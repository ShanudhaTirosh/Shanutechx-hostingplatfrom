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
} from 'lucide-react';

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
  web_hosting: 'bg-accent-violet/10 text-accent-violet-light border border-accent-violet/20',
  node_app_hosting: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  python_app_hosting: 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  discordbot_node: 'bg-purple-500/10 text-purple-300 border border-purple-500/20',
  discordbot_python: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20',
  whatsappbot_hosting: 'bg-green-500/10 text-green-400 border border-green-500/20',
  lavalink_hosting: 'bg-pink-500/10 text-pink-300 border border-pink-500/20',
  vps: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
  ai_subscription: 'bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20',
  smtp_hosting: 'bg-teal-500/10 text-teal-300 border border-teal-500/20',
  database_hosting: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  app_catalog: 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
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
              <Button variant="secondary" size="sm">Manage Products & Plans</Button>
            </Link>
          )}
        </div>

        {/* Category Filter Pills */}
        {products && products.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === 'all'
                  ? 'bg-accent-violet text-white shadow-glow-violet'
                  : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
              }`}
            >
              All Products ({products.reduce((sum, p) => sum + p.plans.length, 0)})
            </button>
            {categoriesPresent.map((cat) => {
              const count = products.filter((p) => p.category === cat).reduce((sum, p) => sum + p.plans.length, 0);
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filter === cat
                      ? 'bg-accent-violet text-white shadow-glow-violet'
                      : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
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

        {/* Flat Grid of Individual Product Plan Cards */}
        {products && planItems.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planItems.map(({ product, plan }) => {
              const specs: any = plan.specsJson || {};

              return (
                <Card
                  key={plan.id}
                  className="flex flex-col justify-between border border-white/[0.08] hover:border-accent-violet/50 bg-black/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-accent-violet/10 transition-all duration-200 group relative overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* Top Category Badge & Billing Label */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${CATEGORY_COLOR[product.category]}`}>
                        {CATEGORY_LABEL[product.category]}
                      </span>
                      <span className="text-[10px] font-mono text-text-faint uppercase">
                        {BILLING_LABEL[plan.billingType] ?? plan.billingType}
                      </span>
                    </div>

                    {/* Product & Plan Header */}
                    <div>
                      <p className="text-[11px] font-medium text-text-muted truncate mb-0.5">{product.name}</p>
                      <h3 className="font-bold text-white text-lg group-hover:text-accent-cyan transition-colors">
                        {plan.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Price Tag */}
                    <div className="py-2.5 border-y border-white/[0.06] flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-white tracking-tight">
                        {formatMoney(plan.price)}
                      </span>
                      <span className="text-xs text-text-muted font-sans font-normal">
                        /{BILLING_LABEL[plan.billingType] ?? plan.billingType}
                      </span>
                    </div>

                    {/* Specs Section with Clean SVG Icons */}
                    <div className="space-y-2 font-mono text-xs pt-1">
                      {/* SMTP / Mail Hosting Specs */}
                      {product.category === 'smtp_hosting' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-200">
                            <Mail className="h-4 w-4 text-indigo-400 shrink-0" />
                            <span>
                              {specs.mailboxesCount === -1 ? 'Unlimited' : (specs.mailboxesCount || 1)} Mailbox{(specs.mailboxesCount || 1) !== 1 ? 'es' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-emerald-300">
                            <HardDrive className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>
                              {specs.storageLimitGb === -1 ? 'Unlimited Storage' : `${specs.storageLimitGb || 1} GB Storage`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-purple-300">
                            <Zap className="h-4 w-4 text-purple-400 shrink-0" />
                            <span>
                              {specs.forwardingRules === -1 ? 'Unlimited' : (specs.forwardingRules || 1)} Forwarding Rule{(specs.forwardingRules || 1) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-cyan-300">
                            <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
                            <span>
                              {specs.maxAliases === -1 || specs.emailAliases === -1 ? 'Unlimited' : (specs.maxAliases || specs.emailAliases || 2)} Email Aliases
                            </span>
                          </div>
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300 font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                              <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              Minimum 3-Month Commitment Required
                            </span>
                          </div>
                        </div>
                      )}

                      {/* VPS Specs */}
                      {product.category === 'vps' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-cyan-300">
                            <Cpu className="h-4 w-4 text-cyan-400 shrink-0" />
                            <span>{specs.cpuCores || 2} vCPU Cores</span>
                          </div>
                          <div className="flex items-center gap-2 text-purple-300">
                            <Layers className="h-4 w-4 text-purple-400 shrink-0" />
                            <span>{specs.ramGb || 4} GB RAM</span>
                          </div>
                          <div className="flex items-center gap-2 text-emerald-300">
                            <HardDrive className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>{specs.storageGb || 50} GB NVMe Storage</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-300">
                            <Zap className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>{specs.bandwidth || 'Unmetered'} Bandwidth</span>
                          </div>
                        </div>
                      )}

                      {/* Web Hosting Specs */}
                      {product.category === 'web_hosting' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-purple-300">
                            <HardDrive className="h-4 w-4 text-purple-400 shrink-0" />
                            <span>{specs.storageGb || 5} GB NVMe SSD Storage</span>
                          </div>
                          <div className="flex items-center gap-2 text-cyan-300">
                            <Zap className="h-4 w-4 text-cyan-400 shrink-0" />
                            <span>{specs.bandwidthGb ? `${specs.bandwidthGb} GB` : '100 GB'} Bandwidth</span>
                          </div>
                          <div className="flex items-center gap-2 text-amber-300">
                            <Globe className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>
                              {specs.domainsCount === -1 ? 'Unlimited Domains' : `${specs.domainsCount || 1} Custom Domain${(specs.domainsCount || 1) !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          {specs.gitAutoDeploy && (
                            <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              <span>GitHub Auto-Deploy Included</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* App & Bot Hosting Specs */}
                      {['node_app_hosting', 'python_app_hosting', 'discordbot_node', 'discordbot_python', 'whatsappbot_hosting', 'lavalink_hosting'].includes(product.category) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-emerald-300">
                            <Cpu className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>{specs.cpuCores || 1} vCPU Dedicated</span>
                          </div>
                          <div className="flex items-center gap-2 text-purple-300">
                            <Layers className="h-4 w-4 text-purple-400 shrink-0" />
                            <span>{specs.ramMb || specs.memoryMb || 512} MB RAM</span>
                          </div>
                          <div className="flex items-center gap-2 text-cyan-300">
                            <HardDrive className="h-4 w-4 text-cyan-400 shrink-0" />
                            <span>{specs.storageGb || 5} GB NVMe Storage</span>
                          </div>
                          <div className="flex items-center gap-2 text-amber-300">
                            <GitBranch className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>Git Webhook & ZIP Archive Deployment</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-5 mt-5 border-t border-white/[0.06]">
                    <Button
                      onClick={() => handleAddToCart(plan.id, `${product.name} — ${plan.name}`)}
                      loading={addingPlanId === plan.id}
                      size="sm"
                      className="w-full flex items-center justify-center gap-2 font-semibold shadow-lg"
                    >
                      {addingPlanId === plan.id ? (
                        'Adding to Cart...'
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4" /> Add to Cart
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
