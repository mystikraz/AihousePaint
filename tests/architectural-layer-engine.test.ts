import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ArchitecturalLayer,
  createEmptyMask,
  fillSmallMaskHoles,
  createRectangleMask,
  createSelectionOverlayData,
  deserializeLayers,
  floodFillMask,
  floodFillMaskFromPreparedImageAsync,
  layersFromPreset,
  mergeMasks,
  paintMaskCircle,
  paintMaskCircleInPlace,
  paintMaskStrokeInPlace,
  renderLayeredImage,
  rasterizePolygonMask,
  prepareLabImage,
  serializeLayers,
  subtractMask,
} from '../lib/architectural-layer-engine';
import { isProtectedNonWallPixel } from '../lib/canvas-recolor';
import { LocalEdgeAwareProvider, WorkerEdgeAwareProvider } from '../lib/segmentation';
import { normalizeArchitecturalCandidates } from '../lib/architectural-decomposition';
const { calculateMaskMetrics } = require('../scripts/segmentation-benchmark.cjs');

class TestImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

Object.assign(globalThis, { ImageData: TestImageData });

function layer(id: string, mask: ReturnType<typeof createEmptyMask>, zIndex: number): ArchitecturalLayer {
  return {
    id,
    parentId: null,
    name: id,
    type: 'manual',
    mask,
    confidence: 1,
    visible: true,
    locked: false,
    selected: false,
    assignedColorId: id,
    zIndex,
    source: 'manual',
  };
}

test('rasterizes preset polygons and respects holes', () => {
  const mask = rasterizePolygonMask(10, 10, [[10, 10], [90, 10], [90, 90], [10, 90]], [
    [[40, 40], [60, 40], [60, 60], [40, 60]],
  ]);
  assert.equal(mask.data[1 * 10 + 1], 255);
  assert.equal(mask.data[5 * 10 + 5], 0);
});

test('creates rectangle selections without including protected pixels', () => {
  const protectedMask = createEmptyMask(5, 4);
  protectedMask.data[1 * 5 + 2] = 255;
  const mask = createRectangleMask(5, 4, 1, 1, 3, 2, protectedMask);
  assert.equal(mask.data[1 * 5 + 1], 255);
  assert.equal(mask.data[1 * 5 + 2], 0);
  assert.equal(mask.data[2 * 5 + 3], 255);
  assert.equal(mask.data[0], 0);
});

test('normalizes AI masks, rejects broad building masks, and gives protected pixels precedence', () => {
  const paintable = createEmptyMask(3, 3);
  paintable.data.fill(255);
  const protectedRegion = createEmptyMask(1, 1);
  protectedRegion.data[0] = 255;
  const broad = createEmptyMask(4, 4);
  broad.data.fill(255);
  const result = normalizeArchitecturalCandidates([
    {
      id: 'wall-1',
      label: 'Ground-floor wall',
      category: 'paintable',
      paintable: true,
      confidence: 0.9,
      bounds: { left: 1, top: 1, right: 4, bottom: 4 },
      mask: paintable,
    },
    {
      id: 'window-1',
      label: 'Window',
      category: 'protected',
      paintable: false,
      confidence: 0.95,
      bounds: { left: 2, top: 2, right: 3, bottom: 3 },
      mask: protectedRegion,
    },
    {
      id: 'building-1',
      label: 'Exterior wall',
      category: 'paintable',
      paintable: true,
      bounds: { left: 0, top: 0, right: 4, bottom: 4 },
      mask: broad,
    },
  ], 4, 4, 'meta-sam', 'sam-3.1');
  assert.equal(result.layers.length, 1);
  assert.equal(result.layers[0].mask.data[2 * 4 + 2], 0);
  assert.equal(result.protectedMask.data[2 * 4 + 2], 255);
  assert.equal(result.layers[0].reviewStatus, 'high-confidence');
  assert.ok(result.warnings.some((warning) => warning.includes('whole-building')));
});

