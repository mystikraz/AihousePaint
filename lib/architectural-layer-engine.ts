import { ArchitecturalZone } from './architectural-presets';

export type ArchitecturalLayerType =
  | 'surface'
  | 'protected'
  | 'manual'
  | 'preset';

export type LayerSource = 'preset' | 'AI' | 'manual';

export type ArchitecturalLayerCategory = 'paintable' | 'protected' | 'unknown';
export type ArchitecturalLayerReviewStatus =
  | 'high-confidence'
  | 'low-confidence'
  | 'needs-review'
  | 'accepted';

export interface RasterMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export const MAX_WORKING_MASK_PIXELS = 2_000_000;

export interface SerializedRasterMask {
  width: number;
  height: number;
  data: string;
}

export interface LayerColourAssignment {
  colorId: string;
  colorHex: string;
  colorCode?: string;
}

export interface ArchitecturalLayer {
  id: string;
  parentId: string | null;
  name: string;
  type: ArchitecturalLayerType;
  mask: RasterMask;
  confidence: number;
  visible: boolean;
  locked: boolean;
  selected: boolean;
  assignedColorId: string | null;
  zIndex: number;
  source: LayerSource;
  category?: ArchitecturalLayerCategory;
  semanticLabel?: string;
  reviewStatus?: ArchitecturalLayerReviewStatus;
  modelProvider?: string;
  modelVersion?: string;
  /** Explicitly drawn areas can include pixels automatically marked protected. */
  overrideProtected?: boolean;
  detectionId?: string;
}

export interface HouseProjectSnapshot {
  layers: ArchitecturalLayer[];
  protectedMasks: RasterMask[];
}

export interface HouseProject {
  originalImageRef: string;
  layers: ArchitecturalLayer[];
  protectedMasks: RasterMask[];
  colourAssignments: Record<string, LayerColourAssignment>;
  renderHistory: HouseProjectSnapshot[];
  currentRenderedOutput: ImageData | null;
}

export interface FloodFillOptions {
  tolerance?: number;
  edgeThreshold?: number;
  maxSeedColorDifference?: number;
  protectedPredicate?: (r: number, g: number, b: number, yRatio: number) => boolean;
}

export function createEmptyMask(width: number, height: number): RasterMask {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_WORKING_MASK_PIXELS
  ) {
    throw new RangeError(`Mask dimensions exceed the ${MAX_WORKING_MASK_PIXELS.toLocaleString()} pixel working limit.`);
  }
  return { width, height, data: new Uint8Array(width * height) };
}

export function createRectangleMask(
  width: number,
  height: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  protectedMask?: RasterMask
): RasterMask {
  const mask = createEmptyMask(width, height);
  if (protectedMask && (
    protectedMask.width !== width ||
    protectedMask.height !== height ||
    protectedMask.data.length !== mask.data.length
  )) {
    throw new RangeError('Protected mask dimensions do not match the rectangle selection.');
  }

  const left = Math.max(0, Math.min(width, Math.floor(Math.min(startX, endX))));
  const right = Math.max(0, Math.min(width, Math.ceil(Math.max(startX, endX)) + 1));
  const top = Math.max(0, Math.min(height, Math.floor(Math.min(startY, endY))));
  const bottom = Math.max(0, Math.min(height, Math.ceil(Math.max(startY, endY)) + 1));
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const pixel = y * width + x;
      if (!protectedMask?.data[pixel]) mask.data[pixel] = 255;
    }
  }
  return mask;
}

export function createSelectionOverlayData(
  mask: RasterMask,
  protectedMask?: RasterMask
): Uint8ClampedArray {
  const pixelCount = mask.width * mask.height;
  if (mask.data.length !== pixelCount) {
    throw new RangeError('Cannot highlight a malformed architectural mask.');
  }
  if (
    protectedMask &&
    (
      protectedMask.width !== mask.width ||
      protectedMask.height !== mask.height ||
      protectedMask.data.length !== pixelCount
    )
  ) {
    throw new RangeError('Protected mask dimensions do not match the selected area.');
  }

  const overlay = new Uint8ClampedArray(pixelCount * 4);
  const isSelected = (pixel: number) =>
    mask.data[pixel] !== 0 && !protectedMask?.data[pixel];

  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const x = pixel % mask.width;
    const y = Math.floor(pixel / mask.width);
    const selected = isSelected(pixel);
    const hasUnselectedNeighbour =
      (x === 0 || !isSelected(pixel - 1)) ||
      (x === mask.width - 1 || !isSelected(pixel + 1)) ||
      (y === 0 || !isSelected(pixel - mask.width)) ||
      (y === mask.height - 1 || !isSelected(pixel + mask.width));

    if (selected) {
      const index = pixel * 4;
      if (hasUnselectedNeighbour) {
        overlay[index] = 15;
        overlay[index + 1] = 23;
        overlay[index + 2] = 42;
        overlay[index + 3] = 180;
      } else {
        overlay[index] = 255;
        overlay[index + 1] = 191;
        overlay[index + 2] = 71;
        overlay[index + 3] = 20;
      }
    }
  }

  return overlay;
}

