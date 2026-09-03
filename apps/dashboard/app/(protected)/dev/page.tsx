'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, Badge, Spinner, PageHeader, StatCard, Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';

function ServerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

const INFRA_PANELS = [
  {
    href: '/supabase',
    label: 'Supabase System Stack',
    description: 'Self-hosted Supabase Auth, PostgreSQL 17, Storage S3, Edge Functions & Realtime WebSockets.',
    icon: <DatabaseIcon />,
    color: 'bg-emerald-500/10 text-emerald-300',
    countKey: 'supabase',
  },
  {
    href: '/secrets',
    label: 'Secrets Vault (Infisical)',
    description: 'Centralized environment variables manager with encrypted storage, bulk import & audit trail.',
    icon: <CloudIcon />,
    color: 'bg-violet-500/10 text-violet-300',
    countKey: 'secrets',
  },
  {
    href: '/admin/nodes',
    label: 'Compute Nodes',
    description: 'Register and monitor bare-metal and VPS compute nodes running cloud workloads.',
    icon: <ServerIcon />,
    color: 'bg-accent-violet/10 text-accent-violet-light',
    countKey: 'nodes',
  },
  {
    href: '/admin/leaseweb',
    label: 'Leaseweb VPS',
    description: 'Create, power cycle, and manage Leaseweb dedicated/VPS instances via the Leaseweb API.',
    icon: <CloudIcon />,
    color: 'bg-teal-500/10 text-teal-300',
    countKey: 'leaseweb',
  },
  {
    href: '/admin/databases',
    label: 'Managed Databases',
    description: 'Provision and inspect MySQL/PostgreSQL managed databases assigned to customer deployments.',
    icon: <DatabaseIcon />,
    color: 'bg-blue-500/10 text-blue-300',
    countKey: 'databases',
  },
  {
    href: '/settings',
    label: 'Protected System Settings',
    description: 'Password-protected Discord Webhooks, Database Backups, and Third-Party API Keys.',
    icon: <ShieldIcon />,
    color: 'bg-orange-500/10 text-orange-300',
    countKey: 'settings',
  },
  {
    href: '/dev/containers',
    label: 'Containers & Docker',
    description: 'Inspect docker container processes, logs, ports, and live states across compute nodes.',
    icon: <ServerIcon />,
    color: 'bg-fuchsia-500/10 text-fuchsia-300',
    countKey: 'containers',
  },
  {
    href: '/catalog',
    label: 'App Catalog & Deploy',
    description: 'One-click deploy templates (Livekit, WordPress, MongoDB, Lavalink, and 360+ more) to any node.',
    icon: <ServerIcon />,
    color: 'bg-sky-500/10 text-sky-300',
    countKey: 'catalog',
  },
];

const ADMIN_PANELS = [
  {
    href: '/admin/review-queue',
    label: 'Payment Review Queue',
    description: 'Verify customer uploaded bank slips & payment proofs for manual order approvals.',
    icon: <ShieldIcon />,
    badgeKey: 'pendingPayments',
  },
  {
    href: '/admin/customers',
    label: 'Customer Directory',
    description: 'Manage customer accounts, assigned admins, spend totals, and account details.',
    icon: <ServerIcon />,
    badgeKey: 'customers',
  },
  {
    href: '/admin/services',
    label: 'Products & Plans',
    description: 'Manage services, pricing tiers, plans, and subscription packages.',
    icon: <DatabaseIcon />,
  },
  {
    href: '/admin/staff',
    label: 'Staff & Roles',
    description: 'View staff members, manage support staff, and update role assignments.',
    icon: <ShieldIcon />,
  },
  {
    href: '/admin/cms',
    label: 'Site Content (CMS)',
    description: 'Edit landing page copy, promotional banners, feature blocks, and public pricing text.',
    icon: <CloudIcon />,
  },
  {
    href: '/admin/analytics',
    label: 'Platform Analytics',
    description: 'View sales performance metrics, revenue charts, user conversion, and order statistics.',
    icon: <ServerIcon />,
  },
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    description: 'Inspect full audit trail of staff actions, payment approvals, and role updates.',
    icon: <ShieldIcon />,
  },
  {
    href: '/admin/tickets',
    label: 'Support Tickets & Chat',
    description: 'Manage support tickets and engage in live customer chat.',
    icon: <CloudIcon />,
    badgeKey: 'tickets',
  },
];