test('converts existing preset zones into independent layers', () => {
  const layers = layersFromPreset([
    {
      id: 'a',
      name: 'A',
      description: '',
      polygon: [[0, 0], [50, 0], [50, 100], [0, 100]],
      defaultColor: '#ffffff',
      defaultCode: 'A',
    },
    {
      id: 'b',
      name: 'B',
      description: '',
      polygon: [[50, 0], [100, 0], [100, 100], [50, 100]],
      defaultColor: '#000000',
      defaultCode: 'B',
    },
  ], 10, 4);
  assert.equal(layers.length, 2);
  assert.notEqual(layers[0].mask.data, layers[1].mask.data);
});

test('highlights selected masks with a visible boundary without covering protected pixels', () => {
  const mask = createEmptyMask(5, 5);
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 3; x++) mask.data[y * 5 + x] = 255;
  }
  const protectedMask = createEmptyMask(5, 5);
  protectedMask.data[2 * 5 + 4] = 255;
  const overlay = createSelectionOverlayData(mask, protectedMask);

  assert.equal(overlay[(2 * 5 + 2) * 4 + 3], 20);
  assert.equal(overlay[(2 * 5 + 1) * 4 + 3], 180);
  assert.equal(overlay[(2 * 5) * 4 + 3], 0);
  assert.equal(overlay[(2 * 5 + 4) * 4 + 3], 0);
});

test('flood fill follows gradual wall texture but stops at strong edges', () => {
  const pixels = new TestImageData(6, 1) as unknown as ImageData;
  pixels.data.set([
    100, 100, 100, 255,
    110, 110, 110, 255,
    120, 120, 120, 255,
    130, 130, 130, 255,
    140, 140, 140, 255,
    220, 220, 220, 255,
  ]);
  const sourceContext = {
    canvas: { width: 6, height: 1 },
    getImageData: () => pixels,
  } as unknown as CanvasRenderingContext2D;

  const mask = floodFillMask(sourceContext, 0, 0, { tolerance: 18 });
  assert.deepEqual(Array.from(mask.data), [255, 255, 255, 255, 255, 0]);
});

test('flood fill does not cross protected pixels', () => {
  const pixels = new TestImageData(5, 1) as unknown as ImageData;
  pixels.data.set([
    100, 100, 100, 255,
    100, 100, 100, 255,
    200, 200, 200, 255,
    100, 100, 100, 255,
    100, 100, 100, 255,
  ]);
  const sourceContext = {
    canvas: { width: 5, height: 1 },
    getImageData: () => pixels,
  } as unknown as CanvasRenderingContext2D;

  const mask = floodFillMask(sourceContext, 0, 0, {
    protectedPredicate: (r) => r === 200,
  });
  assert.deepEqual(Array.from(mask.data), [255, 255, 0, 0, 0]);
});

test('prepared-image segmentation is deterministic and can be cancelled', async () => {
  const pixels = new TestImageData(160, 160) as unknown as ImageData;
  for (let pixel = 0; pixel < 160 * 160; pixel++) {
    pixels.data.set([100, 100, 100, 255], pixel * 4);
  }
  const lab = prepareLabImage(160, 160, pixels.data);
  const sourceContext = {
    canvas: { width: 160, height: 160 },
    getImageData: () => pixels,
  } as unknown as CanvasRenderingContext2D;
  const sync = floodFillMask(sourceContext, 80, 80);
  const asyncMask = await floodFillMaskFromPreparedImageAsync(
    160, 160, pixels.data, lab, 80, 80
  );
  assert.deepEqual(asyncMask.data, sync.data);

  const controller = new AbortController();
  const pending = floodFillMaskFromPreparedImageAsync(
    160, 160, pixels.data, lab, 80, 80, {}, undefined, controller.signal
  );
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(pending, (error: Error) => error.name === 'AbortError');
});

test('local provider advertises supported prompts and respects edge-aware selection', () => {
  const pixels = new TestImageData(3, 1) as unknown as ImageData;
  pixels.data.set([100, 100, 100, 255, 110, 110, 110, 255, 230, 230, 230, 255]);
  const sourceContext = {
    canvas: { width: 3, height: 1 },
    getImageData: () => pixels,
  } as unknown as CanvasRenderingContext2D;
  const provider = new LocalEdgeAwareProvider();

  assert.deepEqual(provider.capabilities, {
    positiveClicks: true,
    negativeClicks: false,
    boundingBox: false,
    localProcessing: true,
  });
  assert.deepEqual(
    Array.from(provider.segmentAtPoint({ sourceContext, x: 0, y: 0, tolerance: 18 }).mask.data),
    [255, 255, 0]
  );
});