export function cloneMask(mask: RasterMask): RasterMask {
  if (mask.data.length !== mask.width * mask.height) {
    throw new RangeError('Cannot clone a malformed architectural mask.');
  }
  return { width: mask.width, height: mask.height, data: new Uint8Array(mask.data) };
}

export function cloneLayer(layer: ArchitecturalLayer): ArchitecturalLayer {
  return { ...layer, mask: cloneMask(layer.mask) };
}

export function cloneLayers(layers: ArchitecturalLayer[]): ArchitecturalLayer[] {
  return layers.map(cloneLayer);
}

export function serializeMask(mask: RasterMask): SerializedRasterMask {
  let binary = '';
  for (const value of mask.data) binary += String.fromCharCode(value);
  return {
    width: mask.width,
    height: mask.height,
    data: typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(mask.data).toString('base64'),
  };
}

export function deserializeMask(serialized: SerializedRasterMask): RasterMask {
  const mask = createEmptyMask(serialized.width, serialized.height);
  const binary = typeof atob === 'function'
    ? atob(serialized.data)
    : Buffer.from(serialized.data, 'base64').toString('binary');
  if (binary.length !== mask.data.length) {
    throw new RangeError('Cannot restore a malformed architectural mask.');
  }
  for (let i = 0; i < binary.length; i++) mask.data[i] = binary.charCodeAt(i);
  return mask;
}

export interface SerializedArchitecturalLayer extends Omit<ArchitecturalLayer, 'mask'> {
  mask: SerializedRasterMask;
}

export function serializeLayers(layers: ArchitecturalLayer[]): SerializedArchitecturalLayer[] {
  return layers.map((layer) => ({ ...layer, mask: serializeMask(layer.mask) }));
}

export function deserializeLayers(layers: SerializedArchitecturalLayer[]): ArchitecturalLayer[] {
  return layers.map((layer) => ({ ...layer, mask: deserializeMask(layer.mask) }));
}

export function rasterizePolygonMask(
  width: number,
  height: number,
  polygon: [number, number][],
  holes: [number, number][][] = []
): RasterMask {
  const mask = createEmptyMask(width, height);
  if (polygon.length < 3) return mask;

  const pointInPolygon = (x: number, y: number, points: [number, number][]) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      const intersects =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  };

  let minX = 100;
  let maxX = 0;
  let minY = 100;
  let maxY = 0;
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const startX = Math.max(0, Math.floor((minX / 100) * width));
  const endX = Math.min(width - 1, Math.ceil((maxX / 100) * width));
  const startY = Math.max(0, Math.floor((minY / 100) * height));
  const endY = Math.min(height - 1, Math.ceil((maxY / 100) * height));

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const xPercent = ((x + 0.5) / width) * 100;
      const yPercent = ((y + 0.5) / height) * 100;
      if (
        pointInPolygon(xPercent, yPercent, polygon) &&
        !holes.some((hole) => pointInPolygon(xPercent, yPercent, hole))
      ) {
        mask.data[y * width + x] = 255;
      }
    }
  }

  return mask;
}

export function layerFromPresetZone(
  zone: ArchitecturalZone,
  width: number,
  height: number,
  index: number
): ArchitecturalLayer {
  return {
    id: zone.id,
    parentId: null,
    name: zone.name,
    type: 'preset',
    mask: rasterizePolygonMask(width, height, zone.polygon, zone.holes),
    confidence: 1,
    visible: true,
    locked: false,
    selected: false,
    assignedColorId: zone.defaultCode,
    zIndex: index,
    source: 'preset',
  };
}

export function layersFromPreset(
  zones: ArchitecturalZone[],
  width: number,
  height: number
): ArchitecturalLayer[] {
  return zones.map((zone, index) => layerFromPresetZone(zone, width, height, index));
}

