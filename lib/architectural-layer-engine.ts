import { ArchitecturalZone } from './architectural-presets';

export type ArchitecturalLayerType =
  | 'surface'
  | 'protected'
  | 'manual'
  | 'preset';

export type LayerSource = 'preset' | 'AI' | 'manual';

export interface RasterMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export const MAX_WORKING_MASK_PIXELS = 4_000_000;

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

export function paintMaskCircle(
  mask: RasterMask,
  centerX: number,
  centerY: number,
  radius: number,
  value = 255,
  protectedMask?: RasterMask
): RasterMask {
  const next = cloneMask(mask);
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
      if (dx * dx + dy * dy <= radiusSquared && !protectedMask?.data[pixel]) {
        next.data[pixel] = value;
      }
    }
  }
  return next;
}

export function floodFillMask(
  sourceCtx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  options: FloodFillOptions = {}
): RasterMask {
  const width = sourceCtx.canvas.width;
  const height = sourceCtx.canvas.height;
  const mask = createEmptyMask(width, height);
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return mask;

  const image = sourceCtx.getImageData(0, 0, width, height);
  const source = image.data;
  const visited = new Uint8Array(width * height);
  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const tolerance = options.tolerance ?? 32;
  const startIndex = (startY * width + startX) * 4;
  const startR = source[startIndex];
  const startG = source[startIndex + 1];
  const startB = source[startIndex + 2];

  queueX[tail] = startX;
  queueY[tail] = startY;
  tail++;
  visited[startY * width + startX] = 1;

  while (head < tail) {
    const x = queueX[head];
    const y = queueY[head];
    head++;
    const pixel = y * width + x;
    const index = pixel * 4;
    const r = source[index];
    const g = source[index + 1];
    const b = source[index + 2];
    const isProtected = options.protectedPredicate?.(r, g, b, y / height) ?? false;

    if (!isProtected) mask.data[pixel] = 255;

    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nextX, nextY] of neighbours) {
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
      const nextPixel = nextY * width + nextX;
      if (visited[nextPixel]) continue;
      visited[nextPixel] = 1;
      const nextIndex = nextPixel * 4;
      const diff = Math.sqrt(
        (source[nextIndex] - startR) ** 2 +
          (source[nextIndex + 1] - startG) ** 2 +
          (source[nextIndex + 2] - startB) ** 2
      );
      if (diff <= tolerance && tail < queueX.length) {
        queueX[tail] = nextX;
        queueY[tail] = nextY;
        tail++;
      }
    }
  }

  return mask;
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
    if (protectedMask?.data[pixelIndex]) continue;

    let selectedLayer: ArchitecturalLayer | undefined;
    for (const layer of orderedLayers) {
      if (layer.mask.data[pixelIndex]) selectedLayer = layer;
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