test('local provider unions positive clicks and reports unsupported prompts explicitly', () => {
  const pixels = new TestImageData(5, 1) as unknown as ImageData;
  pixels.data.set([
    100, 100, 100, 255,
    100, 100, 100, 255,
    230, 230, 230, 255,
    100, 100, 100, 255,
    100, 100, 100, 255,
  ]);
  const sourceContext = {
    canvas: { width: 5, height: 1 },
    getImageData: () => pixels,
  } as unknown as CanvasRenderingContext2D;
  const provider = new LocalEdgeAwareProvider();

  const result = provider.segmentAtPoint({
    sourceContext,
    x: 0,
    y: 0,
    positivePoints: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
    tolerance: 18,
  });
  assert.deepEqual(Array.from(result.mask.data), [255, 255, 0, 255, 255]);
  assert.throws(() => provider.segmentAtPoint({
    sourceContext,
    x: 0,
    y: 0,
    negativePoints: [{ x: 2, y: 0 }],
  }), /does not support negative click prompts/);
});

test('worker provider clearly reports main-thread fallback when workers are unavailable', async () => {
  const pixels = new TestImageData(2, 1) as unknown as ImageData;
  pixels.data.set([100, 100, 100, 255, 110, 110, 110, 255]);
  const sourceContext = {
    canvas: { width: 2, height: 1 },
    getImageData: () => pixels,
  } as unknown as CanvasRenderingContext2D;
  const provider = new WorkerEdgeAwareProvider();
  const result = await provider.segmentAtPoint({
    sourceContext,
    x: 0,
    y: 0,
    protectedMask: createEmptyMask(2, 1),
  });
  assert.equal(result.method, 'fallback-local-edge-aware');
  assert.match(result.warning ?? '', /main thread/);
  assert.ok(result.latencyMs !== undefined);
});

test('brick-like brown pixels are paintable while vegetation remains protected', () => {
  assert.equal(isProtectedNonWallPixel(150, 85, 55, 0.6), false);
  assert.equal(isProtectedNonWallPixel(35, 95, 40, 0.6), true);
});

test('sky pixels remain protected across the upper half of house photos', () => {
  assert.equal(isProtectedNonWallPixel(145, 180, 220, 0.38), true);
  assert.equal(isProtectedNonWallPixel(210, 214, 216, 0.44), true);
  assert.equal(isProtectedNonWallPixel(150, 85, 55, 0.38), false);
});

test('selection masks can add and subtract segmented regions independently', () => {
  const first = createEmptyMask(4, 1);
  first.data.set([255, 0, 0, 0]);
  const second = createEmptyMask(4, 1);
  second.data.set([0, 255, 255, 0]);

  const merged = mergeMasks(first, second);
  const reduced = subtractMask(merged, second);
  assert.deepEqual(Array.from(merged.data), [255, 255, 255, 0]);
  assert.deepEqual(Array.from(reduced.data), [255, 0, 0, 0]);
  assert.deepEqual(Array.from(first.data), [255, 0, 0, 0]);
});

test('continuous brush strokes fill gaps and do not change their source mask', () => {
  const source = createEmptyMask(12, 5);
  const working = { ...source, data: new Uint8Array(source.data) };
  paintMaskStrokeInPlace(working, 2, 2, 10, 2, 1, 255);
  paintMaskCircleInPlace(working, 10, 2, 1, 0);

  assert.equal(working.data[2 * 12 + 2], 255);
  assert.equal(working.data[2 * 12 + 6], 255);
  assert.equal(working.data[2 * 12 + 10], 0);
  assert.equal(source.data[2 * 12 + 2], 0);
});

test('brush refinement adds and erases only the selected mask', () => {
  const mask = createEmptyMask(9, 9);
  const added = paintMaskCircle(mask, 4, 4, 2);
  const erased = paintMaskCircle(added, 4, 4, 1, 0);
  assert.equal(added.data[4 * 9 + 4], 255);
  assert.equal(erased.data[4 * 9 + 4], 0);
  assert.equal(mask.data[4 * 9 + 4], 0);
});

