'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { CanvasViewer } from '@/components/CanvasViewer';
import { ColorSelectorBar } from '@/components/ColorSelectorBar';
import { UsedColorsBar } from '@/components/UsedColorsBar';
import { ColorPaletteModal } from '@/components/ColorPaletteModal';
import {
  CustomerDetailsCard,
  CustomerDetails,
} from '@/components/CustomerDetailsCard';
import { EditCustomerModal } from '@/components/EditCustomerModal';
import { SaveModal } from '@/components/SaveModal';
import {
  SavedGalleryDrawer,
  SavedProject,
} from '@/components/SavedGalleryDrawer';
import { AiAdviceModal } from '@/components/AiAdviceModal';
import { exportJobSpecificationSheet } from '@/components/JobSheetExport';
import {
  ARCHITECTURAL_PRESETS,
  ArchitecturalPreset,
} from '@/lib/architectural-presets';
import { BIHANI_COLORS, DEFAULT_COLOR, BihaniColor } from '@/lib/bihani-colors';
import { PaletteSuggestionTheme } from '@/app/api/gemini/suggest-palettes/route';
import {
  ArchitecturalLayer,
  LayerColourAssignment,
  RasterMask,
  deserializeLayers,
  deserializeMask,
  cloneMask,
  MAX_WORKING_MASK_PIXELS,
  serializeMask,
  serializeLayers,
} from '@/lib/architectural-layer-engine';

interface HistoryState {
  colors: Record<string, string>;
  codes: Record<string, string>;
  customLayers: ArchitecturalLayer[];
  customColourAssignments: Record<string, LayerColourAssignment>;
  customProtectedMask: RasterMask | null;
}

