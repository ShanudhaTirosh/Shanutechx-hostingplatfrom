'use client';

import React from 'react';
import { Zap, ShieldCheck, RefreshCw, Settings, BarChart2, Cloud } from 'lucide-react';
import Reveal from './motion/Reveal';
import TiltCard from './motion/TiltCard';

const ADVANCED_ITEMS = [
  {
    title: 'High Performance',
    icon: Zap,
    description: 'Powered by high-performance enterprise processors for maximum single-thread and multi-thread performance.',
  },
  {
    title: 'Low Latency',
    icon: Zap,
    description: 'Optimized network routing infrastructure for minimal ping lag and latency.',
  },
  {
    title: 'Advanced Security',
    icon: ShieldCheck,
    description: 'Multi-layered DDoS protection, automated network firewall, and AES-256 encrypted secrets vault.',
    wide: true,
  },
  {
    title: 'Auto Recovery',
    icon: RefreshCw,
    description: 'Automated process recovery, database rotation, and secure cloud backup snapshots.',
  },
  {
    title: 'Full Control',
    icon: Settings,
    description: 'Complete web control panel with browser SSH/TTY, container exports, and API access.',
  },
  {
    title: 'Resource Scaling',
    icon: BarChart2,
    description: 'Dynamic CPU cores, RAM, and storage allocation based on real-time application load demands.',
  },
  {
    title: 'Global Network',
    icon: Cloud,
    description: 'Worldwide edge locations across Americas, Europe, and Asia-Pacific for optimal connectivity.',
  },
];

export default function AdvancedFeatures() {
  return (
    <section className="py-20 bg-transparent text-white relative font-sans border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        {/* Category Badge & Heading */}
        <Reveal className="space-y-3">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-600/20 text-purple-300 border border-purple-500/30">
            We Won't Disappoint
          </span>
          <h2 className="text-display">
            Advanced <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-500">Features</span>
          </h2>
          <p className="text-text-muted text-sm max-w-lg">
            Everything you need for professional cloud deployment, game server hosting, and high-availability databases.
          </p>
        </Reveal>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ADVANCED_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Reveal key={idx} index={idx} className={item.wide ? 'lg:col-span-2' : ''}>
                <TiltCard
                  strength={5}
                  className={`h-full bg-[#0d0e1f] border border-white/[0.08] hover:border-purple-500/40 rounded-3xl p-6 hover:shadow-glow-violet flex flex-col justify-between ${
                    item.wide ? 'bg-gradient-to-r from-[#0d0e1f] to-[#12132e]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-extrabold text-lg text-white tracking-tight">
                      {item.title}
                    </h3>
                    <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-purple-300">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-4 leading-relaxed font-sans">
                    {item.description}
                  </p>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