export function combineMasks(masks: RasterMask[]): RasterMask | null {
  if (masks.length === 0) return null;
  const result = createEmptyMask(masks[0].width, masks[0].height);
  for (const mask of masks) {
    if (mask.width !== result.width || mask.height !== result.height) continue;
    for (let i = 0; i < result.data.length; i++) {
      result.data[i] = Math.max(result.data[i], mask.data[i]);
    }
  }
  return result;
}

export function mergeMasks(first: RasterMask, second: RasterMask): RasterMask {
  if (first.width !== second.width || first.height !== second.height) {
    throw new RangeError('Cannot merge architectural masks with different dimensions.');
  }
  const result = cloneMask(first);
  for (let pixel = 0; pixel < result.data.length; pixel++) {
    result.data[pixel] = Math.max(result.data[pixel], second.data[pixel]);
  }
  return result;
}

export function mergeMasksInPlace(target: RasterMask, source: RasterMask): void {
  if (target.width !== source.width || target.height !== source.height) {
    throw new RangeError('Cannot merge architectural masks with different dimensions.');
  }
  for (let pixel = 0; pixel < target.data.length; pixel++) {
    target.data[pixel] = Math.max(target.data[pixel], source.data[pixel]);
  }
}

export function subtractMask(source: RasterMask, removed: RasterMask): RasterMask {
  if (source.width !== removed.width || source.height !== removed.height) {
    throw new RangeError('Cannot subtract architectural masks with different dimensions.');
  }
  const result = cloneMask(source);
  for (let pixel = 0; pixel < result.data.length; pixel++) {
    if (removed.data[pixel]) result.data[pixel] = 0;
  }
  return result;
}