export default function BihaniVisualizerPage() {
  const [activePreset, setActivePreset] = useState<ArchitecturalPreset>(
    ARCHITECTURAL_PRESETS[0]
  );
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<BihaniColor>(DEFAULT_COLOR);

  // Initialize zone colors from preset defaults
  const initializeColors = (preset: ArchitecturalPreset) => {
    const colMap: Record<string, string> = {};
    const codeMap: Record<string, string> = {};
    preset.zones.forEach((z) => {
      colMap[z.id] = z.defaultColor;
      codeMap[z.id] = z.defaultCode;
    });
    return { colMap, codeMap };
  };

  const initial = initializeColors(ARCHITECTURAL_PRESETS[0]);
  const [activeColors, setActiveColors] = useState<Record<string, string>>(
    initial.colMap
  );
  const [colorCodesMap, setColorCodesMap] = useState<Record<string, string>>(
    initial.codeMap
  );
  const [customLayers, setCustomLayers] = useState<ArchitecturalLayer[]>([]);
  const [customColourAssignments, setCustomColourAssignments] = useState<
    Record<string, LayerColourAssignment>
  >({});
  const [customProtectedMask, setCustomProtectedMask] = useState<RasterMask | null>(null);
  const [decompositionStatus, setDecompositionStatus] = useState<'idle' | 'processing' | 'ready' | 'fallback'>('idle');
  const decompositionAbortRef = useRef<AbortController | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Undo / Redo stacks (up to 25 steps)
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  // Compare & glance states
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isGlancingOriginal, setIsGlancingOriginal] = useState(false);

  // Modals state
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSavedGalleryOpen, setIsSavedGalleryOpen] = useState(false);
  const [isAiAdviceOpen, setIsAiAdviceOpen] = useState(false);

  // Customer Job Sheet Details (pre-filled with authentic values)
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    name: 'dilip',
    address: 'bharatpur',
    contact: '9855024639',
    submittedDate: 'Sep 28, 2026',
    receivedDate: 'Sep 28, 2026',
  });

  // Saved projects gallery in LocalStorage
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bihani_saved_projects');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load saved projects from localStorage', e);
      }
    }
    return [];
  });

  // Save projects helper
  const persistSavedProjects = (list: SavedProject[]) => {
    setSavedProjects(list);
    try {
      localStorage.setItem('bihani_saved_projects', JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  };

  // Preset switch
  const handleSelectPreset = (preset: ArchitecturalPreset) => {
    setActivePreset(preset);
    setCustomImageSrc(null);
    const init = initializeColors(preset);
    setActiveColors(init.colMap);
    setColorCodesMap(init.codeMap);
    setCustomLayers([]);
    setCustomColourAssignments({});
    setCustomProtectedMask(null);
    decompositionAbortRef.current?.abort();
    setDecompositionStatus('idle');
    setHistory([]);
    setFuture([]);
    setIsGlancingOriginal(false);
  };

  // Hidden file input for photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose a supported image file.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setUploadError('Images must be smaller than 12 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.naturalWidth * image.naturalHeight > MAX_WORKING_MASK_PIXELS) {
        setUploadError(null);
      }
      const scale = Math.min(
        1,
        Math.sqrt(MAX_WORKING_MASK_PIXELS / (image.naturalWidth * image.naturalHeight)),
        2048 / image.naturalWidth,
        2048 / image.naturalHeight
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const resizeCanvas = document.createElement('canvas');
      resizeCanvas.width = width;
      resizeCanvas.height = height;
      const resizeContext = resizeCanvas.getContext('2d');
      if (!resizeContext) {
        setUploadError('The image could not be prepared for editing.');
        return;
      }
      resizeContext.drawImage(image, 0, 0, width, height);
      const resizedDataUrl = resizeCanvas.toDataURL(
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.92
      );
      setCustomImageSrc(resizedDataUrl);
      setCustomLayers([]);
      setCustomColourAssignments({});
      setCustomProtectedMask(null);
      setHistory([]);
      setFuture([]);
      decompositionAbortRef.current?.abort();
      const decompositionController = new AbortController();
      decompositionAbortRef.current = decompositionController;
      setDecompositionStatus('processing');
      void fetch('/api/decompose-architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: resizedDataUrl, imageWidth: width, imageHeight: height }),
        signal: decompositionController.signal,
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || 'Automatic decomposition failed.');
          if (payload.imageWidth !== width || payload.imageHeight !== height) {
            throw new Error('Automatic decomposition returned mismatched image dimensions.');
          }
          const restoredLayers = deserializeLayers(payload.layers ?? []);
          const restoredProtectedMask = deserializeMask(payload.protectedMask);
          if (
            restoredProtectedMask.width !== width ||
            restoredProtectedMask.height !== height
          ) throw new Error('Automatic decomposition returned an invalid protected mask.');
          setCustomLayers(restoredLayers);
          setCustomProtectedMask(restoredProtectedMask);
          setDecompositionStatus('ready');
        })
        .catch((error: unknown) => {
          if (decompositionController.signal.aborted) return;
          setDecompositionStatus('fallback');
          setUploadError(error instanceof Error
            ? `${error.message} You can continue with manual selection.`
            : 'Automatic decomposition failed. You can continue with manual selection.');
        });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setUploadError('The selected file is not a readable image.');
    };
    image.src = objectUrl;
  };

  // Color a specific zone
  const handleColorZone = (zoneId: string, color: BihaniColor) => {
    // Record history
    setHistory((prev) => [
      ...prev.slice(-24),
      {
        colors: { ...activeColors },
        codes: { ...colorCodesMap },
        customLayers,
        customColourAssignments: { ...customColourAssignments },
        customProtectedMask: customProtectedMask ? cloneMask(customProtectedMask) : null,
      },
    ]);
    setFuture([]);

    setActiveColors((prev) => ({
      ...prev,
      [zoneId]: color.hex,
    }));
    setColorCodesMap((prev) => ({
      ...prev,
      [zoneId]: color.code,
    }));
  };

  // 1-Click apply palette theme from AI consultation
  const handleApplyPaletteTheme = (theme: PaletteSuggestionTheme) => {
    setHistory((prev) => [
      ...prev.slice(-24),
      {
        colors: { ...activeColors },
        codes: { ...colorCodesMap },
        customLayers,
        customColourAssignments: { ...customColourAssignments },
        customProtectedMask: customProtectedMask ? cloneMask(customProtectedMask) : null,
      },
    ]);
    setFuture([]);

    const newColors = { ...activeColors };
    const newCodes = { ...colorCodesMap };

    theme.zones.forEach((z) => {
      newColors[z.zoneId] = z.colorHex;
      newCodes[z.zoneId] = z.colorCode;
    });

    setActiveColors(newColors);
    setColorCodesMap(newCodes);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setFuture((prev) => [
      {
        colors: { ...activeColors },
        codes: { ...colorCodesMap },
        customLayers,
        customColourAssignments: { ...customColourAssignments },
        customProtectedMask: customProtectedMask ? cloneMask(customProtectedMask) : null,
      },
      ...prev,
    ]);
    setActiveColors(last.colors);
    setColorCodesMap(last.codes);
    setCustomLayers(last.customLayers);
    setCustomColourAssignments({ ...last.customColourAssignments });
    setCustomProtectedMask(last.customProtectedMask ? cloneMask(last.customProtectedMask) : null);
    setHistory((prev) => prev.slice(0, prev.length - 1));
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((prev) => [
      ...prev,
      {
        colors: { ...activeColors },
        codes: { ...colorCodesMap },
        customLayers,
        customColourAssignments: { ...customColourAssignments },
        customProtectedMask: customProtectedMask ? cloneMask(customProtectedMask) : null,
      },
    ]);
    setActiveColors(next.colors);
    setColorCodesMap(next.codes);
    setCustomLayers(next.customLayers);
    setCustomColourAssignments({ ...next.customColourAssignments });
    setCustomProtectedMask(next.customProtectedMask ? cloneMask(next.customProtectedMask) : null);
    setFuture((prev) => prev.slice(1));
  };

  const handleCustomPaint = (
    nextLayers: ArchitecturalLayer[],
    nextAssignments: Record<string, LayerColourAssignment>
  ) => {
    if (decompositionStatus === 'processing') {
      decompositionAbortRef.current?.abort();
      setDecompositionStatus('fallback');
    }
    setHistory((prev) => [
      ...prev.slice(-24),
      {
        colors: { ...activeColors },
        codes: { ...colorCodesMap },
        customLayers,
        customColourAssignments: { ...customColourAssignments },
        customProtectedMask: customProtectedMask ? cloneMask(customProtectedMask) : null,
      },
    ]);
    setFuture([]);
    setCustomLayers(nextLayers);
    setCustomColourAssignments({ ...nextAssignments });
  };

  const handleSelectColor = (color: BihaniColor) => {
    setActiveColor(color);
    const selectedLayer = customLayers.find((layer) => layer.selected);
    if (!customImageSrc || !selectedLayer) return;

    const currentAssignment = customColourAssignments[selectedLayer.id];
    if (
      currentAssignment?.colorId === color.code &&
      currentAssignment.colorHex.toLowerCase() === color.hex.toLowerCase()
    ) return;

    handleCustomPaint(
      customLayers.map((layer) =>
        layer.id === selectedLayer.id
          ? { ...layer, assignedColorId: color.code }
          : layer
      ),
      {
        ...customColourAssignments,
        [selectedLayer.id]: {
          colorId: color.code,
          colorHex: color.hex,
          colorCode: color.code,
        },
      }
    );
  };

  // Glance original photo toggle
  const handleToggleGlanceOriginal = () => {
    setIsGlancingOriginal((prev) => !prev);
    // Glance toggles comparison or resets temporary preview
  };

  // Save flow
  const handleSaveClick = () => {
    const newProject: SavedProject = {
      id: `proj_${Date.now()}`,
      presetId: activePreset.id,
      timestamp: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      customer: { ...customerDetails },
      activeColors: { ...activeColors },
      colorCodesMap: { ...colorCodesMap },
      customImageSrc,
      customLayers: serializeLayers(customLayers),
      customColourAssignments: { ...customColourAssignments },
      customProtectedMask: customProtectedMask ? serializeMask(customProtectedMask) : undefined,
    };

    const updated = [newProject, ...savedProjects];
    persistSavedProjects(updated);
    setIsSaveModalOpen(true);
  };

  // High-res download handler
  const handleDownloadHighRes = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `Bihani-${customerDetails.name || 'house'}-painted.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    }
  };

  // Side-by-side job sheet download
  const handleDownloadJobSheet = () => {
    exportJobSpecificationSheet({
      customer: customerDetails,
      zones: activePreset.zones,
      activeColors,
      colorCodesMap,
      originalImageSrc: customImageSrc || activePreset.imageSrc,
    });
  };

  // Load project from gallery drawer
  const handleLoadSavedProject = (project: SavedProject) => {
    const matchedPreset =
      ARCHITECTURAL_PRESETS.find((p) => p.id === project.presetId) ||
      ARCHITECTURAL_PRESETS[0];
    setActivePreset(matchedPreset);
    setCustomImageSrc(project.customImageSrc ?? null);
    setActiveColors(project.activeColors);
    setColorCodesMap(project.colorCodesMap);
    setCustomLayers(project.customLayers ? deserializeLayers(project.customLayers) : []);
    setCustomColourAssignments(project.customColourAssignments ?? {});
    setCustomProtectedMask(project.customProtectedMask ? deserializeMask(project.customProtectedMask) : null);
    setDecompositionStatus(project.customLayers?.some((layer) => layer.source === 'AI') ? 'ready' : 'idle');
    setCustomerDetails(project.customer);
    setHistory([]);
    setFuture([]);
  };

  // Delete saved project
  const handleDeleteSavedProject = (id: string) => {
    const filtered = savedProjects.filter((p) => p.id !== id);
    persistSavedProjects(filtered);
  };

  // List of unique codes applied so far
  const appliedCodes = [
    ...Object.values(colorCodesMap),
    ...Object.values(customColourAssignments).map(
      (assignment) => assignment.colorCode ?? assignment.colorId
    ),
  ];
  const selectedSurfaceName = customImageSrc
    ? customLayers.find((layer) => layer.selected)?.name
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Top Header */}
      <Header
        presets={ARCHITECTURAL_PRESETS}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        onUploadClick={handleUploadClick}
        isCompareMode={isCompareMode}
        onToggleCompare={() => setIsCompareMode((prev) => !prev)}
        onOpenAiAdvice={() => setIsAiAdviceOpen(true)}
        onOpenSavedGallery={() => setIsSavedGalleryOpen(true)}
        savedCount={savedProjects.length}
      />

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 flex flex-col">
        {uploadError && (
          <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {uploadError}
          </p>
        )}
        {customImageSrc && decompositionStatus === 'processing' && (
          <p role="status" className="mb-3 rounded-lg bg-[#147a82]/10 px-3 py-2 text-xs font-medium text-[#0f4f56]">
            Analysing architectural surfaces… You can continue manually if this takes too long.
          </p>
        )}
        {customImageSrc && decompositionStatus === 'ready' && (
          <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            AI surface analysis complete. Review the generated selections before painting.
          </p>
        )}
        {/* Interactive Canvas Recolor Engine & Split Slider */}
        <CanvasViewer
          preset={activePreset}
          customImageSrc={customImageSrc}
          activeColor={activeColor}
          activeColors={isGlancingOriginal ? {} : activeColors}
          colorCodesMap={colorCodesMap}
          onColorZone={handleColorZone}
          onApplyPaletteMap={(colors, codes) => {
            setActiveColors(colors);
            setColorCodesMap(codes);
          }}
          customLayers={customLayers}
          customColourAssignments={customColourAssignments}
          customProtectedMask={customProtectedMask}
          onCustomPaint={handleCustomPaint}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSaveClick={handleSaveClick}
          isCompareMode={isCompareMode}
          onToggleCompare={() => setIsCompareMode((prev) => !prev)}
        />

        {/* Color Selector Bar (Side-by-Side Cards beneath canvas) */}
        <ColorSelectorBar
          activeColor={activeColor}
          selectedSurfaceName={selectedSurfaceName}
          onOpenPaletteModal={() => setIsPaletteModalOpen(true)}
          originalImageSrc={customImageSrc || activePreset.imageSrc}
          onToggleGlanceOriginal={handleToggleGlanceOriginal}
          isGlancingOriginal={isGlancingOriginal}
        />

        {/* Used Colors Quick-Access Bar */}
        <UsedColorsBar
          usedColorCodes={appliedCodes}
          activeColor={activeColor}
          onSelectColor={handleSelectColor}
        />

        {/* Customer Details & Dealer Job Sheet Card */}
        <CustomerDetailsCard
          details={customerDetails}
          onEditClick={() => setIsEditCustomerOpen(true)}
          onGenerateJobSheet={handleDownloadJobSheet}
        />
      </main>

      {/* Footer info */}
      <footer className="w-full bg-white border-t border-slate-200 py-3 px-4 text-center text-xs text-slate-500">
        <p>
          © 2026 Bihani Paints Nepal · Architectural Color Visualizer &amp; Technical Consultation System · Bharatpur, Chitwan
        </p>
      </footer>

      {/* Modals & Drawers */}
      <ColorPaletteModal
        isOpen={isPaletteModalOpen}
        onClose={() => setIsPaletteModalOpen(false)}
        activeColor={activeColor}
        onSelectColor={handleSelectColor}
      />

      <EditCustomerModal
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        details={customerDetails}
        onSave={(updated) => setCustomerDetails(updated)}
      />

      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onDownloadHighRes={handleDownloadHighRes}
        onDownloadJobSheet={handleDownloadJobSheet}
        customer={customerDetails}
        appliedColorsCount={appliedCodes.length}
      />

      <SavedGalleryDrawer
        isOpen={isSavedGalleryOpen}
        onClose={() => setIsSavedGalleryOpen(false)}
        savedProjects={savedProjects}
        onLoadProject={handleLoadSavedProject}
        onDeleteProject={handleDeleteSavedProject}
      />

      <AiAdviceModal
        isOpen={isAiAdviceOpen}
        onClose={() => setIsAiAdviceOpen(false)}
        preset={activePreset}
        activeColors={activeColors}
        colorCodesMap={colorCodesMap}
        onApplyPaletteTheme={handleApplyPaletteTheme}
      />
    </div>
  );
}
