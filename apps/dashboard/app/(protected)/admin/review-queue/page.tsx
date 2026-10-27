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
function ZoomInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  );
}
function RotateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}

function resolveFullProofUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

type StatusFilter = 'manual_review' | 'manually_approved' | 'rejected' | 'all';

export default function ReviewQueuePage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('manual_review');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  const [declineTarget, setDeclineTarget] = useState<Payment | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  // Slip Inspector Modal State
  const [inspectPayment, setInspectPayment] = useState<Payment | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  function load(filter: StatusFilter = activeFilter) {
    setPayments(null);
    api.payments
      .reviewQueue(filter)
      .then((data) => setPayments(data.payments))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load(activeFilter);
  }, [activeFilter]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.payments.review(id, true);
      toast('Payment approved — customer service activated!', 'success');
      load(activeFilter);
      if (inspectPayment?.id === id) setInspectPayment(null);
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
      toast('Payment declined — customer notified.', 'error');
      setDeclineTarget(null);
      if (inspectPayment?.id === declineTarget.id) setInspectPayment(null);
      load(activeFilter);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openInspector(payment: Payment) {
    setZoomLevel(1);
    setRotation(0);
    setInspectPayment(payment);
  }

  const pendingCount = payments?.filter((p) => p.status === 'manual_review').length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Payment Review Queue"
        description="Verify bank transfers, uploaded receipts, and SMS payment match events."
        action={
          pendingCount > 0 ? (
            <span className="h-6 w-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <div className="flex border-b border-white/[0.08] gap-2 pb-px overflow-x-auto">
        {[
          { key: 'manual_review', label: 'Pending Review' },
          { key: 'manually_approved', label: 'Approved' },
          { key: 'rejected', label: 'Declined' },
          { key: 'all', label: 'All Payments' },
        ].map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as StatusFilter)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all border shrink-0 ${
                isActive
                  ? 'bg-white/[0.1] text-text-primary border-white/20 shadow-sm'
                  : 'text-text-muted hover:text-white border-transparent hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && <ErrorBanner message={error} />}
      {payments === null && <Spinner label="Loading review queue..." />}
      {payments?.length === 0 && (
        <EmptyState message="No payment records found matching the selected filter." />
      )}

      <div className="space-y-4">
        {payments?.map((payment) => {
          const confidence = payment.confidenceScore ?? null;
          const confidenceColor =
            confidence === null ? 'text-text-muted' :
            confidence >= 80 ? 'text-emerald-400' :
            confidence >= 50 ? 'text-orange-300' : 'text-red-400';

          const fullProofUrl = resolveFullProofUrl(payment.proofUrl);
          const isPdf = payment.proofUrl?.toLowerCase().endsWith('.pdf');
          const isPending = payment.status === 'manual_review' || payment.status === 'pending';

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
                    <p className="text-text-muted text-xs">{payment.order?.user?.email ?? 'Unknown customer'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={payment.status} />
                  <span className="text-[10px] text-text-faint font-mono">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Order line items summary if available */}
              {payment.order?.items && payment.order.items.length > 0 && (
                <div className="mb-4 p-3 glass rounded-xl border border-white/[0.04] space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-text-faint font-medium">Order Items</p>
                  {payment.order.items.map((item) => (
                    <div key={item.id} className="text-xs flex justify-between text-text-muted">
                      <span>{item.plan?.name ?? item.service?.name ?? 'Cloud Product'} × {item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                <div className="glass rounded-xl p-3 border border-white/[0.04]">
                  <p className="text-text-muted mb-1">Method</p>
                  <p className="font-semibold text-teal-300">
                    {(payment.extractedJson as any)?.methodName || payment.method.replace('_', ' ')}
                  </p>
                </div>
                <div className="glass rounded-xl p-3 border border-white/[0.04]">
                  <p className="text-text-muted mb-1">Proof Format</p>
                  <p className="font-mono text-slate-300">
                    {(payment.extractedJson as any)?.format ? 'WebP (Processed)' : isPdf ? 'PDF' : 'Image'}
                  </p>
                </div>
                <div className="glass rounded-xl p-3 border border-white/[0.04]">
                  <p className="text-text-muted mb-1">Order Total</p>
                  <p className="font-medium">
                    {payment.order ? formatMoney(payment.order.totalLkr ?? payment.order.total, 'LKR') : '—'}
                  </p>
                </div>
              </div>

              {/* Parsed / Submitted Transaction metadata if available */}
              {payment.extractedJson && typeof payment.extractedJson === 'object' && (
                <div className="glass rounded-xl p-3 border border-white/[0.04] text-xs mb-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-text-faint font-medium">Customer Payment Details</p>
                  <div className="flex flex-wrap gap-4 text-text-muted">
                    {(payment.extractedJson as any).methodName && (
                      <p><span className="text-text-faint">Channel:</span> <strong className="text-text-primary">{(payment.extractedJson as any).methodName}</strong></p>
                    )}
                    {(payment.extractedJson as any).reference && (
                      <p><span className="text-text-faint font-mono">Reference:</span> <code className="text-teal-300 font-bold">{(payment.extractedJson as any).reference}</code></p>
                    )}
                    {(payment.extractedJson as any).notes && (
                      <p><span className="text-text-faint">Note:</span> {(payment.extractedJson as any).notes}</p>
                    )}
                    {(payment.extractedJson as any).amount && (
                      <p><span className="text-text-faint">Amount:</span> LKR {(payment.extractedJson as any).amount}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Rejection Reason display */}
              {payment.status === 'rejected' && payment.rejectionReason && (
                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-xs mb-4">
                  <p className="text-red-300 font-medium">Decline Reason:</p>
                  <p className="text-text-muted mt-0.5">{payment.rejectionReason}</p>
                </div>
              )}

              {/* Proof slip thumbnail or document button */}
              {fullProofUrl && (
                <div className="mb-4">
                  {isPdf ? (
                    <a
                      href={fullProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 text-accent-teal-bright px-3 py-2 rounded-xl border border-white/10 transition-all"
                    >
                      View PDF Payment Proof Document →
                    </a>
                  ) : (
                    <div
                      onClick={() => openInspector(payment)}
                      className="group relative cursor-pointer rounded-xl overflow-hidden border border-white/10 max-h-48 max-w-sm bg-black/40"
                    >
                      <img
                        src={fullProofUrl}
                        alt="Payment proof screenshot"
                        className="w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity gap-1.5">
                        <ZoomInIcon /> Tap to inspect full slip
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              {isPending && (
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
              )}
            </Card>
          );
        })}
      </div>

      {/* Decline Reason Modal */}
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

      {/* Proof Slip Inspector Modal */}
      <Modal
        open={!!inspectPayment}
        onClose={() => setInspectPayment(null)}
        title={`Inspect Proof Slip — Order #${inspectPayment?.orderId.slice(0, 8).toUpperCase() ?? ''}`}
      >
        {inspectPayment && (
          <div className="space-y-4">
            {/* Control Bar */}
            <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold"
                >
                  -
                </button>
                <span className="font-mono text-text-muted">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => { setZoomLevel(1); setRotation(0); }}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-text-muted text-[11px]"
                >
                  Reset
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-text-muted flex items-center gap-1"
                >
                  <RotateIcon /> Rotate
                </button>
                {resolveFullProofUrl(inspectPayment.proofUrl) && (
                  <a
                    href={resolveFullProofUrl(inspectPayment.proofUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-accent-teal/20 text-accent-teal-bright rounded-lg font-medium hover:underline"
                  >
                    Open Original
                  </a>
                )}
              </div>
            </div>

            {/* Image viewer container */}
            <div className="overflow-auto max-h-[60vh] bg-black/60 rounded-xl p-4 flex items-center justify-center border border-white/10 min-h-[300px]">
              {resolveFullProofUrl(inspectPayment.proofUrl) ? (
                <img
                  src={resolveFullProofUrl(inspectPayment.proofUrl)!}
                  alt="Proof Slip"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease-in-out',
                  }}
                  className="max-w-full rounded-lg object-contain"
                />
              ) : (
                <p className="text-xs text-text-muted">No proof URL available</p>
              )}
            </div>

            {/* Inspector Action footer */}
            {(inspectPayment.status === 'manual_review' || inspectPayment.status === 'pending') && (
              <div className="flex gap-3 justify-end pt-2 border-t border-white/10">
                <Button variant="danger" size="sm" onClick={() => openDecline(inspectPayment)}>
                  <XIcon /> Decline
                </Button>
                <Button size="sm" onClick={() => handleApprove(inspectPayment.id)} loading={busyId === inspectPayment.id}>
                  <CheckIcon /> Approve Payment
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