/** Fill small enclosed gaps without changing protected pixels or exterior regions. */
export function fillSmallMaskHoles(source: RasterMask, protectedMask?: RasterMask): RasterMask {
  const { width, height, data } = source;
  if (data.length !== width * height || (protectedMask &&
    (protectedMask.width !== width || protectedMask.height !== height || protectedMask.data.length !== data.length))) {
    throw new RangeError('Mask dimensions do not match.');
  }
  const result = cloneMask(source);
  const visited = new Uint8Array(data.length);
  const queue = new Int32Array(data.length);
  const maxHole = Math.max(4, Math.min(4096, Math.floor(data.length * 0.001)));
  for (let start = 0; start < data.length; start++) {
    if (data[start] || visited[start]) continue;
    let head = 0, tail = 0;
    let touchesEdge = false, touchesProtected = false;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width, y = Math.floor(pixel / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      if (protectedMask?.data[pixel]) touchesProtected = true;
      const neighbours = [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1];
      for (const next of neighbours) {
        if (next >= 0 && !data[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (!touchesEdge && !touchesProtected && tail <= maxHole) {
      for (let i = 0; i < tail; i++) result.data[queue[i]] = 255;
    }
  }
  return result;
}

export function paintMaskCircleInPlace(
  mask: RasterMask,
  centerX: number,
  centerY: number,
  radius: number,
  value = 255,
  protectedMask?: RasterMask
): void {
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(mask.width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(mask.height - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const pixel = y * mask.width + x;
      if (
        dx * dx + dy * dy <= radiusSquared &&
        (value === 0 || !protectedMask?.data[pixel])
      ) {
        mask.data[pixel] = value;
      }
    }
  }
}

export function paintMaskStrokeInPlace(
  mask: RasterMask,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  radius: number,
  value = 255,
  protectedMask?: RasterMask
): void {
  const distance = Math.hypot(endX - startX, endY - startY);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.4)));
  for (let step = 1; step <= steps; step++) {
    const ratio = step / steps;
    paintMaskCircleInPlace(
      mask,
      startX + (endX - startX) * ratio,
      startY + (endY - startY) * ratio,
      radius,
      value,
      protectedMask
    );
  }
}

export function paintMaskCircle(
  mask: RasterMask,
  centerX: number,
  centerY: number,
  radius: number,
  value = 255,
  protectedMask?: RasterMask
): RasterMask {
  const next = cloneMask(mask);
  paintMaskCircleInPlace(next, centerX, centerY, radius, value, protectedMask);
  return next;
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);
  const x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047;
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z = (red * 0.0193339 + green * 0.119192 + blue * 0.9503041) / 1.08883;
  const transform = (value: number) => value > 0.008856
    ? Math.cbrt(value)
    : 7.787 * value + 16 / 116;
  const fx = transform(x);
  const fy = transform(y);
  const fz = transform(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function prepareLabImage(
  width: number,
  height: number,
  source: Uint8ClampedArray
): Float32Array {
  if (source.length !== width * height * 4) {
    throw new RangeError('Cannot prepare a malformed source image for segmentation.');
  }
  const lab = new Float32Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const index = pixel * 4;
    const [l, a, b] = rgbToLab(source[index], source[index + 1], source[index + 2]);
    const labIndex = pixel * 3;
    lab[labIndex] = l;
    lab[labIndex + 1] = a;
    lab[labIndex + 2] = b;
  }
  return lab;
}

function* floodFillPreparedSteps(
  width: number,
  height: number,
  source: Uint8ClampedArray,
  lab: Float32Array,
  startX: number,
  startY: number,
  options: FloodFillOptions,
  protectedMask?: Uint8Array
): Generator<void, RasterMask, void> {
  const mask = createEmptyMask(width, height);
  if (
    source.length !== width * height * 4 ||
    lab.length !== width * height * 3 ||
    (protectedMask && protectedMask.length !== width * height)
  ) {
    throw new RangeError('Segmentation inputs have incompatible dimensions.');
  }
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return mask;

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let processed = 0;
  const tolerance = Math.max(0, options.tolerance ?? 32);
  const edgeThresholdSquared =
    Math.max(0, options.edgeThreshold ?? Math.max(12, tolerance * 0.75)) ** 2;
  const maxSeedColorDifferenceSquared =
    Math.max(0, options.maxSeedColorDifference ?? tolerance * 4) ** 2;
  const startIndex = (startY * width + startX) * 4;
  const startR = source[startIndex];
  const startG = source[startIndex + 1];
  const startB = source[startIndex + 2];
  const seedPixel = startY * width + startX;
  if (
    protectedMask?.[seedPixel] ||
    options.protectedPredicate?.(startR, startG, startB, startY / height)
  ) return mask;

  const seedLabIndex = seedPixel * 3;
  const startL = lab[seedLabIndex];
  const startA = lab[seedLabIndex + 1];
  const startLabB = lab[seedLabIndex + 2];

  queue[tail++] = seedPixel;
  visited[seedPixel] = 1;

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    processed++;
    mask.data[pixel] = 255;

    const neighbours = [
      pixel + 1,
      pixel - 1,
      pixel + width,
      pixel - width,
    ];
    for (let direction = 0; direction < neighbours.length; direction++) {
      const nextPixel = neighbours[direction];
      if (
        (direction === 0 && x === width - 1) ||
        (direction === 1 && x === 0) ||
        (direction === 2 && y === height - 1) ||
        (direction === 3 && y === 0)
      ) continue;
      if (visited[nextPixel]) continue;
      const nextY = Math.floor(nextPixel / width);
      const nextIndex = nextPixel * 4;
      if (
        protectedMask?.[nextPixel] ||
        options.protectedPredicate?.(
          source[nextIndex],
          source[nextIndex + 1],
          source[nextIndex + 2],
          nextY / height
        )
      ) {
        visited[nextPixel] = 1;
        continue;
      }

      const nextLabIndex = nextPixel * 3;
      const nextL = lab[nextLabIndex];
      const nextA = lab[nextLabIndex + 1];
      const nextB = lab[nextLabIndex + 2];
      const seedDL = nextL - startL;
      const seedDA = nextA - startA;
      const seedDB = nextB - startLabB;
      const neighborL = nextL - lab[pixel * 3];
      const neighborA = nextA - lab[pixel * 3 + 1];
      const neighborB = nextB - lab[pixel * 3 + 2];
      const seedDiffSquared = seedDL ** 2 + seedDA ** 2 + seedDB ** 2;
      const neighborDiffSquared = neighborL ** 2 + neighborA ** 2 + neighborB ** 2;
      if (
        seedDiffSquared <= maxSeedColorDifferenceSquared &&
        neighborDiffSquared <= edgeThresholdSquared &&
        tail < queue.length
      ) {
        visited[nextPixel] = 1;
        queue[tail++] = nextPixel;
      }
    }
    if (processed % 8192 === 0) yield;
  }

  return mask;
}

