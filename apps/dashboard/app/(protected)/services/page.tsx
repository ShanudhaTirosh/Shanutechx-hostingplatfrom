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
import { ProductCard } from '@/components/ProductCard';
import { ProductDetailsModal } from '@/components/ProductDetailsModal';

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
  const [selectedDetailPlan, setSelectedDetailPlan] = useState<{
    product: Product;
    plan: any;
    features: string[];
  } | null>(null);
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
          <div className="flex gap-2.5 flex-wrap mb-8">
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
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
          <div className="my-8 p-4 bg-white/5 border border-white/15 rounded-2xl flex items-center gap-3 text-xs text-white shadow-lg">
            <Clock className="h-4 w-4 text-white shrink-0" />
            <span><strong>Notice:</strong> VPS servers are delivered within <strong>24 to 72 hours</strong>.</span>
          </div>
        )}

        {/* Flat Grid of Individual Product Plan Cards */}
        {products && planItems.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {planItems.map(({ product, plan }) => {
              // Prices in DB are stored in cents (e.g. 450,000 cents = Rs 4,500). Normalize to rupees.
              const displayPrice = plan.price >= 10000 ? Math.round(plan.price / 100) : plan.price;
              const details = getPlanCardDetails(product, plan, displayPrice);

              return (
                <ProductCard
                  key={plan.id}
                  id={plan.id}
                  name={`${product.name} — ${plan.name}`}
                  category={product.category}
                  categoryLabel={CATEGORY_LABEL[product.category]}
                  billingType={BILLING_LABEL[plan.billingType] ?? plan.billingType}
                  price={displayPrice}
                  currency="Rs"
                  tierChips={details.tierChips}
                  features={details.features}
                  logistics={details.logistics}
                  termsNote={details.termsNote}
                  inStock={true}
                  buyLabel="Buy"
                  buyLoading={addingPlanId === plan.id}
                  onDetails={() =>
                    setSelectedDetailPlan({
                      product,
                      plan: { ...plan, price: displayPrice },
                      features: details.features.map((f) => f.text),
                    })
                  }
                  onBuy={() => handleAddToCart(plan.id, `${product.name} — ${plan.name}`)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Product Details Modal */}
      {selectedDetailPlan && (
        <ProductDetailsModal
          isOpen={true}
          onClose={() => setSelectedDetailPlan(null)}
          productName={`${selectedDetailPlan.product.name} — ${selectedDetailPlan.plan.name}`}
          category={CATEGORY_LABEL[selectedDetailPlan.product.category]}
          price={selectedDetailPlan.plan.price}
          currency="Rs"
          specs={selectedDetailPlan.plan.specsJson || {}}
          features={selectedDetailPlan.features}
          buyLabel="Add to Cart"
          onProceedToBuy={() => {
            const planId = selectedDetailPlan.plan.id;
            const planName = `${selectedDetailPlan.product.name} — ${selectedDetailPlan.plan.name}`;
            handleAddToCart(planId, planName);
          }}
        />
      )}
    </div>
  );
}

function getPlanCardDetails(product: Product, plan: any, displayPrice: number) {
  const specs: any = plan.specsJson || {};
  let features: Array<{ iconName?: string; text: string }> = [];
  let tierChips: Array<{ label: string; priceText: string }> = [];
  let logistics: Array<{ icon: 'truck' | 'clock' | 'box' | 'shield'; text: string }> = [
    { icon: 'truck', text: 'Held for you; delivered when you ask' },
    {
      icon: 'clock',
      text:
        product.category === 'vps'
          ? '24 to 72 hours provisioning'
          : 'Instant auto-provisioning upon verification',
    },
    { icon: 'box', text: 'Ask for it within 7 days of buying' },
  ];
  let termsNote = 'Minimum 2 per order';

  // If actual features are provided in DB specsJson, use them!
  if (Array.isArray(specs.features) && specs.features.length > 0) {
    features = specs.features.slice(0, 4).map((featText: string) => {
      const lower = featText.toLowerCase();
      let iconName = 'zap';
      if (lower.includes('cpu') || lower.includes('core')) iconName = 'cpu';
      else if (lower.includes('ram') || lower.includes('nvme') || lower.includes('ssd') || lower.includes('storage')) iconName = 'hard-drive';
      else if (lower.includes('mail') || lower.includes('smtp') || lower.includes('inbox') || lower.includes('mailbox')) iconName = 'mail';
      else if (lower.includes('domain') || lower.includes('bandwidth') || lower.includes('region')) iconName = 'globe';
      else if (lower.includes('ssh') || lower.includes('root') || lower.includes('server')) iconName = 'server';
      else if (lower.includes('ssl') || lower.includes('protect') || lower.includes('shield')) iconName = 'shield';
      else if (lower.includes('database') || lower.includes('sql') || lower.includes('redis')) iconName = 'database';
      else if (lower.includes('bot') || lower.includes('whatsapp') || lower.includes('discord')) iconName = 'bot';
      else if (lower.includes('deploy') || lower.includes('git') || lower.includes('docker')) iconName = 'layers';
      else if (lower.includes('catalog') || lower.includes('stack') || lower.includes('template')) iconName = 'package';

      return { iconName, text: featText };
    });
  }

  if (product.category === 'smtp') {
    if (features.length === 0) {
      features = [
        { iconName: 'server', text: 'WildDuck Enterprise Engine' },
        {
          iconName: 'hard-drive',
          text:
            specs.storageLimitGb === -1
              ? 'Unlimited NVMe Storage'
              : `${specs.storageLimitGb || 1} GB Mailbox Storage`,
        },
        {
          iconName: 'mail',
          text: `${specs.mailboxesCount === -1 ? 'Unlimited' : specs.mailboxesCount || 1} Dedicated Mailbox${
            (specs.mailboxesCount || 1) !== 1 ? 'es' : ''
          }`,
        },
        {
          iconName: 'globe',
          text: `Up to ${specs.maxAliases || specs.emailAliases || 2} Aliases & Custom Routing`,
        },
      ];
    }
    tierChips = [
      { label: 'Quarterly', priceText: `Rs ${displayPrice.toLocaleString()}` },
      { label: 'Monthly Eqv', priceText: `Rs ${Math.round(displayPrice / 3).toLocaleString()}` },
      { label: 'Multi-Domain', priceText: 'Included' },
    ];
    termsNote = 'Minimum 3-Month Commitment Required';
  } else if (product.category === 'vps') {
    if (features.length === 0) {
      features = [
        { iconName: 'cpu', text: `${specs.cpuCores || 2} vCPU Dedicated Cores` },
        { iconName: 'hard-drive', text: `${specs.ramGb || 4} GB RAM & Dedicated KVM` },
        { iconName: 'hard-drive', text: `${specs.storageGb || 50} GB High-Speed NVMe Storage` },
        { iconName: 'globe', text: `${specs.bandwidth || 'Unmetered'} Global Bandwidth` },
      ];
    }
    tierChips = [
      { label: '10+', priceText: `Rs ${Math.round(displayPrice * 0.92).toLocaleString()}` },
      { label: '25+', priceText: `Rs ${Math.round(displayPrice * 0.86).toLocaleString()}` },
      { label: '50+', priceText: `Rs ${Math.round(displayPrice * 0.81).toLocaleString()}` },
    ];
    termsNote = 'Delivered within 24 to 72 hours';
  } else if (product.category === 'web_hosting') {
    if (features.length === 0) {
      features = [
        { iconName: 'hard-drive', text: `${specs.storageGb || 5} GB NVMe SSD Storage` },
        { iconName: 'globe', text: `${specs.bandwidthGb ? `${specs.bandwidthGb} GB` : '100 GB'} Bandwidth` },
        {
          iconName: 'globe',
          text:
            specs.domainsCount === -1
              ? 'Unlimited Domains'
              : `${specs.domainsCount || 1} Custom Domain${(specs.domainsCount || 1) !== 1 ? 's' : ''}`,
        },
        { iconName: 'shield', text: 'Free SSL Certificates & Edge CDN' },
      ];
    }
    tierChips = [
      { label: 'Quarterly', priceText: `Rs ${displayPrice.toLocaleString()}` },
      { label: 'Monthly Eqv', priceText: `Rs ${Math.round(displayPrice / 3).toLocaleString()}` },
      { label: 'Git Deploy', priceText: 'Included' },
    ];
    termsNote = 'Instant deployment on order review';
  } else if (product.category === 'database') {
    if (features.length === 0) {
      features = [
        { iconName: 'database', text: 'PostgreSQL 16, MySQL 8, Redis 7, MongoDB' },
        {
          iconName: 'hard-drive',
          text: `${
            specs.ramMb
              ? specs.ramMb >= 1024
                ? `${specs.ramMb / 1024} GB`
                : `${specs.ramMb} MB`
              : '512 MB'
          } Dedicated RAM`,
        },
        { iconName: 'hard-drive', text: `${specs.storageGb || 5} GB NVMe SSD Storage` },
        { iconName: 'shield', text: 'PgBouncer Connection Pooling & Auto-Backups' },
      ];
    }
    tierChips = [
      { label: 'High Availability', priceText: '99.9%' },
      { label: 'Daily Backups', priceText: 'Cloudflare R2' },
      { label: 'SSL', priceText: 'Enforced' },
    ];
    termsNote = 'Dedicated database container instance';
  } else if (product.category === 'app_deployment') {
    if (features.length === 0) {
      features = [
        { iconName: 'layers', text: 'GitHub Auto-Deploy on Git Push' },
        { iconName: 'cpu', text: `${specs.cpuCores || 0.5} vCPU Cores Dedicated` },
        {
          iconName: 'hard-drive',
          text: `${
            specs.ramMb
              ? specs.ramMb >= 1024
                ? `${specs.ramMb / 1024} GB`
                : `${specs.ramMb} MB`
              : '512 MB'
          } RAM`,
        },
        { iconName: 'globe', text: 'Automatic SSL Routing & Custom Subdomain' },
      ];
    }
    tierChips = [
      { label: 'Continuous Delivery', priceText: 'Active' },
      { label: 'Isolation', priceText: 'Docker' },
      { label: 'SSL', priceText: 'Zero-Config' },
    ];
    termsNote = 'Continuous integration via webhooks';
  } else if (product.category === 'app_catalog') {
    if (features.length === 0) {
      features = [
        { iconName: 'package', text: '15+ One-Click Docker Compose Stacks' },
        { iconName: 'cpu', text: `${specs.cpuCores || 0.5} vCPU Cores Allocation` },
        {
          iconName: 'hard-drive',
          text: `${
            specs.ramMb
              ? specs.ramMb >= 1024
                ? `${specs.ramMb / 1024} GB`
                : `${specs.ramMb} MB`
              : '512 MB'
          } RAM`,
        },
        { iconName: 'globe', text: 'Direct Port Exposure & Cloudflare DNS' },
      ];
    }
    tierChips = [
      { label: '1-Click', priceText: 'Instant' },
      { label: 'Compose', priceText: 'Verified' },
      { label: 'Ports', priceText: 'Exposed' },
    ];
    termsNote = 'Deploy any template in under 60 seconds';
  } else if (product.category === 'bot_hosting') {
    if (features.length === 0) {
      features = [
        { iconName: 'bot', text: '24/7 Process Runner & Auto-Crash Recovery' },
        { iconName: 'cpu', text: `${specs.cpuCores || 0.5} vCPU Dedicated Core` },
        {
          iconName: 'hard-drive',
          text: `${
            specs.ramMb
              ? specs.ramMb >= 1024
                ? `${specs.ramMb / 1024} GB`
                : `${specs.ramMb} MB`
              : '512 MB'
          } RAM`,
        },
        { iconName: 'package', text: 'Persistent Session Storage (WhatsApp / Discord)' },
      ];
    }
    tierChips = [
      { label: 'Uptime', priceText: '24/7' },
      { label: 'Daemon', priceText: 'Node/Python' },
      { label: 'Logs', priceText: 'Realtime' },
    ];
    termsNote = 'WhatsApp Baileys & Discord.js ready';
  } else {
    if (features.length === 0) {
      features = [
        { iconName: 'zap', text: 'High-Performance Cloud Infrastructure' },
        { iconName: 'shield', text: 'Automated Failover & Monitoring' },
        { iconName: 'globe', text: 'Global Network & SSL Security' },
      ];
    }
    tierChips = [
      { label: 'Quarterly', priceText: `Rs ${displayPrice.toLocaleString()}` },
      { label: 'SLA', priceText: '99.9%' },
      { label: 'Cloud', priceText: 'Verified' },
    ];
  }

  return { features, tierChips, logistics, termsNote };
}
