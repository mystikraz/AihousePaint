import { RasterMask, floodFillMask } from './architectural-layer-engine';

export interface SegmentationRequest {
  sourceContext: CanvasRenderingContext2D;
  x: number;
  y: number;
  tolerance?: number;
  protectedPredicate?: (r: number, g: number, b: number, yRatio: number) => boolean;
}

export interface ArchitecturalSegmentationProvider {
  segmentAtPoint(request: SegmentationRequest): Promise<RasterMask> | RasterMask;
}

/** Temporary local provider. An AI/SAM provider can replace this without changing the renderer. */
export class FloodFillSegmentationProvider implements ArchitecturalSegmentationProvider {
  segmentAtPoint({ sourceContext, x, y, tolerance = 32, protectedPredicate }: SegmentationRequest): RasterMask {
    return floodFillMask(sourceContext, x, y, { tolerance, protectedPredicate });
  }
}
