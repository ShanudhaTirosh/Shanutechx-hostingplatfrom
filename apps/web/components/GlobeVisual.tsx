'use client';

import React from 'react';

const LOCATIONS = {
  Europe: [
    { name: 'Amsterdam', detail: 'EU West (10 Gbps Uplink)', flag: '🇩🇪' },
  ],
  Americas: [
    { name: 'Chicago, IL', detail: 'US Central (Low Latency)', flag: '🇺🇸' },
    { name: 'Dallas, TX', detail: 'US South (DDoS Shielded)', flag: '🇺🇸' },
    { name: 'Seattle, WA', detail: 'US West (Asia-Pac Route)', flag: '🇺🇸' },
  ],
  AsiaPacific: [
    { name: 'Tokyo', detail: 'Asia East (Ultra-Low Ping)', flag: '🇯🇵' },
    { name: 'Singapore', detail: 'Asia South (Tier 4 DC)', flag: '🇸🇬' },
    { name: 'Colombo', detail: 'LK Central (Local POP)', flag: '🇱🇰' },
  ],
};

export default function GlobeVisual() {
  return (
    <section className="py-20 bg-[#070814] text-white relative overflow-hidden font-sans border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Heading & Locations */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-3">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Global Edge Network
              </span>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Global Presence, <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-500">
                  Local Performance
                </span>
              </h2>
              <p className="text-text-muted text-sm leading-relaxed max-w-lg">
                Our rapidly expanding datacenter network spans across the Americas, Europe, and Asia-Pacific, delivering ultra-low latency from anywhere and lightning-fast connections wherever you deploy.
              </p>
            </div>

            {/* Datacenter Regions */}
            <div className="grid sm:grid-cols-3 gap-6 pt-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-3">Europe</h3>
                <div className="space-y-3">
                  {LOCATIONS.Europe.map((loc) => (
                    <div key={loc.name} className="flex items-start gap-2.5">
                      <span className="text-base">{loc.flag}</span>
                      <div>
                        <p className="text-xs font-bold text-white">{loc.name}</p>
                        <p className="text-[10px] text-text-muted">{loc.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-3">Americas</h3>
                <div className="space-y-3">
                  {LOCATIONS.Americas.map((loc) => (
                    <div key={loc.name} className="flex items-start gap-2.5">
                      <span className="text-base">{loc.flag}</span>
                      <div>
                        <p className="text-xs font-bold text-white">{loc.name}</p>
                        <p className="text-[10px] text-text-muted">{loc.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-3">Asia-Pacific</h3>
                <div className="space-y-3">
                  {LOCATIONS.AsiaPacific.map((loc) => (
                    <div key={loc.name} className="flex items-start gap-2.5">
                      <span className="text-base">{loc.flag}</span>
                      <div>
                        <p className="text-xs font-bold text-white">{loc.name}</p>
                        <p className="text-[10px] text-text-muted">{loc.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Animated Particle Globe SVG */}
          <div className="relative flex items-center justify-center">
            {/* Glow Aura Background */}
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 via-indigo-600/20 to-transparent blur-3xl rounded-full scale-110 pointer-events-none" />

            <div className="relative w-full max-w-md aspect-square flex items-center justify-center p-8 bg-[#0b0c1b]/80 border border-white/10 rounded-full shadow-2xl backdrop-blur-xl">
              <svg viewBox="0 0 400 400" className="w-full h-full text-indigo-400 animate-spin-slow">
                {/* Globe Grid Circles */}
                <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.3" />
                <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" opacity="0.4" />
                <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.5" />
                <ellipse cx="200" cy="200" rx="180" ry="120" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.5" />

                {/* Pulsing Datacenter Dots */}
                {[
                  { cx: 120, cy: 150, r: 5, name: 'Chicago' },
                  { cx: 140, cy: 210, r: 6, name: 'Dallas' },
                  { cx: 100, cy: 110, r: 5, name: 'Seattle' },
                  { cx: 230, cy: 140, r: 6, name: 'Amsterdam' },
                  { cx: 310, cy: 180, r: 6, name: 'Tokyo' },
                  { cx: 290, cy: 240, r: 6, name: 'Singapore' },
                  { cx: 270, cy: 220, r: 5, name: 'Colombo' },
                ].map((dot, idx) => (
                  <g key={idx}>
                    <circle cx={dot.cx} cy={dot.cy} r={dot.r * 2} fill="#a855f7" opacity="0.3" className="animate-ping" />
                    <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill="#7c3aed" />
                  </g>
                ))}
              </svg>

              {/* Center Globe Badge */}
              <div className="absolute bg-[#12142d] border border-indigo-500/40 rounded-2xl px-4 py-2 text-center shadow-glow-violet backdrop-blur-md">
                <span className="text-[10px] font-mono uppercase text-indigo-300 block font-bold">Latency Standard</span>
                <span className="text-base font-extrabold text-white">&lt; 15 ms Avg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
