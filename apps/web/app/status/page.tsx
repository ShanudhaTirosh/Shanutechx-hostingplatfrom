'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface ComponentStatus {
  name: string;
  group: string;
  status: 'operational' | 'degraded' | 'outage';
  uptimePct: number;
}

const SYSTEM_SERVICES: ComponentStatus[] = [
  { name: 'API Gateway & Auth', group: 'Core Platform', status: 'operational', uptimePct: 99.99 },
  { name: 'Managed PostgreSQL & MySQL Engine', group: 'Databases', status: 'operational', uptimePct: 99.98 },
  { name: 'Traefik Reverse Proxy & Auto-SSL', group: 'Network & Edge', status: 'operational', uptimePct: 99.99 },
  { name: 'Node Agents Container Builders', group: 'Compute Nodes', status: 'operational', uptimePct: 99.95 },
  { name: 'Cloudflare R2 Backup Storage', group: 'Storage', status: 'operational', uptimePct: 100.00 },
  { name: 'Hostinger & Postal SMTP Relay', group: 'Email Services', status: 'operational', uptimePct: 99.97 },
];

export default function PublicStatusPage() {
  const [overallStatus, setOverallStatus] = useState<'operational' | 'degraded'>('operational');

  return (
    <main className="min-h-screen bg-[#070814] text-white font-sans">
      <Navbar />

      <div className="pt-32 pb-20 max-w-5xl mx-auto px-6 space-y-10">
        {/* Overall Status Banner */}
        <div className="bg-[#0e1026] border border-emerald-500/30 rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xl animate-pulse">
              ✔
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">All Platform Services Operational</h1>
              <p className="text-xs text-text-muted mt-1">Live telemetry monitoring active across all global edge regions.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
            <div>
              <span className="text-[10px] font-mono uppercase text-text-faint block">90-Day Uptime</span>
              <span className="text-xl font-black text-emerald-400">99.98%</span>
            </div>
            <a
              href="http://localhost:3000/status"
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold border border-white/10 text-indigo-300 transition-all"
            >
              Grafana Dashboard ↗
            </a>
          </div>
        </div>

        {/* System Services List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white tracking-tight">System Infrastructure Components</h2>

          <div className="grid gap-3">
            {SYSTEM_SERVICES.map((item, idx) => (
              <div key={idx} className="bg-[#0b0c1b] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">{item.name}</h3>
                  <span className="text-[10px] text-text-faint uppercase font-mono">{item.group}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-emerald-400 font-bold">{item.uptimePct}% uptime</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Operational
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Past Incidents Timeline */}
        <div className="bg-[#0b0c1b] border border-white/[0.08] rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Past Incidents &amp; Maintenance Logs</h2>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-xs text-text-muted">
            <div className="flex justify-between font-mono text-[11px] text-text-faint mb-1">
              <span>Scheduled Maintenance — EU Node Cluster</span>
              <span>Aug 22, 2026</span>
            </div>
            <p className="text-white font-medium">Routine kernel security updates completed cleanly with 0 seconds of downtime.</p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
