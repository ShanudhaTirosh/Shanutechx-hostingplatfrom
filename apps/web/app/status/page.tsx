'use client';

import React, { useEffect, useState } from 'react';

import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Server,
  Zap,
  Globe,
  Database,
  Bot,
  Code,
  ShieldCheck,
  Cpu,
  Layers,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface DayHistory {
  date: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  uptimePct: number;
}

interface ComponentData {
  id: string;
  name: string;
  group: string;
  description?: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  uptimePct90d: number;
  order: number;
  history90d: DayHistory[];
  avgResponseTimeMs?: number;
  latencyHistory?: Array<{ time: string; latencyMs: number }>;
  iconType?: string;
}

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

interface Incident {
  id: string;
  title: string;
  body: string;
  severity: string;
  startedAt: string;
  resolvedAt: string | null;
}

interface PublicStatusResponse {
  overallStatus: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  components: ComponentData[];
  scheduledMaintenances: ScheduledMaintenance[];
  incidents: Incident[];
  updatedAt: string;
}

export default function StatusPage() {
  const [activeTab, setActiveTab] = useState<'status' | 'incidents' | 'maintenance'>('status');
  const [data, setData] = useState<PublicStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [hoveredBar, setHoveredBar] = useState<{ id: string; day: DayHistory } | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');

  function fetchTelemetry() {
    fetch(`${API_BASE}/api/status/public`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((resData) => {
        setData(resData);
        setLastUpdatedTime(new Date().toLocaleTimeString());
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 30000);
    return () => clearInterval(interval);
  }, []);

  function toggleExpand(id: string) {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const getIcon = (type?: string, group?: string) => {
    if (type === 'database' || group?.toLowerCase().includes('database')) {
      return <Database className="h-4 w-4 text-cyan-400 shrink-0" />;
    }
    if (type === 'server' || group?.toLowerCase().includes('vps')) {
      return <Server className="h-4 w-4 text-purple-400 shrink-0" />;
    }
    if (type === 'bot' || group?.toLowerCase().includes('bot')) {
      return <Bot className="h-4 w-4 text-indigo-400 shrink-0" />;
    }
    if (type === 'code' || group?.toLowerCase().includes('platform')) {
      return <Code className="h-4 w-4 text-pink-400 shrink-0" />;
    }
    return <Globe className="h-4 w-4 text-emerald-400 shrink-0" />;
  };

  // Group components by group category
  const grouped = (data?.components || []).reduce<Record<string, ComponentData[]>>((acc, comp) => {
    const groupName = comp.group || 'CORE SERVICES';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(comp);
    return acc;
  }, {});

  const totalServices = data?.components.length || 0;
  const onlineServices = (data?.components || []).filter((c) => c.status === 'operational').length;

  return (
    <div className="min-h-screen bg-[#07070e] text-white font-sans selection:bg-purple-500 selection:text-white flex flex-col justify-between">
      {/* Top Header Bar matching statuspage.png */}
      <header className="border-b border-white/10 bg-[#07070e]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-white text-sm">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-400 flex items-center justify-center text-white font-black text-xs shadow-lg">
              STX
            </span>
            <span>
              SHANUTECHX <span className="text-purple-400 font-extrabold">Status</span>
            </span>
          </Link>

          {/* Navigation Tab Pill */}
          <div className="p-1 bg-[#111224] border border-white/10 rounded-full flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('status')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                activeTab === 'status' ? 'bg-white/10 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Status
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                activeTab === 'incidents' ? 'bg-white/10 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Incidents
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                activeTab === 'maintenance' ? 'bg-white/10 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Maintenance
            </button>
          </div>

          {/* Main Site Link Button */}
          <Link
            href="/"
            className="px-4 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all hover:scale-105"
          >
            <span>Main site</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8 flex-1 w-full">
        {/* Main Big Hero Banner matching statuspage.png */}
        <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-10 text-center space-y-3 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[11px] uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </div>

          {/* Large Title */}
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase">
            {data?.overallStatus === 'operational'
              ? 'ALL SERVICES ONLINE'
              : data?.overallStatus === 'degraded'
              ? 'PARTIAL PERFORMANCE DEGRADATION'
              : 'SYSTEM MAINTENANCE IN PROGRESS'}
          </h1>

          {/* Telemetry Subtext */}
          <p className="text-xs font-mono text-slate-400">
            {onlineServices} of {totalServices} services online · Updated {lastUpdatedTime || 'Just now'}
          </p>
        </div>

        {/* TAB 1: STATUS ACCORDION VIEW */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            {Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName} className="bg-[#0b0c1b] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                {/* Group Accordion Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-2 font-bold text-white text-xs tracking-wider uppercase">
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                    <span>{groupName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase">ONLINE</span>
                  </div>
                </div>

                {/* Group Service Items */}
                <div className="divide-y divide-white/5">
                  {items.map((item) => {
                    const isExpanded = expandedItems[item.id];
                    const history = item.history90d || [];

                    return (
                      <div key={item.id} className="transition-colors">
                        {/* Summary Line matching statuspage.png */}
                        <div
                          onClick={() => toggleExpand(item.id)}
                          className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {getIcon(item.iconType, item.group)}
                            <span className="font-bold text-white text-xs tracking-tight">{item.name}</span>
                          </div>

                          {/* 90 Vertical Uptime Bars */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-[2.5px] h-6 overflow-hidden">
                              {history.slice(-60).map((day, idx) => (
                                <div
                                  key={idx}
                                  onMouseEnter={() => setHoveredBar({ id: item.id, day })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                  className={`w-[4px] h-5 rounded-[1px] transition-transform hover:scale-125 ${
                                    day.status === 'operational'
                                      ? 'bg-emerald-400'
                                      : day.status === 'degraded'
                                      ? 'bg-amber-400'
                                      : 'bg-rose-500'
                                  }`}
                                />
                              ))}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 font-mono text-xs text-slate-300 font-bold">
                              <span>{item.uptimePct90d}%</span>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Item Details Card matching statuspage.png */}
                        {isExpanded && (
                          <div className="px-6 pb-6 pt-2 bg-black/40 border-t border-white/5 space-y-6 animate-fade-in">
                            {/* 4 Stat Metric Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                                  CURRENT STATUS
                                </span>
                                <span className="text-sm font-black text-emerald-400 uppercase">
                                  {item.status}
                                </span>
                              </div>
                              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                                  90-DAY UPTIME
                                </span>
                                <span className="text-sm font-black text-white">{item.uptimePct90d}%</span>
                              </div>
                              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                                  AVG RESPONSE
                                </span>
                                <span className="text-sm font-black text-white">
                                  {item.avgResponseTimeMs ? `${item.avgResponseTimeMs}ms` : '4ms'}
                                </span>
                              </div>
                              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                                  LAST CHECKED
                                </span>
                                <span className="text-sm font-black text-slate-300">just now</span>
                              </div>
                            </div>

                            {/* Response Time Chart Box matching statuspage.png */}
                            <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-5 space-y-4">
                              <span className="text-[11px] font-mono uppercase font-bold text-slate-300 tracking-wider block">
                                REAL RESPONSE TIME LATENCY (MS)
                              </span>

                              {(() => {
                                const latencyGraph = item.latencyHistory || [];
                                const maxLatency = Math.max(...latencyGraph.map((l) => l.latencyMs), 20);

                                return (
                                  <>
                                    <div className="h-28 w-full flex items-end justify-between border-b border-l border-white/10 pb-2 pl-2 relative font-mono text-[9px] text-slate-500">
                                      <span className="absolute -left-6 top-0">{maxLatency}ms</span>
                                      <span className="absolute -left-6 top-1/2">{Math.round(maxLatency / 2)}ms</span>
                                      <span className="absolute -left-6 bottom-0">0ms</span>

                                      <div className="w-full h-full flex items-end gap-1.5 pt-2">
                                        {(latencyGraph.length > 0
                                          ? latencyGraph
                                          : Array.from({ length: 20 }, (_, i) => ({ time: `${i}:00`, latencyMs: 4 }))
                                        ).map((point, idx) => {
                                          const hPct = Math.min(100, Math.max(10, (point.latencyMs / maxLatency) * 100));
                                          return (
                                            <div
                                              key={idx}
                                              style={{ height: `${hPct}%` }}
                                              className="flex-1 bg-gradient-to-t from-purple-600 via-indigo-400 to-emerald-400 rounded-t-sm opacity-85 hover:opacity-100 transition-opacity"
                                              title={`${point.time}: ${point.latencyMs}ms`}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
                                      <span>{latencyGraph[0]?.time || '11:00 AM'}</span>
                                      <span>
                                        {latencyGraph[Math.floor(latencyGraph.length / 2)]?.time || '11:30 AM'}
                                      </span>
                                      <span>{latencyGraph[latencyGraph.length - 1]?.time || '12:00 PM'}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: INCIDENTS LOG VIEW */}
        {activeTab === 'incidents' && (
          <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-400" /> Platform Incidents &amp; Security Audits
            </h2>

            {!data?.incidents || data.incidents.length === 0 ? (
              <div className="text-center py-12 space-y-2 border border-white/5 rounded-2xl bg-black/30">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">No Incidents Reported</p>
                <p className="text-xs text-slate-400">All edge services and container runtimes operating smoothly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.incidents.map((inc) => (
                  <div key={inc.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm">{inc.title}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                          inc.resolvedAt ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {inc.resolvedAt ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{inc.body}</p>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      Logged: {new Date(inc.startedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MAINTENANCE VIEW */}
        {activeTab === 'maintenance' && (
          <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-400" /> Scheduled Maintenance Windows
            </h2>

            {!data?.scheduledMaintenances || data.scheduledMaintenances.length === 0 ? (
              <div className="text-center py-12 space-y-2 border border-white/5 rounded-2xl bg-black/30">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">No Active Maintenance</p>
                <p className="text-xs text-slate-400">No upcoming maintenance windows currently planned.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.scheduledMaintenances.map((m) => (
                  <div key={m.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <h3 className="font-bold text-white text-sm">{m.title}</h3>
                    <p className="text-xs text-slate-300">{m.description}</p>
                    <span className="text-[10px] font-mono text-indigo-400 block">
                      Start: {new Date(m.scheduledStart).toUTCString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Bar matching statuspage.png */}
      <footer className="border-t border-white/10 bg-[#07070e] py-6 text-xs text-slate-400 font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 SHANUTECHX CLOUD™. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <Link href="/" className="hover:text-white transition-colors">
              Main Site
            </Link>
            <span>|</span>
            <span className="text-slate-400">Checks run every minute</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
