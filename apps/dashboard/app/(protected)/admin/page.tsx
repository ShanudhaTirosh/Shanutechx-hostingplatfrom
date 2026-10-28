'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Card,
  StatCard,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
  Table,
  Tr,
  Td,
  Badge,
  Button,
  ProgressBar,
  formatMoney,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function ServerClusterIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function RocketDeployIcon() {
  return (
    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1.5 3 3.5 3s3.5-1 3.5-3V7c0-2-1.5-3-3.5-3S4 5 4 7zm0 5c0 2 1.5 3 3.5 3s3.5-1 3.5-3m5-5v10c0 2 1.5 3 3.5 3s3.5-1 3.5-3V7c0-2-1.5-3-3.5-3S12.5 5 12.5 7zm0 5c0 2 1.5 3 3.5 3s3.5-1 3.5-3" />
    </svg>
  );
}

function GearJobsIcon() {
  return (
    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const ADMIN_MODULES = [
  {
    href: '/admin/nodes',
    title: 'Cluster & Node Inventory',
    desc: 'Manage VPS servers, SSH automated enrollment, cordon maintenance, failover, and hardware health.',
    icon: <ServerClusterIcon />,
  },
  {
    href: '/admin/deployments',
    title: 'Application Deployments',
    desc: 'Coolify & Railway style git-push builds, Railpack / Nixpacks pipelines, env vars, and rollbacks.',
    icon: <RocketDeployIcon />,
  },
  {
    href: '/supabase',
    title: 'Supabase Engine',
    desc: 'One-click self-hosted Supabase projects, isolated databases, auth, studio, and API gateways.',
    icon: <DatabaseIcon />,
  },
  {
    href: '/email',
    title: 'Email Hosting (WildDuck)',
    desc: 'Email domains, automated DKIM/SPF/DMARC DNS checks, mailbox quotas, and connection credentials.',
    icon: (
      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/customers',
    title: 'Customer Directory',
    desc: 'Customer accounts, assigned support staff, service subscriptions, and spend totals.',
    icon: (
      <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/review-queue',
    title: 'Payment Verification Queue',
    desc: 'Audit customer bank transfer slips, crypto proofs, and approve manual order payments.',
    icon: (
      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/services',
    title: 'Products & Pricing Catalog',
    desc: 'VPS tiers, container packages, email plans, add-ons, and recurring billing plans.',
    icon: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/admin/audit-log',
    title: 'Audit Logs & Governance',
    desc: 'Tamper-evident trail of administrative mutations, node enrollments, and status updates.',
    icon: (
      <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clusterStats, setClusterStats] = useState({
    totalNodes: 0,
    onlineNodes: 0,
    cordonedNodes: 0,
    offlineNodes: 0,
    totalCores: 0,
    totalRamMb: 0,
    usedRamMb: 0,
    totalDiskGb: 0,
    usedDiskGb: 0,
    activeDeployments: 0,
    supabaseProjects: 0,
    pendingPayments: 0,
    customersCount: 0,
    openTickets: 0,
  });

  const [pendingPaymentsList, setPendingPaymentsList] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.nodes.list(),
      api.deployments.list(),
      api.devSupabase.listProjects(),
      api.jobs.list({ limit: 6 } as any),
      api.payments.reviewQueue(),
      api.admin.customers(10),
      api.tickets.list(),
    ])
      .then((results) => {
        const [nodesRes, depsRes, supaRes, jobsRes, payRes, custRes, tckRes] = results;

        const nodes = nodesRes.status === 'fulfilled' ? nodesRes.value.nodes || [] : [];
        const deployments = depsRes.status === 'fulfilled' ? depsRes.value.deployments || [] : [];
        const supabase = supaRes.status === 'fulfilled' ? supaRes.value.projects || [] : [];
        const jobs = jobsRes.status === 'fulfilled' ? jobsRes.value.jobs || [] : [];
        const payments = payRes.status === 'fulfilled' ? payRes.value.payments || [] : [];
        const customers = custRes.status === 'fulfilled' ? custRes.value : { total: 0 };
        const tickets = tckRes.status === 'fulfilled' ? tckRes.value.tickets || [] : [];

        let totalCores = 0;
        let totalRamMb = 0;
        let usedRamMb = 0;
        let totalDiskGb = 0;
        let usedDiskGb = 0;
        let onlineNodes = 0;
        let cordonedNodes = 0;
        let offlineNodes = 0;

        for (const n of nodes) {
          totalCores += n.cpuCores || 0;
          totalRamMb += n.ramMb || 0;
          usedRamMb += n.ramUsedMb || 0;
          totalDiskGb += n.diskGb || 0;
          usedDiskGb += n.diskUsedGb || 0;

          if (n.status === 'maintenance' || n.isSchedulable === false) {
            cordonedNodes++;
          } else if (n.isActive && n.status !== 'offline' && n.status !== 'error') {
            onlineNodes++;
          } else {
            offlineNodes++;
          }
        }

        setClusterStats({
          totalNodes: nodes.length,
          onlineNodes,
          cordonedNodes,
          offlineNodes,
          totalCores,
          totalRamMb,
          usedRamMb,
          totalDiskGb,
          usedDiskGb,
          activeDeployments: deployments.filter((d) => d.status === 'running').length,
          supabaseProjects: supabase.length,
          pendingPayments: payments.length,
          customersCount: (customers as any).total || 0,
          openTickets: tickets.filter((t: any) => t.status === 'open').length,
        });

        setPendingPaymentsList(payments.slice(0, 5));
        setRecentJobs(jobs.slice(0, 6));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const ramUsedPct = clusterStats.totalRamMb > 0 ? Math.round((clusterStats.usedRamMb / clusterStats.totalRamMb) * 100) : 0;
  const diskUsedPct = clusterStats.totalDiskGb > 0 ? Math.round((clusterStats.usedDiskGb / clusterStats.totalDiskGb) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Admin Control Center"
        description="Unified infrastructure, multi-tenant application deployments, self-hosted Supabase clusters, and billing governance."
      />

      {error && <ErrorBanner message={error} />}

      {/* Cluster Overview Stats */}
      {loading ? (
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse bg-white/[0.02] border-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard
            label="Infrastructure Nodes"
            value={`${clusterStats.onlineNodes} / ${clusterStats.totalNodes}`}
            icon={<ServerClusterIcon />}
            color="teal"
          />
          <StatCard
            label="Active Deployments"
            value={clusterStats.activeDeployments}
            icon={<RocketDeployIcon />}
            color="orange"
          />
          <StatCard
            label="Supabase Projects"
            value={clusterStats.supabaseProjects}
            icon={<DatabaseIcon />}
            color="violet"
          />
          <StatCard
            label="Pending Payment Reviews"
            value={clusterStats.pendingPayments}
            icon={<ReviewProofIcon />}
            color="teal"
          />
        </div>
      )}

      {/* Hardware Capacity & Allocation Card */}
      <Card className="border border-white/[0.06] bg-white/[0.01] p-5">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
          Cluster Capacity &amp; Resource Allocation
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Total CPU Allocation</span>
              <span className="text-text-primary font-mono font-semibold">{clusterStats.totalCores} Cores Available</span>
            </div>
            <ProgressBar value={Math.min(100, clusterStats.totalNodes * 20)} color="accent" />
            <p className="text-[11px] text-text-faint">Aggregated compute across {clusterStats.totalNodes} node(s)</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">RAM Memory Usage</span>
              <span className="text-text-primary font-mono font-semibold">
                {Math.round(clusterStats.usedRamMb / 1024)}GB / {Math.round(clusterStats.totalRamMb / 1024)}GB ({ramUsedPct}%)
              </span>
            </div>
            <ProgressBar value={ramUsedPct} color={ramUsedPct > 80 ? 'danger' : 'accent'} />
            <p className="text-[11px] text-text-faint">Provisioned memory across cluster</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Cluster Disk Storage</span>
              <span className="text-text-primary font-mono font-semibold">
                {clusterStats.usedDiskGb}GB / {clusterStats.totalDiskGb}GB ({diskUsedPct}%)
              </span>
            </div>
            <ProgressBar value={diskUsedPct} color={diskUsedPct > 80 ? 'danger' : 'accent'} />
            <p className="text-[11px] text-text-faint">Persistent volume and container storage</p>
          </div>
        </div>
      </Card>

      {/* Infrastructure Jobs & Activity Engine */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
            <GearJobsIcon /> Recent Infrastructure Background Jobs ({recentJobs.length})
          </h2>
          <span className="text-xs text-text-faint">Processed via BullMQ</span>
        </div>

        {loading ? (
          <Spinner label="Loading background jobs..." />
        ) : recentJobs.length === 0 ? (
          <Card className="p-6 text-center text-text-muted text-xs border border-white/[0.04]">
            No recent background jobs found. New deployments and node enrollments will stream live here.
          </Card>
        ) : (
          <Table headers={['Job ID', 'Type', 'Target Resource', 'Progress', 'Status', 'Started']}>
            {recentJobs.map((job) => (
              <Tr key={job.id}>
                <Td className="font-mono text-xs text-text-muted">{job.id.slice(0, 10)}...</Td>
                <Td className="font-mono text-xs uppercase text-accent-cyan">{job.type.replace(/_/g, ' ')}</Td>
                <Td className="text-xs text-text-primary font-mono">{job.nodeId ? `Node #${job.nodeId.slice(0, 8)}` : 'Cluster Engine'}</Td>
                <Td className="w-32">
                  <div className="space-y-1">
                    <ProgressBar value={job.progress || 0} color={job.status === 'failed' ? 'danger' : job.status === 'completed' ? 'success' : 'accent'} />
                    <span className="text-[10px] text-text-faint">{job.progress || 0}%</span>
                  </div>
                </Td>
                <Td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    job.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : job.status === 'running'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : job.status === 'failed'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-white/5 text-text-muted border border-white/10'
                  }`}>
                    {job.status}
                  </span>
                </Td>
                <Td className="text-xs text-text-muted">{new Date(job.createdAt).toLocaleTimeString()}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </div>

      {/* Pending Payment Proofs Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Pending Payment Proofs ({pendingPaymentsList.length})
          </h2>
          <Link href="/admin/review-queue" className="text-xs text-accent-cyan hover:underline font-medium">
            Review Queue →
          </Link>
        </div>

        {loading ? (
          <Spinner label="Loading review queue..." />
        ) : pendingPaymentsList.length === 0 ? (
          <EmptyState
            title="Queue is Clear"
            message="No pending payment proofs awaiting manual review. All submitted bank slips have been processed."
          />
        ) : (
          <Table headers={['Order ID', 'Amount', 'Submitted At', 'Status', 'Action']}>
            {pendingPaymentsList.map((p) => (
              <Tr key={p.id} onClick={() => router.push('/admin/review-queue')}>
                <Td className="font-mono text-xs text-text-primary">#{p.orderId?.slice(0, 8)}</Td>
                <Td className="text-xs font-bold text-emerald-400">{formatMoney(p.order?.totalLkr ?? p.order?.total ?? 0, 'LKR')}</Td>
                <Td className="text-xs text-text-muted">{new Date(p.createdAt).toLocaleDateString()}</Td>
                <Td>
                  <Badge status="manual_review" />
                </Td>
                <Td>
                  <Button size="sm" variant="secondary" onClick={() => router.push('/admin/review-queue')}>
                    Review Slip
                  </Button>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </div>

      {/* Navigation Hub Modules */}
      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Administration Modules</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {ADMIN_MODULES.map((mod) => (
            <Link key={mod.href} href={mod.href}>
              <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group p-5">
                <div className="text-2xl mb-3">{mod.icon}</div>
                <h3 className="font-semibold text-text-primary text-sm mb-1 group-hover:text-white transition-colors">
                  {mod.title}
                </h3>
                <p className="text-text-muted text-xs leading-relaxed">{mod.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewProofIcon() {
  return (
    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
