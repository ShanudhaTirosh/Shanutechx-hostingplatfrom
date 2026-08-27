'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Product, ProductCategory } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import {
  Card,
  Button,
  Spinner,
  Skeleton,
  EmptyState,
  ErrorBanner,
  PageHeader,
  formatMoney,
  useToast,
  Badge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  web_hosting: 'Web Hosting',
  node_app_hosting: 'Node.js App Hosting',
  python_app_hosting: 'Python App Hosting',
  discordbot_node: 'Discord Bot (Node.js)',
  discordbot_python: 'Discord Bot (Python)',
  whatsappbot_hosting: 'WhatsApp Bot Hosting',
  lavalink_hosting: 'Lavalink Hosting',
  vps: 'VPS',
  ai_subscription: 'AI Subscriptions',
  smtp_hosting: 'SMTP / Mail Hosting',
  database_hosting: 'Databases',
  app_catalog: 'App Catalog',
};

const CATEGORY_COLOR: Record<ProductCategory, string> = {
  web_hosting: 'bg-accent-violet/10 text-accent-violet-light',
  node_app_hosting: 'bg-emerald-500/10 text-emerald-400',
  python_app_hosting: 'bg-blue-500/10 text-blue-300',
  discordbot_node: 'bg-purple-500/10 text-purple-300',
  discordbot_python: 'bg-indigo-500/10 text-indigo-300',
  whatsappbot_hosting: 'bg-green-500/10 text-green-400',
  lavalink_hosting: 'bg-pink-500/10 text-pink-300',
  vps: 'bg-orange-500/10 text-orange-300',
  ai_subscription: 'bg-fuchsia-500/10 text-fuchsia-300',
  smtp_hosting: 'bg-teal-500/10 text-teal-300',
  database_hosting: 'bg-sky-500/10 text-sky-400',
  app_catalog: 'bg-rose-500/10 text-rose-300',
};

const BILLING_LABEL: Record<string, string> = {
  one_time: 'one-time',
  monthly: 'per month',
  quarterly: 'per 3 months',
  semiannual: 'per 6 months',
  yearly: 'per year',
};

