'use client';

import React, { useState } from 'react';
import { Terminal, Cpu, Server, Activity } from 'lucide-react';

const FEATURES = [
  {
    id: 'shell',
    title: 'Shell Access & Web TTY',
    icon: Terminal,
    description: 'Manage your server directly via our built-in interactive browser SSH shell system. No third-party terminal client required.',
    preview: {
      header: 'Interactive Terminal Container Gateway',
      body: [
        'root@shanutechx-node-01:~# docker ps',
        'CONTAINER ID   IMAGE                  STATUS          PORTS',
        'a8f9c1d2e3b4   nixpacks/app-prod      Up 14 days      0.0.0.0:3000->3000/tcp',
        'b7e6f5a4c3d2   postgres:17-alpine     Up 14 days      0.0.0.0:5432->5432/tcp',
        'root@shanutechx-node-01:~# ufw status verbose',
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
        'Traefik router rules injected for subdomain.shanutechx.com',
        'Let\'s Encrypt SSL auto-certificate provisioned',
        'Status: RUNNING on Node-Central-01',
      ],
    },
  },
  {
    id: 'mod',
    title: 'Multi-Node Cluster Manager',
    icon: Server,
    description: 'Connect, provision, and load-balance across multiple bare-metal or cloud nodes with automated Docker & UFW firewall setup.',
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

  return (
    <section className="py-20 bg-[#0b0c1b] text-white relative font-sans border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        <div className="space-y-3">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
            Control Panel Studio
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Experience Our <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-500">Platform</span>
          </h2>
          <p className="text-text-muted text-sm max-w-xl">
            Discover the powerful features and modern tools that make our cloud management interface the perfect choice for your infrastructure needs.
          </p>
        </div>

        {/* 2-Column Grid: Feature Selector on Left, Preview Card on Right */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Feature Buttons */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-center">
            {FEATURES.map((feat) => {
              const active = activeFeature.id === feat.id;
              const Icon = feat.icon;
              return (
                <button
                  key={feat.id}
                  onClick={() => setActiveFeature(feat)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                    active
                      ? 'bg-gradient-to-r from-indigo-900/40 to-purple-900/20 border-indigo-500/50 shadow-glow-violet'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <span className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                    <Icon className="h-5 w-5 text-accent-violet-light" />
                  </span>
                  <div>
                    <h3 className={`font-bold text-sm ${active ? 'text-white font-extrabold' : 'text-text-muted'}`}>
                      {feat.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Live Mockup Card */}
          <div className="lg:col-span-7 bg-[#101228] border border-white/12 rounded-3xl p-6 shadow-2xl flex flex-col justify-between backdrop-blur-xl relative overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                <span className="text-xs font-mono text-text-muted ml-2">{activeFeature.preview.header}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300">
                Live Interface
              </span>
            </div>

            {/* Code / Output Screen */}
            <div className="py-6 space-y-3 font-mono text-xs text-indigo-200">
              {activeFeature.preview.body.map((line, idx) => (
                <p key={idx} className="leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5 font-mono">
                  {line}
                </p>
              ))}
            </div>

            {/* Bottom Card Summary */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-sm text-white">{activeFeature.title}</h4>
                <p className="text-xs text-text-muted mt-0.5">{activeFeature.description}</p>
              </div>
              <a
                href="https://dashboard.shanutechx.com"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-glow-violet shrink-0 transition-all"
              >
                Launch Studio →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
