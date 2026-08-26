'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.shanutechx.com';

interface DayHistory {
  date: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  uptimePct: number;
  note?: string;
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
}

interface ScheduledMaintenance {
  id: string;
  title: string;
  description: string;
  impact: 'minor' | 'major' | 'critical' | 'none';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledStart: string;
  scheduledEnd: string;
  affectedComponents: string[];
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
  subscriberCount: number;
  updatedAt: string;
}

const STATUS_CONFIG = {
  operational: {
    label: 'All Systems Operational',
    bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    bannerBg: 'from-emerald-950/40 via-emerald-900/20 to-emerald-950/40 border-emerald-500/30 text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    barColor: 'bg-emerald-400 hover:bg-emerald-300',
    dot: 'bg-emerald-400',
    icon: '✔',
  },
  degraded: {
    label: 'Degraded Performance',
    bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    bannerBg: 'from-amber-950/40 via-amber-900/20 to-amber-950/40 border-amber-500/30 text-amber-300',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    barColor: 'bg-amber-400 hover:bg-amber-300',
    dot: 'bg-amber-400',
    icon: '⚠️',
  },
  partial_outage: {
    label: 'Partial System Outage',
    bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    bannerBg: 'from-orange-950/40 via-orange-900/20 to-orange-950/40 border-orange-500/30 text-orange-300',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    barColor: 'bg-orange-400 hover:bg-orange-300',
    dot: 'bg-orange-400',
    icon: '⚡',
  },
  major_outage: {
    label: 'Major System Outage',
    bg: 'bg-red-500/10 border-red-500/30 text-red-400',
    bannerBg: 'from-red-950/40 via-red-900/20 to-red-950/40 border-red-500/30 text-red-300',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    barColor: 'bg-red-500 hover:bg-red-400',
    dot: 'bg-red-500',
    icon: '✖',
  },
  maintenance: {
    label: 'Scheduled Maintenance In Progress',
    bg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    bannerBg: 'from-sky-950/40 via-sky-900/20 to-sky-950/40 border-sky-500/30 text-sky-300',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    barColor: 'bg-sky-400 hover:bg-sky-300',
    dot: 'bg-sky-400',
    icon: '🔧',
  },
};

