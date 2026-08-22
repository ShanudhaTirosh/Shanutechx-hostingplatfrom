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
  Table,
  Tr,
  Td,
  Badge,
  Button,
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
    icon: '💳',
  },
  {
    href: '/admin/customers',
    title: 'Customer Directory',
    desc: 'Manage customer accounts, assigned admins, spend totals, and account details.',
    icon: '👥',
  },
  {
    href: '/admin/services',
    title: 'Products & Plans',
    desc: 'Manage services, pricing tiers, plans, and subscription packages.',
    icon: '📦',
  },
  {
    href: '/admin/staff',
    title: 'Staff Management',
    desc: 'View staff members, manage support staff, and update role assignments.',
    icon: '🛡️',
  },
  {
    href: '/admin/cms',
    title: 'Site Content (CMS)',
    desc: 'Edit landing page copy, promotional banners, feature blocks, and public pricing text.',
    icon: '📝',
  },
  {
    href: '/admin/analytics',
    title: 'Platform Analytics',
    desc: 'View sales performance metrics, revenue charts, user conversion, and order statistics.',
    icon: '📊',
  },
  {
    href: '/admin/audit-log',
    title: 'Audit Log',
    desc: 'Inspect full audit trail of staff actions, payment approvals, and role updates.',
    icon: '📜',
  },
  {
    href: '/admin/knowledgebase',
    title: 'Knowledge Base Manager',
    desc: 'Create, edit, publish, and delete customer-facing documentation articles & guides.',
    icon: '📚',
  },
  {
    href: '/admin/chat',
    title: 'Live Support Chat',
    desc: 'Engage in real-time chat with customers and handle support inquiries live.',
    icon: '💬',
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
          <Card className="flex flex-col items-center justify-center py-8 border border-white/[0.06] text-center">
            <p className="text-text-muted text-xs mb-1">✅ No pending payment proofs awaiting review.</p>
            <p className="text-text-faint text-[11px]">All submitted bank slips have been processed.</p>
          </Card>
        ) : (
          <Table headers={['Order ID', 'Amount', 'Submitted At', 'Status', 'Action']}>
            {pendingPaymentsList.map((p) => (
              <Tr key={p.id} onClick={() => router.push('/admin/review-queue')}>
                <Td className="font-mono text-xs text-text-primary">#{p.orderId?.slice(0, 8)}</Td>
                <Td className="text-xs font-bold text-emerald-400">LKR {(p.amount / 100).toFixed(2)}</Td>
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
