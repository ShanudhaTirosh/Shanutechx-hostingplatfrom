'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Order } from '@/lib/types';
import { orderItemName, orderItemLineTotal } from '@/lib/orderItem';
import {
  Card,
  Button,
  Badge,
  Spinner,
  CardSkeleton,
  EmptyState,
  ErrorBanner,
  PageHeader,
  formatMoney,
  useToast,
} from '@/components/ui';
import { apiFetch } from '@/lib/useAuth';
import InvoiceModal from '@/components/InvoiceModal';

export const dynamic = 'force-dynamic';

// ── Icons ──────────────────────────────────────────────────────────────────
function ReceiptIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
    </svg>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.orders
      .list()
      .then((data) => setOrders(data.orders))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const totalSpend = orders?.reduce((acc, o) => acc + (o.total ?? 0), 0) ?? 0;
  const pendingCount = orders?.filter((o) => o.status === 'awaiting_payment').length ?? 0;
  const paidCount = orders?.filter((o) => o.status === 'paid').length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Orders & Invoices"
        description="Track your purchases and manage payment proofs."
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {/* Summary strip */}
      {orders && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Spent', value: formatMoney(totalSpend), color: 'text-accent-violet-light' },
            { label: 'Paid Orders', value: paidCount, color: 'text-emerald-400' },
            { label: 'Awaiting Payment', value: pendingCount, color: 'text-orange-300' },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-4 border border-white/[0.06]">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {orders === null && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
      {orders?.length === 0 && (
        <EmptyState message="No orders yet — browse the service catalog and add something to your cart." />
      )}

      <div className="space-y-4">
        {orders?.map((order) => (
          <OrderCard key={order.id} order={order} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const latestPayment = order.payments?.[order.payments.length - 1];

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const idempotencyKey = crypto.randomUUID();
    try {
      const { payment } = await api.orders.uploadProof(order.id, file, idempotencyKey);
      if (payment.status === 'auto_approved') {
        toast('Payment confirmed automatically ✓', 'success');
      } else if (payment.status === 'manual_review') {
        toast('Submitted for review — a team member will verify shortly.', 'info');
      } else {
        toast('Could not verify proof. Try a clearer screenshot.', 'error');
      }
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownloadInvoice() {
    setDownloading(true);
    setError(null);
    try {
      const res = await apiFetch(api.orders.invoiceUrl(order.id));
      if (!res.ok) throw new Error('Failed to download invoice');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Invoice downloaded', 'success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        order={order}
      />

      <Card className="border border-white/[0.06] hover:border-white/10 transition-all">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center shrink-0">
              <ReceiptIcon />
            </div>
            <div>
              <p className="font-semibold text-text-primary text-sm">
                Order <span className="font-mono text-text-muted">#{order.id.slice(0, 8).toUpperCase()}</span>
              </p>
              <p className="text-text-muted text-xs">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <Badge status={order.status} />
        </div>

        {/* Line items */}
        <div className="space-y-1.5 mb-4 text-sm">
          {order.items?.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-text-muted">
                {orderItemName(item)}
                <span className="ml-1 text-[10px] text-text-faint">× {item.quantity}</span>
              </span>
              <span className="text-text-primary font-medium">{formatMoney(orderItemLineTotal(item))}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <span className="text-xs text-text-muted font-medium uppercase tracking-wide">Total</span>
          <span className="font-bold text-text-primary">{formatMoney(order.total)}</span>
        </div>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        {latestPayment && order.status === 'awaiting_payment' && (
          <p className="text-text-muted text-xs mt-3 flex items-center gap-2">
            Last payment attempt:
            <Badge status={latestPayment.status} />
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2.5 mt-4">
          {order.status === 'awaiting_payment' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                loading={uploading}
                size="sm"
              >
                <UploadIcon />
                {uploading ? 'Uploading...' : 'Upload payment proof'}
              </Button>
            </>
          )}

          {order.status === 'paid' && (
            order.total === 0 ? (
              <span className="text-xs font-medium text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                ✓ Free Order (No Invoice Required)
              </span>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowInvoiceModal(true)}
                >
                  <ReceiptIcon />
                  View Invoice
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadInvoice}
                  loading={downloading}
                >
                  <DownloadIcon />
                  {downloading ? 'Preparing...' : 'Download PDF'}
                </Button>
              </>
            )
          )}
        </div>
      </Card>
    </>
  );
}
