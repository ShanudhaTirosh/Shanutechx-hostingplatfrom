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
import {
  Mail,
  HardDrive,
  Cpu,
  Zap,
  Globe,
  Lock,
  Layers,
  ShoppingCart,
  CheckCircle2,
  GitBranch,
  Server,
  Clock,
  ShieldAlert,
  Database,
  Bot,
  Package,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  vps: 'VPS Hosting',
  smtp: 'SMTP & Email',
  web_hosting: 'Web Hosting',
  database: 'Managed Databases',
  app_catalog: 'App Catalog',
  bot_hosting: 'Bot Hosting',
  app_deployment: 'App Deployment',
};

const CATEGORY_COLOR: Record<ProductCategory, string> = {
  vps: 'bg-white/10 text-white border border-white/20',
  smtp: 'bg-white/10 text-white border border-white/20',
  web_hosting: 'bg-white/10 text-white border border-white/20',
  database: 'bg-white/10 text-white border border-white/20',
  app_catalog: 'bg-white/10 text-white border border-white/20',
  bot_hosting: 'bg-white/10 text-white border border-white/20',
  app_deployment: 'bg-white/10 text-white border border-white/20',
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

  // Flatten products and plans into individual card items
  const planItems: Array<{ product: Product; plan: any }> = [];
  if (filtered) {
    for (const prod of filtered) {
      if (prod.plans && prod.plans.length > 0) {
        for (const p of prod.plans) {
          planItems.push({ product: prod, plan: p });
        }
      }
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Services & Hosting Storefront"
        description="Browse everything you can buy — web hosting, app runtimes, discord/whatsapp bots, VPS servers, mail hosting — and manage active instances."
        action={
          <Link href="/orders?tab=cart">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-white/10 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>View Shopping Cart</span>
            </button>
          </Link>
        }
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

      {/* Section 2: Storefront Plan Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Available Products & Hosting Plans
            </h2>
            <p className="text-xs text-text-muted">
              Pick a plan and add it to your cart. Payment is manual bank transfer — our team reviews every
              proof by hand before anything activates.
            </p>
          </div>
          {(apiUser?.role === 'admin' || apiUser?.role === 'dev') && (
            <Link href="/admin/services">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all flex items-center gap-1.5 shadow-md shadow-white/10"
              >
                Manage Products &amp; Plans
              </button>
            </Link>
          )}
        </div>

        {/* Category Filter Pills */}
        {products && products.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-black font-bold shadow-lg shadow-white/15'
                  : 'bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-white/30 font-medium'
              }`}
            >
              All Products ({products.reduce((sum, p) => sum + p.plans.length, 0)})
            </button>
            {categoriesPresent.map((cat) => {
              const count = products.filter((p) => p.category === cat).reduce((sum, p) => sum + p.plans.length, 0);
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                    filter === cat
                      ? 'bg-white text-black font-bold shadow-lg shadow-white/15'
                      : 'bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-white/30 font-medium'
                  }`}
                >
                  {CATEGORY_LABEL[cat]} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Loading Skeletons */}
        {products === null && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="flex flex-col border border-white/[0.06] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-8 w-28" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-9 w-full rounded-xl mt-4" />
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {products && planItems.length === 0 && (
          <EmptyState message="No products or plans available in this category." />
        )}

        {/* VPS Delivery Notice */}
        {(filter === 'vps' || filter === 'all') && (
          <div className="p-3.5 bg-white/10 border border-white/20 rounded-2xl flex items-center gap-2.5 text-xs text-white">
            <Clock className="h-4 w-4 text-white shrink-0" />
            <span><strong>Notice:</strong> VPS servers are delivered within <strong>24 to 72 hours</strong>.</span>
          </div>
        )}

        {/* Flat Grid of Individual Product Plan Cards */}
        {products && planItems.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planItems.map(({ product, plan }) => {
              const specs: any = plan.specsJson || {};

              return (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between rounded-2xl p-6 bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-black border border-white/10 hover:border-white/30 backdrop-blur-2xl shadow-2xl hover:shadow-[0_0_35px_rgba(255,255,255,0.07)] transition-all duration-300 relative group overflow-hidden"
                >
                  {/* Top subtle highlight shimmer line */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                  <div className="space-y-4">
                    {/* Top Category Badge & Billing Label */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full ${CATEGORY_COLOR[product.category]}`}>
                        {CATEGORY_LABEL[product.category]}
                      </span>
                      <span className="text-[10px] font-mono text-white/70 uppercase tracking-wider bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                        {BILLING_LABEL[plan.billingType] ?? plan.billingType}
                      </span>
                    </div>

                    {/* Product & Plan Header */}
                    <div>
                      <p className="text-[11px] font-semibold text-white/60 tracking-wider uppercase truncate mb-1">
                        {product.name}
                      </p>
                      <h3 className="font-extrabold text-white text-xl tracking-tight">
                        {plan.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-white/70 mt-1.5 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Price Tag */}
                    <div className="py-3 my-1 border-y border-white/10 flex items-baseline gap-1.5">
                      <span className="text-3xl font-black font-mono text-white tracking-tight">
                        {formatMoney(plan.price)}
                      </span>
                      <span className="text-xs text-white/70 font-mono">
                        /{BILLING_LABEL[plan.billingType] ?? plan.billingType}
                      </span>
                    </div>

                    {/* Specs Section with Clean SVG Icons & Pure White Text */}
                    <div className="space-y-2.5 font-mono text-xs pt-1">
                      {/* SMTP / Mail Hosting Specs */}
                      {product.category === 'smtp' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Mail className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>
                              {specs.mailboxesCount === -1 ? 'Unlimited' : (specs.mailboxesCount || 1)} Mailbox{(specs.mailboxesCount || 1) !== 1 ? 'es' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <HardDrive className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>
                              {specs.storageLimitGb === -1 ? 'Unlimited Storage' : `${specs.storageLimitGb || 1} GB Storage`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Zap className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>
                              {specs.forwardingRules === -1 ? 'Unlimited' : (specs.forwardingRules || 1)} Forwarding Rule{(specs.forwardingRules || 1) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Globe className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>
                              {specs.maxAliases === -1 || specs.emailAliases === -1 ? 'Unlimited' : (specs.maxAliases || specs.emailAliases || 2)} Email Aliases
                            </span>
                          </div>
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white font-mono bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
                              <Lock className="h-3.5 w-3.5 text-white shrink-0" />
                              Minimum 3-Month Commitment Required
                            </span>
                          </div>
                        </div>
                      )}

                      {/* VPS Specs */}
                      {product.category === 'vps' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Cpu className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.cpuCores || 2} vCPU Cores</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Layers className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.ramGb || 4} GB RAM</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <HardDrive className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.storageGb || 50} GB NVMe Storage</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Zap className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.bandwidth || 'Unmetered'} Bandwidth</span>
                          </div>
                          <div className="pt-2 border-t border-white/10 text-[11px] font-mono">
                            <div className="flex items-center gap-2 text-white bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/20">
                              <Clock className="h-3.5 w-3.5 text-white shrink-0" />
                              <span>Delivered within 24 to 72 hours</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Web Hosting Specs */}
                      {product.category === 'web_hosting' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <HardDrive className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.storageGb || 5} GB NVMe SSD Storage</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Zap className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.bandwidthGb ? `${specs.bandwidthGb} GB` : '100 GB'} Bandwidth</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Globe className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>
                              {specs.domainsCount === -1 ? 'Unlimited Domains' : `${specs.domainsCount || 1} Custom Domain${(specs.domainsCount || 1) !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          {specs.gitAutoDeploy && (
                            <div className="flex items-center gap-2.5 text-white font-semibold">
                              <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              </div>
                              <span>GitHub Auto-Deploy Included</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Managed Databases Specs */}
                      {product.category === 'database' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Database className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>PostgreSQL 16 · MySQL 8 · Redis 7 · MongoDB</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Layers className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.ramMb ? (specs.ramMb >= 1024 ? `${specs.ramMb / 1024} GB` : `${specs.ramMb} MB`) : '512 MB'} Dedicated RAM</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <HardDrive className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.storageGb || 5} GB NVMe SSD Storage</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>PgBouncer Pooling & Daily Auto-Backups</span>
                          </div>
                        </div>
                      )}

                      {/* App Deployment Specs (GitHub & Containers) */}
                      {product.category === 'app_deployment' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <GitBranch className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>GitHub Auto-Deploy on Push & Webhooks</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Cpu className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.cpuCores || 0.5} vCPU Cores Dedicated</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Layers className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.ramMb ? (specs.ramMb >= 1024 ? `${specs.ramMb / 1024} GB` : `${specs.ramMb} MB`) : '512 MB'} RAM</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Globe className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>Automatic SSL Routing & Custom Subdomain</span>
                          </div>
                        </div>
                      )}

                      {/* App Catalog Specs */}
                      {product.category === 'app_catalog' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Package className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>15+ One-Click Docker Compose Stacks</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Cpu className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.cpuCores || 0.5} vCPU Cores</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Layers className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.ramMb ? (specs.ramMb >= 1024 ? `${specs.ramMb / 1024} GB` : `${specs.ramMb} MB`) : '512 MB'} RAM</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Zap className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>Direct Port Exposure & Cloudflare DNS</span>
                          </div>
                        </div>
                      )}

                      {/* Bot Hosting Specs */}
                      {product.category === 'bot_hosting' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Bot className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>24/7 Process Runner & Auto-Crash Recovery</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Cpu className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.cpuCores || 0.5} vCPU Dedicated</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <Layers className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>{specs.ramMb ? (specs.ramMb >= 1024 ? `${specs.ramMb / 1024} GB` : `${specs.ramMb} MB`) : '512 MB'} RAM</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-white">
                            <div className="h-6 w-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                              <HardDrive className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span>Persistent Session Storage (WhatsApp / Discord)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-5 mt-6 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(plan.id, `${product.name} — ${plan.name}`)}
                      disabled={addingPlanId === plan.id}
                      className="w-full py-3.5 px-4 rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-[0.98] font-bold text-xs uppercase tracking-wider font-mono transition-all duration-200 flex items-center justify-center gap-2 shadow-xl shadow-white/10 hover:shadow-white/20 cursor-pointer disabled:opacity-50"
                    >
                      {addingPlanId === plan.id ? (
                        <>
                          <span className="h-3.5 w-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          Adding to Cart...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4 text-black" />
                          Add to Cart
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
