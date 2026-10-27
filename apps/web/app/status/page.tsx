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
  Rss,
  Mail,
  Bell,
  X,
  History,
  Radio,
  Wifi,
  HardDrive,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
  subscriberCount?: number;
  updatedAt: string;
  grafanaMetrics?: {
    isConfigured: boolean;
    status: string;
    cpuUsagePct: number;
    memoryUsagePct: number;
    activeContainersCount: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    throughputRps: number;
    metricsHistory?: Array<{ time: string; cpu: number; ram: number; latency: number }>;
  };
  monitoringSources?: {
    uptimeKumaConnected: boolean;
    uptimeKumaCount: number;
    grafanaConnected: boolean;
  };
}

export default function StatusPage() {
  const [data, setData] = useState<PublicStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [hoveredBar, setHoveredBar] = useState<{ id: string; day: DayHistory } | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  
  // Subscription modal state
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subType, setSubType] = useState<'email' | 'webhook'>('email');
  const [subTarget, setSubTarget] = useState('');
  const [subStatus, setSubStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [submittingSub, setSubmittingSub] = useState(false);

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

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!subTarget) return;

    setSubmittingSub(true);
    setSubStatus(null);

    fetch(`${API_BASE}/api/status/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: subType, target: subTarget }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (res.ok) {
          setSubStatus({ success: true, message: body.message || 'Subscribed successfully!' });
          setSubTarget('');
        } else {
          setSubStatus({ success: false, message: body.error || 'Failed to subscribe' });
        }
      })
      .catch(() => {
        setSubStatus({ success: false, message: 'Network error. Please try again.' });
      })
      .finally(() => {
        setSubmittingSub(false);
      });
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
    const groupName = comp.group || 'CORE PLATFORM';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(comp);
    return acc;
  }, {});

  const totalServices = data?.components.length || 0;
  const onlineServices = (data?.components || []).filter((c) => c.status === 'operational').length;

  return (
    <div className="min-h-screen bg-[#07070e] text-white font-sans selection:bg-purple-500 selection:text-white flex flex-col justify-between">
      {/* GitHub Status Inspired Header Bar */}
      <header className="border-b border-white/10 bg-[#07070e]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/status" className="flex items-center gap-2.5 font-bold tracking-tight text-white text-sm">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-400 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-purple-500/20">
              STX
            </span>
            <div className="flex flex-col">
              <span className="leading-none text-xs font-black tracking-wider uppercase text-slate-300">SHANUTECHX</span>
              <span className="text-purple-400 font-extrabold text-xs tracking-tight">System Status</span>
            </div>
          </Link>

          {/* Navigation Bar */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <Link href="/status" className="text-white font-bold flex items-center gap-1.5 hover:text-white transition-colors">
              <Radio className="h-3.5 w-3.5 text-emerald-400" />
              <span>Live Telemetry</span>
            </Link>
            <Link href="/status/history" className="hover:text-white transition-colors flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-slate-400" />
              <span>Incident History</span>
            </Link>
            <Link href="/status/maintenance" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Maintenance Schedule</span>
            </Link>
            <a
              href={`${API_BASE}/api/status/rss`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-400 transition-colors flex items-center gap-1 text-slate-400"
            >
              <Rss className="h-3.5 w-3.5 text-amber-500" />
              <span>RSS</span>
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition-all hover:scale-105"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Subscribe</span>
            </button>

            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all hover:scale-105"
            >
              <span>Main Portal</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8 flex-1 w-full">
        {/* Dedicated Status Page Alert Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-[#0b0c1b] border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <div>
              <p className="text-xs font-bold text-white">Dedicated ShanuTechX Real-Time Status &amp; Uptime Monitor</p>
              <p className="text-[11px] text-slate-400">View real-time ping latency, ICMP telemetry, and live component graphs on our standalone status platform.</p>
            </div>
          </div>
          <a
            href={process.env.NEXT_PUBLIC_STATUS_URL || "https://status.shanutechx.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-purple-600/30 shrink-0 transition-transform hover:scale-105"
          >
            <span>Launch Live Status Portal</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Main Status Hero Banner */}
        <div
          className={`border rounded-3xl p-8 md:p-10 text-center space-y-3 shadow-2xl relative overflow-hidden transition-all ${
            data?.overallStatus === 'operational'
              ? 'bg-gradient-to-b from-emerald-950/40 via-[#0b0c1b] to-[#0b0c1b] border-emerald-500/30'
              : data?.overallStatus === 'degraded'
              ? 'bg-gradient-to-b from-amber-950/40 via-[#0b0c1b] to-[#0b0c1b] border-amber-500/30'
              : 'bg-gradient-to-b from-rose-950/40 via-[#0b0c1b] to-[#0b0c1b] border-rose-500/30'
          }`}
        >
          <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />

          {/* Status Badge Pill */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-1 rounded-full border font-mono font-bold text-[11px] uppercase tracking-widest ${
              data?.overallStatus === 'operational'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : data?.overallStatus === 'degraded'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full animate-pulse ${
                data?.overallStatus === 'operational'
                  ? 'bg-emerald-400'
                  : data?.overallStatus === 'degraded'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            />
            {data?.overallStatus === 'operational'
              ? 'ALL SYSTEMS OPERATIONAL'
              : data?.overallStatus === 'degraded'
              ? 'PARTIAL PERFORMANCE DEGRADATION'
              : 'SYSTEM MAINTENANCE IN PROGRESS'}
          </div>

          {/* Main Banner Title */}
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white uppercase font-sans">
            {data?.overallStatus === 'operational'
              ? 'ShanuTechX Cloud Engine Active'
              : 'Service Outage Detected'}
          </h1>

          {/* Telemetry Subtext */}
          <p className="text-xs font-mono text-slate-400 flex flex-wrap items-center justify-center gap-3 pt-1">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Wifi className="h-3.5 w-3.5" />
              {onlineServices} of {totalServices} Endpoints Online
            </span>
            <span>·</span>
            {data?.monitoringSources?.uptimeKumaConnected && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] uppercase font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Uptime Kuma Synced ({data.monitoringSources.uptimeKumaCount} Monitors)
              </span>
            )}
            {data?.monitoringSources?.grafanaConnected && (
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] uppercase font-bold flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> Grafana Metrics Active
              </span>
            )}
            <span>· Updated {lastUpdatedTime || 'Just now'}</span>
          </p>
        </div>

        {/* GRAFANA LIVE CLUSTER TELEMETRY PANEL */}
        {data?.grafanaMetrics && (
          <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2 uppercase font-mono">
                <Activity className="h-4 w-4 text-orange-400" /> Real-Time Cluster Infrastructure Telemetry
              </h2>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Grafana Data Stream
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">CPU CLUSTER LOAD</span>
                <span className="text-lg font-black text-white">{data.grafanaMetrics.cpuUsagePct}%</span>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div style={{ width: `${Math.min(100, data.grafanaMetrics.cpuUsagePct)}%` }} className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-full" />
                </div>
              </div>

              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">RAM ALLOCATION</span>
                <span className="text-lg font-black text-white">{data.grafanaMetrics.memoryUsagePct}%</span>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div style={{ width: `${Math.min(100, data.grafanaMetrics.memoryUsagePct)}%` }} className="h-full bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full" />
                </div>
              </div>

              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">P95 LATENCY</span>
                <span className="text-lg font-black text-emerald-400">{data.grafanaMetrics.p95LatencyMs}ms</span>
                <span className="text-[10px] text-slate-500 font-mono block">P99: {data.grafanaMetrics.p99LatencyMs}ms</span>
              </div>

              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">THROUGHPUT</span>
                <span className="text-lg font-black text-indigo-300">{data.grafanaMetrics.throughputRps} RPS</span>
                <span className="text-[10px] text-slate-500 font-mono block">{data.grafanaMetrics.activeContainersCount} Containers Monitored</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Incidents Alert Banner (if any) */}
        {data?.incidents && data.incidents.filter((i) => !i.resolvedAt).length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>ACTIVE SYSTEM INCIDENT UNDER INVESTIGATION</span>
            </div>
            {data.incidents
              .filter((i) => !i.resolvedAt)
              .map((inc) => (
                <div key={inc.id} className="text-xs text-slate-300 space-y-1 pl-6">
                  <p className="font-bold text-white">{inc.title}</p>
                  <p>{inc.body}</p>
                  <span className="text-[10px] font-mono text-slate-400 block">
                    Started: {new Date(inc.startedAt).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Quick Links Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/status"
            className="p-4 rounded-2xl bg-[#0b0c1b] border border-white/10 hover:border-purple-500/50 transition-all space-y-1 group"
          >
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block group-hover:text-purple-400">
              SERVICE TELEMETRY
            </span>
            <span className="text-sm font-black text-white flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-purple-400" /> Live Grid
            </span>
          </Link>
          <Link
            href="/status/history"
            className="p-4 rounded-2xl bg-[#0b0c1b] border border-white/10 hover:border-indigo-500/50 transition-all space-y-1 group"
          >
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block group-hover:text-indigo-400">
              INCIDENT AUDIT
            </span>
            <span className="text-sm font-black text-white flex items-center gap-1.5">
              <History className="h-4 w-4 text-indigo-400" /> History Log
            </span>
          </Link>
          <Link
            href="/status/maintenance"
            className="p-4 rounded-2xl bg-[#0b0c1b] border border-white/10 hover:border-emerald-500/50 transition-all space-y-1 group"
          >
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block group-hover:text-emerald-400">
              MAINTENANCE
            </span>
            <span className="text-sm font-black text-white flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-emerald-400" /> Scheduled
            </span>
          </Link>
          <a
            href={`${API_BASE}/api/status/rss`}
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl bg-[#0b0c1b] border border-white/10 hover:border-amber-500/50 transition-all space-y-1 group"
          >
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block group-hover:text-amber-400">
              RSS / ATOM
            </span>
            <span className="text-sm font-black text-white flex items-center gap-1.5">
              <Rss className="h-4 w-4 text-amber-400" /> XML Feed
            </span>
          </a>
        </div>

        {/* SYSTEM COMPONENTS & 90-DAY HEATMAP BARS */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2 uppercase font-mono">
              <Layers className="h-4 w-4 text-purple-400" /> Infrastructure Components &amp; Uptime History
            </h2>
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-1 bg-emerald-400 rounded-xs" /> Operational
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-1 bg-amber-400 rounded-xs" /> Degraded
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-1 bg-rose-500 rounded-xs" /> Outage
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 bg-[#0b0c1b] border border-white/10 rounded-3xl space-y-3">
              <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">Polling real server probes...</p>
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName} className="bg-[#0b0c1b] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                {/* Accordion Group Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-2 font-bold text-white text-xs tracking-wider uppercase font-mono">
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                    <span>{groupName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase">ONLINE</span>
                  </div>
                </div>

                {/* Group Component Rows */}
                <div className="divide-y divide-white/5">
                  {items.map((item) => {
                    const isExpanded = expandedItems[item.id];
                    const history = item.history90d || [];

                    return (
                      <div key={item.id} className="transition-colors">
                        {/* Summary Line with 90 Vertical Day Bars */}
                        <div
                          onClick={() => toggleExpand(item.id)}
                          className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {getIcon(item.iconType, item.group)}
                            <div>
                              <span className="font-bold text-white text-xs tracking-tight block">{item.name}</span>
                              {item.description && (
                                <span className="text-[11px] text-slate-400 font-mono block">{item.description}</span>
                              )}
                            </div>
                          </div>

                          {/* 90 Vertical Heatmap Uptime Bars (GitHub Status Style) */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-[2.5px] h-6 overflow-hidden">
                              {history.slice(-60).map((day, idx) => (
                                <div
                                  key={idx}
                                  onMouseEnter={() => setHoveredBar({ id: item.id, day })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                  className={`w-[4.5px] h-5 rounded-[1px] transition-transform hover:scale-125 cursor-pointer ${
                                    day.status === 'operational'
                                      ? 'bg-emerald-400'
                                      : day.status === 'degraded'
                                      ? 'bg-amber-400'
                                      : 'bg-rose-500'
                                  }`}
                                  title={`${day.date}: ${day.status.toUpperCase()} (${day.uptimePct}%)`}
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

                        {/* Hover Bar Tooltip Indicator */}
                        {hoveredBar?.id === item.id && (
                          <div className="px-6 py-1.5 bg-purple-950/40 border-y border-purple-500/20 flex items-center justify-between text-[11px] font-mono text-purple-300">
                            <span>Date: {hoveredBar.day.date}</span>
                            <span className="uppercase font-bold">Status: {hoveredBar.day.status}</span>
                            <span>Uptime: {hoveredBar.day.uptimePct}%</span>
                          </div>
                        )}

                        {/* Expanded Item Details Card */}
                        {isExpanded && (
                          <div className="px-6 pb-6 pt-2 bg-black/40 border-t border-white/5 space-y-6">
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
                                  AVG LATENCY
                                </span>
                                <span className="text-sm font-black text-white">
                                  {item.avgResponseTimeMs ? `${item.avgResponseTimeMs}ms` : '< 1ms'}
                                </span>
                              </div>
                              <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-4 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                                  PROBE FREQUENCY
                                </span>
                                <span className="text-sm font-black text-slate-300">Every 60s</span>
                              </div>
                            </div>

                            {/* Response Time Latency Histogram */}
                            <div className="bg-[#0e0f24] border border-white/10 rounded-2xl p-5 space-y-4">
                              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300">
                                <span className="uppercase tracking-wider flex items-center gap-1.5">
                                  <TrendingUp className="h-3.5 w-3.5 text-purple-400" /> REAL RESPONSE TIME LATENCY (MS)
                                </span>
                                <span className="text-slate-500 font-normal">Last {item.latencyHistory?.length || 0} Probes</span>
                              </div>

                              {(() => {
                                const latencyGraph = item.latencyHistory || [];
                                const maxLatency = Math.max(...latencyGraph.map((l) => l.latencyMs), 10);

                                if (latencyGraph.length === 0) {
                                  return (
                                    <div className="py-6 text-center text-xs font-mono text-slate-500 italic">
                                      Collecting live probe telemetry for {item.name}...
                                    </div>
                                  );
                                }

                                return (
                                  <>
                                    <div className="h-28 w-full flex items-end justify-between border-b border-l border-white/10 pb-2 pl-2 relative font-mono text-[9px] text-slate-500">
                                      <span className="absolute -left-6 top-0">{maxLatency}ms</span>
                                      <span className="absolute -left-6 top-1/2">{Math.round(maxLatency / 2)}ms</span>
                                      <span className="absolute -left-6 bottom-0">0ms</span>

                                      <div className="w-full h-full flex items-end gap-1.5 pt-2">
                                        {latencyGraph.map((point, idx) => {
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
                                      <span>{latencyGraph[0]?.time || 'Start'}</span>
                                      <span>
                                        {latencyGraph[Math.floor(latencyGraph.length / 2)]?.time || ''}
                                      </span>
                                      <span>{latencyGraph[latencyGraph.length - 1]?.time || 'Now'}</span>
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
            ))
          )}
        </div>
      </main>

      {/* SUBSCRIBE MODAL */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 relative shadow-2xl">
            <button
              onClick={() => setShowSubscribeModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-400" /> Subscribe to Status Updates
              </h3>
              <p className="text-xs text-slate-400">
                Get real-time notifications whenever ShanuTechX creates, updates, or resolves system incidents.
              </p>
            </div>

            {/* Subscribe Type Selector */}
            <div className="p-1 bg-[#111224] border border-white/10 rounded-2xl flex items-center gap-1 text-xs font-semibold">
              <button
                onClick={() => setSubType('email')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  subType === 'email' ? 'bg-purple-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email Notifications</span>
              </button>
              <button
                onClick={() => setSubType('webhook')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  subType === 'webhook' ? 'bg-purple-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                <span>Webhook URL</span>
              </button>
            </div>

            {/* Subscription Form */}
            <form onSubmit={handleSubscribe} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                  {subType === 'email' ? 'Email Address' : 'HTTP/HTTPS Webhook Endpoint'}
                </label>
                <input
                  type={subType === 'email' ? 'email' : 'url'}
                  value={subTarget}
                  onChange={(e) => setSubTarget(e.target.value)}
                  placeholder={subType === 'email' ? 'admin@yourcompany.com' : 'https://api.yourcompany.com/webhooks/status'}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {subStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono border ${
                    subStatus.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {subStatus.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingSub}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all"
              >
                {submittingSub ? 'Subscribing...' : 'Confirm Subscription'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GitHub Status Inspired Footer */}
      <footer className="border-t border-white/10 bg-[#07070e] py-6 text-xs text-slate-400 font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 SHANUTECHX CLOUD PLATFORM™. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/status/history" className="hover:text-white transition-colors">
              Incident Log
            </Link>
            <span>·</span>
            <Link href="/status/maintenance" className="hover:text-white transition-colors">
              Maintenance
            </Link>
            <span>·</span>
            <a href={`${API_BASE}/api/status/rss`} target="_blank" rel="noreferrer" className="hover:text-amber-400 transition-colors">
              RSS Feed
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
