'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Spinner, ErrorBanner, StatCard, PageHeader, formatMoney } from '@/components/ui';

export const dynamic = 'force-dynamic';

type RangeOption = '7d' | '30d' | '90d' | '1y' | 'all';

const RANGE_LABELS: { id: RangeOption; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '1y', label: '1 Year' },
  { id: 'all', label: 'All Time' },
];

// ── Mini Bar Chart ─────────────────────────────────────────────────────────
function RevenueBarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return <p className="text-text-muted text-sm py-8 text-center">No revenue recorded in this period.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 h-36 pt-4">
        {entries.map(([label, value]) => {
          const heightPct = Math.max((value / max) * 100, 6);
          return (
            <div key={label} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group relative">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 bg-surface-tertiary px-2 py-0.5 rounded text-[10px] font-mono text-text-primary z-10 whitespace-nowrap shadow-lg border border-white/10 pointer-events-none">
                {formatMoney(value)}
              </div>
              <p className="text-[10px] text-text-muted font-mono truncate max-w-full">{formatMoney(value)}</p>
              <div className="w-full rounded-t-lg bg-accent-violet/15 relative overflow-hidden h-full flex items-end">
                <div
                  className="w-full bg-brand-gradient opacity-90 rounded-t-lg transition-all duration-300 group-hover:brightness-125"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <p className="text-[10px] text-text-muted truncate w-full text-center font-mono">
                {label.length > 7 ? label.slice(5) : label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Resource Utilization Gauge Bar ─────────────────────────────────────────
function UtilBar({ label, value }: { label: string; value: number | null }) {
  const pct = value ?? 0;
  const color = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-400' : 'bg-emerald-500';
  const textColor = pct > 85 ? 'text-red-400' : pct > 65 ? 'text-amber-300' : 'text-emerald-400';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-text-muted">{label}</span>
        <span className={`font-mono font-medium ${textColor}`}>
          {value !== null ? `${pct}%` : 'N/A'}
        </span>
      </div>
      <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────────────────
function RevenueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

function ContainerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
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
  const [range, setRange] = useState<RangeOption>('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    api.analytics.get(range)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (isMounted) {
          setError(e.message || 'Failed to load analytics');
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [range]);

  if (error) return <ErrorBanner message={error} />;
  if (!data && loading) return <Spinner label="Loading telemetry analytics..." />;

  const statusColors: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PENDING_REVIEW: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    PENDING_PAYMENT: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
    CANCELLED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <PageHeader
        title="Platform Analytics & Telemetry"
        description="Comprehensive insight into system revenue, active subscriptions, customer churn, and node infrastructure health."
        action={
          <div className="flex bg-surface-tertiary p-1 rounded-xl border border-white/[0.08]">
            {RANGE_LABELS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRange(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  range === opt.id
                    ? 'bg-accent-violet text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-2 text-xs text-accent-violet gap-2">
          <Spinner label="Updating timeframe..." />
        </div>
      )}

      {/* Top Stat Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Revenue (${RANGE_LABELS.find((r) => r.id === range)?.label})`}
          value={formatMoney(data?.revenueInWindowLkr ?? 0)}
          icon={<RevenueIcon />}
          color="violet"
          trend={{ value: `$${(data?.revenueInWindowUsd ?? 0).toLocaleString()} USD equiv.`, up: true }}
        />
        <StatCard
          label="Estimated MRR"
          value={formatMoney(data?.mrrLkr ?? 0)}
          icon={<TrendingIcon />}
          color="teal"
          trend={{ value: `Avg: ${formatMoney(data?.averageOrderValueLkr ?? 0)}`, up: true }}
        />
        <StatCard
          label="Active Subscriptions"
          value={data?.activeSubscriptions ?? 0}
          icon={<ContainerIcon />}
          color="green"
          trend={{ value: `Churn: ${data?.churnRatePct ?? 0}%`, up: (data?.churnRatePct ?? 0) <= 5 }}
        />
        <StatCard
          label="Total Customers"
          value={data?.totalCustomers ?? 0}
          icon={<UsersIcon />}
          color="orange"
          trend={{ value: `${data?.activeContainersCount ?? 0} active containers`, up: true }}
        />
      </div>

      {/* Primary Charts & Order Status Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-white/[0.06]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-semibold text-sm text-text-primary">Revenue Trend by Month (LKR)</h2>
              <p className="text-xs text-text-muted mt-0.5">Historical earnings breakdown</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Total Window: {formatMoney(data?.revenueInWindowLkr ?? 0)}
            </span>
          </div>
          <RevenueBarChart data={data?.revenueByMonth ?? {}} />
        </Card>

        {/* Order Status Map */}
        <Card className="border border-white/[0.06] flex flex-col justify-between">
          <div>
            <h2 className="font-semibold text-sm text-text-primary mb-1">Orders by Status</h2>
            <p className="text-xs text-text-muted mb-4">Breakdown for the selected window ({data?.orderCountInWindow ?? 0} total)</p>

            <div className="space-y-2.5">
              {Object.entries(data?.ordersByStatus ?? {}).map(([st, count]) => {
                const badgeClass = statusColors[st] || 'bg-surface-tertiary text-text-muted border-white/10';
                return (
                  <div key={st} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-tertiary/40 border border-white/[0.03]">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono border ${badgeClass}`}>
                      {st}
                    </span>
                    <span className="font-mono text-sm text-text-primary font-semibold">
                      {count as number}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-text-muted">
            <span>Container Deployment Count:</span>
            <span className="font-mono text-text-primary font-bold">{data?.totalContainersCount ?? 0}</span>
          </div>
        </Card>
      </div>

      {/* Top Services & Infrastructure Node Health Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Services Leaderboard */}
        <Card className="border border-white/[0.06]">
          <h2 className="font-semibold text-sm text-text-primary mb-1">Top Performing Services</h2>
          <p className="text-xs text-text-muted mb-4">Highest revenue-generating catalog items in window</p>

          {(!data?.topServices || data.topServices.length === 0) ? (
            <p className="text-text-muted text-xs py-6 text-center">No service orders recorded in this timeframe.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-white/[0.06]">
                    <th className="pb-2 font-medium">Service Name</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-right">Orders</th>
                    <th className="pb-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.topServices.map((svc: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 font-medium text-text-primary">{svc.title}</td>
                      <td className="py-2.5 text-text-muted font-mono">{svc.category}</td>
                      <td className="py-2.5 text-right font-mono text-text-secondary">{svc.ordersCount}</td>
                      <td className="py-2.5 text-right font-mono text-emerald-400 font-semibold">
                        {formatMoney(svc.revenueLkr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Node Health Telemetry */}
        <Card className="border border-white/[0.06]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-semibold text-sm text-text-primary">Infrastructure Node Pool Health</h2>
              <p className="text-xs text-text-muted mt-0.5">Real-time resource utilization across host VPS nodes</p>
            </div>
          </div>

          <div className="space-y-6">
            {data?.nodeUtilization?.map((n: any) => {
              const statusBadge =
                n.status === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : n.status === 'warning'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20';

              return (
                <div key={n.label} className="p-3.5 rounded-xl bg-surface-tertiary/40 border border-white/[0.04] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-text-primary">{n.label}</span>
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${statusBadge}`}>
                        {n.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono">
                      {n.containerCount ?? 0} active containers
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <UtilBar label="CPU" value={n.cpuUsedPct} />
                    <UtilBar label="RAM" value={n.ramUsedPct} />
                    <UtilBar label="Disk" value={n.diskUsedPct} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

