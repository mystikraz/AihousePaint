'use client';

import React, { useState } from 'react';
import { X, Save, UserCheck } from 'lucide-react';
import { CustomerDetails } from './CustomerDetailsCard';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: CustomerDetails;
  onSave: (updated: CustomerDetails) => void;
}

export function EditCustomerModal({
  isOpen,
  onClose,
  details,
  onSave,
}: EditCustomerModalProps) {
  const [formData, setFormData] = useState<CustomerDetails>({ ...details });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-client-title"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#147a82] text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <h2
              id="edit-client-title"
              className="text-base font-bold text-slate-900"
            >
              Edit Customer &amp; Job Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#147a82]/20 focus:border-[#147a82]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Site Address / City
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#147a82]/20 focus:border-[#147a82]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Contact
            </label>
            <input
              type="text"
              required
              value={formData.contact}
              onChange={(e) =>
                setFormData({ ...formData, contact: e.target.value })
              }
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#147a82]/20 focus:border-[#147a82]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Submitted Date
              </label>
              <input
                type="text"
                value={formData.submittedDate}
                onChange={(e) =>
                  setFormData({ ...formData, submittedDate: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#147a82]/20 focus:border-[#147a82]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Received Date
              </label>
              <input
                type="text"
                value={formData.receivedDate}
                onChange={(e) =>
                  setFormData({ ...formData, receivedDate: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#147a82]/20 focus:border-[#147a82]"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#147a82] hover:bg-[#0f3f45] rounded-lg shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
