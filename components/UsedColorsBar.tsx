'use client';

import React from 'react';
import { History, Check } from 'lucide-react';
import { BIHANI_COLORS, BihaniColor } from '@/lib/bihani-colors';

interface UsedColorsBarProps {
  usedColorCodes: string[];
  activeColor: BihaniColor;
  onSelectColor: (color: BihaniColor) => void;
}

export function UsedColorsBar({
  usedColorCodes,
  activeColor,
  onSelectColor,
}: UsedColorsBarProps) {
  // If no shades applied yet or empty, don't show
  if (!usedColorCodes || usedColorCodes.length === 0) {
    return null;
  }

  // Deduplicate used codes
  const uniqueCodes = Array.from(new Set(usedColorCodes));

  return (
    <div className="w-full bg-white rounded-xl p-3 border border-slate-200 shadow-2xs mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
          <History className="w-3.5 h-3.5 text-[#147a82]" />
          <span>Used Colors on This Project</span>
        </div>
        <span className="text-[11px] text-slate-400">
          Tap any chip to reactivate for other walls
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {uniqueCodes.map((code) => {
          const colorObj =
            BIHANI_COLORS.find((c) => c.code.toLowerCase() === code.toLowerCase()) || {
              code,
              name: 'Custom Applied',
              hex: '#147a82',
              category: 'Weatherproof Exterior',
            };
          const isActive = activeColor.code === colorObj.code;

          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelectColor(colorObj as BihaniColor)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
              title={`Switch active color to ${colorObj.code} (${colorObj.name})`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs"
                style={{ backgroundColor: colorObj.hex }}
              />
              <span className="font-mono font-bold">{colorObj.code}</span>
              <span className="text-[11px] opacity-80">{colorObj.name}</span>
              {isActive && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
