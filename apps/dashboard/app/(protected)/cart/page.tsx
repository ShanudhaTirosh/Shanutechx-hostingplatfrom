'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Order, OrderItem } from '@/lib/types';
import { orderItemName, orderItemUnitPrice, orderItemLineTotal, orderItemSubtitle } from '@/lib/orderItem';
import { AiSubscriptionPopup } from '@/components/AiSubscriptionPopup';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  formatMoney,
  useToast,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

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

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}

export default function CartPage() {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const { toast } = useToast();

  function load() {
    api.cart
      .get()
      .then((data) => {
        setOrder(data.order);
        setItems(data.items);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleRemove(itemId: string) {
    setBusyItemId(itemId);
    try {
      await api.cart.removeItem(itemId);
      load();
      toast('Item removed from cart', 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyItemId(null);
    }
  }

  const [aiSubItems, setAiSubItems] = useState<Array<{ id: string; planName: string }>>([]);

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const result = await api.cart.checkout(idempotencyKeyRef.current);
      if (result.aiSubscriptionItems?.length) {
        setAiSubItems(result.aiSubscriptionItems);
        toast('Order placed! A few items need a quick support ticket to activate.', 'info');
        return; // popup takes over from here — customer opens ticket(s), then continues to Orders
      }
      toast('Order placed! Upload your payment proof.', 'success');
      router.push('/orders');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCheckingOut(false);
    }
  }

  const total = items?.reduce((sum, item) => sum + orderItemLineTotal(item), 0) ?? 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <PageHeader
        title="Your Cart"
        description="Review your selected services before placing your order."
      />

      {error && <ErrorBanner message={error} />}
      {items === null && <Spinner />}
      {items?.length === 0 && (
        <EmptyState message="Your cart is empty — browse the service catalog to add something." />
      )}

      {items && items.length > 0 && (
        <>
          <Card className="border border-white/[0.06]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.06]">
              <div className="h-8 w-8 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center">
                <CartIcon />
              </div>
              <p className="font-semibold text-text-primary text-sm">
                {items.length} item{items.length !== 1 ? 's' : ''} in your cart
              </p>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-none"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary text-sm">{orderItemName(item)}</p>
                    <p className="text-text-muted text-xs mt-0.5">
                      {orderItemSubtitle(item)} · {formatMoney(orderItemUnitPrice(item))} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="font-semibold text-text-primary text-sm">
                      {formatMoney(orderItemLineTotal(item))}
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemove(item.id)}
                      loading={busyItemId === item.id}
                      className="!px-2.5"
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total + checkout */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-muted">Order total</p>
                  <p className="text-2xl font-bold text-text-primary">{formatMoney(total)}</p>
                  <p className="text-[10px] text-text-faint mt-0.5">
                    Payment via bank transfer — upload proof on the Orders page after checkout.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCheckout}
                loading={checkingOut}
                className="w-full justify-center"
                size="lg"
              >
                {checkingOut ? 'Placing order...' : 'Place Order'}
              </Button>
            </div>
          </Card>

          {/* Info card */}
          <Card className="border border-white/[0.04] bg-white/[0.01]">
            <p className="text-xs text-text-muted leading-relaxed">
              <span className="text-text-primary font-medium">How payment works:</span>{' '}
              After placing your order, you'll need to make a bank transfer and upload a screenshot as proof.
              Our team verifies it (usually within a few hours) and activates your service automatically once confirmed.
            </p>
          </Card>
        </>
      )}

      {aiSubItems.length > 0 && (
        <AiSubscriptionPopup
          items={aiSubItems}
          onDone={() => {
            setAiSubItems([]);
            router.push('/orders');
          }}
        />
      )}
    </div>
  );
}
