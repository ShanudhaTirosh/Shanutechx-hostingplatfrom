'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Ticket, TicketStatus } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  useToast,
} from '@/components/ui';
import {
  IconServer,
  IconRefresh,
  IconAlert,
  IconPlus,
} from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default function SupportPortalPage() {
  const { apiUser } = useAppUser();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [searchCustomer, setSearchCustomer] = useState<string>('');
  const [customerResult, setCustomerResult] = useState<any | null>(null);
  const [searching, setSearching] = useState<boolean>(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [replyStatus, setReplyStatus] = useState<TicketStatus>('pending');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { toast } = useToast();

  function loadTickets() {
    api.tickets
      .list(filterStatus === 'ALL' ? undefined : filterStatus)
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(err.message));
  }

  useEffect(loadTickets, [filterStatus]);

  async function handleCustomerSearch() {
    if (!searchCustomer.trim()) return;
    setSearching(true);
    setCustomerResult(null);
    try {
      const res = await api.admin.customers(50);
      const matched = res.customers.find(
        (c) =>
          c.email.toLowerCase().includes(searchCustomer.toLowerCase()) ||
          c.id.toLowerCase() === searchCustomer.trim().toLowerCase()
      );
      if (matched) {
        setCustomerResult(matched);
        toast(`Customer found: ${matched.email}`, 'success');
      } else {
        toast('No matching customer found', 'error');
      }
    } catch (err: any) {
      toast(`Search error: ${err.message}`, 'error');
    } finally {
      setSearching(false);
    }
  }

  async function handleReplySubmit() {
    if (!selectedTicket || !replyText.trim()) return;
    setSubmitting(true);
    try {
      await api.tickets.reply(selectedTicket.id, replyText);
      await api.tickets.update(selectedTicket.id, { status: replyStatus });
      toast('Ticket response and status updated successfully.', 'success');
      setReplyText('');
      setSelectedTicket(null);
      loadTickets();
    } catch (err: any) {
      toast(`Failed to update ticket: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Support Operations Center"
        description="Unified portal for support staff: live ticket triage queue, customer account lookup, service diagnostics, and real-time support gateway."
      />

      {/* Top Metrics & Gateway Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-cyan-500/10 border border-cyan-500/20 p-4 space-y-1">
          <span className="text-cyan-300 text-xs block">Active Ticket Queue</span>
          <span className="text-2xl font-bold text-cyan-400 font-mono">
            {tickets?.filter((t) => t.status === 'open' || t.status === 'pending').length || 0}
          </span>
        </Card>
        <Card className="bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-1">
          <span className="text-emerald-300 text-xs block">Resolved Tickets</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono">
            {tickets?.filter((t) => t.status === 'closed').length || 0}
          </span>
        </Card>
        <Link href="/admin/chat" className="block">
          <Card className="bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 p-4 space-y-1 transition-all cursor-pointer">
            <span className="text-purple-300 text-xs block">Live Chat Gateway</span>
            <span className="text-sm font-bold text-purple-400">Open Live Chat Console →</span>
          </Card>
        </Link>
        <Link href="/knowledgebase" className="block">
          <Card className="bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 p-4 space-y-1 transition-all cursor-pointer">
            <span className="text-amber-300 text-xs block">Knowledge Base</span>
            <span className="text-sm font-bold text-amber-400">Manage Articles →</span>
          </Card>
        </Link>
      </div>

      {/* Customer Quick Lookup Card */}
      <Card className="bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          🔍 Customer Account Quick Lookup
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter customer email address or User ID..."
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:border-accent-teal font-mono"
          />
          <Button size="sm" variant="primary" onClick={handleCustomerSearch} loading={searching}>
            Search Customer
          </Button>
        </div>

        {customerResult && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs space-y-2 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-accent-teal font-bold">{customerResult.email}</span>
              <span className="text-xs bg-cyan-500/20 text-cyan-300 rounded px-2 py-0.5 font-bold uppercase">{customerResult.role}</span>
            </div>
            <div className="text-text-muted text-[11px]">
              User ID: {customerResult.id} | Joined: {new Date(customerResult.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </Card>

      {/* Ticket Queue Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Filter Queue:</span>
          {(['ALL', 'open', 'pending', 'closed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === st
                  ? 'bg-accent-teal text-black'
                  : 'bg-white/5 text-text-muted hover:text-white'
              }`}
            >
              {st.toUpperCase()}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={loadTickets} className="flex items-center gap-1.5">
          <IconRefresh size={14} /> Refresh Queue
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {tickets === null && <Spinner label="Loading support ticket queue..." />}
      {tickets?.length === 0 && (
        <EmptyState message="No tickets found matching current filter." />
      )}

      {/* Ticket List & Triage Drawer */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {tickets?.map((t) => (
            <Card
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`p-4 space-y-2 cursor-pointer transition-all border ${
                selectedTicket?.id === t.id
                  ? 'border-accent-teal bg-white/10'
                  : 'border-white/10 bg-neutral-900/60 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">{t.subject}</span>
                <Badge status={t.status === 'open' ? 'failed' : t.status === 'pending' ? 'pending' : 'running'} />
              </div>
              <p className="text-text-muted text-xs line-clamp-2 leading-relaxed">{t.messages?.[0]?.body || 'No message content'}</p>
              <div className="flex items-center justify-between text-[10px] text-text-muted pt-1 border-t border-white/5 font-mono">
                <span>User: {t.userId.slice(0, 8)}...</span>
                <span>Updated: {new Date(t.updatedAt).toLocaleString()}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Reply & Triage Workspace */}
        {selectedTicket ? (
          <Card className="border border-white/10 bg-neutral-900 p-5 space-y-4 h-fit sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-sm">Ticket Response Workspace</h3>
              <Badge status={selectedTicket.status === 'open' ? 'failed' : selectedTicket.status === 'pending' ? 'pending' : 'running'} />
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-accent-teal">{selectedTicket.subject}</div>
              <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-text-muted leading-relaxed font-mono">
                {selectedTicket.messages?.[0]?.body || 'No content provided.'}
              </div>
            </div>

            {/* Conversation Thread */}
            {selectedTicket.messages && selectedTicket.messages.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedTicket.messages.map((m, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs space-y-1">
                    <div className="text-[10px] text-accent-teal font-semibold font-mono">
                      {m.senderId} ({m.senderRole})
                    </div>
                    <div className="text-white text-xs leading-normal">{m.body}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-white/10 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Staff Response Note *</label>
                <textarea
                  rows={4}
                  placeholder="Type your response to the customer..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder:text-text-muted focus:outline-none focus:border-accent-teal font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Update Ticket Status</label>
                <select
                  value={replyStatus}
                  onChange={(e) => setReplyStatus(e.target.value as TicketStatus)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white focus:outline-none focus:border-accent-teal font-mono text-xs"
                >
                  <option value="pending" className="bg-neutral-900 text-white">PENDING (Awaiting Customer Response)</option>
                  <option value="open" className="bg-neutral-900 text-white">OPEN (In Progress)</option>
                  <option value="closed" className="bg-neutral-900 text-white">CLOSED (Resolved)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelectedTicket(null)}>
                  Close Drawer
                </Button>
                <Button size="sm" variant="primary" onClick={handleReplySubmit} loading={submitting}>
                  Send Response & Update Status
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border border-dashed border-white/10 p-8 flex flex-col items-center justify-center text-center text-text-muted space-y-2">
            <span className="text-2xl">🎧</span>
            <p className="text-xs">Select any ticket from the queue on the left to review details and send a staff response.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
