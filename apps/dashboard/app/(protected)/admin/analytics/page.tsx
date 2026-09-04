'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Spinner, ErrorBanner, StatCard, PageHeader, EmptyState, formatMoney } from '@/components/ui';

export const dynamic = 'force-dynamic';

type RangeOption = '7d' | '30d' | '90d' | '1y' | 'all';

const RANGE_LABELS: { id: RangeOption; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '1y', label: '1 Year' },
  { id: 'all', label: 'All Time' },
];

// ── Mini Bar Chart for Monthly Revenue ──────────────────────────────────────
function RevenueBarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return <EmptyState message="No revenue recorded in this period." className="my-4" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2.5 h-44 pt-6">
        {entries.map(([label, value]) => {
          const heightPct = Math.max((value / max) * 100, 6);
          return (
            <div key={label} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group relative">
              {/* Hover Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute -top-8 bg-surface-tertiary px-2.5 py-1 rounded-md text-[11px] font-mono text-text-primary z-20 whitespace-nowrap shadow-xl border border-white/10 pointer-events-none">
                {label}: <span className="text-emerald-400 font-bold">{formatMoney(value)}</span>
              </div>
              <p className="text-[10px] text-text-muted font-mono truncate max-w-full">{formatMoney(value)}</p>
              <div className="w-full rounded-t-lg bg-accent-violet/10 relative overflow-hidden h-full flex items-end">
                <div
                  className="w-full bg-brand-gradient opacity-90 rounded-t-lg transition-all duration-500 group-hover:brightness-125 group-hover:opacity-100"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <p className="text-[10px] text-text-muted truncate w-full text-center font-mono font-medium">
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
      <div className="flex justify-between text-xs mb-1">
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

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
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
          setError(e.message || 'Failed to load analytics telemetry');
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [range]);

  const exportTelemetryCsv = () => {
    if (!data) return;
    const csvRows = [
      ['Metric', 'Value'],
      ['Timeframe Range', data.range],
      ['Period Revenue (LKR)', data.revenueInWindowLkr],
      ['Period Revenue (USD Equiv)', data.revenueInWindowUsd],
      ['Revenue Growth vs Prior Period (%)', `${data.revenueGrowthPct}%`],
      ['Monthly Recurring Revenue (MRR LKR)', data.mrrLkr],
      ['Annual Run Rate (ARR LKR)', data.arrLkr],
      ['Average Order Value (AOV LKR)', data.averageOrderValueLkr],
      ['Average Revenue Per User (ARPU LKR)', data.arpuLkr],
      ['Active Subscriptions', data.activeSubscriptions],
      ['Churn Rate (%)', `${data.churnRatePct}%`],
      ['Total Customers', data.totalCustomers],
      ['New Customers in Period', data.newCustomersCurrentWindow],
      ['Customer Growth (%)', `${data.customerGrowthPct}%`],
      ['Running Containers', data.deploymentsSummary?.running ?? 0],
      ['Total Containers', data.deploymentsSummary?.total ?? 0],
      ['Active VPS Provisions', data.vpsProvisionsCount],
      ['Business Email Mailboxes', data.smtpAccountsCount],
      ['LiveKit Projects', data.livekitProjectsCount],
      ['Supabase Database Projects', data.supabaseProjectsCount],
      ['Open Support Tickets', data.ticketsOpenCount],
      ['Uptime Percentage', `${data.uptimePct}%`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shanutechx_telemetry_${data.range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) return <ErrorBanner message={error} />;
  if (!data && loading) return <Spinner label="Loading enterprise telemetry analytics..." />;

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
        description="Real-time financial performance, MRR/ARR run rates, customer acquisition trends, container workloads, and host node telemetry."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportTelemetryCsv}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-text-primary flex items-center gap-1.5 transition-all shadow-sm"
              title="Export report to CSV"
            >
              <DownloadIcon />
              <span>Export CSV</span>
            </button>

            <div className="flex bg-surface-tertiary p-1 rounded-xl border border-white/[0.08]">
              {RANGE_LABELS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setRange(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    range === opt.id
                      ? 'bg-accent-violet text-white shadow-sm font-semibold'
                      : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-2 text-xs text-accent-violet gap-2">
          <Spinner label="Updating telemetry calculations..." />
        </div>
      )}

      {/* Top Executive Financial KPIs (5 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          label={`Period Revenue (${RANGE_LABELS.find((r) => r.id === range)?.label})`}
          value={formatMoney(data?.revenueInWindowLkr ?? 0)}
          icon={<RevenueIcon />}
          color="violet"
          trend={{
            value: `${(data?.revenueGrowthPct ?? 0) >= 0 ? '+' : ''}${data?.revenueGrowthPct ?? 0}% vs prior`,
            up: (data?.revenueGrowthPct ?? 0) >= 0,
          }}
        />
        <StatCard
          label="Estimated MRR"
          value={formatMoney(data?.mrrLkr ?? 0)}
          icon={<TrendingIcon />}
          color="teal"
          trend={{ value: `$${(data?.mrrUsd ?? 0).toLocaleString()} USD / mo`, up: true }}
        />
        <StatCard
          label="Annual Run Rate (ARR)"
          value={formatMoney(data?.arrLkr ?? 0)}
          icon={<TrendingIcon />}
          color="teal"
          trend={{ value: `$${(data?.arrUsd ?? 0).toLocaleString()} USD / yr`, up: true }}
        />
        <StatCard
          label="Avg Order Value (AOV)"
          value={formatMoney(data?.averageOrderValueLkr ?? 0)}
          icon={<RevenueIcon />}
          color="orange"
          trend={{ value: `$${data?.averageOrderValueUsd ?? 0} USD equiv.`, up: true }}
        />
        <StatCard
          label="ARPU (Avg Rev / User)"
          value={formatMoney(data?.arpuLkr ?? 0)}
          icon={<UsersIcon />}
          color="green"
          trend={{ value: `Per Active Sub`, up: true }}
        />
      </div>

      {/* Customer & Workload Fleet Overview (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Customers"
          value={data?.totalCustomers ?? 0}
          icon={<UsersIcon />}
          color="orange"
          trend={{
            value: `${(data?.newCustomersCurrentWindow ?? 0)} new in period (${(data?.customerGrowthPct ?? 0) >= 0 ? '+' : ''}${data?.customerGrowthPct ?? 0}%)`,
            up: (data?.customerGrowthPct ?? 0) >= 0,
          }}
        />
        <StatCard
          label="Active Subscriptions"
          value={data?.activeSubscriptions ?? 0}
          icon={<ContainerIcon />}
          color="green"
          trend={{
            value: `Churn: ${data?.churnRatePct ?? 0}%`,
            up: (data?.churnRatePct ?? 0) <= 5,
          }}
        />
        <StatCard
          label="Running Containers"
          value={`${data?.deploymentsSummary?.running ?? 0} / ${data?.deploymentsSummary?.total ?? 0}`}
          icon={<ContainerIcon />}
          color="violet"
          trend={{ value: `${data?.deploymentsSummary?.building ?? 0} building`, up: true }}
        />
        <StatCard
          label="Node Pool Fleet"
          value={`${data?.fleetSummary?.activeNodes ?? 0} Nodes`}
          icon={<ServerIcon />}
          color="teal"
          trend={{ value: `${data?.fleetSummary?.totalCpuCores ?? 0} Cores | ${data?.fleetSummary?.totalRamGb ?? 0}GB RAM`, up: true }}
        />
      </div>

      {/* Workload Provisioning Badges */}
      <Card className="p-4 border border-white/[0.06] bg-surface-tertiary/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Active Workload Provisions:</span>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <div className="bg-surface-tertiary px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-text-muted">VPS Hosts:</span>
              <span className="text-accent-violet-light font-bold">{data?.vpsProvisionsCount ?? 0}</span>
            </div>
            <div className="bg-surface-tertiary px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-text-muted">Business Email & Webmail:</span>
              <span className="text-emerald-400 font-bold">{data?.smtpAccountsCount ?? 0}</span>
            </div>
            <div className="bg-surface-tertiary px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-text-muted">LiveKit Video Rooms:</span>
              <span className="text-cyan-400 font-bold">{data?.livekitProjectsCount ?? 0}</span>
            </div>
            <div className="bg-surface-tertiary px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-text-muted">Supabase DB Instances:</span>
              <span className="text-amber-400 font-bold">{data?.supabaseProjectsCount ?? 0}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Primary Revenue Chart & Category Breakdown Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-white/[0.06]">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
            <div>
              <h2 className="font-semibold text-sm text-text-primary">12-Month Revenue Trend (LKR)</h2>
              <p className="text-xs text-text-muted mt-0.5">Historical monthly billing distribution</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-semibold">
              All-Time: {formatMoney(data?.revenueAllTimeLkr ?? 0)} (${(data?.revenueAllTimeUsd ?? 0).toLocaleString()} USD)
            </span>
          </div>
          <RevenueBarChart data={data?.revenueByMonth ?? {}} />
        </Card>

        {/* Order Status & Operations Map */}
        <Card className="border border-white/[0.06] flex flex-col justify-between">
          <div>
            <h2 className="font-semibold text-sm text-text-primary mb-1">Orders by Status</h2>
            <p className="text-xs text-text-muted mb-4">Breakdown for window ({data?.orderCountInWindow ?? 0} total)</p>

            <div className="space-y-2.5">
              {Object.entries(data?.ordersByStatus ?? {}).map(([st, count]) => {
                const badgeClass = statusColors[st] || 'bg-surface-tertiary text-text-muted border-white/10';
                return (
                  <div key={st} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-tertiary/40 border border-white/[0.03]">
                    <span className={`text-xs px-2.5 py-0.5 rounded font-mono border font-medium ${badgeClass}`}>
                      {st}
                    </span>
                    <span className="font-mono text-sm text-text-primary font-bold">
                      {count as number}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] space-y-2 text-xs text-text-muted">
            <div className="flex justify-between items-center">
              <span>Open Support Tickets:</span>
              <span className={`font-mono font-bold ${(data?.ticketsOpenCount ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {data?.ticketsOpenCount ?? 0} open
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Platform System Uptime:</span>
              <span className="font-mono text-emerald-400 font-bold">{data?.uptimePct ?? 100}%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Services Leaderboard & Infrastructure Node Health Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Performing Services Leaderboard */}
        <Card className="border border-white/[0.06]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-semibold text-sm text-text-primary">Top Performing Services Leaderboard</h2>
              <p className="text-xs text-text-muted mt-0.5">Highest order volume and revenue generators in period</p>
            </div>
          </div>

          {(!data?.topServices || data.topServices.length === 0) ? (
            <EmptyState message="No service orders recorded in this timeframe." className="my-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-white/[0.06] font-mono">
                    <th className="pb-2.5 font-medium">Service / Plan Name</th>
                    <th className="pb-2.5 font-medium">Category</th>
                    <th className="pb-2.5 font-medium text-right">Orders</th>
                    <th className="pb-2.5 font-medium text-right">Est. Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.topServices.map((svc: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-medium text-text-primary flex items-center gap-2">
                        <span className="font-mono text-[10px] bg-accent-violet/20 text-accent-violet-light px-1.5 py-0.5 rounded font-bold">
                          #{idx + 1}
                        </span>
                        {svc.title}
                      </td>
                      <td className="py-3 text-text-muted font-mono uppercase text-[10px]">{svc.category}</td>
                      <td className="py-3 text-right font-mono text-text-secondary font-semibold">{svc.ordersCount}</td>
                      <td className="py-3 text-right font-mono text-emerald-400 font-bold">
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
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {data?.fleetSummary?.healthyNodes ?? 0} Healthy
              </span>
              {(data?.fleetSummary?.criticalNodes ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                  {data?.fleetSummary?.criticalNodes} Critical
                </span>
              )}
            </div>
          </div>

          {(!data?.nodeUtilization || data.nodeUtilization.length === 0) ? (
            <EmptyState message="No host nodes configured in cluster." className="my-4" />
          ) : (
            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
              {data.nodeUtilization.map((node: any) => {
                const statusBadge =
                  node.status === 'critical'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : node.status === 'warning'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                return (
                  <div key={node.id || node.label} className="p-3.5 rounded-xl bg-surface-tertiary/40 border border-white/[0.04] space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-text-primary">{node.label}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${statusBadge}`}>
                          {node.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted font-mono">
                        {node.cpuCores} Cores | {node.ramGb}GB RAM | {node.diskGb}GB Disk
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <UtilBar label="CPU Load" value={node.cpuUsedPct} />
                      <UtilBar label="RAM Memory" value={node.ramUsedPct} />
                      <UtilBar label="Disk Storage" value={node.diskUsedPct} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
