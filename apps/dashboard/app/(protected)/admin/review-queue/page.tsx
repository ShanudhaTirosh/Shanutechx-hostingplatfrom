'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Payment } from '@/lib/types';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  formatMoney,
  useToast,
  Modal,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function ReceiptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

export default function ReviewQueuePage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  // Declining always requires a reason — see routes/payments.ts, which
  // enforces this server-side too. This modal is what collects it.
  const [declineTarget, setDeclineTarget] = useState<Payment | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  function load() {
    api.payments
      .reviewQueue()
      .then((data) => setPayments(data.payments))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.payments.review(id, true);
      toast('Payment approved — service will be activated.', 'success');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openDecline(payment: Payment) {
    setDeclineReason('');
    setDeclineTarget(payment);
  }

  async function confirmDecline() {
    if (!declineTarget || !declineReason.trim()) return;
    setBusyId(declineTarget.id);
    try {
      await api.payments.review(declineTarget.id, false, declineReason.trim());
      toast('Payment declined — customer has been notified with the reason.', 'error');
      setDeclineTarget(null);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = payments?.length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Payment Review Queue"
        description="Manually verify payment proofs submitted by customers that could not be auto-approved."
        action={
          pendingCount > 0 ? (
            <span className="h-6 w-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}
      {payments === null && <Spinner />}
      {payments?.length === 0 && (
        <EmptyState message="Queue is clear — no payments waiting on manual review." />
      )}

      <div className="space-y-4">
        {payments?.map((payment) => {
          const confidence = payment.confidenceScore ?? null;
          const confidenceColor =
            confidence === null ? 'text-text-muted' :
            confidence >= 80 ? 'text-emerald-400' :
            confidence >= 50 ? 'text-orange-300' : 'text-red-400';

          return (
            <Card key={payment.id} className="border border-white/[0.06] hover:border-white/10 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-300 flex items-center justify-center shrink-0">
                    <ReceiptIcon />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-sm">
                      Order <span className="font-mono text-text-muted">#{payment.orderId.slice(0, 8).toUpperCase()}</span>
                    </p>
                    <p className="text-text-muted text-xs">{payment.order?.user?.email}</p>
                  </div>
                </div>
                <Badge status={payment.status} />
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                <div className="glass rounded-xl p-3 border border-white/[0.04]">
                  <p className="text-text-muted mb-1">Method</p>
                  <p className="font-medium capitalize">{payment.method}</p>
                </div>
                <div className="glass rounded-xl p-3 border border-white/[0.04]">
                  <p className="text-text-muted mb-1">AI Confidence</p>
                  <p className={`font-semibold ${confidenceColor}`}>
                    {confidence !== null ? `${confidence}%` : '—'}
                  </p>
                </div>
                <div className="glass rounded-xl p-3 border border-white/[0.04]">
                  <p className="text-text-muted mb-1">Order Total</p>
                  <p className="font-medium">{payment.order ? formatMoney(payment.order.total) : '—'}</p>
                </div>
              </div>

              {/* Proof image link (if exists) */}
              {(payment as any).proofUrl && (
                <a
                  href={(payment as any).proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-teal-bright hover:underline mb-4 block"
                >
                  View payment proof →
                </a>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleApprove(payment.id)}
                  loading={busyId === payment.id}
                  size="sm"
                >
                  <CheckIcon /> Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => openDecline(payment)}
                  disabled={busyId === payment.id}
                >
                  <XIcon /> Decline
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!declineTarget}
        onClose={() => setDeclineTarget(null)}
        title={`Decline payment for order #${declineTarget?.orderId.slice(0, 8).toUpperCase() ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            This reason is sent directly to the customer and stored on the payment record. A reason is required —
            declines without one are rejected by the API.
          </p>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={4}
            placeholder="e.g. Slip amount does not match the order total, or the transfer reference doesn't match any pending order."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400/50 text-text-primary"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeclineTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={confirmDecline}
              loading={busyId === declineTarget?.id}
              disabled={!declineReason.trim()}
            >
              Confirm Decline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
