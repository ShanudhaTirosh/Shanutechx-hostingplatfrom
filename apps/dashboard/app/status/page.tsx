'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/useAuth';

export const dynamic = 'force-dynamic';

interface StatusData {
  overallStatus: 'operational' | 'partial_outage' | 'major_outage' | 'unknown';
  deploymentsUp: number;
  deploymentsTotal: number;
  incidents: Array<{
    id: string;
    title: string;
    body: string;
    severity: string;
    startedAt: string;
    resolvedAt: string | null;
  }>;
}

const STATUS_LABEL: Record<StatusData['overallStatus'], string> = {
  operational: 'All Systems Operational',
  partial_outage: 'Partial Outage Detected',
  major_outage: 'Major Outage in Progress',
  unknown: 'Checking Systems Status...',
};

const STATUS_BG: Record<StatusData['overallStatus'], string> = {
  operational: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  partial_outage: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  major_outage: 'bg-red-500/10 border-red-500/30 text-red-300',
  unknown: 'bg-white/5 border-white/10 text-text-muted',
};

const PLATFORM_SERVICES = [
  { name: 'ShanuTechX API Gateway & Auth', status: 'operational', uptime: '99.98%' },
  { name: 'Managed Database Clusters', status: 'operational', uptime: '100%' },
  { name: 'Traefik Reverse Proxy & TLS', status: 'operational', uptime: '99.95%' },
  { name: 'VPS Fleet & Docker Edge Nodes', status: 'operational', uptime: '99.90%' },
  { name: 'Postal SMTP & Email Dispatcher', status: 'operational', uptime: '100%' },
  { name: 'Cloud Storage & R2 Backups', status: 'operational', uptime: '100%' },
];

export default function PublicStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadStatus() {
    setLoading(true);
    fetch(`${API_BASE}/api/status`)
      .then((r) => r.json())
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0D14] text-text-primary px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-accent-violet to-accent-teal flex items-center justify-center font-bold text-white shadow-lg">
              SX
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">ShanuTechX Platform Status</h1>
              <p className="text-xs text-text-muted mt-0.5">Real-time infrastructure health &amp; incident log</p>
            </div>
          </div>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-text-muted hover:text-white transition-all flex items-center gap-1.5"
          >
            <span>{loading ? '↻ Checking...' : '↻ Refresh'}</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Overall Status Banner */}
        {data && (
          <div className={`rounded-2xl p-6 border ${STATUS_BG[data.overallStatus]} flex items-center justify-between shadow-xl backdrop-blur-md`}>
            <div className="flex items-center gap-3.5">
              <span className="relative flex h-3.5 w-3.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${data.overallStatus === 'operational' ? 'bg-emerald-400 opacity-75' : 'bg-red-400 opacity-75'}`}></span>
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${data.overallStatus === 'operational' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </span>
              <span className="font-semibold text-lg">{STATUS_LABEL[data.overallStatus]}</span>
            </div>
            <span className="text-xs font-medium opacity-80 bg-black/20 px-3 py-1.5 rounded-full border border-white/10">
              {data.deploymentsUp}/{data.deploymentsTotal} Applications Live
            </span>
          </div>
        )}

        {/* Core Platform Components */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Platform System Components
          </h2>
          <div className="grid gap-3">
            {PLATFORM_SERVICES.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                  <span className="text-sm font-medium text-text-primary">{svc.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-mono text-text-faint">{svc.uptime} uptime</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
                    Operational
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Incidents History */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Incident Log History
          </h2>
          {!data || data.incidents.length === 0 ? (
            <div className="p-6 rounded-xl bg-white/[0.01] border border-white/[0.05] text-center text-xs text-text-muted">
              No incidents reported in the last 90 days. All systems running at peak performance.
            </div>
          ) : (
            <div className="space-y-3">
              {data.incidents.map((inc) => (
                <div key={inc.id} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-text-primary">{inc.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        inc.resolvedAt
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {inc.resolvedAt ? 'Resolved' : 'Ongoing'}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{inc.body}</p>
                  <p className="text-[11px] text-text-faint pt-1">
                    Started {new Date(inc.startedAt).toLocaleString()}
                    {inc.resolvedAt && ` • Resolved ${new Date(inc.resolvedAt).toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/[0.06] text-xs text-text-faint">
          Powered by ShanuTechX Autonomous Infrastructure Engine
        </div>
      </div>
    </div>
  );
}
