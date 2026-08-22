'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Spinner, ErrorBanner, StatCard, PageHeader, formatMoney } from '@/components/ui';

export const dynamic = 'force-dynamic';

// ── Mini bar chart component ───────────────────────────────────────────────
function BarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="flex items-end gap-2 h-28">
      {entries.map(([label, value]) => (
        <div key={label} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <p className="text-[9px] text-text-muted font-mono">{formatMoney(value)}</p>
          <div className="w-full rounded-t-lg bg-accent-violet/20 relative overflow-hidden" style={{ height: `${(value / max) * 80}px`, minHeight: 4 }}>
            <div
              className="absolute inset-0 bg-brand-gradient opacity-80 rounded-t-lg"
              style={{ height: '100%' }}
            />
          </div>
          <p className="text-[9px] text-text-muted truncate w-full text-center">{label.slice(2)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Utilization bar ────────────────────────────────────────────────────────
function UtilBar({ label, value }: { label: string; value: number | null }) {
  const pct = value ?? 0;
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-orange-400' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className={`font-medium ${pct > 85 ? 'text-red-300' : pct > 60 ? 'text-orange-300' : 'text-emerald-400'}`}>
          {value !== null ? `${pct}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────
function RevenueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function SubsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.analytics.get().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <Spinner label="Loading analytics..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Analytics"
        description="Revenue, subscription activity, and infrastructure node utilization."
      />

      {/* Top stat cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          label="Revenue (30 days)"
          value={formatMoney(data.revenueLast30dLkr)}
          icon={<RevenueIcon />}
          color="violet"
        />
        <StatCard
          label="Active Subscriptions"
          value={data.activeSubscriptions}
          icon={<SubsIcon />}
          color="teal"
        />
        <StatCard
          label="Total Customers"
          value={data.totalCustomers}
          icon={<UsersIcon />}
          color="green"
        />
      </div>

      {/* Revenue chart */}
      <Card className="border border-white/[0.06]">
        <h2 className="font-semibold text-sm text-text-primary mb-6">Revenue by Month (LKR)</h2>
        {Object.keys(data.revenueByMonth ?? {}).length === 0 ? (
          <p className="text-text-muted text-sm">No revenue data yet.</p>
        ) : (
          <BarChart data={data.revenueByMonth} />
        )}
      </Card>

      {/* Node utilization */}
      <Card className="border border-white/[0.06]">
        <h2 className="font-semibold text-sm text-text-primary mb-5">Infrastructure Node Utilization</h2>
        <div className="space-y-5">
          {data.nodeUtilization?.map((n: any) => (
            <div key={n.label} className="space-y-2">
              <p className="text-xs font-semibold text-text-primary">{n.label}</p>
              <div className="grid grid-cols-3 gap-3">
                <UtilBar label="CPU" value={n.cpuUsedPct} />
                <UtilBar label="RAM" value={n.ramUsedPct} />
                <UtilBar label="Disk" value={n.diskUsedPct} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
