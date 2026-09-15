'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Server,
  Layers,
  FileText,
} from 'lucide-react';

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Incident {
  id: string;
  title: string;
  body: string;
  severity: string;
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export default function IncidentDetailPage() {
  const params = useParams();
  const incidentId = params?.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) return;

    fetch(`${API_BASE}/api/status/incidents/${incidentId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setIncident(data.incident);
        setLoading(false);
      })
      .catch((err) => {
        setError('Incident record not found');
        setLoading(false);
      });
  }, [incidentId]);

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
            href="/status/history"
            className="px-3.5 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Incident Audit History</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 flex-1 w-full">
        {loading ? (
          <div className="text-center py-20 bg-[#0b0c1b] border border-white/10 rounded-3xl space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono text-slate-400">Loading incident timeline...</p>
          </div>
        ) : error || !incident ? (
          <div className="text-center py-16 border border-rose-500/30 rounded-3xl bg-[#0b0c1b] space-y-3">
            <AlertTriangle className="h-12 w-12 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-white uppercase">{error || 'Incident Not Found'}</p>
            <Link href="/status/history" className="text-xs text-purple-400 font-mono underline block">
              Return to Incident History
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Box */}
            <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-8 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                    incident.resolvedAt
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {incident.resolvedAt ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Incident Resolved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Active Outage
                    </span>
                  )}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Incident ID: {incident.id.slice(0, 12)}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-white">{incident.title}</h1>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-white/5 font-mono text-xs">
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">SEVERITY</span>
                  <span className="text-white font-bold uppercase">{incident.severity}</span>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">STARTED AT</span>
                  <span className="text-slate-200">{new Date(incident.startedAt).toLocaleString()}</span>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">RESOLVED AT</span>
                  <span className="text-emerald-400">
                    {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline Breakdown */}
            <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2 font-mono uppercase">
                <FileText className="h-4 w-4 text-purple-400" /> Incident Analysis &amp; Timeline
              </h2>

              <div className="space-y-6 relative pl-6 border-l-2 border-purple-500/30">
                {/* Resolution Milestone */}
                {incident.resolvedAt && (
                  <div className="relative space-y-1">
                    <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#0b0c1b]" />
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                      RESOLVED · {new Date(incident.resolvedAt).toLocaleString()}
                    </span>
                    <p className="text-xs text-slate-300 font-sans">
                      Services restored to 100% operational capacity after validation.
                    </p>
                  </div>
                )}

                {/* Monitoring Milestone */}
                <div className="relative space-y-1">
                  <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-purple-500 border-2 border-[#0b0c1b]" />
                  <span className="text-[10px] font-mono font-bold text-purple-400 uppercase">
                    INVESTIGATION &amp; REMEDIATION · {new Date(incident.startedAt).toLocaleString()}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{incident.body}</p>
                </div>
              </div>
            </div>
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
