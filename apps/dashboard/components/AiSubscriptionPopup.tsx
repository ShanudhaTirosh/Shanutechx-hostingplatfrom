'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Card } from '@/components/ui';

interface AiSubItem {
  id: string; // OrderItem id
  planName: string;
}

/**
 * Shown right after checkout when the cart contained one or more
 * ai_subscription products (Gemini Pro, GPT Pro, Lovable, Canva, etc).
 * These are never auto-provisioned — the only action available is opening
 * a ticket with the reason already filled in. No free text from the
 * customer, per the product requirement.
 */
export function AiSubscriptionPopup({
  items,
  onDone,
}: {
  items: AiSubItem[];
  onDone: () => void;
}) {
  const [ticketIds, setTicketIds] = useState<Record<string, string>>({});
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openTicket(item: AiSubItem) {
    setOpening(item.id);
    setError(null);
    try {
      const { ticket } = await api.aiSubscription.openTicket(item.id);
      setTicketIds((prev) => ({ ...prev, [item.id]: ticket.id }));
    } catch (err: any) {
      setError(err.message || 'Failed to open ticket');
    } finally {
      setOpening(null);
    }
  }

  const allDone = items.every((i) => ticketIds[i.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="max-w-md w-full border border-white/10 bg-surface-card shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 text-fuchsia-300 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-text-primary text-sm">AI subscription setup needed</h2>
            <p className="text-xs text-text-muted">These seats are activated by hand, not automatically.</p>
          </div>
        </div>

        <p className="text-xs text-text-muted leading-relaxed mb-4">
          For each AI subscription below, just click "Open Ticket" — we'll fill in the reason for you.
          Our team will reach out once it's ready.
        </p>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="space-y-2 mb-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
            >
              <span className="text-sm text-text-primary font-medium truncate">{item.planName}</span>
              {ticketIds[item.id] ? (
                <Link href="/tickets">
                  <Button size="sm" variant="secondary">View Ticket</Button>
                </Link>
              ) : (
                <Button size="sm" onClick={() => openTicket(item)} loading={opening === item.id}>
                  {opening === item.id ? 'Opening...' : 'Open Ticket'}
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={onDone}
          variant={allDone ? 'primary' : 'secondary'}
          className="w-full justify-center"
        >
          {allDone ? 'Continue to Orders' : 'Continue without opening all tickets'}
        </Button>
      </Card>
    </div>
  );
}
