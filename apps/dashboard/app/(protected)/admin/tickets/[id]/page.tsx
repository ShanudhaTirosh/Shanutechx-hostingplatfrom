'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Ticket, TicketStatus, TicketPriority } from '@/lib/types';
import { TicketThread } from '@/components/TicketThread';
import { Card, useToast } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS: TicketStatus[] = ['open', 'pending', 'closed'];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'medium', 'high'];

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="space-y-6 animate-fade-in">
      <TicketThread
        ticketId={params.id}
        adminControls={(ticket, reload) => <AdminControls ticket={ticket} onChanged={reload} />}
      />
    </div>
  );
}

function AdminControls({ ticket, onChanged }: { ticket: Ticket; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function handleChange(data: { status?: TicketStatus; priority?: TicketPriority }) {
    setBusy(true);
    try {
      await api.tickets.update(ticket.id, data);
      toast('Ticket updated successfully', 'success');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Failed to update ticket', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border border-white/[0.06] bg-white/[0.01] p-4 mb-6">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-text-muted">Status:</span>
          <select
            value={ticket.status}
            disabled={busy}
            onChange={(e) => handleChange({ status: e.target.value as TicketStatus })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-accent-violet/50 capitalize"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-[#0a0a14] capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-text-muted">Priority:</span>
          <select
            value={ticket.priority}
            disabled={busy}
            onChange={(e) => handleChange({ priority: e.target.value as TicketPriority })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-accent-violet/50 capitalize"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p} className="bg-[#0a0a14] capitalize">
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}
