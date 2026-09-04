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
  { href: '/services', label: 'Browse catalog', hint: 'Order static, Node.js/Python hosting, VPS or Bot plans' },
  { href: '/deployments', label: 'Deploy Repository', hint: 'Deploy a code repository instantly via automated build pipeline' },
  { href: '/tickets', label: 'Get support', hint: 'Open a support ticket or talk to our engineers via live chat' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { apiUser, loading: userLoading, error: userError } = useAppUser();
  const router = useRouter();

  // Dashboard Stats States
  const [stats, setStats] = useState({
    deployments: 0,
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
      api.billing.subscriptions(),
      api.orders.list(),
      api.tickets.list(),
    ])
      .then((results) => {
        const [deploysResult, subsResult, ordsResult, tcksResult] = results;
        
        const deploys = deploysResult.status === 'fulfilled' ? deploysResult.value : { deployments: [] };
        const subs = subsResult.status === 'fulfilled' ? subsResult.value : { subscriptions: [] };
        const ords = ordsResult.status === 'fulfilled' ? ordsResult.value : { orders: [] };
        const tcks = tcksResult.status === 'fulfilled' ? tcksResult.value : { tickets: [] };
        
        setStats({
          deployments: deploys.deployments?.length ?? 0,
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
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden glass p-6 border-white/[0.08]">
        <div className="absolute inset-0 bg-brand-gradient opacity-[0.04] -z-10" />
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-accent-violet/10 blur-3xl" />
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back, {user?.displayName ?? apiUser?.email?.split('@')[0]} 👋
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Everything is running smoothly. Your services are active and monitored in real time.
        </p>
      </div>

      {/* Stats Grid */}
      {loadingData ? (
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse bg-white/[0.02] border-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard
            label="Active Deployments"
            value={stats.deployments}
            icon={<DeploymentsIcon />}
            color="violet"
          />
          <StatCard
            label="Subscriptions"
            value={stats.subscriptions}
            icon={<SubscriptionsIcon />}
            color="teal"
          />
          <StatCard
            label="Total Invoices"
            value={stats.orders}
            icon={<InvoicesIcon />}
            color="green"
          />
          <StatCard
            label="Support Tickets"
            value={stats.tickets}
            icon={<TicketsIcon />}
            color="orange"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="hover:bg-white/[0.06] hover:border-white/12 transition-all cursor-pointer h-full border border-white/[0.06]">
                <h3 className="font-semibold text-text-primary mb-1 text-sm">{action.label}</h3>
                <p className="text-text-muted text-xs leading-relaxed">{action.hint}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Deployments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Deployments</h2>
            <Link href="/deployments" className="text-xs text-accent-teal-bright hover:underline">
              View all
            </Link>
          </div>
          {loadingData ? (
            <div className="glass rounded-2xl h-48 animate-pulse bg-white/[0.02]" />
          ) : recentDeploys.length === 0 ? (
            <EmptyState
              message="No active container deployments found on your account."
              action={{ label: 'Create First Deployment', onClick: () => router.push('/deployments') }}
            />
          ) : (
            <Table headers={['Name', 'Type', 'Status']}>
              {recentDeploys.map((dep) => (
                <Tr key={dep.id} onClick={() => router.push(`/deployments?id=${dep.id}`)}>
                  <Td className="font-semibold text-xs">{dep.preferredName}</Td>
                  <Td className="text-xs text-text-muted capitalize">{dep.serviceType}</Td>
                  <Td>
                    <Badge status={dep.status} dot />
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </div>

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Orders</h2>
            <Link href="/orders" className="text-xs text-accent-teal-bright hover:underline">
              View all
            </Link>
          </div>
          {loadingData ? (
            <div className="glass rounded-2xl h-48 animate-pulse bg-white/[0.02]" />
          ) : recentOrders.length === 0 ? (
            <EmptyState
              message="No service orders placed yet — browse our hosting & service catalog."
              action={{ label: 'Browse Services', onClick: () => router.push('/services') }}
            />
          ) : (
            <Table headers={['Order ID', 'Total', 'Payment Status']}>
              {recentOrders.map((ord) => (
                <Tr key={ord.id} onClick={() => router.push('/orders')}>
                  <Td className="font-mono text-[10px] text-text-muted">#{ord.id.slice(0, 8)}</Td>
                  <Td className="text-xs font-medium">LKR {(ord.total / 100).toFixed(2)}</Td>
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
