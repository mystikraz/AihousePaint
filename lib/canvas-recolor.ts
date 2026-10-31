import { ArchitecturalZone } from './architectural-presets';

export interface RecoloredZoneState {
  zoneId: string;
  colorHex: string;
  colorCode: string;
}

export interface CustomMaskPoint {
  x: number; // 0 to 100 percentage
  y: number;
  colorHex: string;
  colorCode: string;
  radius?: number;
}

// Ray-casting point-in-polygon test
export function isPointInPolygon(
  x: number,
  y: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Check if point is inside a zone (and not inside any hole)
export function isPointInZone(
  xPercent: number,
  yPercent: number,
  zone: ArchitecturalZone
): boolean {
  if (!isPointInPolygon(xPercent, yPercent, zone.polygon)) {
    return false;
  }
  if (zone.holes && zone.holes.length > 0) {
    for (const hole of zone.holes) {
      if (isPointInPolygon(xPercent, yPercent, hole)) {
        return false;
      }
    }
  }
  return true;
}

// Hex to RGB helper
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Check if pixel is protected non-wall (green foliage, wooden door, sky, glass reflection)
export function isProtectedNonWallPixel(
  r: number,
  g: number,
  b: number,
  yRatio: number
): boolean {
  // Deep dark metal window frame / mullions
  if (r < 24 && g < 24 && b < 24) return true;

  // Lush garden foliage & trees (green dominant)
  if (g > 48 && g > r * 1.15 && g > b * 1.1) return true;

  // Rich wooden door (warm brown-amber hue)
  if (r > 95 && r < 190 && g > 45 && g < 125 && b < 70 && r > g * 1.3) {
    return true;
  }

  // Pure open sky (top quarter of image, strong blue dominance)
  if (yRatio < 0.22 && b > 140 && b > r * 1.3 && b > g * 1.15) {
    return true;
  }

  return false;
}

/**
 * Realistic architectural paint blend:
 * Preserves surface micro-texture, ambient shadows, and sunlight gradients.
 */
export function blendPaintColor(
  origR: number,
  origG: number,
  origB: number,
  targetR: number,
  targetG: number,
  targetB: number,
  opacity: number = 0.92
): { r: number; g: number; b: number } {
  // Compute perceived luminance of masonry surface
  const luminance = 0.299 * origR + 0.587 * origG + 0.114 * origB;

  // Emulsion response curve: light walls reflect full shade, shadows deepen smoothly
  const factor = Math.max(0.08, Math.min(1.45, luminance / 215));

  const blendedR = Math.min(255, Math.max(0, targetR * factor));
  const blendedG = Math.min(255, Math.max(0, targetG * factor));
  const blendedB = Math.min(255, Math.max(0, targetB * factor));

  // Blend with original surface for tactile masonry texture
  return {
    r: Math.round(blendedR * opacity + origR * (1 - opacity)),
    g: Math.round(blendedG * opacity + origG * (1 - opacity)),
    b: Math.round(blendedB * opacity + origB * (1 - opacity)),
  };
}

/**
 * Recolor full image based on zone assignments
 */
export function renderRecoloredCanvas(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  zones: ArchitecturalZone[],
  activeColors: Record<string, string>, // zoneId -> hex
  hoveredZoneId: string | null = null
) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (targetCanvas.width !== width || targetCanvas.height !== height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
  }

  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const tgtCtx = targetCanvas.getContext('2d');
  if (!srcCtx || !tgtCtx) return;

  const srcImgData = srcCtx.getImageData(0, 0, width, height);
  const tgtImgData = tgtCtx.createImageData(width, height);

  const srcData = srcImgData.data;
  const tgtData = tgtImgData.data;

  // Pre-parse target colors
  const zoneColorsMap: Record<string, { r: number; g: number; b: number }> = {};
  for (const zone of zones) {
    const hex = activeColors[zone.id];
    if (hex) {
      zoneColorsMap[zone.id] = hexToRgb(hex);
    }
  }

  // Pre-calculate bounding boxes for each zone to optimize loop
  const zoneBounds = zones.map((zone) => {
    let minX = 100,
      maxX = 0,
      minY = 100,
      maxY = 0;
    for (const [x, y] of zone.polygon) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return {
      zone,
      minX: (minX * width) / 100,
      maxX: (maxX * width) / 100,
      minY: (minY * height) / 100,
      maxY: (maxY * height) / 100,
      color: zoneColorsMap[zone.id] || null,
    };
  });

  // Fast loop over all pixels
  for (let y = 0; y < height; y++) {
    const yPct = (y / height) * 100;
    const yRatio = y / height;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const xPct = (x / width) * 100;

      const r0 = srcData[idx];
      const g0 = srcData[idx + 1];
      const b0 = srcData[idx + 2];
      const a0 = srcData[idx + 3];

      // Check if pixel belongs to any colored zone
      let appliedColor: { r: number; g: number; b: number } | null = null;

      for (let z = 0; z < zoneBounds.length; z++) {
        const zb = zoneBounds[z];
        if (
          x >= zb.minX &&
          x <= zb.maxX &&
          y >= zb.minY &&
          y <= zb.maxY &&
          zb.color
        ) {
          if (isPointInZone(xPct, yPct, zb.zone)) {
            // Check non-wall protection
            if (!isProtectedNonWallPixel(r0, g0, b0, yRatio)) {
              appliedColor = zb.color;
            }
            break;
          }
        }
      }

      if (appliedColor) {
        const painted = blendPaintColor(
          r0,
          g0,
          b0,
          appliedColor.r,
          appliedColor.g,
          appliedColor.b
        );
        tgtData[idx] = painted.r;
        tgtData[idx + 1] = painted.g;
        tgtData[idx + 2] = painted.b;
        tgtData[idx + 3] = a0;
      } else {
        tgtData[idx] = r0;
        tgtData[idx + 1] = g0;
        tgtData[idx + 2] = b0;
        tgtData[idx + 3] = a0;
      }
    }
  }

  tgtCtx.putImageData(tgtImgData, 0, 0);

  // If a zone is hovered, draw a subtle crisp architectural highlight overlay
  if (hoveredZoneId) {
    const hoveredZone = zones.find((z) => z.id === hoveredZoneId);
    if (hoveredZone) {
      tgtCtx.save();
      tgtCtx.strokeStyle = 'rgba(20, 122, 130, 0.9)';
      tgtCtx.lineWidth = 3;
      tgtCtx.setLineDash([6, 4]);
      tgtCtx.fillStyle = 'rgba(20, 122, 130, 0.12)';

      tgtCtx.beginPath();
      hoveredZone.polygon.forEach(([px, py], i) => {
        const cx = (px / 100) * width;
        const cy = (py / 100) * height;
        if (i === 0) tgtCtx.moveTo(cx, cy);
        else tgtCtx.lineTo(cx, cy);
      });
      tgtCtx.closePath();

      // Punch out holes
      if (hoveredZone.holes) {
        for (const hole of hoveredZone.holes) {
          hole.forEach(([px, py], i) => {
            const cx = (px / 100) * width;
            const cy = (py / 100) * height;
            if (i === 0) tgtCtx.moveTo(cx, cy);
            else tgtCtx.lineTo(cx, cy);
          });
        }
      }

      tgtCtx.fill('evenodd');
      tgtCtx.stroke();
      tgtCtx.restore();
    }
  }
}

