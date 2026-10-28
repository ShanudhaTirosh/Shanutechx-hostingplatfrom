'use client';

import React from 'react';
import { X, ShieldCheck, Zap, HardDrive, Globe, Clock, CheckCircle2, Server } from 'lucide-react';

export interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  category?: string;
  price: number;
  currency?: string;
  specs?: Record<string, any>;
  features?: string[];
  onProceedToBuy?: () => void;
  buyLabel?: string;
}

export function ProductDetailsModal({
  isOpen,
  onClose,
  productName,
  category,
  price,
  currency = 'Rs',
  specs = {},
  features = [],
  onProceedToBuy,
  buyLabel = 'Proceed to Order',
}: ProductDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#121215] border border-white/15 rounded-3xl p-6 md:p-8 w-full max-w-xl text-white shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-neutral-300">
                {category || 'Enterprise Cloud'}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Instant Automated Provisioning
              </span>
            </div>
            <h2 className="text-xl font-black text-white">{productName}</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Technical specifications, SLA limits, and cluster allocation details.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pricing & Guarantee Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-400 block font-mono">Verified Pricing</span>
            <span className="text-2xl font-black text-white font-mono">
              {currency} {price.toLocaleString()}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 justify-end">
              <ShieldCheck className="w-4 h-4" /> 99.9% Uptime SLA
            </span>
            <span className="text-[11px] text-neutral-400 block">Bank Transfer & Crypto Verified</span>
          </div>
        </div>

        {/* Specs Table */}
        {specs && Object.keys(specs).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
              Resource Allocations & Engine Specs
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {Object.entries(specs).map(([key, val]) => (
                <div key={key} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[11px] text-neutral-400 block capitalize">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <span className="text-white font-semibold block mt-0.5">
                    {val === -1 ? 'Unlimited' : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Features Included */}
        {features.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
              Standard Inclusions
            </h4>
            <div className="space-y-1.5 text-xs text-neutral-300">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Infrastructure & Security Disclosures */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-neutral-400 space-y-1.5">
          <p className="flex items-center gap-2 text-neutral-300 font-semibold">
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Fulfillment & Activation SLA</span>
          </p>
          <p>
            Containers and mailboxes provision instantly on order review approval. Dedicated VPS instances undergo automatic OS virtualization and Cloudflare DNS binding within 24 to 72 hours.
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Close
          </button>
          {onProceedToBuy && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onProceedToBuy();
              }}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold flex items-center gap-2 shadow-lg shadow-white/10 transition-colors"
            >
              <span>{buyLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
