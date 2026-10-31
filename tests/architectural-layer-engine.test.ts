import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ArchitecturalLayer,
  createEmptyMask,
  deserializeLayers,
  layersFromPreset,
  paintMaskCircle,
  renderLayeredImage,
  rasterizePolygonMask,
  serializeLayers,
} from '../lib/architectural-layer-engine';

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

test('brush refinement adds and erases only the selected mask', () => {
  const mask = createEmptyMask(9, 9);
  const added = paintMaskCircle(mask, 4, 4, 2);
  const erased = paintMaskCircle(added, 4, 4, 1, 0);
  assert.equal(added.data[4 * 9 + 4], 255);
  assert.equal(erased.data[4 * 9 + 4], 0);
  assert.equal(mask.data[4 * 9 + 4], 0);
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
  assert.notDeepEqual(Array.from(output.data.slice(0, 3)), [100, 100, 100]);
  assert.deepEqual(Array.from(output.data.slice(4, 7)), [50, 50, 50]);
  assert.deepEqual(Array.from(output.data.slice(8, 11)), [20, 20, 20]);
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