/**
 * Edge-aware flood fill for custom uploaded user photos
 */
export function floodFillRecolor(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  colorHex: string,
  tolerance: number = 32
): boolean {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const targetRgb = hexToRgb(colorHex);
  const startIdx = (startY * width + startX) * 4;
  const sr = data[startIdx];
  const sg = data[startIdx + 1];
  const sb = data[startIdx + 2];

  // If clicking on sky or dense foliage, prevent accidental bleed
  if (isProtectedNonWallPixel(sr, sg, sb, startY / height)) {
    return false;
  }

  const visited = new Uint8Array(width * height);
  const queue: [number, number][] = [[startX, startY]];
  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    const idx = (cy * width + cx) * 4;

    const r0 = data[idx];
    const g0 = data[idx + 1];
    const b0 = data[idx + 2];

    const painted = blendPaintColor(
      r0,
      g0,
      b0,
      targetRgb.r,
      targetRgb.g,
      targetRgb.b
    );
    data[idx] = painted.r;
    data[idx + 1] = painted.g;
    data[idx + 2] = painted.b;

    // 4-way neighbors
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nPos = ny * width + nx;
        if (!visited[nPos]) {
          visited[nPos] = 1;
          const nIdx = nPos * 4;
          const nr = data[nIdx];
          const ng = data[nIdx + 1];
          const nb = data[nIdx + 2];

          // Check color distance from seed
          const diff = Math.sqrt(
            Math.pow(nr - sr, 2) + Math.pow(ng - sg, 2) + Math.pow(nb - sb, 2)
          );

          if (
            diff <= tolerance &&
            !isProtectedNonWallPixel(nr, ng, nb, ny / height)
          ) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return true;
}
