'use client';

import React from 'react';
import Image from 'next/image';
import { Palette, Eye, Sparkles } from 'lucide-react';
import { BihaniColor } from '@/lib/bihani-colors';

interface ColorSelectorBarProps {
  activeColor: BihaniColor;
  onOpenPaletteModal: () => void;
  originalImageSrc: string;
  onToggleGlanceOriginal: () => void;
  isGlancingOriginal: boolean;
}

// Helper to determine whether text should be dark or white on a color background
function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

export function ColorSelectorBar({
  activeColor,
  onOpenPaletteModal,
  originalImageSrc,
  onToggleGlanceOriginal,
  isGlancingOriginal,
}: ColorSelectorBarProps) {
  const light = isLightColor(activeColor.hex);
  const textColor = light ? 'text-slate-900' : 'text-white';
  const subtitleColor = light ? 'text-slate-700' : 'text-white/80';
  const borderColor = light ? 'border-slate-300' : 'border-black/10';

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
      {/* Card 1: Active Paint Color Selector (Wide button - 2 cols on md) */}
      <button
        type="button"
        onClick={onOpenPaletteModal}
        className={`md:col-span-2 relative group flex items-center justify-between p-4 rounded-xl shadow-xs transition-all duration-150 border ${borderColor} hover:shadow-md hover:scale-[1.008] min-h-[72px] text-left overflow-hidden`}
        style={{ backgroundColor: activeColor.hex }}
        aria-label={`Select Color. Currently active: ${activeColor.code} ${activeColor.name}`}
      >
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
              light ? 'border-slate-400 bg-black/5' : 'border-white/30 bg-white/10'
            }`}
          >
            <Palette className={`w-6 h-6 ${textColor}`} />
          </div>
          <div>
            <div className={`text-[11px] uppercase tracking-wider font-semibold ${subtitleColor}`}>
              Active Paint Shade (Tap to Select Color)
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${textColor}`}>
                {activeColor.code}
              </span>
              <span className={`text-sm sm:text-base font-semibold ${textColor}`}>
                · {activeColor.name}
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 pr-1">
          <span
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border backdrop-blur-xs transition-colors ${
              light
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-900 border-white'
            }`}
          >
            Change Color
          </span>
        </div>
      </button>

      {/* Card 2: Original Photo Quick Glance / Toggle */}
      <button
        type="button"
        onClick={onToggleGlanceOriginal}
        className={`relative group flex items-center gap-3 p-3 rounded-xl border bg-white shadow-xs transition-all duration-150 min-h-[72px] text-left hover:border-slate-300 ${
          isGlancingOriginal
            ? 'border-[#147a82] ring-2 ring-[#147a82]/20'
            : 'border-slate-200'
        }`}
        aria-label="Glance at original unpainted house"
      >
        <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
          <Image
            src={originalImageSrc}
            alt="Original unpainted house"
            fill
            className="object-cover"
            sizes="64px"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 text-slate-900 font-semibold text-sm">
            <Eye className="w-3.5 h-3.5 text-slate-600" />
            <span>Original</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 truncate">
            {isGlancingOriginal ? 'Showing unpainted' : 'Tap to glance original'}
          </span>
        </div>
      </button>
    </div>
  );
}
