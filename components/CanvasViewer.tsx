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
} from 'lucide-react';
import {
  ArchitecturalPreset,
  ArchitecturalZone,
} from '@/lib/architectural-presets';
import {
  renderRecoloredCanvas,
  isPointInZone,
  floodFillRecolor,
} from '@/lib/canvas-recolor';
import { BihaniColor } from '@/lib/bihani-colors';

interface CanvasViewerProps {
  preset: ArchitecturalPreset;
  customImageSrc: string | null;
  activeColor: BihaniColor;
  activeColors: Record<string, string>; // zoneId -> hex
  colorCodesMap: Record<string, string>; // zoneId -> code
  onColorZone: (zoneId: string, color: BihaniColor) => void;
  onApplyPaletteMap: (colorMap: Record<string, string>, codesMap: Record<string, string>) => void;
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

  // Initialize source and buffer canvases when image source changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentImageSource;

    img.onload = () => {
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.naturalWidth || 1920;
      srcCanvas.height = img.naturalHeight || 1080;
      const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (sCtx) {
        sCtx.drawImage(img, 0, 0);
      }
      sourceCanvasRef.current = srcCanvas;

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

    if (!isCustomImage) {
      renderRecoloredCanvas(
        sourceCanvasRef.current,
        recolorCanvasRef.current,
        preset.zones,
        activeColors,
        hoveredZone ? hoveredZone.id : null
      );
    } else {
      const rCtx = recolorCanvasRef.current.getContext('2d');
      if (rCtx) {
        rCtx.drawImage(sourceCanvasRef.current, 0, 0);
      }
    }

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

    const xPct = (clientX / rect.width) * 100;
    const yPct = (clientY / rect.height) * 100;
    const pixelX = Math.floor((clientX / rect.width) * canvas.width);
    const pixelY = Math.floor((clientY / rect.height) * canvas.height);

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
    } else {
      if (recolorCanvasRef.current && displayCanvasRef.current) {
        const rCtx = recolorCanvasRef.current.getContext('2d');
        if (rCtx) {
          const filled = floodFillRecolor(
            rCtx,
            pixelX,
            pixelY,
            activeColor.hex,
            32
          );
          if (filled) {
            const dispCtx = displayCanvasRef.current.getContext('2d');
            if (dispCtx) {
              dispCtx.drawImage(recolorCanvasRef.current, 0, 0);
            }
            setClickNotification({
              text: `Recolored section with ${activeColor.code}`,
              xPct,
              yPct,
            });
            setTimeout(() => setClickNotification(null), 1800);
          }
        }
      }
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
