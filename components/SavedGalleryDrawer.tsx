'use client';

import React from 'react';
import { X, Trash2, FolderOpen, Calendar, MapPin, User } from 'lucide-react';
import { CustomerDetails } from './CustomerDetailsCard';
import {
  LayerColourAssignment,
  SerializedArchitecturalLayer,
  SerializedRasterMask,
} from '@/lib/architectural-layer-engine';

export interface SavedProject {
  id: string;
  presetId: string;
  timestamp: string;
  customer: CustomerDetails;
  activeColors: Record<string, string>;
  colorCodesMap: Record<string, string>;
  customImageSrc?: string | null;
  customLayers?: SerializedArchitecturalLayer[];
  customColourAssignments?: Record<string, LayerColourAssignment>;
  customProtectedMask?: SerializedRasterMask;
  thumbnailDataUrl?: string;
}

interface SavedGalleryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedProjects: SavedProject[];
  onLoadProject: (project: SavedProject) => void;
  onDeleteProject: (id: string) => void;
}

export function SavedGalleryDrawer({
  isOpen,
  onClose,
  savedProjects,
  onLoadProject,
  onDeleteProject,
}: SavedGalleryDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-gallery-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2
              id="saved-gallery-title"
              className="text-base font-bold text-slate-900"
            >
              Saved Projects Gallery
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {savedProjects.length} client visualizer consultations saved
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {savedProjects.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <FolderOpen className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
              <p className="text-sm font-medium text-slate-600">
                No saved projects yet
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Recolor any house facade and click &quot;Save&quot; in the toolbar to archive your consultations here.
              </p>
            </div>
          ) : (
            savedProjects.map((proj) => (
              <div
                key={proj.id}
                className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 capitalize flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#147a82]" />
                      {proj.customer.name}
                    </h4>
                    <span className="text-xs text-slate-600 flex items-center gap-1 mt-0.5 capitalize">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {proj.customer.address} · {proj.customer.contact}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteProject(proj.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Swatches preview */}
                <div className="flex items-center gap-1.5 my-2.5 overflow-x-auto pb-1 no-scrollbar">
                  {Object.entries(proj.activeColors).map(([zoneId, hex]) => (
                    <div
                      key={zoneId}
                      className="w-5 h-5 rounded-md border border-black/15 shrink-0 shadow-2xs"
                      style={{ backgroundColor: hex }}
                      title={`${proj.colorCodesMap[zoneId] || ''} (${hex})`}
                    />
                  ))}
                  <span className="text-[11px] text-slate-400 font-mono ml-1">
                    {Object.keys(proj.activeColors).length} shades
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {proj.timestamp}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      onLoadProject(proj);
                      onClose();
                    }}
                    className="px-3 py-1 bg-[#147a82]/10 hover:bg-[#147a82]/20 text-[#147a82] font-semibold rounded-lg transition-colors"
                  >
                    Load into Canvas
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
