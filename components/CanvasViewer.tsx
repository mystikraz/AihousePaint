'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo2,
  Redo2,
  Save,
  SplitSquareVertical,
  MousePointerClick,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  ArchitecturalPreset,
  ArchitecturalZone,
} from '@/lib/architectural-presets';
import {
  isPointInZone,
  isProtectedNonWallPixel,
  createHeuristicProtectedMask,
} from '@/lib/canvas-recolor';
import { BihaniColor } from '@/lib/bihani-colors';
import {
  ArchitecturalLayer,
  LayerColourAssignment,
  MAX_WORKING_MASK_PIXELS,
  cloneLayers,
  layersFromPreset,
  paintMaskCircle,
  renderProjectToCanvas,
} from '@/lib/architectural-layer-engine';
import { FloodFillSegmentationProvider } from '@/lib/segmentation';

interface CanvasViewerProps {
  preset: ArchitecturalPreset;
  customImageSrc: string | null;
  activeColor: BihaniColor;
  activeColors: Record<string, string>; // zoneId -> hex
  colorCodesMap: Record<string, string>; // zoneId -> code
  onColorZone: (zoneId: string, color: BihaniColor) => void;
  onApplyPaletteMap: (colorMap: Record<string, string>, codesMap: Record<string, string>) => void;
  customLayers: ArchitecturalLayer[];
  customColourAssignments: Record<string, LayerColourAssignment>;
  onCustomPaint: (
    layers: ArchitecturalLayer[],
    assignments: Record<string, LayerColourAssignment>
  ) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveClick: () => void;
  isCompareMode: boolean;
  onToggleCompare: () => void;
}