export default function DevLandingPage() {
  const [activeTab, setActiveTab] = useState<'infra' | 'admin'>('infra');
  const [health, setHealth] = useState<any>(null);
  const [nodeCount, setNodeCount] = useState<number | null>(null);
  const [dbCount, setDbCount] = useState<number | null>(null);
  const [pendingPayments, setPendingPayments] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [ticketCount, setTicketCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.leaseweb.health(),
      api.nodes.list(),
      api.managedDatabases.list(),
      api.payments.reviewQueue(),
      api.admin.customers(1),
      api.tickets.list(),
    ]).then((results) => {
      const [healthResult, nodesResult, dbsResult, payResult, custResult, tickResult] = results;
      
      setHealth(healthResult.status === 'fulfilled' ? healthResult.value : null);
      setNodeCount(nodesResult.status === 'fulfilled' ? nodesResult.value.nodes.length : 0);
      setDbCount(dbsResult.status === 'fulfilled' ? dbsResult.value.databases.length : 0);
      setPendingPayments(payResult.status === 'fulfilled' ? payResult.value.payments.length : 0);
      setCustomerCount(custResult.status === 'fulfilled' ? custResult.value.total : 0);
      setTicketCount(tickResult.status === 'fulfilled' ? tickResult.value.tickets.length : 0);
      
      setLoading(false);
    });
  }, []);

  const counts: Record<string, string> = {
    nodes: nodeCount === null ? '…' : `${nodeCount}`,
    supabase: 'Manage Stack',
    secrets: 'Open Vault',
    leaseweb: health === null ? '…' : (health?.apiKeyConfigured ? 'Connected' : 'Not configured'),
    databases: dbCount === null ? '…' : `${dbCount}`,
    settings: 'Protected',
    containers: 'Inspect',
    catalog: 'Browse',
  };

  const adminBadges: Record<string, string | number> = {
    pendingPayments: pendingPayments > 0 ? `${pendingPayments} pending` : 'Clean',
    customers: `${customerCount} users`,
    tickets: `${ticketCount} tickets`,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Developer Master Control"
        description="Complete overarching control hub — manage core infrastructure, tech stack, and full admin business operations."
      />

      {/* Tabs */}
      <Tabs
        tabs={[
          { label: 'Infrastructure & Tech Stack', value: 'infra' },
          { label: 'Admin & Business Control', value: 'admin', count: pendingPayments > 0 ? pendingPayments : undefined },
        ]}
        active={activeTab}
        onChange={(v) => setActiveTab(v as 'infra' | 'admin')}
      />

      {/* Status Bar */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Compute Nodes"
          value={loading ? '…' : (nodeCount ?? 0)}
          icon={<ServerIcon />}
          color="violet"
        />
        <StatCard
          label="Leaseweb API"
          value={loading ? '…' : (health?.apiKeyConfigured ? 'Online' : 'Offline')}
          icon={<CloudIcon />}
          color="teal"
        />
        <StatCard
          label="Managed DBs"
          value={loading ? '…' : (dbCount ?? 0)}
          icon={<DatabaseIcon />}
          color="green"
        />
        <StatCard
          label="Pending Approvals"
          value={loading ? '…' : pendingPayments}
          icon={<ShieldIcon />}
          color="orange"
        />
      </div>

      {loading && <Spinner label="Loading system context..." />}

      {/* INFRA TAB CONTENT */}
      {activeTab === 'infra' && (
        <div className="space-y-6 animate-fade-in">
          {health && (
            <Card className="border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-300 flex items-center justify-center">
                    <CloudIcon />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">Leaseweb API Health</p>
                    <p className="text-text-muted text-xs mt-0.5">
                      {health.apiKeyConfigured ? 'API key is configured and reachable.' : 'API key is not configured — manage in Protected Settings.'}
                    </p>
                  </div>
                </div>
                <Badge status={health.apiKeyConfigured && health.lastCallSucceeded !== false ? 'running' : 'failed'} />
              </div>
            </Card>
          )}

          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Infrastructure Surface Area</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {INFRA_PANELS.map((panel) => (
              <Link key={panel.href} href={panel.href}>
                <Card className="h-full border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer group p-5">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${panel.color}`}>
                    {panel.icon}
                  </div>
                  <h3 className="font-semibold text-text-primary text-sm mb-1 group-hover:text-white transition-colors">
                    {panel.label}
                  </h3>
                  <p className="text-text-muted text-xs leading-relaxed mb-4">{panel.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-accent-teal-bright group-hover:gap-2 transition-all font-medium">
                    <span>{counts[panel.countKey]}</span>
                    <ArrowIcon />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ADMIN TAB CONTENT */}
      {activeTab === 'admin' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-accent-violet/10 border border-accent-violet/20 rounded-2xl p-4 text-xs text-accent-violet-light flex items-center justify-between">
            <span>Full Admin Control Mode: You have complete access to review payments, manage staff roles, edit products, update CMS, and inspect audit logs.</span>
            <Link href="/admin">
              <span className="font-semibold underline hover:text-white">Open Admin Dashboard →</span>
            </Link>
          </div>

          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Admin Management Modules</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {ADMIN_PANELS.map((panel) => (
              <Link key={panel.href} href={panel.href}>
                <Card className="h-full border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer group p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{panel.icon}</span>
                    {panel.badgeKey && adminBadges[panel.badgeKey] && (
                      <span className="text-[10px] bg-white/10 text-text-muted rounded-full px-2 py-0.5 font-medium">
                        {adminBadges[panel.badgeKey]}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-text-primary text-sm mb-1 group-hover:text-white transition-colors">
                    {panel.label}
                  </h3>
                  <p className="text-text-muted text-xs leading-relaxed mb-4">{panel.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-accent-violet-light group-hover:gap-2 transition-all font-medium">
                    <span>Manage</span>
                    <ArrowIcon />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
