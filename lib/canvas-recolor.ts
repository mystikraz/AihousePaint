import { ArchitecturalZone } from './architectural-presets';
import {
  createEmptyMask,
  floodFillMask,
  hexToRgb,
  layersFromPreset,
  renderProjectToCanvas,
} from './architectural-layer-engine';
import { RasterMask } from './architectural-layer-engine';

export interface RecoloredZoneState {
  zoneId: string;
  colorHex: string;
  colorCode: string;
}

export interface CustomMaskPoint {
  x: number;
  y: number;
  colorHex: string;
  colorCode: string;
  radius?: number;
}

export function isPointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isPointInZone(xPercent: number, yPercent: number, zone: ArchitecturalZone): boolean {
  return isPointInPolygon(xPercent, yPercent, zone.polygon) &&
    !(zone.holes ?? []).some((hole) => isPointInPolygon(xPercent, yPercent, hole));
}

export function isProtectedNonWallPixel(r: number, g: number, b: number, yRatio: number): boolean {
  if (r < 24 && g < 24 && b < 24) return true;
  if (g > 48 && g > r * 1.15 && g > b * 1.1) return true;

  // Sky can occupy much more than the top strip in a portrait house photo.
  // Keep blue and bright cloud-like pixels in the upper half out of paintable
  // surface masks, while leaving brown brick and warm wall colours eligible.
  const brightness = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const upperSky = yRatio < 0.5 && (
    (b > 110 && b > r * 1.08 && b > g * 1.02) ||
    (brightness > 175 && spread < 34)
  );
  return upperSky;
}

export function createHeuristicProtectedMask(sourceCanvas: HTMLCanvasElement): RasterMask {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const mask = createEmptyMask(width, height);
  if (!ctx) return mask;
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let pixel = 0; pixel < mask.data.length; pixel++) {
    const index = pixel * 4;
    if (isProtectedNonWallPixel(
      data[index],
      data[index + 1],
      data[index + 2],
      Math.floor(pixel / width) / height
    )) {
      mask.data[pixel] = 255;
    }
  }
  return mask;
}

export { hexToRgb };

/** Compatibility wrapper: preset polygons are rasterized into independent layers. */
export function renderRecoloredCanvas(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  zones: ArchitecturalZone[],
  activeColors: Record<string, string>,
  hoveredZoneId: string | null = null
) {
  const layers = layersFromPreset(zones, sourceCanvas.width, sourceCanvas.height);
  const assignments = Object.fromEntries(
    layers.filter((layer) => activeColors[layer.id]).map((layer) => [layer.id, {
      colorId: layer.assignedColorId ?? layer.id,
      colorHex: activeColors[layer.id],
    }])
  );
  renderProjectToCanvas(sourceCanvas, targetCanvas, layers, assignments);

  if (hoveredZoneId) {
    const zone = zones.find((candidate) => candidate.id === hoveredZoneId);
    const ctx = targetCanvas.getContext('2d');
    if (zone && ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(20, 122, 130, 0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      zone.polygon.forEach(([x, y], index) => {
        const px = (x / 100) * targetCanvas.width;
        const py = (y / 100) * targetCanvas.height;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Temporary compatibility helper. New code should create a mask and render it. */
export function floodFillRecolor(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  colorHex: string,
  tolerance = 32
): boolean {
  const mask = floodFillMask(ctx, startX, startY, {
    tolerance,
    protectedPredicate: isProtectedNonWallPixel,
  });
  const [targetR, targetG, targetB] = hexToRgb(colorHex);
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let pixel = 0; pixel < mask.data.length; pixel++) {
    if (!mask.data[pixel]) continue;
    const index = pixel * 4;
    image.data[index] = targetR;
    image.data[index + 1] = targetG;
    image.data[index + 2] = targetB;
  }
  ctx.putImageData(image, 0, 0);
  return mask.data.some(Boolean);
}
