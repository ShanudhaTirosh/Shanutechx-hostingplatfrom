'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Wrench,
} from 'lucide-react';

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ScheduledMaintenance {
  id: string;
  title: string;
  description: string;
  impact: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  updates?: Array<{ timestamp: string; message: string }>;
}

export default function StatusMaintenancePage() {
  const [maintenances, setMaintenances] = useState<ScheduledMaintenance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/status/public`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setMaintenances(data.scheduledMaintenances || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#07070e] text-white font-sans flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-[#07070e]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/status" className="flex items-center gap-2 font-bold tracking-tight text-white text-sm">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-400 flex items-center justify-center text-white font-black text-xs shadow-lg">
              STX
            </span>
            <span>
              SHANUTECHX <span className="text-purple-400 font-extrabold">Status</span>
            </span>
          </Link>

          <Link
            href="/status"
            className="px-3.5 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Live Telemetry</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8 flex-1 w-full">
        {/* Header Title */}
        <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-8 space-y-3 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-[10px] uppercase">
            <Wrench className="h-3.5 w-3.5" /> PLANNED INFRASTRUCTURE MAINTENANCE
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
            Scheduled Maintenance Windows
          </h1>
          <p className="text-xs text-slate-400">
            Upcoming and historical system upgrade windows, database optimization windows, and network kernel updates.
          </p>
        </div>

        {/* Maintenance Cards */}
        {loading ? (
          <div className="text-center py-20 bg-[#0b0c1b] border border-white/10 rounded-3xl space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono text-slate-400">Loading maintenance schedule...</p>
          </div>
        ) : maintenances.length === 0 ? (
          <div className="text-center py-16 border border-white/10 rounded-3xl bg-[#0b0c1b] space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-white uppercase tracking-wider">No Maintenance Currently Scheduled</p>
            <p className="text-xs text-slate-400 font-mono">All compute nodes and core databases are operating at full capacity.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {maintenances.map((m) => (
              <div
                key={m.id}
                className="bg-[#0b0c1b] border border-white/10 rounded-2xl p-6 space-y-4 hover:border-indigo-500/40 transition-all shadow-xl"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>{m.title}</span>
                  </h3>
                  <span
                    className={`px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                      m.status === 'in_progress'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">{m.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/5 text-xs font-mono">
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">SCHEDULED START</span>
                    <span className="text-indigo-300 font-bold">{new Date(m.scheduledStart).toUTCString()}</span>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">SCHEDULED END</span>
                    <span className="text-indigo-300 font-bold">{new Date(m.scheduledEnd).toUTCString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#07070e] py-6 text-xs text-slate-400 font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p>© 2026 SHANUTECHX CLOUD PLATFORM™.</p>
          <Link href="/status" className="hover:text-white transition-colors">
            Live Telemetry
          </Link>
        </div>
      </footer>
    </div>
  );
}
