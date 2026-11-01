import {
  FloodFillOptions,
  RasterMask,
  floodFillMaskFromPreparedImage,
  mergeMasksInPlace,
  prepareLabImage,
} from './architectural-layer-engine';

export interface SegmentationPoint {
  x: number;
  y: number;
}

export interface SegmentationBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SegmentationProviderCapabilities {
  positiveClicks: boolean;
  negativeClicks: boolean;
  boundingBox: boolean;
  localProcessing: boolean;
}

export interface SegmentationRequest {
  sourceContext: CanvasRenderingContext2D;
  x: number;
  y: number;
  positivePoints?: SegmentationPoint[];
  negativePoints?: SegmentationPoint[];
  boundingBox?: SegmentationBox;
  protectedMask?: RasterMask;
  signal?: AbortSignal;
  tolerance?: number;
  edgeThreshold?: number;
  protectedPredicate?: (r: number, g: number, b: number, yRatio: number) => boolean;
}

export interface SegmentationResult {
  mask: RasterMask;
  method: 'local-edge-aware' | 'worker-edge-aware' | 'fallback-local-edge-aware';
  latencyMs?: number;
  processingLatencyMs?: number;
  warning?: string;
}

interface WorkerReadyMessage {
  type: 'ready' | 'error';
  message?: string;
}

interface WorkerResultMessage {
  type: 'result' | 'error' | 'cancelled';
  requestId: number;
  width?: number;
  height?: number;
  latencyMs?: number;
  data?: ArrayBuffer;
  message?: string;
}

export interface ArchitecturalSegmentationProvider {
  readonly capabilities: SegmentationProviderCapabilities;
  segmentAtPoint(request: SegmentationRequest): Promise<SegmentationResult> | SegmentationResult;
}

/** Local, click-guided region growing with perceptual colour and boundary constraints. */
export class LocalEdgeAwareProvider implements ArchitecturalSegmentationProvider {
  readonly capabilities: SegmentationProviderCapabilities = {
    positiveClicks: true,
    negativeClicks: false,
    boundingBox: false,
    localProcessing: true,
  };

  segmentAtPoint({
    sourceContext,
    x,
    y,
    positivePoints,
    negativePoints,
    boundingBox,
    protectedMask: suppliedProtectedMask,
    signal,
    tolerance = 32,
    edgeThreshold,
    protectedPredicate,
  }: SegmentationRequest): SegmentationResult {
    if (negativePoints?.length) {
      throw new Error('The local edge-aware provider does not support negative click prompts.');
    }
    if (boundingBox) {
      throw new Error('The local edge-aware provider does not support bounding-box prompts.');
    }
    const points = positivePoints?.length ? positivePoints : [{ x, y }];
    const width = sourceContext.canvas.width;
    const height = sourceContext.canvas.height;
    const source = sourceContext.getImageData(0, 0, width, height).data;
    const lab = prepareLabImage(width, height, source);
    let protectedMask = suppliedProtectedMask
      ? new Uint8Array(suppliedProtectedMask.data)
      : undefined;
    if (protectedMask && (
      suppliedProtectedMask?.width !== width ||
      suppliedProtectedMask?.height !== height ||
      protectedMask.length !== width * height
    )) {
      throw new RangeError('Protected mask dimensions do not match the source image.');
    }
    if (protectedPredicate) {
      const derivedMask = new Uint8Array(width * height);
      for (let pixel = 0; pixel < derivedMask.length; pixel++) {
        const index = pixel * 4;
        if (protectedPredicate(
          source[index],
          source[index + 1],
          source[index + 2],
          Math.floor(pixel / width) / height
        )) derivedMask[pixel] = 255;
      }
      if (protectedMask) {
        for (let pixel = 0; pixel < protectedMask.length; pixel++) {
          if (derivedMask[pixel]) protectedMask[pixel] = 255;
        }
      } else {
        protectedMask = derivedMask;
      }
    }
    let mask: RasterMask | null = null;
    for (const point of points) {
      if (signal?.aborted) {
        const error = new Error('Segmentation request was cancelled.');
        error.name = 'AbortError';
        throw error;
      }
      const region = floodFillMaskFromPreparedImage(width, height, source, lab, point.x, point.y, {
        tolerance,
        edgeThreshold,
      }, protectedMask);
      if (!mask) mask = region;
      else mergeMasksInPlace(mask, region);
    }
    if (!mask) throw new Error('No positive click was provided for local segmentation.');
    return { mask, method: 'local-edge-aware' };
  }
}

export class WorkerEdgeAwareProvider implements ArchitecturalSegmentationProvider {
  readonly capabilities: SegmentationProviderCapabilities = {
    positiveClicks: true,
    negativeClicks: false,
    boundingBox: false,
    localProcessing: true,
  };

