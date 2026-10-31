'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Download,
  FileCheck2,
} from 'lucide-react';
import { CustomerDetails } from './CustomerDetailsCard';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadHighRes: () => void;
  onDownloadJobSheet: () => void;
  customer: CustomerDetails;
  appliedColorsCount: number;
}

export function SaveModal(props: SaveModalProps) {
  if (!props.isOpen) return null;
  return <SaveModalContent {...props} />;
}

function SaveModalContent({
  onClose,
  onDownloadHighRes,
  onDownloadJobSheet,
  customer,
  appliedColorsCount,
}: SaveModalProps) {
  const [phase, setPhase] = useState<'saving' | 'success'>('saving');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('success');
    }, 950);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      {/* Success Floating Toast when in success phase */}
      {phase === 'success' && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>✓ House Preview saved to gallery</span>
        </div>
      )}

      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-center"
        role="dialog"
        aria-modal="true"
      >
        {phase === 'saving' ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center">
            {/* Centered circular spinner */}
            <div className="w-12 h-12 border-3 border-[#147a82] border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-base font-bold text-slate-900">
              Saving to gallery...
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Archiving color coordinates and architectural specs
            </p>
          </div>
        ) : (
          <div className="p-6 flex flex-col items-center">
            {/* Success Header */}
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Project Successfully Saved!
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Client{' '}
              <span className="font-semibold text-slate-700 capitalize">
                {customer.name}
              </span>{' '}
              ({customer.address}) recorded with {appliedColorsCount} custom Bihani architectural shades.
            </p>

            {/* Download Options */}
            <div className="w-full mt-6 space-y-2.5">
              <button
                type="button"
                onClick={onDownloadHighRes}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-[#147a82] transition-colors">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      1. High-Resolution Painted Image
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Download crisp JPG render for client presentation
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onDownloadJobSheet}
                className="w-full flex items-center justify-between p-3.5 bg-[#147a82]/5 hover:bg-[#147a82]/10 rounded-xl border border-[#147a82]/30 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#147a82] text-white flex items-center justify-center shadow-xs">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#0f3f45]">
                      2. Side-by-Side Job Specification Sheet
                    </span>
                    <span className="block text-[11px] text-slate-600">
                      Official Bihani sheet with before/after and swatch codes
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Done Button */}
            <div className="w-full mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Accessible anytime via &quot;Saved&quot; in header
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#147a82] hover:bg-[#0f4f56] rounded-lg transition-colors shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
