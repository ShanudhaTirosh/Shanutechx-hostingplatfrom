'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Ticket, TicketStatus } from '@/lib/types';
import {
  Card,
  Button,
  Badge,
  Spinner,
  CardSkeleton,
  EmptyState,
  ErrorBanner,
  Input,
  Textarea,
  Modal,
  useToast,
  PageHeader,
  Tabs,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const { toast } = useToast();

  function load() {
    api.tickets
      .list(activeTab !== 'all' ? (activeTab as TicketStatus) : undefined)
      .then((data) => setTickets(data.tickets))
      .catch((err) => {
        setError(err.message);
        toast('Failed to load tickets', 'error');
      });
  }

  useEffect(load, [activeTab]);

  const tabs = [
    { label: 'All Tickets', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'Pending', value: 'pending' },
    { label: 'Closed', value: 'closed' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Support Tickets"
        description="Get in touch with our operations team or view your ticket history."
        action={
          <Button onClick={() => setShowModal(true)}>
            + Open Ticket
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {tickets === null && (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
      {tickets?.length === 0 && (
        <EmptyState
          message="No tickets found matching this filter."
          action={{
            label: 'Open a support ticket',
            onClick: () => setShowModal(true),
          }}
        />
      )}

      <div className="space-y-3">
        {tickets?.map((ticket) => (
          <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block">
            <Card className="hover:bg-white/[0.06] hover:border-white/12 cursor-pointer transition-all border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-text-primary">{ticket.subject}</p>
                <p className="text-text-muted text-xs mt-1">
                  Updated {new Date(ticket.updatedAt).toLocaleString()} &middot;{' '}
                  {ticket._count?.messages ?? 0} message{ticket._count?.messages === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {ticket.priority && <Badge status={ticket.priority} />}
                <Badge status={ticket.status} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Open a new support ticket">
        <NewTicketForm
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function NewTicketForm({ onCreated }: { onCreated: (ticket: Ticket) => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<import('@/lib/types').TicketPriority>('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ticket } = await api.tickets.create({ subject, message, priority });
      setSubject('');
      setMessage('');
      toast('Ticket created & dispatched to Support Hub!', 'success');
      onCreated(ticket);
    } catch (err: any) {
      setError(err.message);
      toast('Failed to create ticket', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="rounded-xl border border-white/10 bg-[#0a0a0c] p-3 text-xs text-neutral-300 flex items-center justify-between">
        <span>Submitting this ticket immediately notifies our 24/7 Support Team via Discord &amp; WhatsApp.</span>
      </div>

      <Input
        required
        label="Subject / Topic"
        placeholder="e.g. Node app port binding issue"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <div>
        <label className="block text-xs font-semibold text-text-muted mb-1">Ticket Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as any)}
          className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 capitalize transition-all"
        >
          <option value="low" className="bg-[#0a0a0d] text-white">Low Priority (General Question)</option>
          <option value="medium" className="bg-[#0a0a0d] text-white">Medium Priority (Deployment / Service Issue)</option>
          <option value="high" className="bg-[#0a0a0d] text-white">High Priority (Production Down / Urgent)</option>
        </select>
      </div>

      <Textarea
        required
        label="Description / Details"
        rows={5}
        placeholder="Please provide details about what went wrong, including error messages or links."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div className="flex gap-3 justify-end pt-2">
        <Button type="submit" loading={busy}>
          {busy ? 'Submitting...' : 'Submit Ticket'}
        </Button>
      </div>
    </form>
  );
}
