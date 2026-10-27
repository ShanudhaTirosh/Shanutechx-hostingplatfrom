'use client';

import React from 'react';
import Reveal from './motion/Reveal';
import GlobeCanvas from './GlobeCanvas';
import { MapPin } from 'lucide-react';

const LOCATIONS = {
  Europe: [
    { name: 'Amsterdam', detail: 'EU West (10 Gbps Uplink)' },
  ],
  Americas: [
    { name: 'Chicago, IL', detail: 'US Central (Low Latency)' },
    { name: 'Dallas, TX', detail: 'US South (DDoS Shielded)' },
    { name: 'Seattle, WA', detail: 'US West (Asia-Pac Route)' },
  ],
  AsiaPacific: [
    { name: 'Tokyo', detail: 'Asia East (Ultra-Low Ping)' },
    { name: 'Singapore', detail: 'Asia South (Tier 4 DC)' },
    { name: 'Colombo', detail: 'LK Central (Local POP)' },
  ],
};

export default function GlobeVisual() {
  return (
    <section className="py-20 bg-transparent text-white relative overflow-hidden font-sans border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Heading & Locations */}
          <Reveal className="space-y-8">
            <div className="space-y-3">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Global Edge Network
              </span>
              <h2 className="text-display leading-tight">
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
              {Object.entries(LOCATIONS).map(([region, locs], idx) => (
                <Reveal key={region} index={idx + 1}>
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-3">
                    {region === 'AsiaPacific' ? 'Asia-Pacific' : region}
                  </h3>
                  <div className="space-y-3">
                    {locs.map((loc) => (
                      <div key={loc.name} className="flex items-start gap-2.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-white">{loc.name}</p>
                          <p className="text-[10px] text-text-muted">{loc.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* Right Column: Real interactive WebGL globe */}
          <Reveal index={2} className="relative flex items-center justify-center">
            {/* Glow Aura Background */}
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 via-indigo-600/20 to-transparent blur-3xl rounded-full scale-110 pointer-events-none" />

            <div className="relative w-full max-w-md aspect-square rounded-full border border-white/10 shadow-2xl overflow-hidden bg-[#0b0c1b]/60">
              <GlobeCanvas />

              {/* Floating latency badge — glass panel over the globe */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#12142d]/80 border border-indigo-500/40 rounded-2xl px-4 py-2 text-center shadow-glow-violet backdrop-blur-md pointer-events-none">
                <span className="text-[10px] font-mono uppercase text-indigo-300 block font-bold">Latency Standard</span>
                <span className="text-base font-extrabold text-white">&lt; 15 ms Avg</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