export function CanvasViewer({
  preset,
  customImageSrc,
  activeColor,
  activeColors,
  colorCodesMap,
  onColorZone,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveClick,
  isCompareMode,
  onToggleCompare,
  customLayers,
  customColourAssignments,
  onCustomPaint,
}: CanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recolorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  const isCustomImage = !!customImageSrc;
  const currentImageSource = customImageSrc || preset.imageSrc;

  const [loadedImageSrc, setLoadedImageSrc] = useState<string | null>(null);
  const imageLoaded = loadedImageSrc === currentImageSource;
  const [zoom, setZoom] = useState(1);
  const [hoveredZone, setHoveredZone] = useState<ArchitecturalZone | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50); // 0 to 100 percentage
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [clickNotification, setClickNotification] = useState<{
    text: string;
    xPct: number;
    yPct: number;
  } | null>(null);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [isBrushErase, setIsBrushErase] = useState(false);
  const segmentationProvider = useRef(new FloodFillSegmentationProvider());
  const protectedMaskRef = useRef<import('@/lib/architectural-layer-engine').RasterMask | null>(null);

  // Initialize source and buffer canvases when image source changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentImageSource;

    img.onload = () => {
      const srcCanvas = document.createElement('canvas');
      const naturalWidth = img.naturalWidth || 1920;
      const naturalHeight = img.naturalHeight || 1080;
      const scale = Math.min(
        1,
        Math.sqrt(MAX_WORKING_MASK_PIXELS / (naturalWidth * naturalHeight)),
        2048 / naturalWidth,
        2048 / naturalHeight
      );
      srcCanvas.width = Math.max(1, Math.round(naturalWidth * scale));
      srcCanvas.height = Math.max(1, Math.round(naturalHeight * scale));
      const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (sCtx) {
        sCtx.drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);
      }
      sourceCanvasRef.current = srcCanvas;
      protectedMaskRef.current = createHeuristicProtectedMask(srcCanvas);

      const recCanvas = document.createElement('canvas');
      recCanvas.width = srcCanvas.width;
      recCanvas.height = srcCanvas.height;
      recolorCanvasRef.current = recCanvas;

      setLoadedImageSrc(currentImageSource);
    };
  }, [currentImageSource]);

  // Redraw both recoloring and display canvas
  useEffect(() => {
    if (!sourceCanvasRef.current || !recolorCanvasRef.current || !imageLoaded) {
      return;
    }

    const layers = isCustomImage
      ? customLayers
      : layersFromPreset(
          preset.zones,
          sourceCanvasRef.current.width,
          sourceCanvasRef.current.height
        );
    const assignments = isCustomImage
      ? customColourAssignments
      : Object.fromEntries(
          layers
            .filter((layer) => activeColors[layer.id])
            .map((layer) => [layer.id, {
              colorId: layer.assignedColorId ?? layer.id,
              colorHex: activeColors[layer.id],
            }])
        );
    renderProjectToCanvas(
      sourceCanvasRef.current,
      recolorCanvasRef.current,
      layers,
      assignments,
      isCustomImage && protectedMaskRef.current ? [protectedMaskRef.current] : []
    );

    // Draw to visible display canvas
    const dispCanvas = displayCanvasRef.current;
    if (!dispCanvas) return;

    const width = sourceCanvasRef.current.width;
    const height = sourceCanvasRef.current.height;

    if (dispCanvas.width !== width || dispCanvas.height !== height) {
      dispCanvas.width = width;
      dispCanvas.height = height;
    }

    const ctx = dispCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (isCompareMode) {
      const splitX = Math.round((sliderPosition / 100) * width);

      // Draw original on left
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, height);
      ctx.clip();
      ctx.drawImage(sourceCanvasRef.current, 0, 0);
      ctx.restore();

      // Draw recolored on right
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, width - splitX, height);
      ctx.clip();
      ctx.drawImage(recolorCanvasRef.current, 0, 0);
      ctx.restore();

      // Draw divider line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.drawImage(recolorCanvasRef.current, 0, 0);
    }
  }, [
    imageLoaded,
    activeColors,
    hoveredZone,
    preset.zones,
    isCustomImage,
    isCompareMode,
    sliderPosition,
    customLayers,
    customColourAssignments,
  ]);

  // Coordinate helper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) {
      return { xPct: 0, yPct: 0, pixelX: 0, pixelY: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const sourceAspect = canvas.width / canvas.height;
    const displayAspect = rect.width / rect.height;
    const drawnWidth = sourceAspect > displayAspect ? rect.width : rect.height * sourceAspect;
    const drawnHeight = sourceAspect > displayAspect ? rect.width / sourceAspect : rect.height;
    const offsetX = (rect.width - drawnWidth) / 2;
    const offsetY = (rect.height - drawnHeight) / 2;
    const imageX = Math.max(0, Math.min(drawnWidth, clientX - offsetX));
    const imageY = Math.max(0, Math.min(drawnHeight, clientY - offsetY));
    const xPct = (imageX / drawnWidth) * 100;
    const yPct = (imageY / drawnHeight) * 100;
    const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.floor((imageX / drawnWidth) * canvas.width)));
    const pixelY = Math.max(0, Math.min(canvas.height - 1, Math.floor((imageY / drawnHeight) * canvas.height)));

    return { xPct, yPct, pixelX, pixelY };
  };

  // Hover detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingSlider || isCustomImage) return;

    const { xPct, yPct } = getCanvasCoords(e);
    let found: ArchitecturalZone | null = null;
    for (const zone of preset.zones) {
      if (isPointInZone(xPct, yPct, zone)) {
        found = zone;
        break;
      }
    }
    setHoveredZone(found);
  };

  const handleMouseLeave = () => {
    setHoveredZone(null);
  };

  // Click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isCompareMode) return;
    const { xPct, yPct, pixelX, pixelY } = getCanvasCoords(e);

    if (!isCustomImage) {
      let targetZone: ArchitecturalZone | null = null;
      for (const zone of preset.zones) {
        if (isPointInZone(xPct, yPct, zone)) {
          targetZone = zone;
          break;
        }
      }

      if (targetZone) {
        onColorZone(targetZone.id, activeColor);
        setClickNotification({
          text: `Painted ${targetZone.name} with ${activeColor.code} ${activeColor.name}`,
          xPct,
          yPct,
        });
        setTimeout(() => setClickNotification(null), 1800);
      }
    } else if (sourceCanvasRef.current) {
      if (isBrushMode) {
        const selected = customLayers.find((layer) => layer.selected && !layer.locked);
        if (!selected) return;
        const nextLayers = cloneLayers(customLayers).map((layer) =>
          layer.id === selected.id
            ? { ...layer, mask: paintMaskCircle(layer.mask, pixelX, pixelY, 28, isBrushErase ? 0 : 255, protectedMaskRef.current ?? undefined) }
            : layer
        );
        onCustomPaint(nextLayers, customColourAssignments);
        return;
      }

      const sourceCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!sourceCtx) return;
      const mask = segmentationProvider.current.segmentAtPoint({
        sourceContext: sourceCtx,
        x: pixelX,
        y: pixelY,
        tolerance: 32,
        protectedPredicate: isProtectedNonWallPixel,
      });
      if (!mask.data.some(Boolean)) return;
      const layerId = `manual-${Date.now()}`;
      const nextLayer: ArchitecturalLayer = {
        id: layerId,
        parentId: null,
        name: `Uploaded surface ${customLayers.length + 1}`,
        type: 'manual',
        mask,
        confidence: 0.55,
        visible: true,
        locked: false,
        selected: true,
        assignedColorId: activeColor.code,
        zIndex: customLayers.length,
        source: 'manual',
      };
      const nextLayers = customLayers.map((layer) => ({ ...layer, selected: false }));
      nextLayers.push(nextLayer);
      onCustomPaint(nextLayers, {
        ...customColourAssignments,
        [layerId]: {
          colorId: activeColor.code,
          colorHex: activeColor.hex,
          colorCode: activeColor.code,
        },
      });
      setClickNotification({ text: `Selected surface with ${activeColor.code}`, xPct, yPct });
      setTimeout(() => setClickNotification(null), 1800);
    }
  };

  // Split Slider drag handling
  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSlider(true);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingSlider || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      setSliderPosition(Math.max(2, Math.min(98, pos)));
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingSlider(false);
    };

    if (isDraggingSlider) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingSlider]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Canvas Viewport Frame */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[16/9] max-h-[640px] bg-slate-900 rounded-xl overflow-hidden shadow-md select-none border border-slate-200"
      >
        {!imageLoaded ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500">
            <div className="w-10 h-10 border-3 border-[#147a82] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Calibrating Architectural Surfaces...
            </p>
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-150"
            style={{ transform: `scale(${zoom})` }}
          >
            <canvas
              ref={displayCanvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className={`w-full h-full object-contain ${
                isCompareMode
                  ? 'cursor-ew-resize'
                  : 'cursor-crosshair hover:brightness-102'
              }`}
            />
          </div>
        )}

        {/* Floating Zoom & Reset Controls (Top Right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-md px-1.5 py-1 rounded-lg shadow-sm border border-slate-200/80 z-20">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))}
            className="p-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))}
            className="p-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded transition-colors"
            title="Reset View (100%)"
            aria-label="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Hover Feedback Badge (Top Left) */}
        {hoveredZone && !isCompareMode && (
          <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg shadow-md border border-white/10 z-20 flex items-center gap-2 pointer-events-none transition-all">
            <span className="w-2 h-2 rounded-full bg-[#147a82] animate-pulse" />
            <span className="font-medium">{hoveredZone.name}</span>
            <span className="text-slate-400 text-[11px]">
              (Tap to paint {activeColor.code})
            </span>
          </div>
        )}

        {/* Interactive Before/After Split Slider Handle */}
        {isCompareMode && (
          <div
            className="absolute top-0 bottom-0 z-30 cursor-ew-resize group"
            style={{ left: `${sliderPosition}%` }}
            onMouseDown={handleSliderMouseDown}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg border-2 border-[#147a82] flex items-center justify-center text-[#147a82]">
              <SplitSquareVertical className="w-4 h-4" />
            </div>
            {/* Badges for Before / After */}
            <div className="absolute bottom-4 -left-20 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase pointer-events-none">
              Original
            </div>
            <div className="absolute bottom-4 left-4 bg-[#147a82]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase pointer-events-none">
              Bihani
            </div>
          </div>
        )}

        {/* Floating Click Notification */}
        {clickNotification && (
          <div
            className="absolute z-40 bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xl pointer-events-none transition-opacity animate-in fade-in max-w-[80%]"
            style={{
              left: `${Math.min(75, Math.max(8, clickNotification.xPct))}%`,
              top: `${Math.max(8, clickNotification.yPct - 6)}%`,
            }}
          >
            ✓ {clickNotification.text}
          </div>
        )}
      </div>

      {/* Toolbar Immediately Below the Image */}
      <div className="w-full mt-2.5 flex flex-wrap items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
        {/* Left: Undo, Redo, Compare Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
              canUndo
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 shadow-2xs'
                : 'text-slate-300 border-transparent cursor-not-allowed'
            }`}
            title="Undo last paint step (up to 25 history steps)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
              canRedo
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 shadow-2xs'
                : 'text-slate-300 border-transparent cursor-not-allowed'
            }`}
            title="Redo step"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span>Redo</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={onToggleCompare}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
              isCompareMode
                ? 'bg-[#147a82]/10 text-[#147a82] border-[#147a82]'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5 text-slate-600" />
            <span>{isCompareMode ? 'Exit Split' : 'Split Slider'}</span>
          </button>

          {isCustomImage && (
            <>
              <div className="h-4 w-px bg-slate-200 mx-1" />
              <button
                type="button"
                onClick={() => {
                  setIsBrushMode((enabled) => !enabled);
                  setIsBrushErase(false);
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  isBrushMode
                    ? 'bg-[#147a82]/10 text-[#147a82] border-[#147a82]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isBrushMode ? 'Brush on' : 'Refine mask'}
              </button>
              {isBrushMode && (
                <button
                  type="button"
                  onClick={() => setIsBrushErase((erasing) => !erasing)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    isBrushErase
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {isBrushErase ? 'Erase' : 'Add'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Save Project Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveClick}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg text-white bg-[#147a82] hover:bg-[#0f4f56] transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {isCustomImage && customLayers.length > 0 && (
        <div className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Uploaded image layers
          </div>
          <div className="flex flex-wrap gap-1.5">
            {customLayers.map((layer) => (
              <div key={layer.id} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => onCustomPaint(
                    customLayers.map((candidate) => ({ ...candidate, selected: candidate.id === layer.id })),
                    customColourAssignments
                  )}
                  className={`max-w-40 truncate rounded-md px-2 py-1 text-xs font-medium ${
                    layer.selected ? 'bg-[#147a82]/10 text-[#147a82]' : 'text-slate-600 hover:bg-white'
                  }`}
                  aria-pressed={layer.selected}
                >
                  {layer.name}
                </button>
                <button
                  type="button"
                  onClick={() => onCustomPaint(
                    customLayers.map((candidate) => candidate.id === layer.id ? { ...candidate, visible: !candidate.visible } : candidate),
                    customColourAssignments
                  )}
                  className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                  aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                >
                  {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onCustomPaint(
                    customLayers.map((candidate) => candidate.id === layer.id ? { ...candidate, locked: !candidate.locked } : candidate),
                    customColourAssignments
                  )}
                  className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                  aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                >
                  {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-calibrated Architectural Zones Quick Selector */}
      {!isCustomImage && (
        <div className="w-full mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] font-semibold uppercase text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
            <MousePointerClick className="w-3 h-3 text-[#147a82]" />
            Tap to paint:
          </span>
          {preset.zones.map((zone, idx) => {
            const currentColor = activeColors[zone.id];
            const currentCode = colorCodesMap[zone.id];
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => onColorZone(zone.id, activeColor)}
                onMouseEnter={() => setHoveredZone(zone)}
                onMouseLeave={() => setHoveredZone(null)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shrink-0 hover:border-[#147a82]"
                title={`Click to paint ${zone.name} with ${activeColor.code}`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                  style={{ backgroundColor: currentColor || zone.defaultColor }}
                />
                <span className="text-slate-700 font-medium whitespace-nowrap">
                  {idx + 1}. {zone.name.split('&')[0]}
                </span>
                {currentCode && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({currentCode})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
