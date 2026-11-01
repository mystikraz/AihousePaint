import {
  FloodFillOptions,
  mergeMasksInPlace,
  prepareLabImage,
  floodFillMaskFromPreparedImageAsync,
  RasterMask,
} from './architectural-layer-engine';
import { SegmentationPoint } from './segmentation';

interface InitializeMessage {
  type: 'initialize';
  bitmap: ImageBitmap;
  width: number;
  height: number;
  protectedBuffer: ArrayBuffer;
}

interface SegmentMessage {
  type: 'segment';
  requestId: number;
  points: SegmentationPoint[];
  options: FloodFillOptions;
}

interface CancelMessage {
  type: 'cancel';
  requestId: number;
}

type WorkerRequest = InitializeMessage | SegmentMessage | CancelMessage;

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void;
  postMessage(message: object, transfer?: Transferable[]): void;
}

const workerScope = self as unknown as WorkerScope;
const cancelledRequests = new Set<number>();
const activeRequests = new Set<number>();
let imageWidth = 0;
let imageHeight = 0;
let sourcePixels: Uint8ClampedArray | null = null;
let labImage: Float32Array | null = null;
let protectedPixels: Uint8Array | null = null;

workerScope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'initialize') {
    initializeImage(message);
  } else if (message.type === 'cancel') {
    if (activeRequests.has(message.requestId)) cancelledRequests.add(message.requestId);
  } else {
    void segment(message);
  }
});

function initializeImage(message: InitializeMessage): void {
  try {
    imageWidth = message.width;
    imageHeight = message.height;
    const canvas = new OffscreenCanvas(imageWidth, imageHeight);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The worker could not create an image processing context.');
    context.drawImage(message.bitmap, 0, 0);
    message.bitmap.close();
    sourcePixels = context.getImageData(0, 0, imageWidth, imageHeight).data;
    labImage = prepareLabImage(imageWidth, imageHeight, sourcePixels);
    protectedPixels = new Uint8Array(message.protectedBuffer);
    if (protectedPixels.length !== imageWidth * imageHeight) {
      throw new RangeError('Protected-region mask dimensions do not match the source image.');
    }
    workerScope.postMessage({ type: 'ready' });
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Worker initialization failed.',
    });
  }
}

async function segment(message: SegmentMessage): Promise<void> {
  if (!sourcePixels || !labImage || !protectedPixels) {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: 'Segmentation worker has not loaded the image.',
    });
    return;
  }

  activeRequests.add(message.requestId);
  const startedAt = performance.now();
  try {
    let combined: RasterMask | null = null;
    for (const point of message.points) {
      const current = await floodFillMaskFromPreparedImageAsync(
        imageWidth,
        imageHeight,
        sourcePixels,
        labImage,
        point.x,
        point.y,
        message.options,
        protectedPixels,
        {
          get aborted() {
            return cancelledRequests.has(message.requestId);
          },
        }
      );
      if (!combined) combined = current;
      else mergeMasksInPlace(combined, current);
    }

    if (cancelledRequests.has(message.requestId)) {
      workerScope.postMessage({ type: 'cancelled', requestId: message.requestId });
    } else if (!combined) {
      workerScope.postMessage({
        type: 'error',
        requestId: message.requestId,
        message: 'No positive click was provided for local segmentation.',
      });
    } else {
      workerScope.postMessage({
        type: 'result',
        requestId: message.requestId,
        width: combined.width,
        height: combined.height,
        latencyMs: Math.round(performance.now() - startedAt),
        data: combined.data.buffer,
      }, [combined.data.buffer]);
    }
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : 'Local segmentation failed.',
    });
  } finally {
    cancelledRequests.delete(message.requestId);
    activeRequests.delete(message.requestId);
  }
}
