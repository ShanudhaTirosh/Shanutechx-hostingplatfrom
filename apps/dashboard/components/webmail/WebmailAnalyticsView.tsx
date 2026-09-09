'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Mail, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../../lib/api';

export function WebmailAnalyticsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.webmail.getAnalytics()
      .then((res) => setData(res.analytics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading webmail analytics...</div>;
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-100 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Webmail Delivery Analytics</h2>
            <p className="text-xs text-slate-400">Real-time stats on open rates, delivery performance & volume</p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Open Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{data.openRatePct}%</div>
          <p className="text-[10px] text-emerald-400 font-medium">+4.2% from last week</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Click-Through Rate</span>
            <BarChart3 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{data.clickRatePct}%</div>
          <p className="text-[10px] text-indigo-400 font-medium">Link clicks tracking</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Bounce Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{data.bounceRatePct}%</div>
          <p className="text-[10px] text-emerald-400 font-medium">Healthy sender reputation</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avg Response Time</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{data.avgResponseTimeMins}m</div>
          <p className="text-[10px] text-slate-400">Fast team turnaround</p>
        </div>
      </div>

      {/* Volume Timeline */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">7-Day Mail Traffic Breakdown</h3>
        <div className="grid grid-cols-7 gap-2 pt-2">
          {data.timeline?.map((day: any) => (
            <div key={day.day} className="text-center space-y-2">
              <div className="h-32 bg-slate-950 rounded-lg p-1.5 flex flex-col justify-end gap-1 relative border border-slate-800/80">
                <div
                  style={{ height: `${Math.min(100, (day.sent / 120) * 100)}%` }}
                  className="w-full bg-indigo-500 rounded-sm transition-all"
                  title={`Sent: ${day.sent}`}
                />
                <div
                  style={{ height: `${Math.min(100, (day.received / 120) * 100)}%` }}
                  className="w-full bg-slate-700 rounded-sm transition-all"
                  title={`Received: ${day.received}`}
                />
              </div>
              <div className="text-xs font-semibold text-slate-300">{day.day}</div>
              <div className="text-[10px] text-slate-500">{day.sent}S / {day.received}R</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 pt-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500" /> Sent Emails</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-700" /> Received Emails</span>
        </div>
      </div>
    </div>
  );
}
