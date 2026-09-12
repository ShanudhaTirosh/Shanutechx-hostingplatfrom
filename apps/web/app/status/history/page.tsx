'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Incident {
  id: string;
  title: string;
  body: string;
  severity: string;
  startedAt: string;
  resolvedAt: string | null;
}

export default function StatusHistoryPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [groupedByMonth, setGroupedByMonth] = useState<Record<string, Incident[]>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  function fetchHistory() {
    setLoading(true);
    const params = new URLSearchParams();
    if (severityFilter !== 'all') params.append('severity', severityFilter);
    if (statusFilter !== 'all') params.append('status', statusFilter);

    fetch(`${API_BASE}/api/status/history?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setIncidents(data.incidents || []);
        setGroupedByMonth(data.groupedByMonth || {});
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchHistory();
  }, [severityFilter, statusFilter]);

  const filteredGrouped = Object.entries(groupedByMonth).reduce<Record<string, Incident[]>>(
    (acc, [month, itemArray]) => {
      const filtered = itemArray.filter(
        (i) =>
          i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.body.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[month] = filtered;
      }
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-[#07070e] text-white font-sans flex flex-col justify-between">
      {/* Header Bar */}
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
        {/* Page Header Title */}
        <div className="bg-[#0b0c1b] border border-white/10 rounded-3xl p-8 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono font-bold text-[10px] uppercase">
                <History className="h-3.5 w-3.5" /> ARCHIVED SYSTEM AUDITS
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                Incident &amp; Outage History
              </h1>
              <p className="text-xs text-slate-400">
                Full chronological log of past platform incidents, outages, and post-mortem resolution reports.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search incident reports..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Outages</option>
              <option value="major">Major Disruptions</option>
              <option value="minor">Minor Degradations</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="resolved">Resolved Only</option>
              <option value="unresolved">Active / Unresolved</option>
            </select>
          </div>
        </div>

        {/* Timeline Log View */}
        {loading ? (
          <div className="text-center py-20 bg-[#0b0c1b] border border-white/10 rounded-3xl space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono text-slate-400">Loading incident history...</p>
          </div>
        ) : Object.keys(filteredGrouped).length === 0 ? (
          <div className="text-center py-16 border border-white/10 rounded-3xl bg-[#0b0c1b] space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-white uppercase tracking-wider">No Incident Records Found</p>
            <p className="text-xs text-slate-400 font-mono">No incident reports match your selected criteria.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(filteredGrouped).map(([month, itemArray]) => (
              <div key={month} className="space-y-4">
                <h2 className="text-xs font-mono font-bold text-purple-400 uppercase tracking-widest pl-2">
                  {month} ({itemArray.length})
                </h2>

                <div className="space-y-4">
                  {itemArray.map((inc) => (
                    <div
                      key={inc.id}
                      className="bg-[#0b0c1b] border border-white/10 rounded-2xl p-6 space-y-3 hover:border-white/20 transition-all shadow-xl"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <Link
                          href={`/status/incidents/${inc.id}`}
                          className="font-bold text-white text-sm hover:text-purple-400 transition-colors flex items-center gap-2"
                        >
                          <span>{inc.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                        </Link>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              inc.severity === 'critical'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : inc.severity === 'major'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {inc.severity}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              inc.resolvedAt
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {inc.resolvedAt ? 'Resolved' : 'Active'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{inc.body}</p>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>Started: {new Date(inc.startedAt).toLocaleString()}</span>
                        <span>
                          {inc.resolvedAt
                            ? `Resolved: ${new Date(inc.resolvedAt).toLocaleString()}`
                            : 'Ongoing incident'}
                        </span>
                      </div>
                    </div>
                  ))}
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
