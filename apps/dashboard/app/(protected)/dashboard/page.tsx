'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useAppUser } from '@/lib/AppUserContext';
import { api } from '@/lib/api';
import {
  Card,
  Spinner,
  ErrorBanner,
  StatCard,
  PageHeader,
  EmptyState,
  Badge,
  Table,
  Tr,
  Td,
  Button,
} from '@/components/ui';

// ── Icons ───────────────────────────────────────────────────────────────────
function DeploymentsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}

function InvoicesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}

function TicketsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function SubscriptionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

const QUICK_ACTIONS = [
  { href: '/deployments', label: 'Deploy Application', hint: 'Deploy Git repositories with Railpack / Nixpacks automatic detection' },
  { href: '/supabase', label: 'Launch Supabase Project', hint: 'Provision isolated backend stack, PostgreSQL, Auth & Supabase Studio' },
  { href: '/email', label: 'Email Hosting (WildDuck)', hint: 'Create custom domain mailboxes with DKIM/SPF/DMARC and Webmail' },
  { href: '/services', label: 'Browse Hosting Catalog', hint: 'Order VPS compute instances, bot hosting, and managed databases' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { apiUser, loading: userLoading, error: userError } = useAppUser();
  const router = useRouter();

  // Dashboard Stats States
  const [stats, setStats] = useState({
    deployments: 0,
    supabase: 0,
    subscriptions: 0,
    orders: 0,
    tickets: 0,
  });
  const [recentDeploys, setRecentDeploys] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch real count summaries for dashboard cards - PARALLEL REQUESTS
  useEffect(() => {
    if (!apiUser) return;

    setLoadingData(true);
    
    // Use Promise.allSettled to handle partial failures gracefully
    Promise.allSettled([
      api.deployments.list(),
      api.devSupabase.listProjects(),
      api.billing.subscriptions(),
      api.orders.list(),
      api.tickets.list(),
    ])
      .then((results) => {
        const [deploysResult, supaResult, subsResult, ordsResult, tcksResult] = results;
        
        const deploys = deploysResult.status === 'fulfilled' ? deploysResult.value : { deployments: [] };
        const supa = supaResult.status === 'fulfilled' ? supaResult.value : { projects: [] };
        const subs = subsResult.status === 'fulfilled' ? subsResult.value : { subscriptions: [] };
        const ords = ordsResult.status === 'fulfilled' ? ordsResult.value : { orders: [] };
        const tcks = tcksResult.status === 'fulfilled' ? tcksResult.value : { tickets: [] };
        
        setStats({
          deployments: deploys.deployments?.length ?? 0,
          supabase: supa.projects?.length ?? 0,
          subscriptions: subs.subscriptions?.length ?? 0,
          orders: ords.orders?.length ?? 0,
          tickets: tcks.tickets?.length ?? 0,
        });
        setRecentDeploys((deploys.deployments ?? []).slice(0, 3));
        setRecentOrders((ords.orders ?? []).slice(0, 3));
      })
      .finally(() => setLoadingData(false));
  }, [apiUser]);

  if (userLoading) return <Spinner label="Setting up dashboard session..." />;
  if (userError) return <ErrorBanner message={userError} />;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome Banner (Pure Black Hero) */}
      <div className="relative rounded-3xl overflow-hidden p-6 md:p-8 bg-black border border-white/10 shadow-2xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-neutral-300 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Platform Online & Monitored</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Welcome back, {user?.displayName ?? apiUser?.email?.split('@')[0]}
        </h1>
        <p className="text-neutral-400 text-xs max-w-xl">
          Everything is running smoothly. Your container deployments, managed databases, and custom domains are active and isolated.
        </p>
      </div>

      {/* Stats Grid */}
      {loadingData ? (
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl h-24 animate-pulse bg-[#0c0d12] border border-white/10" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard
            label="Active Deployments"
            value={stats.deployments}
            icon={<DeploymentsIcon />}
            color="accent"
            className="bg-[#0c0d12] border-white/10"
          />
          <StatCard
            label="Supabase Projects"
            value={stats.supabase}
            icon={<SubscriptionsIcon />}
            color="accent"
            className="bg-[#0c0d12] border-white/10"
          />
          <StatCard
            label="Subscriptions"
            value={stats.subscriptions}
            icon={<SubscriptionsIcon />}
            color="green"
            className="bg-[#0c0d12] border-white/10"
          />
          <StatCard
            label="Support Tickets"
            value={stats.tickets}
            icon={<TicketsIcon />}
            color="orange"
            className="bg-[#0c0d12] border-white/10"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="p-5 rounded-2xl bg-[#0c0d12] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all cursor-pointer h-full space-y-1 group shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs group-hover:text-neutral-200 transition-colors">{action.label}</h3>
                  <span className="text-neutral-500 group-hover:text-white transition-colors text-xs font-mono">→</span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">{action.hint}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Deployments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Recent Deployments</h2>
            <Link href="/deployments" className="text-xs text-white hover:underline font-semibold">
              View all
            </Link>
          </div>
          {loadingData ? (
            <div className="rounded-2xl h-48 animate-pulse bg-[#0c0d12] border border-white/10" />
          ) : recentDeploys.length === 0 ? (
            <EmptyState
              message="No active container deployments found on your account."
              action={{ label: 'Create First Deployment', onClick: () => router.push('/deployments') }}
            />
          ) : (
            <Table headers={['Name', 'Type', 'Status']}>
              {recentDeploys.map((dep) => (
                <Tr key={dep.id} onClick={() => router.push(`/deployments?id=${dep.id}`)}>
                  <Td className="font-semibold text-xs text-white">{dep.preferredName}</Td>
                  <Td className="text-xs text-neutral-400 capitalize">{dep.serviceType}</Td>
                  <Td>
                    <Badge status={dep.status} dot />
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </div>

        {/* Recent Orders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Recent Orders</h2>
            <Link href="/orders" className="text-xs text-white hover:underline font-semibold">
              View all
            </Link>
          </div>
          {loadingData ? (
            <div className="rounded-2xl h-48 animate-pulse bg-[#0c0d12] border border-white/10" />
          ) : recentOrders.length === 0 ? (
            <EmptyState
              message="No service orders placed yet — browse our hosting & service catalog."
              action={{ label: 'Browse Services', onClick: () => router.push('/services') }}
            />
          ) : (
            <Table headers={['Order ID', 'Total', 'Payment Status']}>
              {recentOrders.map((ord) => (
                <Tr key={ord.id} onClick={() => router.push('/orders')}>
                  <Td className="font-mono text-[10px] text-neutral-400">#{ord.id.slice(0, 8)}</Td>
                  <Td className="text-xs font-medium text-white">LKR {(ord.total / 100).toFixed(2)}</Td>
                  <Td>
                    <Badge status={ord.paymentStatus} />
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
