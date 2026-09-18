'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  metadata?: Record<string, string>;
}

export default function AdminObservabilityStudioPage() {
  const [activeTab, setActiveTab] = useState<'loki' | 'grafana' | 'dashboards'>('loki');
  
  // Loki State
  const [logQuery, setLogQuery] = useState('{app=~".+"}');
  const [logLevel, setLogLevel] = useState('all');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lokiStatus, setLokiStatus] = useState<string>('unconfigured');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Grafana State
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [grafanaConfigured, setGrafanaConfigured] = useState(false);
  const [clusterMetrics, setClusterMetrics] = useState<any>(null);

  function fetchLokiLogs() {
    setLoadingLogs(true);
    api.admin.observability.queryLogs(logQuery, 100)
      .then((res) => {
        setLokiStatus(res.status);
        setLogs(res.entries || []);
      })
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  }

  function fetchDashboardsAndMetrics() {
    api.admin.observability.getDashboards()
      .then((res) => {
        setGrafanaConfigured(res.isConfigured);
        setDashboards(res.dashboards || []);
      })
      .catch(() => {});

    api.admin.monitoring.getStatus()
      .then((res) => {
        if (res.grafana) setClusterMetrics(res.grafana);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetchLokiLogs();
    fetchDashboardsAndMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchLokiLogs, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, logQuery]);

  const filteredLogs = logs.filter((log) => {
    if (logLevel === 'all') return true;
    return log.level === logLevel;
  });

  return (
    <div className="min-h-screen bg-[#070914] text-white p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            Grafana &amp; Loki Observability Studio
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">
              Production Telemetry
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time LogQL log search across VPS nodes and Docker containers alongside Grafana PromQL metrics
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/10 rounded-2xl">
          <button
            onClick={() => setActiveTab('loki')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'loki' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Loki Log Explorer
          </button>
          <button
            onClick={() => setActiveTab('grafana')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'grafana' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Prometheus Metrics
          </button>
          <button
            onClick={() => setActiveTab('dashboards')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'dashboards' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dashboards ({dashboards.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LOKI LOG EXPLORER */}
      {activeTab === 'loki' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${lokiStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-xs font-mono font-bold uppercase text-slate-300">
                  Loki Stream: {lokiStatus.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-slate-400 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900 text-orange-500 focus:ring-orange-500"
                  />
                  <span>Auto-Refresh (5s)</span>
                </label>

                <button
                  onClick={fetchLokiLogs}
                  disabled={loadingLogs}
                  className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all flex items-center gap-2"
                >
                  <svg className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filter Inputs */}
            <div className="grid md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-3">
                <label className="font-bold text-slate-300 block mb-1">LogQL Search Query</label>
                <input
                  type="text"
                  placeholder='e.g. {app="api"} or {container_name=~".+"}'
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Severity Level</label>
                <select
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-orange-500"
                >
                  <option value="all">All Levels</option>
                  <option value="info">INFO</option>
                  <option value="warn">WARN</option>
                  <option value="error">ERROR</option>
                  <option value="debug">DEBUG</option>
                </select>
              </div>
            </div>
          </div>

          {/* Terminal Log Console */}
          <div className="bg-[#05060f] border border-white/10 rounded-2xl overflow-hidden font-mono text-xs shadow-2xl">
            <div className="px-6 py-3 bg-[#0d0f26] border-b border-white/10 flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live LogQL Output ({filteredLogs.length} lines)
              </span>
              <span className="text-[10px]">Loki Datasource: {lokiStatus}</span>
            </div>

            <div className="p-4 max-h-[550px] overflow-y-auto space-y-1 divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <p className="text-slate-500 p-4 text-center italic">No log entries found for query.</p>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="pt-2 hover:bg-white/[0.02] p-1.5 rounded transition-colors flex flex-col md:flex-row md:items-start gap-3">
                    <span className="text-slate-500 text-[10px] shrink-0 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                        log.level === 'error'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : log.level === 'warn'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {log.level}
                    </span>

                    <span className="text-purple-400 font-bold shrink-0 text-[11px]">
                      [{log.source}]
                    </span>

                    <span className="text-slate-200 break-all text-[11px]">
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROMETHEUS CLUSTER METRICS */}
      {activeTab === 'grafana' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">CPU CLUSTER USAGE</span>
              <span className="text-2xl font-black text-white">{clusterMetrics?.cpuUsagePct || 0}%</span>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div style={{ width: `${Math.min(100, clusterMetrics?.cpuUsagePct || 0)}%` }} className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-full" />
              </div>
            </div>

            <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">RAM ALLOCATION</span>
              <span className="text-2xl font-black text-white">{clusterMetrics?.memoryUsagePct || 0}%</span>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div style={{ width: `${Math.min(100, clusterMetrics?.memoryUsagePct || 0)}%` }} className="h-full bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full" />
              </div>
            </div>

            <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">P95 RESPONSE LATENCY</span>
              <span className="text-2xl font-black text-emerald-400">{clusterMetrics?.p95LatencyMs || 0}ms</span>
              <span className="text-xs text-slate-400 block font-mono">P99: {clusterMetrics?.p99LatencyMs || 0}ms</span>
            </div>

            <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">SERVICE THROUGHPUT</span>
              <span className="text-2xl font-black text-indigo-300">{clusterMetrics?.throughputRps || 0} RPS</span>
              <span className="text-xs text-slate-400 block font-mono">{clusterMetrics?.activeContainersCount || 0} Containers Active</span>
            </div>
          </div>

          {/* Metrics History Chart — rendered from real Prometheus range queries */}
          {clusterMetrics?.metricsHistory && clusterMetrics.metricsHistory.length > 0 ? (
            <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white tracking-tight">Cluster Metrics — Last 60 Minutes</h3>
                <div className="flex items-center gap-4 text-[10px] font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" /> CPU %</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-purple-400 inline-block rounded" /> RAM %</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" /> Latency ms</span>
                </div>
              </div>

              {(() => {
                const history = clusterMetrics.metricsHistory;
                const W = 800, H = 160, PAD = { t: 8, b: 28, l: 32, r: 8 };
                const innerW = W - PAD.l - PAD.r;
                const innerH = H - PAD.t - PAD.b;
                const n = history.length;

                // Normalise each series to the chart height independently
                const norm = (vals: number[]) => {
                  const max = Math.max(...vals, 1);
                  return vals.map(v => (v / max) * innerH);
                };

                const cpuN = norm(history.map((p: { time: string; cpu: number; ram: number; latency: number }) => p.cpu));
                const ramN = norm(history.map((p: { time: string; cpu: number; ram: number; latency: number }) => p.ram));
                const latN = norm(history.map((p: { time: string; cpu: number; ram: number; latency: number }) => p.latency));

                const toPath = (vals: number[]) =>
                  vals.map((v, i) => {
                    const x = PAD.l + (i / (n - 1)) * innerW;
                    const y = PAD.t + innerH - v;
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  }).join(' ');

                const cpuPath = toPath(cpuN);
                const ramPath = toPath(ramN);
                const latPath = toPath(latN);

                // X-axis time labels — show every 3rd label to avoid crowding
                const labels = history.map((p: { time: string; cpu: number; ram: number; latency: number }, i: number) => ({ label: p.time, i })).filter((_: { label: string; i: number }, i: number) => i % 3 === 0);

                return (
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: 'monospace' }}>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                      const y = PAD.t + innerH * (1 - frac);
                      return (
                        <g key={frac}>
                          <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                          <text x={PAD.l - 4} y={y + 4} fill="rgba(255,255,255,0.3)" fontSize={8} textAnchor="end">
                            {Math.round(frac * 100)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Series paths */}
                    <path d={cpuPath} fill="none" stroke="#34d399" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    <path d={ramPath} fill="none" stroke="#c084fc" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    <path d={latPath} fill="none" stroke="#fbbf24" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

                    {/* X-axis labels */}
                    {labels.map(({ label, i }: { label: string; i: number }) => {
                      const x = PAD.l + (i / (n - 1)) * innerW;
                      return (
                        <text key={i} x={x} y={H - 6} fill="rgba(255,255,255,0.35)" fontSize={8} textAnchor="middle">
                          {label}
                        </text>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          ) : (
            <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm font-mono">
                {clusterMetrics?.status === 'connected'
                  ? 'No historical data yet — Prometheus may need more scrape cycles.'
                  : 'Connect Prometheus to view the metrics history chart.'}
              </p>
            </div>
          )}
        </div>
      )}


      {/* TAB 3: DASHBOARDS */}
      {activeTab === 'dashboards' && (
        <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-base font-extrabold text-white tracking-tight">Available Grafana Dashboards</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {dashboards.map((dash) => (
              <div key={dash.uid} className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-sm text-white">{dash.title}</h3>
                <span className="text-[10px] font-mono text-orange-400 block">UID: {dash.uid}</span>
                <div className="flex items-center gap-1.5 pt-2">
                  {(dash.tags || []).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-mono text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
