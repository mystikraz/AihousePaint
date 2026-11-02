import {
  ArchitecturalLayer,
  ArchitecturalLayerCategory,
  ArchitecturalLayerReviewStatus,
  RasterMask,
  SerializedArchitecturalLayer,
  SerializedRasterMask,
  createEmptyMask,
  serializeLayers,
  serializeMask,
} from './architectural-layer-engine';

export interface ArchitecturalConcept {
  prompt: string;
  label: string;
  category: ArchitecturalLayerCategory;
  paintable: boolean;
}

export const ARCHITECTURAL_CONCEPTS: readonly ArchitecturalConcept[] = [
  { prompt: 'exterior wall', label: 'Exterior wall', category: 'paintable', paintable: true },
  { prompt: 'ground-floor wall', label: 'Ground-floor wall', category: 'paintable', paintable: true },
  { prompt: 'upper-floor wall', label: 'Upper-floor wall', category: 'paintable', paintable: true },
  { prompt: 'balcony wall', label: 'Balcony wall', category: 'paintable', paintable: true },
  { prompt: 'pillar', label: 'Pillar', category: 'paintable', paintable: true },
  { prompt: 'column', label: 'Column', category: 'paintable', paintable: true },
  { prompt: 'decorative wall panel', label: 'Decorative wall panel', category: 'paintable', paintable: true },
  { prompt: 'parapet wall', label: 'Parapet wall', category: 'paintable', paintable: true },
  { prompt: 'cornice', label: 'Cornice', category: 'paintable', paintable: true },
  { prompt: 'window', label: 'Window', category: 'protected', paintable: false },
  { prompt: 'door', label: 'Door', category: 'protected', paintable: false },
  { prompt: 'railing', label: 'Railing', category: 'protected', paintable: false },
  { prompt: 'roof', label: 'Roof', category: 'protected', paintable: false },
  { prompt: 'vegetation', label: 'Vegetation', category: 'protected', paintable: false },
  { prompt: 'vehicle', label: 'Vehicle', category: 'protected', paintable: false },
  { prompt: 'sky', label: 'Sky', category: 'protected', paintable: false },
];

export interface DecompositionCandidate {
  id: string;
  label: string;
  category: ArchitecturalLayerCategory;
  paintable: boolean;
  confidence?: number;
  bounds: { left: number; top: number; right: number; bottom: number };
  mask: RasterMask;
}

export interface ArchitecturalDecompositionResult {
  imageWidth: number;
  imageHeight: number;
  layers: ArchitecturalLayer[];
  protectedMask: RasterMask;
  provider: string;
  modelVersion: string;
  warnings: string[];
}

export interface SerializedArchitecturalDecomposition {
  imageWidth: number;
  imageHeight: number;
  layers: SerializedArchitecturalLayer[];
  protectedMask: SerializedRasterMask;
  provider: string;
  modelVersion: string;
  warnings: string[];
}

export function validateImageDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('The decomposition image dimensions are invalid.');
  }
  createEmptyMask(width, height);
}

function validateCandidate(candidate: DecompositionCandidate, width: number, height: number): void {
  if (!candidate.id || !candidate.label) throw new Error('A decomposition candidate is missing an identifier or label.');
  if (candidate.mask.data.length !== candidate.mask.width * candidate.mask.height) {
    throw new RangeError(`Mask for ${candidate.label} is malformed.`);
  }
  const { left, top, right, bottom } = candidate.bounds;
  if (
    ![left, top, right, bottom].every(Number.isFinite) ||
    left < 0 || top < 0 || right > width || bottom > height ||
    right <= left || bottom <= top
  ) throw new RangeError(`Bounds for ${candidate.label} are outside the source image.`);
}

function maskArea(mask: RasterMask): number {
  let area = 0;
  for (const value of mask.data) if (value) area++;
  return area;
}

export function normalizeArchitecturalCandidates(
  candidates: DecompositionCandidate[],
  width: number,
  height: number,
  provider: string,
  modelVersion: string
): ArchitecturalDecompositionResult {
  validateImageDimensions(width, height);
  const protectedMask = createEmptyMask(width, height);
  const warnings: string[] = [];
  const accepted: DecompositionCandidate[] = [];

  for (const candidate of candidates) {
    validateCandidate(candidate, width, height);
    const areaRatio = maskArea(candidate.mask) / (candidate.mask.width * candidate.mask.height);
    const boxRatio = ((candidate.bounds.right - candidate.bounds.left) * (candidate.bounds.bottom - candidate.bounds.top)) / (width * height);
    if (candidate.paintable && candidate.label.toLowerCase().includes('exterior wall') && boxRatio > 0.75) {
      warnings.push(`Rejected broad whole-building mask for ${candidate.label}.`);
      continue;
    }
    if (areaRatio === 0) continue;
    accepted.push(candidate);
  }

  // Protected output has deterministic precedence over every paintable mask.
  for (const candidate of accepted.filter((item) => !item.paintable)) {
    const { left, top } = candidate.bounds;
    for (let y = 0; y < candidate.mask.height; y++) {
      for (let x = 0; x < candidate.mask.width; x++) {
        if (candidate.mask.data[y * candidate.mask.width + x]) {
          const targetX = left + x;
          const targetY = top + y;
          if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
            protectedMask.data[targetY * width + targetX] = 255;
          }
        }
      }
    }
  }

  const layers: ArchitecturalLayer[] = [];
  for (const [index, candidate] of accepted.filter((item) => item.paintable).entries()) {
    const mask = createEmptyMask(width, height);
    const { left, top } = candidate.bounds;
    for (let y = 0; y < candidate.mask.height; y++) {
      for (let x = 0; x < candidate.mask.width; x++) {
        const sourcePixel = y * candidate.mask.width + x;
        const targetX = left + x;
        const targetY = top + y;
        if (
          candidate.mask.data[sourcePixel] &&
          targetX >= 0 && targetX < width && targetY >= 0 && targetY < height &&
          !protectedMask.data[targetY * width + targetX]
        ) mask.data[targetY * width + targetX] = 255;
      }
    }
    if (!mask.data.some(Boolean)) continue;
    const confidence = candidate.confidence;
    const reviewStatus: ArchitecturalLayerReviewStatus =
      confidence === undefined ? 'needs-review' : confidence >= 0.8 ? 'high-confidence' : 'low-confidence';
    layers.push({
      id: `ai-${candidate.id}-${index}`,
      parentId: null,
      name: candidate.label,
      type: 'surface',
      mask,
      confidence: confidence ?? 0,
      visible: true,
      locked: false,
      selected: false,
      assignedColorId: null,
      zIndex: index,
      source: 'AI',
      category: candidate.category,
      semanticLabel: candidate.label,
      reviewStatus,
      modelProvider: provider,
      modelVersion,
      detectionId: candidate.id,
    });
  }

  return { imageWidth: width, imageHeight: height, layers, protectedMask, provider, modelVersion, warnings };
}

export function serializeArchitecturalDecomposition(
  result: ArchitecturalDecompositionResult
): SerializedArchitecturalDecomposition {
  return {
    imageWidth: result.imageWidth,
    imageHeight: result.imageHeight,
    layers: serializeLayers(result.layers),
    protectedMask: serializeMask(result.protectedMask),
    provider: result.provider,
    modelVersion: result.modelVersion,
    warnings: result.warnings,
  };
}
