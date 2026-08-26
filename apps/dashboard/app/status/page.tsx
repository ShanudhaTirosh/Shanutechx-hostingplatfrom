'use client';

import { useEffect, useState } from 'react';
import { API_BASE, apiFetch } from '@/lib/useAuth';

export const dynamic = 'force-dynamic';

interface ComponentData {
  id: string;
  name: string;
  group: string;
  description?: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  uptimePct90d: number;
}

interface ScheduledMaintenance {
  id: string;
  title: string;
  description: string;
  impact: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  affectedComponents: string[];
}

interface Incident {
  id: string;
  title: string;
  body: string;
  severity: string;
  startedAt: string;
  resolvedAt: string | null;
}

interface StatusResponse {
  overallStatus: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  components: ComponentData[];
  scheduledMaintenances: ScheduledMaintenance[];
  incidents: Incident[];
  subscriberCount: number;
}

export default function AdminStatusStudioPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms
  const [newIncident, setNewIncident] = useState({ title: '', body: '', severity: 'minor' });
  const [newMaintenance, setNewMaintenance] = useState({
    title: '',
    description: '',
    impact: 'minor',
    scheduledStart: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    scheduledEnd: new Date(Date.now() + 10800000).toISOString().slice(0, 16),
  });

  const [postingIncident, setPostingIncident] = useState(false);
  const [postingMaintenance, setPostingMaintenance] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  function loadStatus() {
    setLoading(true);
    fetch(`${API_BASE}/api/status/public`)
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
  }, []);

  async function handleComponentStatusChange(componentId: string, newStatus: string) {
    try {
      const res = await apiFetch(`/api/status/components/${componentId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update component status');
      setActionMessage('Component status updated successfully');
      loadStatus();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handlePostIncident(e: React.FormEvent) {
    e.preventDefault();
    setPostingIncident(true);
    try {
      const res = await apiFetch('/api/status/incidents', {
        method: 'POST',
        body: JSON.stringify(newIncident),
      });
      if (!res.ok) throw new Error('Failed to post incident');
      setNewIncident({ title: '', body: '', severity: 'minor' });
      setActionMessage('Incident posted to status page');
      loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostingIncident(false);
    }
  }

  async function handleResolveIncident(incidentId: string) {
    try {
      const res = await apiFetch(`/api/status/incidents/${incidentId}/resolve`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to resolve incident');
      setActionMessage('Incident resolved');
      loadStatus();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateMaintenance(e: React.FormEvent) {
    e.preventDefault();
    setPostingMaintenance(true);
    try {
      const res = await apiFetch('/api/status/maintenances', {
        method: 'POST',
        body: JSON.stringify(newMaintenance),
      });
      if (!res.ok) throw new Error('Failed to schedule maintenance');
      setNewMaintenance({
        title: '',
        description: '',
        impact: 'minor',
        scheduledStart: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
        scheduledEnd: new Date(Date.now() + 10800000).toISOString().slice(0, 16),
      });
      setActionMessage('Maintenance scheduled successfully');
      loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostingMaintenance(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070914] text-white p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            Status Telemetry Studio
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Admin Controls
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage public status telemetry, component health overrides, scheduled maintenance &amp; incidents</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Status Subscribers</span>
            <span className="text-lg font-bold text-purple-400">{data?.subscriberCount || 0} Registered</span>
          </div>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all"
          >
            {loading ? '↻ Loading...' : '↻ Refresh Data'}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex justify-between items-center">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="font-bold text-emerald-400">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold text-red-400">✕</button>
        </div>
      )}

      {/* System Components Override Matrix */}
      <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-base font-extrabold text-white tracking-tight flex items-center justify-between">
          <span>System Infrastructure Components</span>
          <span className="text-xs font-mono text-slate-400 font-normal">Live Override Controls</span>
        </h2>

        <div className="grid gap-3">
          {(data?.components || []).map((comp) => (
            <div key={comp.id} className="bg-black/30 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-white">{comp.name}</h3>
                <span className="text-[10px] font-mono text-purple-400 uppercase">{comp.group}</span>
                {comp.description && <p className="text-xs text-slate-400 mt-0.5">{comp.description}</p>}
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={comp.status}
                  onChange={(e) => handleComponentStatusChange(comp.id, e.target.value)}
                  className="bg-slate-900 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                >
                  <option value="operational">Operational</option>
                  <option value="degraded">Degraded</option>
                  <option value="partial_outage">Partial Outage</option>
                  <option value="major_outage">Major Outage</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post Incident & Schedule Maintenance Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Post Incident */}
        <form onSubmit={handlePostIncident} className="bg-[#0b0e22] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-base font-extrabold text-white tracking-tight">Post New Public Incident</h2>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Incident Title</label>
            <input
              type="text"
              placeholder="e.g. Database latency on AP-SOUTHEAST region"
              value={newIncident.title}
              onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
              required
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Severity</label>
            <select
              value={newIncident.severity}
              onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Details &amp; Action Notes</label>
            <textarea
              rows={3}
              placeholder="Engineering is investigating elevated connection timeouts..."
              value={newIncident.body}
              onChange={(e) => setNewIncident({ ...newIncident, body: e.target.value })}
              required
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            type="submit"
            disabled={postingIncident}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50"
          >
            {postingIncident ? 'Publishing...' : 'Publish Incident Notice'}
          </button>
        </form>

        {/* Schedule Maintenance */}
        <form onSubmit={handleCreateMaintenance} className="bg-[#0b0e22] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-base font-extrabold text-white tracking-tight">Schedule Planned Maintenance</h2>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Title</label>
            <input
              type="text"
              placeholder="e.g. Host Kernel Security Patching"
              value={newMaintenance.title}
              onChange={(e) => setNewMaintenance({ ...newMaintenance, title: e.target.value })}
              required
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={newMaintenance.scheduledStart}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduledStart: e.target.value })}
                required
                className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">End Time</label>
              <input
                type="datetime-local"
                value={newMaintenance.scheduledEnd}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduledEnd: e.target.value })}
                required
                className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Description &amp; Expected Impact</label>
            <textarea
              rows={2}
              placeholder="Routine node maintenance. Zero downtime expected."
              value={newMaintenance.description}
              onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
              required
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            type="submit"
            disabled={postingMaintenance}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-xs text-white transition-all shadow-lg shadow-sky-600/30 disabled:opacity-50"
          >
            {postingMaintenance ? 'Scheduling...' : 'Announce Maintenance Window'}
          </button>
        </form>
      </div>

      {/* Existing Incidents List */}
      <div className="bg-[#0b0e22] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-base font-extrabold text-white tracking-tight">Active &amp; Historical Incidents</h2>

        {(data?.incidents || []).length === 0 ? (
          <p className="text-xs text-slate-400 italic">No incidents recorded.</p>
        ) : (
          <div className="space-y-3">
            {data?.incidents.map((inc) => (
              <div key={inc.id} className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{inc.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${inc.resolvedAt ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {inc.resolvedAt ? 'Resolved' : 'Ongoing'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{inc.body}</p>
                </div>

                {!inc.resolvedAt && (
                  <button
                    onClick={() => handleResolveIncident(inc.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shrink-0"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
