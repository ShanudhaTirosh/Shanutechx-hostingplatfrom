'use client';

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles, MessageSquare } from 'lucide-react';
import type { Product, Plan } from '../lib/api';

interface VpsCatalogShowcaseProps {
  products: Product[];
  dashboardUrl: string;
}

export default function VpsCatalogShowcase({ products, dashboardUrl }: VpsCatalogShowcaseProps) {
  const [selectedDuration, setSelectedDuration] = useState<'30-day' | '50-day'>('30-day');
  
  // Extract all unique provider names (product names) or use default grouping
  const providerNames = Array.from(new Set(products.map((p) => p.name)));
  
  // Active selected provider filter
  const [activeProvider, setActiveProvider] = useState<string>(
    providerNames.length > 0 ? providerNames[0] : 'All Nodes'
  );

  // Filter products by selected provider
  const filteredProducts = activeProvider === 'All Nodes'
    ? products
    : products.filter((p) => p.name === activeProvider);

  // Extract all active plans from filtered products
  const activePlans = filteredProducts.flatMap((p) =>
    (p.plans || []).map((plan) => ({
      ...plan,
      providerName: p.name,
      productDescription: p.description,
    }))
  );

  return (
    <div className="space-y-16 font-sans">
      {/* Duration & Provider Filter Controls (Matching vps.png) */}
      <div className="flex flex-col items-center gap-6">
        {/* Billing Duration Switcher */}
        <div className="bg-[#0b0c1f] border border-white/10 p-1.5 rounded-full inline-flex items-center gap-1 shadow-lg">
          <button
            onClick={() => setSelectedDuration('30-day')}
            className={`px-5 py-2 rounded-full text-xs font-bold font-mono transition-all ${
              selectedDuration === '30-day'
                ? 'bg-white text-black shadow-glow-violet'
                : 'text-text-muted hover:text-white'
            }`}
          >
            30-Day
          </button>
          <button
            onClick={() => setSelectedDuration('50-day')}
            className={`px-5 py-2 rounded-full text-xs font-bold font-mono transition-all ${
              selectedDuration === '50-day'
                ? 'bg-white text-black shadow-glow-violet'
                : 'text-text-muted hover:text-white'
            }`}
          >
            50-Day
          </button>
        </div>

        {/* Dynamic Provider Tabs (Linode, DigitalOcean, Hetzner, etc.) */}
        {providerNames.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl">
            <button
              onClick={() => setActiveProvider('All Nodes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeProvider === 'All Nodes'
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-glow-violet'
                  : 'bg-[#080918]/80 border-white/10 text-text-muted hover:text-white hover:border-white/20'
              }`}
            >
              All Providers
            </button>
            {providerNames.map((pName) => (
              <button
                key={pName}
                onClick={() => setActiveProvider(pName)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeProvider === pName
                    ? 'bg-purple-600/20 border-purple-500 text-white shadow-glow-violet'
                    : 'bg-[#080918]/80 border-white/10 text-text-muted hover:text-white hover:border-white/20'
                }`}
              >
                {pName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Plan Cards Grid (Exact matching vps.png design) */}
      {activePlans.length === 0 ? (
        <div className="bg-[#080918] border border-white/10 rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto shadow-2xl">
          <ShieldAlert className="h-12 w-12 text-purple-400 mx-auto" />
          <h3 className="text-xl font-extrabold text-white">No VPS Plans Available for {activeProvider}</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Admins &amp; Devs can add VPS provider products and plans dynamically in the Control Panel under <strong className="text-white">Admin &gt; Products &amp; Plans</strong>.
          </p>
          <a
            href={`${dashboardUrl}/admin/services`}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-violet transition-all"
          >
            Open Admin Products Manager →
          </a>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {activePlans.map((plan, idx) => {
            const specs: any = plan.specsJson || {};
            const ram = specs.ramGb ? `${specs.ramGb}GB` : (specs.ram || '1GB');
            const cpu = specs.cpuCores ? `${specs.cpuCores} ${specs.cpuCores === 1 ? 'Core' : 'Cores'}` : (specs.vCPU || '1 Core');
            const nvme = specs.storageGb ? `${specs.storageGb}GB` : (specs.storage || '25GB');
            const bandwidth = specs.bandwidth || '1TB';

            const priceDisplay = plan.currency === 'LKR'
              ? `LKR ${(plan.price / 100).toLocaleString('en-LK')}`
              : `$${(plan.price / 100).toFixed(2)}`;

            return (
              <div
                key={plan.id || idx}
                className="bg-[#090a1c] border border-white/10 hover:border-purple-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl group hover:scale-[1.02]"
              >
                {/* Header Info */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-text-muted font-bold tracking-widest block">
                      {plan.providerName}
                    </span>
                    <h3 className="text-xl font-extrabold text-white tracking-tight">{plan.name}</h3>
                  </div>

                  {/* 2x2 Specs Grid (Exact matching vps.png) */}
                  <div className="grid grid-cols-2 gap-3 bg-[#040512] border border-white/[0.08] p-3.5 rounded-2xl text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold block">RAM</span>
                      <span className="font-extrabold text-white">{ram}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold block">CPU</span>
                      <span className="font-extrabold text-white">{cpu}</span>
                    </div>
                    <div className="pt-2 border-t border-white/[0.06]">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">NVME</span>
                      <span className="font-extrabold text-white">{nvme}</span>
                    </div>
                    <div className="pt-2 border-t border-white/[0.06]">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">BANDWIDTH</span>
                      <span className="font-extrabold text-white">{bandwidth}</span>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                    {plan.productDescription || 'Entry-level cloud node for high-performance server allocations.'}
                  </p>

                  {/* Status Badge & Duration */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <span className="text-[10px] font-mono font-bold uppercase bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-text-muted">
                      • NON-RENEWABLE
                    </span>
                    <span className="text-[10px] font-mono font-bold text-text-muted">
                      {selectedDuration === '30-day' ? '30-Day' : '50-Day'}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="pt-2">
                    <span className="text-xs font-mono uppercase text-text-muted font-bold block">
                      {selectedDuration === '30-day' ? '30-DAY' : '50-DAY'}
                    </span>
                    <span className="text-2xl font-black text-white">{priceDisplay}</span>
                  </div>
                </div>

                {/* Order CTA Button */}
                <div className="pt-6">
                  <a
                    href={`${dashboardUrl}/services`}
                    className="w-full py-3 rounded-full bg-white hover:bg-slate-200 text-black font-black text-xs transition-all shadow-glow-violet flex items-center justify-center gap-2 group-hover:bg-gradient-to-r group-hover:from-purple-500 group-hover:to-indigo-500 group-hover:text-white"
                  >
                    Order Now <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
