'use client';

import React, { useState } from 'react';
import { Terminal, Cpu, Server, Activity } from 'lucide-react';
import Reveal from './motion/Reveal';

const FEATURES = [
  {
    id: 'shell',
    title: 'Shell Access & Web TTY',
    icon: Terminal,
    description: 'Manage your server directly via our built-in interactive browser SSH shell system. No third-party terminal client required.',
    preview: {
      header: 'Interactive Terminal Container Gateway',
      body: [
        'root@shanutechx-node-01:~# status --services',
        'CONTAINER ID   IMAGE                  STATUS          PORTS',
        'a8f9c1d2e3b4   app/service-prod       Up 14 days      0.0.0.0:3000->3000/tcp',
        'b7e6f5a4c3d2   postgres:17-alpine     Up 14 days      0.0.0.0:5432->5432/tcp',
        'root@shanutechx-node-01:~# status --firewall',
        'Status: active | Ports 80, 443, 22 OPEN',
      ],
    },
  },
  {
    id: 'catalog',
    title: '1-Click App Catalog',
    icon: Cpu,
    description: 'Deploy production stacks (WordPress, n8n, MongoDB, Redis, Lavalink, LiveKit) in one click with pre-configured environment variables.',
    preview: {
      header: 'Catalog Stack Installer',
      body: [
        'Selected Template: WordPress + MySQL Stack',
        'Auto-generated MySQL root password (Encrypted AES-GCM)',
        'Automated SSL & route initialized for subdomain.shanutechx.com',
        'SSL auto-certificate provisioned',
        'Status: RUNNING on Node-Central-01',
      ],
    },
  },
  {
    id: 'mod',
    title: 'Multi-Node Cluster Manager',
    icon: Server,
    description: 'Connect, provision, and load-balance across multiple cloud nodes with automated firewall setup.',
    preview: {
      header: 'Node Cluster Distribution',
      body: [
        'Node #1 (Amsterdam): 16 vCPU | 64 GB RAM | CPU Load: 12%',
        'Node #2 (Chicago):   8 vCPU | 32 GB RAM | CPU Load: 24%',
        'Node #3 (Colombo):   4 vCPU | 16 GB RAM | CPU Load: 8%',
        'Auto-Failover: Active',
      ],
    },
  },
  {
    id: 'analytics',
    title: 'Real-Time Telemetry & Alerts',
    icon: Activity,
    description: 'Inspect CPU, RAM, Disk, and Network bandwidth metrics live with WhatsApp & Discord alert hook triggers.',
    preview: {
      header: 'Real-Time Health Pulse',
      body: [
        'CPU Utilization: 14.2% [||.......]',
        'Memory Usage:    4.1 GB / 32 GB (12.8%)',
        'Disk Storage:     42 GB / 500 GB (8.4%)',
        'Discord Webhook: Active (Payment & Status Alerts)',
      ],
    },
  },
];

export default function PlatformShowcase() {
  const [activeFeature, setActiveFeature] = useState(FEATURES[0]);
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  return (
    <section className="py-20 px-6 max-w-7xl mx-auto font-sans relative">
      <div className="space-y-12">
        {/* Section Header */}
        <Reveal className="text-center space-y-3 flex flex-col items-center">
          <span className="text-xs font-bold font-mono tracking-widest text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full">
            Control Panel Studio
          </span>
          <h2 className="text-display">
            Experience Our <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-500">Platform</span>
          </h2>
        </Reveal>

        {/* 2-Column Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Feature Buttons */}
          <Reveal index={1} className="lg:col-span-5 space-y-3 flex flex-col justify-center">
            {FEATURES.map((feat) => {
              const active = activeFeature.id === feat.id;
              const Icon = feat.icon;
              return (
                <button
                  key={feat.id}
                  onClick={() => setActiveFeature(feat)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-start gap-4 ${
                    active
                      ? 'bg-[#0f1026] border-purple-500/50 shadow-glow-violet'
                      : 'bg-[#080918]/60 border-white/[0.06] hover:bg-[#0c0d22]'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 ${
                      active
                        ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                        : 'bg-white/5 border-white/10 text-text-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{feat.title}</h3>
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">{feat.description}</p>
                  </div>
                </button>
              );
            })}
          </Reveal>

          {/* Right Column: Live Interactive Mockup Card */}
          <Reveal index={2} className="lg:col-span-7 bg-[#080918] border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Top Mock Window Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-[11px] font-mono text-text-muted ml-2">
                  shanutechx-cloud // {activeFeature.id}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                Active Node
              </span>
            </div>

            {/* Mock Content Body */}
            <div className="py-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono text-indigo-300 font-bold uppercase tracking-wider">
                  {activeFeature.preview.header}
                </h4>
                <span className="text-xs text-text-faint font-mono">Live Terminal output</span>
              </div>

              {/* Console Code Window */}
              <div className="bg-[#03040c] border border-white/[0.08] rounded-xl p-4 font-mono text-xs space-y-2 text-text-muted shadow-inner">
                {activeFeature.preview.body.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-400 select-none">&gt;</span>
                    <span className={idx === activeFeature.preview.body.length - 1 ? 'text-emerald-300 font-bold' : ''}>
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Card Summary */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-sm text-white">{activeFeature.title}</h4>
                <p className="text-xs text-text-muted mt-0.5">{activeFeature.description}</p>
              </div>
              <a
                href={`${dashboardUrl}/login`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-glow-violet shrink-0 transition-all"
              >
                Launch Studio →
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
