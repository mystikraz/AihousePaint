'use client';

import React from 'react';
import {
  User,
  MapPin,
  Phone,
  Calendar,
  Edit3,
  FileSpreadsheet,
  FileCheck2,
} from 'lucide-react';

export interface CustomerDetails {
  name: string;
  address: string;
  contact: string;
  submittedDate: string;
  receivedDate: string;
}

interface CustomerDetailsCardProps {
  details: CustomerDetails;
  onEditClick: () => void;
  onGenerateJobSheet: () => void;
}

export function CustomerDetailsCard({
  details,
  onEditClick,
  onGenerateJobSheet,
}: CustomerDetailsCardProps) {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 p-4 shadow-2xs my-3">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#147a82]/10 text-[#147a82] flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-none">
              Dealer Consultation &amp; Job Sheet
            </h3>
            <span className="text-[11px] text-slate-500">
              Bihani Authorized Dealer Service Record
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEditClick}
            className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-200"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
            <span>Edit Details</span>
          </button>
          <button
            type="button"
            onClick={onGenerateJobSheet}
            className="flex items-center gap-1 text-xs font-semibold text-[#147a82] hover:text-[#0f3f45] bg-[#147a82]/8 hover:bg-[#147a82]/15 px-2.5 py-1.5 rounded-lg transition-colors border border-[#147a82]/20"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Export Spec Sheet</span>
          </button>
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3">
        {/* Name */}
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" /> Client Name
          </span>
          <span className="text-sm font-bold text-slate-900 capitalize mt-0.5">
            {details.name}
          </span>
        </div>

        {/* Address */}
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400" /> Site Address
          </span>
          <span className="text-sm font-semibold text-slate-800 capitalize mt-0.5">
            {details.address}
          </span>
        </div>

        {/* Contact */}
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Phone className="w-3 h-3 text-slate-400" /> Phone Contact
          </span>
          <span className="text-sm font-mono font-semibold text-slate-800 mt-0.5">
            {details.contact}
          </span>
        </div>

        {/* Submitted Date */}
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" /> Submitted
          </span>
          <span className="text-sm font-medium text-slate-800 mt-0.5">
            {details.submittedDate}
          </span>
        </div>

        {/* Received Date */}
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" /> Received
          </span>
          <span className="text-sm font-medium text-slate-800 mt-0.5">
            {details.receivedDate}
          </span>
        </div>
      </div>
    </div>
  );
}