  private readonly fallback = new LocalEdgeAwareProvider();
  private readonly createWorker: (() => Worker) | null;
  private worker: Worker | null = null;
  private imageCanvas: HTMLCanvasElement | null = null;
  private readyPromise: Promise<void> | null = null;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (message: WorkerResultMessage) => void;
    reject: (error: Error) => void;
  }>();
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;

  constructor(createWorker?: () => Worker) {
    this.createWorker = createWorker ?? null;
  }

  async segmentAtPoint(request: SegmentationRequest): Promise<SegmentationResult> {
    const startedAt = performance.now();
    if (request.negativePoints?.length || request.boundingBox) {
      return this.fallback.segmentAtPoint(request);
    }
    if (!request.protectedMask && request.protectedPredicate) {
      return {
        ...this.fallback.segmentAtPoint(request),
        method: 'fallback-local-edge-aware',
        warning: 'The worker requires a raster protected mask; selection ran on the main thread.',
      };
    }
    if (!this.createWorker || typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') {
      const result = this.fallback.segmentAtPoint(request);
      return {
        ...result,
        method: 'fallback-local-edge-aware',
        latencyMs: Math.round(performance.now() - startedAt),
        warning: 'Web Worker support is unavailable; selection ran on the main thread.',
      };
    }

    try {
      await this.ensureWorker(request.sourceContext.canvas, request.protectedMask);
      if (request.signal?.aborted) {
        const cancelled = new Error('Segmentation request was cancelled.');
        cancelled.name = 'AbortError';
        throw cancelled;
      }
      const result = await this.requestWorkerSegmentation(request);
      if (result.type !== 'result' || !result.data || result.width === undefined || result.height === undefined) {
        throw new Error(result.message ?? 'Worker returned an incomplete segmentation mask.');
      }
      return {
        mask: {
          width: result.width,
          height: result.height,
          data: new Uint8Array(result.data),
        },
        method: 'worker-edge-aware',
        latencyMs: Math.round(performance.now() - startedAt),
        processingLatencyMs: result.latencyMs,
      };
    } catch (error) {
      if (request.signal?.aborted) {
        const cancelled = new Error('Segmentation request was cancelled.');
        cancelled.name = 'AbortError';
        throw cancelled;
      }
      this.dispose();
      const localResult = this.fallback.segmentAtPoint(request);
      return {
        ...localResult,
        method: 'fallback-local-edge-aware',
        latencyMs: Math.round(performance.now() - startedAt),
        warning: `Worker segmentation failed; used main-thread fallback: ${
          error instanceof Error ? error.message : 'unknown worker error'
        }`,
      };
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.imageCanvas = null;
    this.readyPromise = null;
    this.readyReject?.(new Error('Segmentation worker disposed.'));
    this.readyResolve = null;
    this.readyReject = null;
    for (const request of this.pending.values()) request.reject(new Error('Segmentation worker disposed.'));
    this.pending.clear();
  }

  private async ensureWorker(canvas: HTMLCanvasElement, protectedMask?: RasterMask): Promise<void> {
    if (this.worker && this.imageCanvas === canvas && this.readyPromise) {
      return this.readyPromise;
    }
    this.dispose();
    const worker = this.createWorker!();
    this.worker = worker;
    this.imageCanvas = canvas;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    worker.onmessage = (event: MessageEvent<WorkerReadyMessage | WorkerResultMessage>) => {
      const message = event.data;
      if (message.type === 'ready') {
        this.readyResolve?.();
        this.readyResolve = null;
        this.readyReject = null;
      } else if (message.type === 'result' || message.type === 'cancelled') {
        const pending = this.pending.get(message.requestId);
        if (!pending) return;
        this.pending.delete(message.requestId);
        pending.resolve(message);
      } else if (message.type === 'error') {
        const error = new Error(message.message ?? 'Segmentation worker failed.');
        if ('requestId' in message) {
          const pending = this.pending.get(message.requestId);
          if (pending) {
            this.pending.delete(message.requestId);
            pending.reject(error);
          }
        } else {
          this.readyReject?.(error);
          this.readyResolve = null;
          this.readyReject = null;
        }
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Segmentation worker failed.');
      if (this.worker === worker) {
        this.worker = null;
        this.imageCanvas = null;
        this.readyPromise = null;
      }
      this.readyReject?.(error);
      this.readyResolve = null;
      this.readyReject = null;
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
    const bitmap = await createImageBitmap(canvas);
    if (this.worker !== worker) {
      bitmap.close();
      throw new Error('Segmentation worker was replaced before image initialization.');
    }
    const protectedData = protectedMask
      ? new Uint8Array(protectedMask.data)
      : new Uint8Array(canvas.width * canvas.height);
    if (
      protectedMask &&
      (
        protectedMask.width !== canvas.width ||
        protectedMask.height !== canvas.height ||
        protectedData.length !== canvas.width * canvas.height
      )
    ) {
      bitmap.close();
      throw new RangeError('Protected mask dimensions do not match the source image.');
    }
    worker.postMessage({
      type: 'initialize',
      bitmap,
      width: canvas.width,
      height: canvas.height,
      protectedBuffer: protectedData.buffer,
    }, [bitmap, protectedData.buffer]);
    return this.readyPromise;
  }

  private requestWorkerSegmentation(request: SegmentationRequest): Promise<WorkerResultMessage> {
    if (!this.worker) return Promise.reject(new Error('Segmentation worker is not initialized.'));
    const requestId = ++this.requestId;
    return new Promise<WorkerResultMessage>((resolve, reject) => {
      const abort = () => {
        this.worker?.postMessage({ type: 'cancel', requestId });
      };
      request.signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(requestId, {
        resolve: (message) => {
          request.signal?.removeEventListener('abort', abort);
          if (message.type === 'cancelled') {
            const error = new Error('Segmentation request was cancelled.');
            error.name = 'AbortError';
            reject(error);
          } else {
            resolve(message);
          }
        },
        reject: (error) => {
          request.signal?.removeEventListener('abort', abort);
          reject(error);
        },
      });
      this.worker!.postMessage({
        type: 'segment',
        requestId,
        points: request.positivePoints?.length
          ? request.positivePoints
          : [{ x: request.x, y: request.y }],
        options: {
          tolerance: request.tolerance,
          edgeThreshold: request.edgeThreshold,
        } satisfies FloodFillOptions,
      });
    });
  }
}

/** @deprecated Use LocalEdgeAwareProvider for the improved local selection algorithm. */
export class FloodFillSegmentationProvider extends LocalEdgeAwareProvider {}
