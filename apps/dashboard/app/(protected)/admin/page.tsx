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
  formatMoney,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function ReviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
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

function AuditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14"/>
      <path d="M3.05 11a9 9 0 11.5 4m-.5 5v-5h5"/>
    </svg>
  );
}

const ADMIN_CARDS = [
  {
    href: '/admin/review-queue',
    title: 'Payment Review Queue',
    desc: 'Verify customer uploaded bank slips & payment proofs for manual order approvals.',
    icon: (
      <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/settings',
    title: 'Payment Methods & Gateways',
    desc: 'Manage bank transfer info, Helakuru HelaPay, Dialog eZ Cash, Bybit Crypto, and toggle active methods.',
    icon: (
      <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/customers',
    title: 'Customer Directory',
    desc: 'Manage customer accounts, assigned admins, spend totals, and account details.',
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/services',
    title: 'Products & Plans',
    desc: 'Manage services, pricing tiers, plans, and subscription packages.',
    icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/admin/staff',
    title: 'Staff Management',
    desc: 'View staff members, manage support staff, and update role assignments.',
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    href: '/admin/cms',
    title: 'Site Content (CMS)',
    desc: 'Edit landing page copy, promotional banners, feature blocks, and public pricing text.',
    icon: (
      <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    href: '/admin/analytics',
    title: 'Platform Analytics',
    desc: 'View sales performance metrics, revenue charts, user conversion, and order statistics.',
    icon: (
      <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/admin/audit-log',
    title: 'Audit Log',
    desc: 'Inspect full audit trail of staff actions, payment approvals, and role updates.',
    icon: (
      <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/admin/knowledgebase',
    title: 'Knowledge Base Manager',
    desc: 'Create, edit, publish, and delete customer-facing documentation articles & guides.',
    icon: (
      <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];


export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    pendingPayments: 0,
    customersCount: 0,
    openTickets: 0,
    auditCount: 0,
  });

  const [pendingPaymentsList, setPendingPaymentsList] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.payments.reviewQueue(),
      api.admin.customers(10),
      api.tickets.list(),
      api.admin.auditLog(),
    ])
      .then((results) => {
        const [payRes, custRes, tckRes, auditRes] = results;

        const payments = payRes.status === 'fulfilled' ? payRes.value.payments : [];
        const customers = custRes.status === 'fulfilled' ? custRes.value : { total: 0 };
        const tickets = tckRes.status === 'fulfilled' ? tckRes.value.tickets : [];
        const audit = auditRes.status === 'fulfilled' ? auditRes.value : { total: 0 };

        setStats({
          pendingPayments: payments.length,
          customersCount: customers.total || 0,
          openTickets: tickets.filter((t: any) => t.status === 'open').length,
          auditCount: audit.total || 0,
        });

        setPendingPaymentsList(payments.slice(0, 5));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Admin Control Center"
        description="Comprehensive management portal for orders, customers, products, staff, site content, and support."
      />

      {error && <ErrorBanner message={error} />}

      {/* Stats Summary Grid */}
      {loading ? (
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse bg-white/[0.02] border-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard
            label="Pending Payment Reviews"
            value={stats.pendingPayments}
            icon={<ReviewIcon />}
            color="orange"
          />
          <StatCard
            label="Total Customers"
            value={stats.customersCount}
            icon={<UsersIcon />}
            color="teal"
          />
          <StatCard
            label="Open Support Tickets"
            value={stats.openTickets}
            icon={<TicketsIcon />}
            color="violet"
          />
          <StatCard
            label="Audit Log Entries"
            value={stats.auditCount}
            icon={<AuditIcon />}
            color="green"
          />
        </div>
      )}

      {/* Pending Payment Proofs Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Pending Payment Proofs ({pendingPaymentsList.length})
          </h2>
          <Link href="/admin/review-queue" className="text-xs text-accent-teal-bright hover:underline font-medium">
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

      {/* Quick Access Admin Cards */}
      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Admin Management Modules</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {ADMIN_CARDS.map((card) => (
            <Link key={card.href} href={card.href}>
              <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group p-5">
                <div className="text-2xl mb-3">{card.icon}</div>
                <h3 className="font-semibold text-text-primary text-sm mb-1 group-hover:text-white transition-colors">
                  {card.title}
                </h3>
                <p className="text-text-muted text-xs leading-relaxed">{card.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