export function floodFillMaskFromPreparedImage(
  width: number,
  height: number,
  source: Uint8ClampedArray,
  lab: Float32Array,
  startX: number,
  startY: number,
  options: FloodFillOptions = {},
  protectedMask?: Uint8Array
): RasterMask {
  const steps = floodFillPreparedSteps(
    width,
    height,
    source,
    lab,
    startX,
    startY,
    options,
    protectedMask
  );
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export async function floodFillMaskFromPreparedImageAsync(
  width: number,
  height: number,
  source: Uint8ClampedArray,
  lab: Float32Array,
  startX: number,
  startY: number,
  options: FloodFillOptions = {},
  protectedMask?: Uint8Array,
  signal?: Pick<AbortSignal, 'aborted'>
): Promise<RasterMask> {
  const steps = floodFillPreparedSteps(
    width,
    height,
    source,
    lab,
    startX,
    startY,
    options,
    protectedMask
  );
  let step = steps.next();
  while (!step.done) {
    if (signal?.aborted) {
      const error = new Error('Segmentation request was cancelled.');
      error.name = 'AbortError';
      throw error;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    step = steps.next();
  }
  if (signal?.aborted) {
    const error = new Error('Segmentation request was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
  return step.value;
}

export function floodFillMask(
  sourceCtx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  options: FloodFillOptions = {}
): RasterMask {
  const width = sourceCtx.canvas.width;
  const height = sourceCtx.canvas.height;
  const source = sourceCtx.getImageData(0, 0, width, height).data;
  const lab = prepareLabImage(width, height, source);
  const protectedMask = options.protectedPredicate
    ? new Uint8Array(width * height)
    : undefined;
  if (protectedMask) {
    for (let pixel = 0; pixel < protectedMask.length; pixel++) {
      const index = pixel * 4;
      if (options.protectedPredicate?.(
        source[index],
        source[index + 1],
        source[index + 2],
        Math.floor(pixel / width) / height
      )) {
        protectedMask[pixel] = 255;
      }
    }
  }
  return floodFillMaskFromPreparedImage(
    width,
    height,
    source,
    lab,
    startX,
    startY,
    { ...options, protectedPredicate: undefined },
    protectedMask
  );
}

export function blendPaintColor(
  origR: number,
  origG: number,
  origB: number,
  targetR: number,
  targetG: number,
  targetB: number,
  opacity = 0.92
): [number, number, number] {
  const luminance = 0.299 * origR + 0.587 * origG + 0.114 * origB;
  const factor = Math.max(0.08, Math.min(1.45, luminance / 215));
  const r = Math.min(255, Math.max(0, targetR * factor));
  const g = Math.min(255, Math.max(0, targetG * factor));
  const b = Math.min(255, Math.max(0, targetB * factor));
  return [
    Math.round(r * opacity + origR * (1 - opacity)),
    Math.round(g * opacity + origG * (1 - opacity)),
    Math.round(b * opacity + origB * (1 - opacity)),
  ];
}

export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function renderLayeredImage(
  sourceImage: ImageData,
  layers: ArchitecturalLayer[],
  colourAssignments: Record<string, LayerColourAssignment>,
  protectedMasks: RasterMask[] = []
): ImageData {
  const output = new ImageData(sourceImage.width, sourceImage.height);
  output.data.set(sourceImage.data);
  const protectedMask = combineMasks(protectedMasks);
  const orderedLayers = [...layers]
    .filter((layer) => layer.visible && colourAssignments[layer.id])
    .sort((a, b) => a.zIndex - b.zIndex);

  for (let pixel = 0; pixel < output.data.length; pixel += 4) {
    const pixelIndex = pixel / 4;
    let selectedLayer: ArchitecturalLayer | undefined;
    for (const layer of orderedLayers) {
      if (layer.mask.data[pixelIndex] && (!protectedMask?.data[pixelIndex] || layer.overrideProtected)) selectedLayer = layer;
    }
    if (!selectedLayer) continue;

    const assignment = colourAssignments[selectedLayer.id];
    const [targetR, targetG, targetB] = hexToRgb(assignment.colorHex);
    const alpha = (selectedLayer.mask.data[pixelIndex] / 255) * 0.92;
    const [r, g, b] = blendPaintColor(
      sourceImage.data[pixel],
      sourceImage.data[pixel + 1],
      sourceImage.data[pixel + 2],
      targetR,
      targetG,
      targetB,
      alpha
    );
    output.data[pixel] = r;
    output.data[pixel + 1] = g;
    output.data[pixel + 2] = b;
  }
  return output;
}

export function renderProjectToCanvas(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  layers: ArchitecturalLayer[],
  colourAssignments: Record<string, LayerColourAssignment>,
  protectedMasks: RasterMask[] = []
): ImageData | null {
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const targetCtx = targetCanvas.getContext('2d');
  if (!sourceCtx || !targetCtx) return null;
  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;
  const output = renderLayeredImage(
    sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height),
    layers,
    colourAssignments,
    protectedMasks
  );
  targetCtx.putImageData(output, 0, 0);
  return output;
}