export default function PublicStatusPage() {
  const [data, setData] = useState<PublicStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subType, setSubType] = useState<'email' | 'webhook'>('email');
  const [subTarget, setSubTarget] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [subMessage, setSubMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{ componentId: string; day: DayHistory } | null>(null);

  function fetchStatus() {
    setLoading(true);
    fetch(`${API_BASE}/api/status/public`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load status telemetry');
        return r.json();
      })
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!subTarget.trim()) return;

    setSubLoading(true);
    setSubMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/status/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: subType, target: subTarget }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to subscribe');

      setSubMessage({ type: 'success', text: resData.message });
      setSubTarget('');
    } catch (err: any) {
      setSubMessage({ type: 'error', text: err.message || 'Something went wrong' });
    } finally {
      setSubLoading(false);
    }
  }

  const overall = data ? STATUS_CONFIG[data.overallStatus] || STATUS_CONFIG.operational : STATUS_CONFIG.operational;

  const groupedComponents = (data?.components || []).reduce<Record<string, ComponentData[]>>((acc, comp) => {
    const groupName = comp.group || 'Core Services';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(comp);
    return acc;
  }, {});

  const pastDays = Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });

  return (
    <main className="min-h-screen bg-[#060814] text-white font-sans selection:bg-purple-500 selection:text-white relative">
      <Navbar />

      <div className="pt-28 pb-20 max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-black text-xl text-white shadow-xl shadow-purple-500/20 border border-white/20">
              SX
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                ShanuTechX Status
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-white/5 border border-white/10 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Live Telemetry
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Real-time infrastructure health, uptime history &amp; maintenance logs</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 border border-white/20 transition-all flex items-center gap-2 transform active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Subscribe to Updates
            </button>
          </div>
        </div>

        {/* Top Overall Status Banner */}
        <div className={`bg-gradient-to-r ${overall.bannerBg} border rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden`}>
          <div className="flex items-start sm:items-center gap-4 z-10">
            <div className={`h-12 w-12 rounded-2xl ${overall.badge} flex items-center justify-center text-xl font-bold border shadow-inner shrink-0`}>
              {overall.icon}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">{overall.label}</h2>
              <p className="text-xs text-slate-300 mt-1">
                {data?.overallStatus === 'operational'
                  ? 'All core services, database engines, edge networks, and storage nodes are operating at peak efficiency.'
                  : 'Our engineering team is actively monitoring system telemetry.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 shrink-0 z-10">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-widest">90-Day Uptime</span>
              <span className="text-xl font-black text-emerald-400">99.98%</span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-widest">Global Telemetry</span>
              <span className="text-xs font-semibold text-slate-300">12 Edge Regions</span>
            </div>
          </div>
        </div>

        {/* About This Site */}
        <div className="bg-[#0b0e20] border border-white/[0.08] rounded-2xl p-5 text-xs text-slate-300 space-y-1">
          <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-purple-400">About Platform Status</h3>
          <p>
            Welcome to ShanuTechX's public status portal. Telemetry signals are updated automatically every 20 seconds from distributed uptime probes.
          </p>
        </div>

        {/* Service Uptime Component List */}
        <div className="space-y-8">
          {Object.entries(groupedComponents).map(([group, components]) => (
            <div key={group} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-200 tracking-wider uppercase flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                  {group}
                </h3>
                <span className="text-[11px] font-mono text-slate-400">90-Day History</span>
              </div>

              <div className="space-y-4">
                {components.map((comp) => {
                  const compStatus = STATUS_CONFIG[comp.status] || STATUS_CONFIG.operational;
                  const history = comp.history90d || [];

                  return (
                    <div
                      key={comp.id}
                      className="bg-[#0a0d1d] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 space-y-3 transition-all shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-white tracking-tight">{comp.name}</h4>
                          {comp.description && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{comp.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-300 font-bold hidden sm:inline">
                            {comp.uptimePct90d}% uptime
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${compStatus.badge}`}>
                            {compStatus.label.replace('All Systems ', '')}
                          </span>
                        </div>
                      </div>

                      {/* 90-Day Daily Bar Graph */}
                      <div className="relative pt-1">
                        <div className="flex gap-[3px] items-center h-8 w-full bg-black/40 p-1.5 rounded-xl border border-white/5">
                          {history.slice(-90).map((day, idx) => {
                            const barConf = STATUS_CONFIG[day.status] || STATUS_CONFIG.operational;
                            return (
                              <div
                                key={idx}
                                onMouseEnter={() => setHoveredBar({ componentId: comp.id, day })}
                                onMouseLeave={() => setHoveredBar(null)}
                                className={`flex-1 h-full rounded-[2px] transition-all cursor-pointer ${barConf.barColor}`}
                              />
                            );
                          })}
                        </div>

                        {/* Tooltip */}
                        {hoveredBar && hoveredBar.componentId === comp.id && (
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/20 px-3 py-1.5 rounded-lg shadow-2xl text-[11px] font-mono text-white whitespace-nowrap z-20 pointer-events-none">
                            <span className="font-bold text-purple-300">{hoveredBar.day.date}: </span>
                            <span>{hoveredBar.day.uptimePct}% Uptime ({hoveredBar.day.status})</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-0.5">
                        <span>90 days ago</span>
                        <span className="text-slate-400 font-bold">{comp.uptimePct90d}% uptime</span>
                        <span>Today</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Scheduled Maintenance Section */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="text-sky-400">🔧</span>
              Scheduled Maintenance
            </h3>
            <span className="text-xs text-slate-400 font-mono">Planned Windows</span>
          </div>

          {!data?.scheduledMaintenances || data.scheduledMaintenances.length === 0 ? (
            <div className="bg-[#0a0d1d] border border-white/[0.08] rounded-2xl p-6 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">No scheduled maintenance currently planned.</p>
              <p className="text-[11px]">All host nodes, databases, and network gateways are operating in standard mode.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.scheduledMaintenances.map((m) => (
                <div key={m.id} className="bg-[#0b0e20] border border-sky-500/30 rounded-2xl p-6 space-y-3 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <h4 className="font-bold text-base text-white">{m.title}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {new Date(m.scheduledStart).toUTCString()} &mdash; {new Date(m.scheduledEnd).toUTCString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] uppercase font-extrabold tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 w-fit">
                      {m.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{m.description}</p>

                  {m.updates && m.updates.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest font-bold block">Progress Updates</span>
                      {m.updates.map((u, i) => (
                        <div key={i} className="pl-3 border-l-2 border-sky-500/40 text-xs text-slate-300 space-y-0.5">
                          <span className="text-[10px] font-mono text-slate-500">{new Date(u.timestamp).toLocaleString()}</span>
                          <p>{u.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Incidents Timeline */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="text-purple-400">📜</span>
              Past Incidents &amp; Event Logs
            </h3>
            <span className="text-xs text-slate-400 font-mono">Last 15 Days</span>
          </div>

          <div className="space-y-4">
            {pastDays.map((dayDate, idx) => {
              const dayStr = dayDate.toISOString().split('T')[0];
              const dayIncidents = (data?.incidents || []).filter((inc) => inc.startedAt.startsWith(dayStr));

              return (
                <div key={idx} className="border-b border-white/[0.06] pb-4 space-y-2">
                  <h4 className="text-xs font-mono font-bold text-slate-400">
                    {dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </h4>

                  {dayIncidents.length === 0 ? (
                    <p className="text-xs text-slate-500 italic pl-3">No incidents reported today.</p>
                  ) : (
                    <div className="space-y-3 pl-3">
                      {dayIncidents.map((inc) => (
                        <div key={inc.id} className="bg-[#0b0e20] border border-white/10 rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-sm text-white">{inc.title}</h5>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${inc.resolvedAt ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                              {inc.resolvedAt ? 'Resolved' : 'Ongoing'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{inc.body}</p>
                          <span className="text-[10px] font-mono text-slate-500 block">
                            Logged at {new Date(inc.startedAt).toLocaleTimeString()} UTC
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Subscribe to Updates Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0b0e20] border border-white/20 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowSubscribeModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">Subscribe to Status Updates</h3>
              <p className="text-xs text-slate-400 mt-1">Get real-time notifications whenever ShanuTechX creates, updates, or resolves an incident.</p>
            </div>

            {/* Notification Method Tabs */}
            <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 font-medium text-xs">
              <button
                onClick={() => setSubType('email')}
                className={`flex-1 py-2 rounded-lg transition-all ${subType === 'email' ? 'bg-purple-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'}`}
              >
                ✉ Email
              </button>
              <button
                onClick={() => setSubType('webhook')}
                className={`flex-1 py-2 rounded-lg transition-all ${subType === 'webhook' ? 'bg-purple-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'}`}
              >
                🔗 Webhook
              </button>
            </div>

            {subMessage && (
              <div className={`p-4 rounded-xl text-xs font-medium border ${subMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                {subMessage.text}
              </div>
            )}

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  {subType === 'email' ? 'Email Address' : 'Webhook Endpoint URL'}
                </label>
                <input
                  type={subType === 'email' ? 'email' : 'url'}
                  placeholder={subType === 'email' ? 'dev@yourcompany.com' : 'https://yourdomain.com/webhooks/status'}
                  value={subTarget}
                  onChange={(e) => setSubTarget(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={subLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 border border-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {subLoading ? 'Subscribing...' : 'Subscribe to Incident Alerts'}
              </button>
            </form>

            <div className="pt-2 border-t border-white/10 text-center">
              <span className="text-[11px] text-slate-500 font-mono">
                Atom / RSS Feed URL: <code className="text-purple-400">/api/status/public</code>
              </span>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