export default function ServicesPage() {
  const { apiUser } = useAppUser();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[] | null>(null);
  const [deployments, setDeployments] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingPlanId, setAddingPlanId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductCategory | 'all'>('all');
  const { toast } = useToast();

  function load() {
    api.products
      .list()
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err.message));

    api.subscriptions
      .list()
      .then((data) => setSubscriptions(data.subscriptions))
      .catch(() => setSubscriptions([]));

    api.deployments
      .list()
      .then((data) => setDeployments(data.deployments))
      .catch(() => setDeployments([]));
  }

  useEffect(load, []);

  async function handleAddToCart(planId: string, planName: string) {
    setAddingPlanId(planId);
    try {
      await api.cart.addItem({ planId }, 1);
      toast(`Added ${planName} to cart`, 'success');
    } catch (err: any) {
      let errorData: any = {};
      try {
        errorData = JSON.parse(err.message);
      } catch {
        errorData = { error: err.message };
      }

      if (errorData.canClearCart) {
        const { attemptedCurrency, suggestion } = errorData;
        const shouldClear = window.confirm(
          `Currency Conflict\n\n${suggestion}\n\nWould you like to clear your cart and add this ${attemptedCurrency} item?`
        );
        if (shouldClear) {
          try {
            await api.cart.clearCart();
            await api.cart.addItem({ planId }, 1);
            toast('Cart cleared and item added successfully', 'success');
          } catch (clearErr: any) {
            toast(clearErr.message || 'Failed to clear cart', 'error');
          }
        }
      } else {
        toast(errorData.error || err.message || 'Failed to add to cart', 'error');
      }
    } finally {
      setAddingPlanId(null);
    }
  }

  const activeSubscriptions = subscriptions?.filter((s) => s.status === 'active') ?? [];
  const categoriesPresent = Array.from(new Set(products?.map((p) => p.category) ?? [])) as ProductCategory[];
  const filtered = filter === 'all' ? products : products?.filter((p) => p.category === filter);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Services & Hosting"
        description="Browse everything you can buy — hosting, bots, VPS, AI subscriptions, databases, mail — and manage what's already active."
      />

      {error && <ErrorBanner message={error} />}

      {/* Section 1: My Purchased & Active Services */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          My Purchased & Active Services ({activeSubscriptions.length + (deployments?.length ?? 0)})
        </h2>

        {subscriptions === null && deployments === null ? (
          <Spinner label="Loading your active services..." />
        ) : activeSubscriptions.length === 0 && (deployments?.length ?? 0) === 0 ? (
          <Card className="border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm font-medium text-text-primary mb-1">No Active Purchased Services Found</p>
            <p className="text-xs text-text-muted mb-4 max-w-md mx-auto">
              Anything you buy below will appear here once your payment proof is reviewed and approved.
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/catalog">
                <Button variant="secondary" size="sm">Browse App Catalog</Button>
              </Link>
              <Link href="/vps-plans">
                <Button size="sm">Browse VPS Plans</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSubscriptions.map((sub) => {
              const name = sub.orderItem?.plan?.name ?? sub.orderItem?.service?.name;
              if (!name) return null;
              return (
                <Card key={sub.id} className="border border-white/[0.08] bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-accent-violet/10 text-accent-violet-light">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <Badge status="running" />
                  </div>
                  <h3 className="font-semibold text-text-primary text-sm mb-1">{name}</h3>
                  <p className="text-xs text-text-muted mb-3">
                    Renews: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-xs font-mono text-text-faint">ID: {sub.id.slice(0, 8)}</span>
                    <Link href="/orders"><Button size="sm" variant="secondary">Manage</Button></Link>
                  </div>
                </Card>
              );
            })}

            {deployments?.map((dep) => (
              <Card key={dep.id} className="border border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <Badge status={dep.status} />
                </div>
                <h3 className="font-semibold text-text-primary text-sm mb-1">
                  {dep.subdomain ? `${dep.subdomain}.shanutechx.com` : 'Container Deployment'}
                </h3>
                <p className="text-xs text-text-muted mb-3">Port: {dep.internalPort}</p>
                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-xs font-mono text-text-faint">{dep.id.slice(0, 8)}</span>
                  <Link href={`/deployments/${dep.id}`}>
                    <Button size="sm" variant="secondary">Manage App</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Storefront */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Available Products
            </h2>
            <p className="text-xs text-text-muted">
              Pick a plan and add it to your cart. Payment is manual bank transfer — our team reviews every
              proof by hand before anything activates.
            </p>
          </div>
          {(apiUser?.role === 'admin' || apiUser?.role === 'dev') && (
            <Link href="/admin/services">
              <Button variant="secondary" size="sm">Manage Products & Plans</Button>
            </Link>
          )}
        </div>

        {products === null && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="flex flex-col border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-5 w-32 mb-4" />
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {products && products.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === 'all'
                  ? 'bg-accent-violet text-white shadow-glow-violet'
                  : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
              }`}
            >
              All Products
            </button>
            {categoriesPresent.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === cat
                    ? 'bg-accent-violet text-white shadow-glow-violet'
                    : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
                }`}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
        )}

        {products && products.length === 0 && (
          <EmptyState message="No products are published yet. Check back soon." />
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((product) => (
            <Card
              key={product.id}
              className="flex flex-col border border-white/[0.06] hover:border-white/10 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${CATEGORY_COLOR[product.category]}`}>
                  {CATEGORY_LABEL[product.category]}
                </span>
              </div>

              <h3 className="font-semibold text-text-primary mb-1 group-hover:text-white transition-colors">
                {product.name}
              </h3>
              {product.description && (
                <p className="text-xs text-text-muted mb-3 line-clamp-2">{product.description}</p>
              )}

              <div className="mt-auto pt-3 border-t border-white/[0.04] space-y-2">
                {product.plans.length === 0 && (
                  <p className="text-xs text-text-faint italic">No active plans yet.</p>
                )}
                {product.plans.map((plan) => {
                  const specs: any = plan.specsJson || {};
                  return (
                    <div key={plan.id} className="p-3 bg-white/[0.02] border border-white/10 rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-text-primary truncate">{plan.name}</p>
                        <p className="text-xs font-mono font-bold text-accent-cyan">
                          {formatMoney(plan.price)} <span className="text-[10px] text-text-muted font-sans font-normal">/{BILLING_LABEL[plan.billingType] ?? plan.billingType}</span>
                        </p>
                        
                        {/* SMTP Specs */}
                        {product.category === 'smtp_hosting' && (
                          <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                              <span className="inline-flex items-center gap-1 text-slate-200">
                                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {specs.mailboxesCount === -1 ? '∞' : (specs.mailboxesCount || 1)} Mailbox{(specs.mailboxesCount || 1) !== 1 ? 'es' : ''}
                              </span>
                              <span className="text-white/20">•</span>
                              <span className="inline-flex items-center gap-1 text-emerald-300">
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                                {specs.storageLimitGb === -1 ? '∞ Unlimited' : `${specs.storageLimitGb || 1}GB`} Storage
                              </span>
                              <span className="text-white/20">•</span>
                              <span className="inline-flex items-center gap-1 text-purple-300">
                                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                {specs.forwardingRules === -1 ? '∞' : (specs.forwardingRules || 1)} Forwarding
                              </span>
                              <span className="text-white/20">•</span>
                              <span className="inline-flex items-center gap-1 text-accent-cyan">
                                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                {specs.maxAliases === -1 || specs.emailAliases === -1 ? '∞' : (specs.maxAliases || specs.emailAliases || 2)} Aliases
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Minimum 3-Month Commitment Required
                            </span>
                          </div>
                        )}

                        {/* VPS Specs */}
                        {product.category === 'vps' && (
                          <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-sky-400 pt-1">
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                              </svg>
                              {specs.cpuCores || 2} vCPU
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              {specs.ramGb || 4}GB RAM
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                              </svg>
                              {specs.storageGb || 50}GB NVMe
                            </span>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => handleAddToCart(plan.id, `${product.name} — ${plan.name}`)}
                        loading={addingPlanId === plan.id}
                        size="sm"
                        className="shrink-0"
                      >
                        {addingPlanId === plan.id ? 'Adding...' : 'Add to Cart'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