test('gap repair fills enclosed holes but preserves protected and exterior areas', () => {
  const mask = createEmptyMask(7, 7);
  for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) mask.data[y * 7 + x] = 255;
  mask.data[2 * 7 + 2] = 0;
  mask.data[4 * 7 + 4] = 0;
  const protectedMask = createEmptyMask(7, 7);
  protectedMask.data[4 * 7 + 4] = 255;
  const result = fillSmallMaskHoles(mask, protectedMask);
  assert.equal(result.data[2 * 7 + 2], 255);
  assert.equal(result.data[4 * 7 + 4], 0);
  assert.equal(result.data[0], 0);
  assert.equal(mask.data[2 * 7 + 2], 0);
});

test('brush erase can remove a protected pixel from a mistaken selection', () => {
  const mask = createEmptyMask(3, 1);
  mask.data.fill(255);
  const protectedMask = createEmptyMask(3, 1);
  protectedMask.data[1] = 255;
  paintMaskCircleInPlace(mask, 1, 0, 1, 0, protectedMask);
  assert.deepEqual(Array.from(mask.data), [0, 0, 0]);
});

test('renders independent colours, preserves untouched pixels, and protects regions', () => {
  const source = new TestImageData(3, 1) as unknown as ImageData;
  source.data.set([100, 100, 100, 255, 50, 50, 50, 255, 20, 20, 20, 255]);
  const first = createEmptyMask(3, 1);
  first.data[0] = 255;
  const second = createEmptyMask(3, 1);
  second.data[1] = 255;
  const protectedMask = createEmptyMask(3, 1);
  protectedMask.data[1] = 255;
  const output = renderLayeredImage(
    source,
    [layer('first', first, 0), layer('second', second, 1)],
    {
      first: { colorId: 'first', colorHex: '#ff0000' },
      second: { colorId: 'second', colorHex: '#0000ff' },
    },
    [protectedMask]
  );
  const recoloured = renderLayeredImage(
    source,
    [layer('first', first, 0), layer('second', second, 1)],
    {
      first: { colorId: 'first', colorHex: '#00ff00' },
      second: { colorId: 'second', colorHex: '#0000ff' },
    },
    [protectedMask]
  );
  assert.notDeepEqual(Array.from(output.data.slice(0, 3)), [100, 100, 100]);
  assert.notDeepEqual(Array.from(recoloured.data.slice(0, 3)), Array.from(output.data.slice(0, 3)));
  assert.deepEqual(Array.from(output.data.slice(4, 7)), [50, 50, 50]);
  assert.deepEqual(Array.from(output.data.slice(8, 11)), [20, 20, 20]);
});

test('benchmark reports overlap, boundary, protected leakage, and correction effort', () => {
  const reference = Uint8Array.from([0, 255, 255, 0, 0, 0]);
  const prediction = Uint8Array.from([0, 255, 255, 255, 0, 0]);
  const protectedMask = Uint8Array.from([0, 0, 0, 255, 0, 0]);
  const metrics = calculateMaskMetrics(prediction, reference, 3, 2, protectedMask, 1);
  assert.equal(metrics.iou, 2 / 3);
  assert.equal(metrics.precision, 2 / 3);
  assert.equal(metrics.recall, 1);
  assert.equal(metrics.protectedLeakagePixels, 1);
  assert.equal(metrics.manualCorrectionPixels, 1);
  assert.ok(metrics.boundaryF1 > 0);
});

test('snapshot copies remain independent for undo and redo', () => {
  const original = createEmptyMask(2, 2);
  const snapshot = { ...layer('one', original, 0), mask: { ...original, data: new Uint8Array(original.data) } };
  const edited = paintMaskCircle(snapshot.mask, 0, 0, 1);
  assert.equal(snapshot.mask.data[0], 0);
  assert.equal(edited.data[0], 255);
});

test('layer masks survive save/load serialization', () => {
  const source = layer('saved', createEmptyMask(2, 2), 0);
  source.mask.data[3] = 255;
  const restored = deserializeLayers(serializeLayers([source]))[0];
  assert.equal(restored.id, source.id);
  assert.equal(restored.mask.data[3], 255);
  assert.notEqual(restored.mask.data, source.mask.data);
});
