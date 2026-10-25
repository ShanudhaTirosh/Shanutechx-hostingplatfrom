'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { api } from '@/lib/api';
import { Order, OrderItem, Subscription } from '@/lib/types';
import {
  orderItemName,
  orderItemUnitPrice,
  orderItemLineTotal,
  orderItemSubtitle,
  orderItemCurrency,
} from '@/lib/orderItem';
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
  Modal,
} from '@/components/ui';
import { apiFetch } from '@/lib/useAuth';
import InvoiceModal from '@/components/InvoiceModal';
import PaymentProofModal from '@/components/PaymentProofModal';

// ── Icons ──────────────────────────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

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

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
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

function SweepIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}

export type TabType = 'subscriptions' | 'orders' | 'cart';

export function UnifiedOrdersPortal({ initialTab = 'subscriptions' }: { initialTab?: TabType }) {
  return (
    <Suspense fallback={<div className="p-6"><Spinner /></div>}>
      <UnifiedOrdersPortalContent initialTab={initialTab} />
    </Suspense>
  );
}

function UnifiedOrdersPortalContent({ initialTab = 'subscriptions' }: { initialTab?: TabType }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apiUser } = useAppUser();
  const { toast } = useToast();

  const tabParam = searchParams.get('tab') as TabType | null;
  const initialActive = tabParam && ['subscriptions', 'orders', 'cart'].includes(tabParam)
    ? tabParam
    : initialTab;
  const [activeTab, setActiveTabState] = useState<TabType>(initialActive);

  useEffect(() => {
    if (tabParam && ['subscriptions', 'orders', 'cart'].includes(tabParam)) {
      setActiveTabState(tabParam);
    }
  }, [tabParam]);

  function setActiveTab(tab: TabType) {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.push(`/orders?${params.toString()}`);
  }

  // ── Data States ──────────────────────────────────────────────────────────
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [cartItems, setCartItems] = useState<OrderItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subscriptions renewal state
  const [runningCheck, setRunningCheck] = useState(false);
  const [renewSub, setRenewSub] = useState<Subscription | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingRenew, setSubmittingRenew] = useState(false);

  // Cart state
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const [aiSubItems, setAiSubItems] = useState<Array<{ id: string; planName: string }>>([]);

  function loadAllData() {
    api.billing
      .subscriptions()
      .then((data) => setSubscriptions(data.subscriptions))
      .catch((err) => setError(err.message));

    api.orders
      .list()
      .then((data) => setOrders(data.orders))
      .catch((err) => setError(err.message));

    api.cart
      .get()
      .then((data) => setCartItems(data.items))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadAllData();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleRunChecks() {
    setRunningCheck(true);
    try {
      const result = await api.billing.runChecks();
      toast(
        `Renewal sweep complete — marked ${result.markedPastDue} past due, cancelled ${result.cancelled}.`,
        'success'
      );
      loadAllData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setRunningCheck(false);
    }
  }

  async function handleRenewalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renewSub) return;
    setSubmittingRenew(true);
    try {
      const res = await api.billing.renew(renewSub.id);
      if (proofFile) {
        await api.billing.uploadRenewalProof(res.renewalOrderId, proofFile);
      }
      toast('Renewal payment proof submitted! An admin will review and extend your subscription shortly.', 'success');
      setRenewSub(null);
      setProofFile(null);
      loadAllData();
    } catch (err: any) {
      toast(err.message || 'Failed to submit renewal request', 'error');
    } finally {
      setSubmittingRenew(false);
    }
  }

  async function handleRemoveCartItem(itemId: string) {
    setBusyItemId(itemId);
    try {
      await api.cart.removeItem(itemId);
      loadAllData();
      toast('Item removed from cart', 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleCartCheckout() {
    setCheckingOut(true);
    try {
      await api.cart.checkout(idempotencyKeyRef.current);
      toast('Order placed! Upload your payment proof in the Orders tab.', 'success');
      loadAllData();
      setActiveTab('orders');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCheckingOut(false);
    }
  }

  // ── Calculated Summaries ──────────────────────────────────────────────────
  const activeSubsCount = subscriptions?.filter((s) => s.status === 'active').length ?? 0;
  const totalOrdersSpend = orders?.reduce((acc, o) => acc + (o.total ?? 0), 0) ?? 0;
  const pendingOrdersCount = orders?.filter((o) => o.status === 'awaiting_payment').length ?? 0;
  const cartCount = cartItems?.length ?? 0;
  const cartTotal = cartItems?.reduce((sum, item) => sum + orderItemLineTotal(item), 0) ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Subscriptions, Orders & Invoices"
        description="Manage your active platform subscriptions, order history, invoices, and cart in one place."
      />

      {error && <ErrorBanner message={error} />}

      {/* Top Tab Bar */}
      <div className="flex border-b border-white/10 gap-2.5 pb-2 overflow-x-auto">
        {[
          {
            key: 'subscriptions',
            label: 'Subscriptions & Active Services',
            icon: <CalendarIcon />,
            badge: activeSubsCount > 0 ? activeSubsCount : undefined,
          },
          {
            key: 'orders',
            label: 'Orders & Invoices',
            icon: <ReceiptIcon />,
            badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} Pending` : undefined,
          },
          {
            key: 'cart',
            label: 'Shopping Cart',
            icon: <CartIcon />,
            badge: cartCount > 0 ? cartCount : undefined,
          },
        ].map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              type="button"
              key={t.key}
              onClick={() => setActiveTab(t.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold rounded-xl transition-all border shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/25'
              }`}
            >
              <span className={isActive ? 'text-black' : 'text-white/80'}>
                {t.icon}
              </span>
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    isActive
                      ? 'bg-black/15 text-black border-black/20'
                      : 'bg-white/15 text-white border-white/20'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: SUBSCRIPTIONS ───────────────────────────────────────────── */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-5">
          {subscriptions && subscriptions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Active Services', value: activeSubsCount },
                {
                  label: 'Monthly Spend',
                  value: formatMoney(
                    subscriptions
                      .filter((s) => s.status === 'active')
                      .reduce((acc, s) => acc + (s.orderItem?.plan?.price ?? s.orderItem?.service?.price ?? 0), 0)
                  ),
                },
                {
                  label: 'Cancelled',
                  value: subscriptions.filter((s) => s.status === 'cancelled').length,
                },
              ].map((s) => (
                <div key={s.label} className="bg-gradient-to-b from-zinc-900/90 to-black/90 rounded-2xl p-4 border border-white/10">
                  <p className="text-[10px] text-white/60 uppercase font-mono tracking-wider mb-1">{s.label}</p>
                  <p className="text-xl font-bold font-mono text-white">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {apiUser?.role === 'admin' && (
            <Card className="border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-300 flex items-center justify-center">
                    <SweepIcon />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-sm">Automated Renewal Sweep</p>
                    <p className="text-text-muted text-xs mt-0.5">
                      Runs daily to update past-due subscriptions and trigger billing dunning.
                    </p>
                  </div>
                </div>
                <Button onClick={handleRunChecks} loading={runningCheck} variant="secondary" size="sm">
                  <SweepIcon />
                  {runningCheck ? 'Running...' : 'Run Sweep Now'}
                </Button>
              </div>
            </Card>
          )}

          {subscriptions === null && (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          )}
          {subscriptions?.length === 0 && (
            <EmptyState message="No active subscriptions yet. Browse services to launch your first VPS, bot, or app!" />
          )}

          <div className="space-y-3">
            {subscriptions?.map((sub) => {
              const daysLeft = Math.ceil(
                (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const isExpiringSoon = daysLeft <= 7 && sub.status === 'active';
              const canRenew = sub.status === 'active' || sub.status === 'past_due';

              return (
                <Card
                  key={sub.id}
                  className={`border transition-all ${
                    isExpiringSoon
                      ? 'border-orange-500/30 bg-orange-500/[0.03]'
                      : 'border-white/[0.06] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center shrink-0">
                        <CalendarIcon />
                      </div>
                      <div>
                        <p className="font-semibold text-text-primary text-sm">
                          {sub.orderItem?.plan?.name ?? sub.orderItem?.service?.name ?? 'Cloud Subscription'}
                        </p>
                        {apiUser?.role === 'admin' && (
                          <p className="text-text-muted text-xs">{sub.user?.email}</p>
                        )}
                        <p className="text-text-muted text-xs mt-0.5 flex items-center gap-1.5">
                          <CalendarIcon />
                          {sub.status === 'cancelled' ? 'Ended' : 'Renews'}{' '}
                          {new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                          {sub.orderItem && (
                            <span className="text-text-faint">
                              · {formatMoney(sub.orderItem.plan?.price ?? sub.orderItem.service?.price ?? 0)}/mo
                            </span>
                          )}
                        </p>
                        {isExpiringSoon && (
                          <p className="text-orange-300 text-xs mt-0.5 font-medium flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-orange-400 shrink-0 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge status={sub.status} />
                      {canRenew && apiUser?.role !== 'admin' && (
                        <Button variant="primary" size="sm" onClick={() => setRenewSub(sub)}>
                          Renew Service
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: ORDERS & INVOICES ───────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          {orders && orders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Spent', value: formatMoney(totalOrdersSpend), color: 'text-accent-violet-light' },
                { label: 'Paid Invoices', value: orders.filter((o) => o.status === 'paid').length, color: 'text-emerald-400' },
                { label: 'Awaiting Payment', value: pendingOrdersCount, color: 'text-orange-300' },
              ].map((s) => (
                <div key={s.label} className="glass rounded-2xl p-4 border border-white/[0.06]">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {orders === null && (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          )}
          {orders?.length === 0 && (
            <EmptyState message="No orders placed yet. Browse the catalog to select your hosting services." />
          )}

          <div className="space-y-4">
            {orders?.map((order) => (
              <OrderCard key={order.id} order={order} onChanged={loadAllData} />
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: SHOPPING CART ───────────────────────────────────────────── */}
      {activeTab === 'cart' && (
        <div className="space-y-5 max-w-2xl">
          {cartItems === null && <Spinner />}
          {cartItems?.length === 0 && (
            <EmptyState message="Your cart is currently empty — browse our service catalog to add plans!" />
          )}

          {cartItems && cartItems.length > 0 && (
            <>
              <Card className="border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.06]">
                  <div className="h-8 w-8 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center">
                    <CartIcon />
                  </div>
                  <p className="font-semibold text-text-primary text-sm">
                    {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} ready for checkout
                  </p>
                </div>

                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-none"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm">{orderItemName(item)}</p>
                        <p className="text-text-muted text-xs mt-0.5">
                          {orderItemSubtitle(item)} · {formatMoney(orderItemUnitPrice(item), orderItemCurrency(item))} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <span className="font-semibold text-text-primary text-sm">
                          {formatMoney(orderItemLineTotal(item), orderItemCurrency(item))}
                        </span>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveCartItem(item.id)}
                          loading={busyItemId === item.id}
                          className="!px-2.5"
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-muted">Total Due Now</p>
                      <p className="text-2xl font-bold text-text-primary">{formatMoney(cartTotal)}</p>
                      <p className="text-[10px] text-text-faint mt-0.5">
                        Manual bank transfer slip upload required after placing order. No automated gateway.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCartCheckout}
                    loading={checkingOut}
                    className="w-full justify-center"
                    size="lg"
                  >
                    {checkingOut ? 'Placing Order...' : 'Place Order & Upload Payment Proof'}
                  </Button>
                </div>
              </Card>

              <Card className="border border-white/[0.04] bg-white/[0.01]">
                <p className="text-xs text-text-muted leading-relaxed">
                  <span className="text-text-primary font-medium">Notice:</span> VPS servers are delivered within <strong className="text-amber-300">24 to 72 hours</strong>.
                </p>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Subscription Renewal Modal */}
      <Modal open={!!renewSub} onClose={() => setRenewSub(null)} title="Renew Subscription">
        {renewSub && (
          <form onSubmit={handleRenewalSubmit} className="space-y-4">
            <div className="glass rounded-xl p-4 border border-white/[0.08] space-y-1">
              <p className="text-xs text-text-muted uppercase tracking-wider">Renewing Service</p>
              <p className="text-base font-bold text-text-primary">
                {renewSub.orderItem?.plan?.name ?? renewSub.orderItem?.service?.name}
              </p>
              <p className="text-sm text-accent-violet-light font-semibold">
                Amount Due: {formatMoney(renewSub.orderItem?.plan?.price ?? renewSub.orderItem?.service?.price ?? 0)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted block">
                Upload Renewal Payment Proof (Bank Transfer / Receipt Screenshot)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50"
                required
              />
              <p className="text-[11px] text-text-faint">
                Upload your payment slip or transfer receipt screenshot for swift review.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRenewSub(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submittingRenew}>
                Submit Renewal Proof
              </Button>
            </div>
          </form>
        )}
      </Modal>


    </div>
  );
}

// ── Single Order Card Component ─────────────────────────────────────────────
function OrderCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const latestPayment = order.payments?.[order.payments.length - 1];

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
      toast('Invoice PDF downloaded', 'success');
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

      <PaymentProofModal
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
        order={order}
        onSuccess={() => {
          toast('Payment proof uploaded successfully and submitted for manual review!', 'success');
          onChanged();
        }}
      />

      <Card className="border border-white/[0.06] hover:border-white/10 transition-all">
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

        <div className="space-y-1.5 mb-4 text-sm">
          {order.items?.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-text-muted">
                {orderItemName(item)}
                <span className="ml-1 text-[10px] text-text-faint">× {item.quantity}</span>
              </span>
              <span className="text-text-primary font-medium">{formatMoney(orderItemLineTotal(item), orderItemCurrency(item))}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <span className="text-xs text-text-muted font-medium uppercase tracking-wide">Total</span>
          <span className="font-bold text-text-primary">{formatMoney(order.total, order.items?.[0] ? orderItemCurrency(order.items[0]) : 'LKR')}</span>
        </div>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        {latestPayment && order.status === 'awaiting_payment' && (
          <div className="mt-4 p-3 rounded-xl glass border border-white/[0.06] text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-text-muted font-medium">Payment Review Status:</span>
              <Badge status={latestPayment.status} />
            </div>
            {latestPayment.status === 'manual_review' && (
              <p className="text-orange-300/90 text-[11px] leading-relaxed">
                ⏳ Proof received — currently awaiting manual verification by staff. Services activate upon approval (VPS setups are delivered within 24 to 72 hours).
              </p>
            )}
            {latestPayment.status === 'rejected' && latestPayment.rejectionReason && (
              <p className="text-red-400 text-[11px] leading-relaxed">
                ❌ Proof could not be verified: <span className="text-text-primary font-medium">{latestPayment.rejectionReason}</span>. Please re-upload a clear transfer receipt.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 mt-4">
          {order.status === 'awaiting_payment' && (
            <Button
              onClick={() => setShowProofModal(true)}
              size="sm"
            >
              <UploadIcon />
              {latestPayment?.status === 'manual_review' ? 'Re-upload Payment Proof' : 'Upload Payment Proof'}
            </Button>
          )}

          {order.status === 'paid' && (
            order.total === 0 ? (
              <span className="text-xs font-medium text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Free Order (No Invoice Required)
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
