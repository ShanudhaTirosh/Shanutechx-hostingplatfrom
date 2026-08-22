'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Ticket, TicketStatus } from '@/lib/types';
import {
  Card,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Tabs,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

const TABS = [
  { label: 'All Tickets', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Pending', value: 'pending' },
  { label: 'Closed', value: 'closed' },
];

function MessageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('open');

  useEffect(() => {
    setTickets(null);
    const filterParam = activeTab === 'all' ? undefined : (activeTab as TicketStatus);
    api.tickets
      .list(filterParam)
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(err.message));
  }, [activeTab]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Admin Support Queue"
        description="Review and respond to technical support queries and requests submitted by customers."
      />

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {tickets === null && <Spinner label="Loading tickets..." />}
      {tickets?.length === 0 && <EmptyState message="All clear! No support tickets in this view." />}

      <div className="space-y-3">
        {tickets?.map((ticket) => (
          <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} className="block">
            <Card className="hover:bg-white/[0.06] hover:border-white/12 cursor-pointer transition-all border border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-text-primary group-hover:text-white transition-colors">{ticket.subject}</p>
                <div className="flex items-center gap-3 text-text-muted text-xs mt-1.5 flex-wrap">
                  <span className="font-mono bg-white/[0.04] px-1.5 py-0.5 rounded text-[10px]">{ticket.user?.email}</span>
                  <span>Updated {new Date(ticket.updatedAt).toLocaleString()}</span>
                  <span className="flex items-center gap-1">
                    <MessageIcon />
                    {ticket._count?.messages ?? 0}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                {ticket.priority && <Badge status={ticket.priority} />}
                <Badge status={ticket.status} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
