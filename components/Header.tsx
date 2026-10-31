'use client';

import React from 'react';
import {
  ArrowLeft,
  Upload,
  SplitSquareVertical,
  Sparkles,
  BookmarkCheck,
  ChevronDown,
  Building2,
  Home,
} from 'lucide-react';
import { ArchitecturalPreset } from '@/lib/architectural-presets';

interface HeaderProps {
  presets: ArchitecturalPreset[];
  activePreset: ArchitecturalPreset;
  onSelectPreset: (preset: ArchitecturalPreset) => void;
  onUploadClick: () => void;
  isCompareMode: boolean;
  onToggleCompare: () => void;
  onOpenAiAdvice: () => void;
  onOpenSavedGallery: () => void;
  savedCount: number;
}

export function Header({
  presets,
  activePreset,
  onSelectPreset,
  onUploadClick,
  isCompareMode,
  onToggleCompare,
  onOpenAiAdvice,
  onOpenSavedGallery,
  savedCount,
}: HeaderProps) {
  const [presetDropdownOpen, setPresetDropdownOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-xs">
      {/* Primary Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Back / Visualize & Brand Wordmark */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-1.5 text-slate-700 hover:text-slate-950 font-medium text-sm transition-colors py-2 px-2 -ml-2 rounded-md hover:bg-slate-100"
            aria-label="Visualize Home"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Visualize</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Bihani Paints Wordmark */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#147a82] to-[#0f3f45] flex items-center justify-center text-white shadow-xs">
              <span className="font-black text-sm tracking-tighter">BP</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 leading-none">
                BIHANI <span className="text-[#147a82]">PAINTS</span>
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-500 mt-0.5">
                Nepal&apos;s Leading Paint
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Preset Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors border border-slate-200/60"
            >
              <Building2 className="w-3.5 h-3.5 text-[#147a82]" />
              <span className="max-w-[110px] sm:max-w-none truncate">
                {activePreset.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {presetDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-slate-400">
                  Architectural Presets
                </div>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset);
                      setPresetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                      activePreset.id === preset.id
                        ? 'text-[#147a82] font-semibold bg-[#147a82]/5'
                        : 'text-slate-700'
                    }`}
                  >
                    {preset.category === 'Exterior Villa' ? (
                      <Building2 className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Home className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload Photo Button */}
          <button
            type="button"
            onClick={onUploadClick}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors border border-slate-200 shadow-2xs"
            title="Upload your own house photo"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden md:inline">Upload Photo</span>
          </button>

          {/* Compare (Split Before/After) */}
          <button
            type="button"
            onClick={onToggleCompare}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors border shadow-2xs ${
              isCompareMode
                ? 'bg-[#147a82] text-white border-[#147a82]'
                : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
            }`}
            title="Compare original vs painted"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare</span>
          </button>

          {/* AI Advice */}
          <button
            type="button"
            onClick={onOpenAiAdvice}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white bg-gradient-to-r from-[#147a82] to-[#0f3f45] hover:opacity-95 shadow-sm transition-opacity"
            title="AI Architectural Color & Material Advice"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            <span>AI Advice</span>
          </button>

          {/* Saved Projects Gallery */}
          <button
            type="button"
            onClick={onOpenSavedGallery}
            className="relative flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors border border-slate-200 shadow-2xs"
            title="View saved visualizer projects"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Saved</span>
            {savedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-[#147a82] text-white text-[10px] font-bold rounded-full">
                {savedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Subtitle Banner as specified in prompt */}
      <div className="bg-[#147a82]/8 border-t border-[#147a82]/15 py-1.5 px-4 text-center">
        <p className="text-xs font-medium text-[#0f3f45] tracking-wide">
          Select a color and tap on image to paint it and enjoy
        </p>
      </div>
    </header>
  );
}
