'use client';

import React, { useState, useMemo } from 'react';
import {
  Palette,
  X,
  Search,
  Check,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { BIHANI_COLORS, CATEGORIES, BihaniColor } from '@/lib/bihani-colors';

interface ColorPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeColor: BihaniColor;
  onSelectColor: (color: BihaniColor) => void;
}

export function ColorPaletteModal({
  isOpen,
  onClose,
  activeColor,
  onSelectColor,
}: ColorPaletteModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Colors');

  const filteredColors = useMemo(() => {
    return BIHANI_COLORS.filter((color) => {
      // Category filter
      if (
        selectedCategory !== 'All Colors' &&
        color.category !== selectedCategory
      ) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchCode = color.code.toLowerCase().includes(query);
        const matchName = color.name.toLowerCase().includes(query);
        const matchCategory = color.category.toLowerCase().includes(query);
        return matchCode || matchName || matchCategory;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#147a82] text-white flex items-center justify-center shadow-xs">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="palette-modal-title"
                className="text-base font-bold text-slate-900 leading-none"
              >
                Color Palette
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Authentic Bihani exterior & interior high-pigment shade library
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            aria-label="Close color palette modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by color code or name (e.g. 2434, 2252, Azure, Dusk)..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#147a82]/20 focus:border-[#147a82] transition-all placeholder:text-slate-400"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto mt-3 pb-1 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#147a82] text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 4-Column Responsive Swatch Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredColors.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm">No Bihani shades found matching &quot;{searchQuery}&quot;</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All Colors');
                }}
                className="mt-2 text-xs font-semibold text-[#147a82] hover:underline"
              >
                Reset search & filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredColors.map((color) => {
                const isSelected = activeColor.code === color.code;
                return (
                  <button
                    key={color.code}
                    type="button"
                    onClick={() => {
                      onSelectColor(color);
                      onClose();
                    }}
                    className={`group relative flex flex-col p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] hover:shadow-md ${
                      isSelected
                        ? 'border-[#147a82] ring-2 ring-[#147a82]/20 bg-[#147a82]/5'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {/* Swatch Color Preview Block */}
                    <div
                      className="w-full aspect-[16/10] rounded-lg border border-black/10 shadow-2xs relative flex items-center justify-center overflow-hidden mb-2"
                      style={{ backgroundColor: color.hex }}
                    >
                      {isSelected && (
                        <div className="w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center text-[#147a82]">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-black text-sm text-slate-900 tracking-tight">
                          {color.code}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 truncate">
                          {color.category.split(' ')[0]}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 truncate mt-0.5">
                        {color.name}
                      </span>
                      {color.description && (
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">
                          {color.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredColors.length} Bihani authentic shades</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-700 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
