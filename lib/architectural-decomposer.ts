import OpenAI from 'openai';
import {
  decodeMaskToRaster,
  parseImageStream,
  recordsOfKind,
} from '@meta-sam/parser';
import {
  ARCHITECTURAL_CONCEPTS,
  ArchitecturalDecompositionResult,
  DecompositionCandidate,
  normalizeArchitecturalCandidates,
} from './architectural-decomposition';

export interface ArchitecturalDecomposerRequest {
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  signal?: AbortSignal;
}

export interface ArchitecturalDecomposer {
  readonly provider: string;
  decompose(request: ArchitecturalDecomposerRequest): Promise<ArchitecturalDecompositionResult>;
}

export class DecompositionStageError extends Error {
  constructor(readonly stage: string, readonly concept: string | undefined, readonly originalError: unknown) {
    super('Architectural decomposition failed.');
    this.name = 'DecompositionStageError';
  }
}

export class SamConceptProvider implements ArchitecturalDecomposer {
  readonly provider = 'meta-sam';
  readonly modelVersion = 'sam-3.1';
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: 'https://api.meta.ai/v1',
      apiKey,
      timeout: 25_000,
    });
  }

  async decompose({ imageDataUrl, imageWidth, imageHeight, signal }: ArchitecturalDecomposerRequest) {
    const candidates: DecompositionCandidate[] = [];
    const warnings: string[] = [];

    for (const concept of ARCHITECTURAL_CONCEPTS) {
      if (signal?.aborted) throw new DOMException('Decomposition cancelled.', 'AbortError');
      let stage = 'provider_request';
      try {
      const events = await this.client.responses.create({
        model: this.modelVersion,
        input: [{
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: concept.prompt },
            { type: 'input_image', image_url: imageDataUrl, detail: 'auto' },
          ],
        }],
        stream: true,
        metadata: {
          mask_encoding: 'one_bit',
          include_confidence: 'true',
        },
      }, { signal });
      stage = 'response_parsing';
      const parsed = parseImageStream(events);
      const result = await parsed.finalResult;
      if (result.outcome.status !== 'completed') {
        warnings.push(`${concept.label} segmentation ended before completion.`);
      }
      if (result.diagnostics.length) {
        warnings.push(`${concept.label} returned ${result.diagnostics.length} parser diagnostic(s).`);
      }

      const boxRecords = recordsOfKind(result.records, 'box');
      const maskRecords = recordsOfKind(result.records, 'mask');
      for (const maskRecord of maskRecords) {
        const box = boxRecords.find((candidate) => candidate.objectId === maskRecord.objectId);
        if (!box) {
          warnings.push(`${concept.label} returned a mask without a matching box.`);
          continue;
        }
        const raster = decodeMaskToRaster(maskRecord.mask);
        candidates.push({
          id: `${concept.prompt.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${maskRecord.objectId}`,
          label: concept.label,
          category: concept.category,
          paintable: concept.paintable,
          confidence: maskRecord.confidence ?? box.confidence,
          bounds: {
            left: maskRecord.bounds.left,
            top: maskRecord.bounds.top,
            right: maskRecord.bounds.right,
            bottom: maskRecord.bounds.bottom,
          },
          mask: {
            width: maskRecord.mask.width,
            height: maskRecord.mask.height,
            data: raster,
          },
        });
      }
      } catch (error) {
        throw new DecompositionStageError(stage, concept.prompt, error);
      }
    }

    try {
    const normalized = normalizeArchitecturalCandidates(
      candidates,
      imageWidth,
      imageHeight,
      this.provider,
      this.modelVersion
    );
    return { ...normalized, warnings: [...warnings, ...normalized.warnings] };
    } catch (error) {
      throw new DecompositionStageError('mask_normalization', undefined, error);
    }
  }
}

export class GeminiSegmentationProvider implements ArchitecturalDecomposer {
  readonly provider = 'gemini-segmentation';

  async decompose(): Promise<ArchitecturalDecompositionResult> {
    throw new Error('Gemini segmentation provider is not enabled in this increment.');
  }
}

export class LocalFallbackProvider implements ArchitecturalDecomposer {
  readonly provider = 'local-fallback';

  async decompose({ imageWidth, imageHeight }: ArchitecturalDecomposerRequest): Promise<ArchitecturalDecompositionResult> {
    return {
      imageWidth,
      imageHeight,
      layers: [],
      protectedMask: { width: imageWidth, height: imageHeight, data: new Uint8Array(imageWidth * imageHeight) },
      provider: this.provider,
      modelVersion: 'existing-local-provider',
      warnings: ['Automatic decomposition is unavailable; use manual local selection.'],
    };
  }
}
