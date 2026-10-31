'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  ShieldCheck,
  Lightbulb,
  CloudRain,
  Paintbrush,
  Check,
  RefreshCw,
  Palette,
} from 'lucide-react';
import { ArchitecturalPreset } from '@/lib/architectural-presets';
import { PaletteSuggestionTheme } from '@/app/api/gemini/suggest-palettes/route';
import { EnhanceResponseData } from '@/app/api/gemini/enhance/route';

interface AiAdviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: ArchitecturalPreset;
  activeColors: Record<string, string>;
  colorCodesMap: Record<string, string>;
  onApplyPaletteTheme: (theme: PaletteSuggestionTheme) => void;
}

export function AiAdviceModal(props: AiAdviceModalProps) {
  if (!props.isOpen) return null;
  return <AiAdviceModalContent {...props} />;
}

function AiAdviceModalContent({
  onClose,
  preset,
  activeColors,
  colorCodesMap,
  onApplyPaletteTheme,
}: AiAdviceModalProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'palettes'>('analysis');

  // Analysis state
  const [analysisData, setAnalysisData] = useState<EnhanceResponseData | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // Palettes state
  const [themes, setThemes] = useState<PaletteSuggestionTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [appliedThemeId, setAppliedThemeId] = useState<string | null>(null);

  // Fetch analysis
  const fetchAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const colorsUsed = Object.entries(activeColors).map(([zoneId, hex]) => ({
        zone: preset.zones.find((z) => z.id === zoneId)?.name || zoneId,
        code: colorCodesMap[zoneId] || 'Custom',
        hex,
      }));

      const res = await fetch('/api/gemini/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseType: preset.name,
          colorsUsed,
        }),
      });

      const data = await res.json();
      setAnalysisData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Fetch themes
  const fetchThemes = async () => {
    setLoadingThemes(true);
    try {
      const res = await fetch('/api/gemini/suggest-palettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: preset.id }),
      });
      const data = await res.json();
      if (data.themes) {
        setThemes(data.themes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingThemes(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      setLoadingAnalysis(true);
      setLoadingThemes(true);

      const colorsUsed = Object.entries(activeColors).map(([zoneId, hex]) => ({
        zone: preset.zones.find((z) => z.id === zoneId)?.name || zoneId,
        code: colorCodesMap[zoneId] || 'Custom',
        hex,
      }));

      try {
        const [enhanceRes, paletteRes] = await Promise.all([
          fetch('/api/gemini/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ houseType: preset.name, colorsUsed }),
          }),
          fetch('/api/gemini/suggest-palettes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetId: preset.id }),
          }),
        ]);

        const [enhanceData, paletteData] = await Promise.all([
          enhanceRes.json(),
          paletteRes.json(),
        ]);

        if (isMounted) {
          if (enhanceData) setAnalysisData(enhanceData);
          if (paletteData.themes) setThemes(paletteData.themes);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) {
          setLoadingAnalysis(false);
          setLoadingThemes(false);
        }
      }
    }

    initialLoad();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-advice-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#0f3f45] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#147a82] text-teal-200 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="ai-advice-title"
                className="text-base font-bold text-white flex items-center gap-2"
              >
                Bihani AI Architectural Consultation
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-200">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Technical coating analysis &amp; curated Himalayan palettes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-[#147a82] text-[#147a82]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Architectural &amp; Coating Analysis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('palettes')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'palettes'
                ? 'border-[#147a82] text-[#147a82]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Curated Themes (1-Click Apply)
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'analysis' && (
            <div>
              {loadingAnalysis ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-500">
                  <div className="w-10 h-10 border-3 border-[#147a82] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Analyzing Facade Daylight &amp; Volumetric Lines...
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Powered by multimodal Gemini 3.8 Flash
                  </p>
                </div>
              ) : analysisData ? (
                <div className="space-y-4">
                  {/* Harmony Score Banner */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-br from-[#147a82]/10 to-teal-50 rounded-xl border border-[#147a82]/20">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#147a82]">
                        Facade Aesthetic Harmony
                      </span>
                      <h3 className="text-xl font-black text-slate-900 mt-0.5">
                        {analysisData.harmonyScore}% Optimal Contrast
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 max-w-sm">
                        High volumetric balance respecting natural light reflectance and shade saturation.
                      </p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-white shadow-sm border-4 border-[#147a82] flex items-center justify-center shrink-0">
                      <span className="text-lg font-black font-mono text-[#0f3f45]">
                        {analysisData.harmonyScore}%
                      </span>
                    </div>
                  </div>

                  {/* Commentary */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Daylight &amp; Architectural Lines Analysis
                    </span>
                    <p className="text-xs sm:text-sm text-slate-700 mt-1.5 leading-relaxed">
                      {analysisData.aestheticCommentary}
                    </p>
                  </div>

                  {/* Recommended Exterior Coating */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#147a82] text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Recommended Coating Specification
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        {analysisData.recommendedCoating}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1">
                        Engineered with cross-linked silicon polymers for maximum dirt-pickup resistance against Nepal urban dust and rain streaks.
                      </p>
                    </div>
                  </div>

                  {/* Lighting and Accent Tips */}
                  <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                        Architectural Lighting Recommendation
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 mt-1">
                        {analysisData.lightingTips}
                      </p>
                    </div>
                  </div>

                  {/* Monsoon & UV Durability */}
                  <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <CloudRain className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                        Monsoon Moisture &amp; UV Endurance
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 mt-1">
                        {analysisData.monsoonProtectionAdvice}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={fetchAnalysis}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#147a82] hover:text-[#0f3f45]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-analyze Current Facade</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'palettes' && (
            <div>
              {loadingThemes ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-500">
                  <div className="w-10 h-10 border-3 border-[#147a82] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Synthesizing Curated Bihani Color Schemes...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 mb-2">
                    Expert designer color schemes curated for {preset.name}. Click &quot;Apply Palette&quot; to paint all walls and trims in one tap.
                  </p>

                  {themes.map((theme) => {
                    const isApplied = appliedThemeId === theme.id;
                    return (
                      <div
                        key={theme.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isApplied
                            ? 'border-[#147a82] ring-2 ring-[#147a82]/20 bg-[#147a82]/5'
                            : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              <Palette className="w-4 h-4 text-[#147a82]" />
                              {theme.title}
                            </h4>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {theme.concept}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onApplyPaletteTheme(theme);
                              setAppliedThemeId(theme.id);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                              isApplied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#147a82] text-white hover:bg-[#0f4f56] shadow-xs'
                            }`}
                          >
                            {isApplied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Applied!</span>
                              </>
                            ) : (
                              <>
                                <Paintbrush className="w-3.5 h-3.5" />
                                <span>Apply Palette</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Swatches preview for the theme */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                          {theme.zones.map((z) => (
                            <div
                              key={z.zoneId}
                              className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200/60"
                            >
                              <div
                                className="w-5 h-5 rounded-md border border-black/15 shrink-0"
                                style={{ backgroundColor: z.colorHex }}
                              />
                              <div className="min-w-0">
                                <span className="block font-mono text-[11px] font-bold text-slate-900 truncate">
                                  {z.colorCode}
                                </span>
                                <span className="block text-[10px] text-slate-500 truncate">
                                  {z.zoneName.split('&')[0]}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
