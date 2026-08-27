'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Product, ProductCategory, PlanBillingType, Plan } from '@/lib/types';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  useToast,
  Modal,
  ConfirmDialog,
  formatMoney,
  Badge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

const CATEGORIES: ProductCategory[] = [
  'smtp_hosting',
  'web_hosting',
  'node_app_hosting',
  'python_app_hosting',
  'discordbot_node',
  'discordbot_python',
  'whatsappbot_hosting',
  'lavalink_hosting',
  'vps',
  'ai_subscription',
  'database_hosting',
  'app_catalog',
];

const BILLING_TYPES: PlanBillingType[] = ['monthly', 'yearly', 'one_time', 'quarterly', 'semiannual'];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Product modal state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState<ProductCategory>('smtp_hosting');
  const [pDescription, setPDescription] = useState('');
  
  // Initial plan fields (in Add Product modal)
  const [initialPlanName, setInitialPlanName] = useState('');
  const [initialPlanPrice, setInitialPlanPrice] = useState('');
  const [initialPlanBilling, setInitialPlanBilling] = useState<PlanBillingType>('monthly');

  // SMTP specific fields
  const [smtpMailboxesCount, setSmtpMailboxesCount] = useState('1');
  const [smtpStorageGb, setSmtpStorageGb] = useState('1');
  const [smtpForwardingRules, setSmtpForwardingRules] = useState('1');
  const [smtpMaxAliases, setSmtpMaxAliases] = useState('2');
  const [smtpDailyQuota, setSmtpDailyQuota] = useState('500');

  // VPS specific fields
  const [vpsCpu, setVpsCpu] = useState('2');
  const [vpsRamGb, setVpsRamGb] = useState('4');
  const [vpsStorageGb, setVpsStorageGb] = useState('50');
  const [vpsBandwidth, setVpsBandwidth] = useState('1TB');
  const [leasewebCost, setLeasewebCost] = useState('');

  const [busy, setBusy] = useState(false);

  // Delete product dialog
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  // Plan modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planProductId, setPlanProductId] = useState<string | null>(null);
  const [planCategory, setPlanCategory] = useState<ProductCategory>('smtp_hosting');
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [plName, setPlName] = useState('');
  const [plPrice, setPlPrice] = useState('');
  const [plBilling, setPlBilling] = useState<PlanBillingType>('monthly');

  function load() {
    setLoading(true);
    api.products
      .list()
      .then((data) => {
        setProducts(data.products);
        if (data.products?.length > 0 && !expandedId) {
          setExpandedId(data.products[0].id);
        }
      })
      .catch((err) => {
        setError(err.message);
        toast('Failed to load products', 'error');
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreateProduct() {
    setActiveProduct(null);
    setPName('');
    setPCategory('smtp_hosting');
    setPDescription('');
    setInitialPlanName('Starter Plan');
    setInitialPlanPrice('1500');
    setInitialPlanBilling('monthly');
    setSmtpStorageGb('5');
    setSmtpMaxAliases('3');
    setSmtpDailyQuota('500');
    setVpsCpu('2');
    setVpsRamGb('4');
    setVpsStorageGb('50');
    setVpsBandwidth('1TB');
    setLeasewebCost('');
    setProductModalOpen(true);
  }

  function openEditProduct(product: Product) {
    setActiveProduct(product);
    setPName(product.name);
    setPCategory(product.category);
    setPDescription(product.description ?? '');
    setProductModalOpen(true);
  }

  function buildSpecsJson(category: ProductCategory) {
    if (category === 'smtp_hosting') {
      const mailboxesCount = parseInt(smtpMailboxesCount, 10) || 1;
      const storageLimitGb = parseInt(smtpStorageGb, 10);
      const storageQuotaMb = storageLimitGb === -1 ? -1 : ((isNaN(storageLimitGb) ? 1 : storageLimitGb) * 1024);
      const forwardingRules = parseInt(smtpForwardingRules, 10);
      const maxAliases = parseInt(smtpMaxAliases, 10);
      const dailyQuota = parseInt(smtpDailyQuota, 10) || 500;
      return {
        mailboxesCount,
        storageLimitGb: isNaN(storageLimitGb) ? 1 : storageLimitGb,
        storageQuotaMb,
        forwardingRules: isNaN(forwardingRules) ? 1 : forwardingRules,
        emailAliases: isNaN(maxAliases) ? 2 : maxAliases,
        maxAliases: isNaN(maxAliases) ? 2 : maxAliases,
        dailyQuota,
        minCommitmentMonths: 3,
        storage: storageLimitGb === -1 ? 'Unlimited Storage' : `${storageLimitGb} GB Storage per Mailbox`,
        aliases: maxAliases === -1 ? 'Unlimited Email Aliases' : `${maxAliases} Custom Domain Aliases`,
        forwarding: forwardingRules === -1 ? 'Unlimited Forwarding Rules' : `${forwardingRules} Forwarding Rules`,
        sendLimit: `${dailyQuota} emails/day`,
        features: [
          `${mailboxesCount === -1 ? 'Unlimited' : mailboxesCount} Mailbox${mailboxesCount !== 1 ? 'es' : ''} Included`,
          storageLimitGb === -1 ? 'Unlimited Storage' : `${storageLimitGb} GB Storage per Mailbox`,
          forwardingRules === -1 ? 'Unlimited Forwarding Rules' : `${forwardingRules} Forwarding Rule${forwardingRules !== 1 ? 's' : ''}`,
          maxAliases === -1 ? 'Unlimited Email Aliases' : `${maxAliases} Email Alias${maxAliases !== 1 ? 'es' : ''}`,
          'Webmail & SMTP/IMAP Access',
        ],
      };
    }

    if (category === 'vps') {
      return {
        cpuCores: parseInt(vpsCpu, 10) || 2,
        ramGb: parseInt(vpsRamGb, 10) || 4,
        storageGb: parseInt(vpsStorageGb, 10) || 50,
        bandwidth: vpsBandwidth || '1TB',
        leasewebCostLkr: leasewebCost ? parseFloat(leasewebCost) : undefined,
        specs: `${vpsCpu} vCPU · ${vpsRamGb}GB RAM · ${vpsStorageGb}GB NVMe · ${vpsBandwidth}`,
      };
    }

    return {
      specs: 'Standard Hosting Package',
    };
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim()) return;
    setBusy(true);
    try {
      if (activeProduct) {
        await api.products.update(activeProduct.id, { name: pName, category: pCategory, description: pDescription || null });
        toast('Product updated', 'success');
      } else {
        const created = await api.products.create({ name: pName, category: pCategory, description: pDescription || undefined });
        
        // Auto-create initial pricing plan with details
        if (initialPlanPrice && parseFloat(initialPlanPrice) >= 0) {
          const priceInCents = Math.round(parseFloat(initialPlanPrice) * 100);
          const specsJson = buildSpecsJson(pCategory);

          await api.products.createPlan(created.product.id, {
            name: initialPlanName.trim() || 'Starter Plan',
            price: priceInCents,
            billingType: initialPlanBilling,
            specsJson,
          }).catch(() => null);
        }
        
        toast('Product & Pricing Plan created successfully', 'success');
      }
      setProductModalOpen(false);
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to save product', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleProductActive(product: Product) {
    try {
      const updated = await api.products.update(product.id, { isActive: !product.isActive });
      toast(`Product "${updated.product.name}" ${updated.product.isActive ? 'activated' : 'deactivated'}`, 'info');
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to update product status', 'error');
    }
  }

  async function handleDeleteProduct() {
    if (!deleteProduct) return;
    try {
      const res: any = await api.products.delete(deleteProduct.id);
      if (res?.deactivated) {
        toast(`Product "${deleteProduct.name}" has existing orders, so it was deactivated instead of deleted.`, 'info');
      } else {
        toast('Product deleted', 'success');
      }
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to delete product', 'error');
    } finally {
      setDeleteProduct(null);
    }
  }

  function openCreatePlan(productId: string, category: ProductCategory) {
    setPlanProductId(productId);
    setPlanCategory(category);
    setActivePlan(null);
    setPlName('');
    setPlPrice('');
    setPlBilling('quarterly');
    setSmtpMailboxesCount('1');
    setSmtpStorageGb('1');
    setSmtpForwardingRules('1');
    setSmtpMaxAliases('2');
    setSmtpDailyQuota('500');
    setVpsCpu('4');
    setVpsRamGb('8');
    setVpsStorageGb('100');
    setVpsBandwidth('2TB');
    setPlanModalOpen(true);
  }

  function openEditPlan(productId: string, category: ProductCategory, plan: Plan) {
    setPlanProductId(productId);
    setPlanCategory(category);
    setActivePlan(plan);
    setPlName(plan.name);
    setPlPrice((plan.price / 100).toString());
    setPlBilling(plan.billingType);
    
    // Fill specific specs if available
    const specs: any = plan.specsJson || {};
    setSmtpMailboxesCount(specs.mailboxesCount !== undefined ? specs.mailboxesCount.toString() : '1');
    setSmtpStorageGb(specs.storageLimitGb !== undefined ? specs.storageLimitGb.toString() : '1');
    setSmtpForwardingRules(specs.forwardingRules !== undefined ? specs.forwardingRules.toString() : '1');
    setSmtpMaxAliases((specs.maxAliases !== undefined ? specs.maxAliases : (specs.emailAliases !== undefined ? specs.emailAliases : '2')).toString());
    setSmtpDailyQuota(specs.dailyQuota ? specs.dailyQuota.toString() : '500');
    if (specs.cpuCores) setVpsCpu(specs.cpuCores.toString());
    if (specs.ramGb) setVpsRamGb(specs.ramGb.toString());
    if (specs.storageGb) setVpsStorageGb(specs.storageGb.toString());
    if (specs.bandwidth) setVpsBandwidth(specs.bandwidth);
    if (specs.leasewebCostLkr) setLeasewebCost(specs.leasewebCostLkr.toString());

    setPlanModalOpen(true);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!plName.trim() || !plPrice || !planProductId) return;

    setBusy(true);
    const priceInCents = Math.round(parseFloat(plPrice) * 100);
    const specsJson = buildSpecsJson(planCategory);

    try {
      if (activePlan) {
        await api.products.updatePlan(activePlan.id, {
          name: plName,
          price: priceInCents,
          billingType: plBilling,
          specsJson,
        });
        toast('Plan updated', 'success');
      } else {
        await api.products.createPlan(planProductId, {
          name: plName,
          price: priceInCents,
          billingType: plBilling,
          specsJson,
        });
        toast('Plan created', 'success');
      }
      setPlanModalOpen(false);
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to save plan', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivatePlan(plan: Plan) {
    try {
      await api.products.deletePlan(plan.id);
      toast('Plan deactivated', 'success');
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to deactivate plan', 'error');
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Products & Pricing Plans"
        description="Manage everything customers can buy — SMTP mail, VPS, web hosting, bots, AI subscriptions, databases — set prices, storage limits, and alias quotas."
        action={
          <Button onClick={openCreateProduct} variant="primary">
            + Add Product & Price
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner label="Loading products and pricing plans..." />}

      {!loading && products?.length === 0 && (
        <EmptyState
          message="No products published yet. Click above to create your first product & price."
          action={{ label: 'Add Product & Price', onClick: openCreateProduct }}
        />
      )}

      <div className="space-y-4">
        {products?.map((product) => {
          const expanded = expandedId === product.id;
          return (
            <Card key={product.id} className={`border transition-all ${product.isActive ? 'border-white/[0.08]' : 'border-amber-500/20 bg-amber-500/[0.02]'}`}>
              <div
                className="flex items-center justify-between cursor-pointer p-1"
                onClick={() => setExpandedId(expanded ? null : product.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-accent-violet/20 text-accent-violet-light shrink-0 font-mono">
                    {product.category.replace(/_/g, ' ')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-white truncate">{product.name}</h3>
                      {!product.isActive && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {product.plans.length} plan{product.plans.length !== 1 ? 's' : ''} available · /{product.slug}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="sm" onClick={() => handleToggleProductActive(product)}>
                    {product.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEditProduct(product)}>Edit Details</Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteProduct(product)}>Delete</Button>
                  <span className="text-text-faint text-xs ml-1 font-mono">
                    <svg className={`w-4 h-4 inline transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-accent-cyan uppercase tracking-wider font-mono">
                      Pricing Plans for {product.name}
                    </p>
                    <Button variant="primary" size="sm" onClick={() => openCreatePlan(product.id, product.category)}>
                      + Add Pricing Plan
                    </Button>
                  </div>

                  {product.plans.length === 0 && (
                    <div className="p-4 border border-dashed border-white/10 rounded-xl text-center">
                      <p className="text-xs text-text-muted">No pricing plans added for this product yet.</p>
                      <button
                        onClick={() => openCreatePlan(product.id, product.category)}
                        className="text-xs text-accent-cyan hover:underline mt-1 block font-semibold mx-auto"
                      >
                        + Add Pricing Plan Now
                      </button>
                    </div>
                  )}

                  <div className="grid gap-3">
                    {product.plans.map((plan) => {
                      const specs: any = plan.specsJson || {};
                      return (
                        <div
                          key={plan.id}
                          className="flex flex-col md:flex-row md:items-center justify-between rounded-2xl border border-white/[0.08] bg-black/40 p-4 gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{plan.name}</h4>
                              {!plan.isActive && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-mono">Inactive</span>}
                            </div>
                            <p className="text-base font-bold font-mono text-accent-cyan">
                              {formatMoney(plan.price)}{' '}
                              <span className="text-xs font-normal font-sans text-text-muted">/ {plan.billingType.replace('_', ' ')}</span>
                            </p>

                            {/* Render Category Specifications */}
                            {product.category === 'smtp_hosting' && (
                              <div className="flex gap-2 flex-wrap pt-1 text-[11px] text-text-muted font-mono">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white">
                                  <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {specs.mailboxesCount === -1 ? '∞' : (specs.mailboxesCount || 1)} Mailbox{(specs.mailboxesCount || 1) !== 1 ? 'es' : ''}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-300">
                                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                  </svg>
                                  {specs.storageLimitGb === -1 ? '∞ Unlimited' : `${specs.storageLimitGb || 1} GB`} Storage
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-purple-300">
                                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  {specs.forwardingRules === -1 ? '∞' : (specs.forwardingRules || 1)} Forwarding Rule{(specs.forwardingRules || 1) !== 1 ? 's' : ''}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-accent-cyan">
                                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  {specs.maxAliases === -1 || specs.emailAliases === -1 ? '∞' : (specs.maxAliases || specs.emailAliases || 2)} Aliases
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-amber-300">
                                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  {specs.dailyQuota || 500} emails/day
                                </span>
                                {(plan.billingType === 'quarterly' || specs.minCommitmentMonths === 3) && (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold">
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    3-Mo Commitment
                                  </span>
                                )}
                              </div>
                            )}

                            {product.category === 'vps' && (
                              <div className="flex gap-2 flex-wrap pt-1 text-[11px] text-text-muted font-mono">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white">
                                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                  </svg>
                                  {specs.cpuCores || 2} vCPU
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-accent-cyan">
                                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                  {specs.ramGb || 4} GB RAM
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-300">
                                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                  </svg>
                                  {specs.storageGb || 50} GB NVMe
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="secondary" size="sm" onClick={() => openEditPlan(product.id, product.category, plan)}>
                              Edit Price & Limits
                            </Button>
                            {plan.isActive && (
                              <Button variant="danger" size="sm" onClick={() => handleDeactivatePlan(plan)}>
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Product Modal */}
      <Modal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={activeProduct ? 'Edit Product Details' : 'Add New Product & Set Price'}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Product Category</label>
            <select
              value={pCategory}
              onChange={(e) => setPCategory(e.target.value as ProductCategory)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-bg text-white capitalize">
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Product Name"
            placeholder="e.g. Enterprise Shared SMTP & Mail Hosting"
            value={pName}
            onChange={(e) => setPName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Description</label>
            <textarea
              value={pDescription}
              onChange={(e) => setPDescription(e.target.value)}
              rows={2}
              placeholder="Overview of this product package for customers..."
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-accent-cyan resize-none"
            />
          </div>

          {!activeProduct && (
            <div className="p-4 bg-black/60 border border-white/10 rounded-2xl space-y-3">
              <p className="text-xs font-bold text-accent-cyan uppercase tracking-wider font-mono">
                💰 Pricing & Resource Quotas
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Plan Name"
                  placeholder="e.g. Starter Mail"
                  value={initialPlanName}
                  onChange={(e) => setInitialPlanName(e.target.value)}
                  required
                />
                <Input
                  label="Price (LKR)"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  value={initialPlanPrice}
                  onChange={(e) => setInitialPlanPrice(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-muted">Billing Cycle</label>
                <select
                  value={initialPlanBilling}
                  onChange={(e) => setInitialPlanBilling(e.target.value as PlanBillingType)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                >
                  {BILLING_TYPES.map((b) => (
                    <option key={b} value={b} className="bg-bg text-white capitalize">
                      {b.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* SMTP Specific Resource Controls */}
              {pCategory === 'smtp_hosting' && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">Storage (GB)</label>
                    <input
                      type="number"
                      value={smtpStorageGb}
                      onChange={(e) => setSmtpStorageGb(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">Max Aliases</label>
                    <input
                      type="number"
                      value={smtpMaxAliases}
                      onChange={(e) => setSmtpMaxAliases(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">Daily Limit</label>
                    <input
                      type="number"
                      value={smtpDailyQuota}
                      onChange={(e) => setSmtpDailyQuota(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              )}

              {/* VPS Specific Controls */}
              {pCategory === 'vps' && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">vCPU Cores</label>
                    <input
                      type="number"
                      value={vpsCpu}
                      onChange={(e) => setVpsCpu(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">RAM (GB)</label>
                    <input
                      type="number"
                      value={vpsRamGb}
                      onChange={(e) => setVpsRamGb(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">Storage (GB)</label>
                    <input
                      type="number"
                      value={vpsStorageGb}
                      onChange={(e) => setVpsStorageGb(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setProductModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={busy}>
              {activeProduct ? 'Update Product' : 'Create Product & Pricing'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Plan Modal */}
      <Modal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={activePlan ? 'Edit Pricing Plan' : 'Add New Pricing Plan'}
      >
        <form onSubmit={handleSavePlan} className="space-y-4">
          <Input
            label="Plan Name"
            placeholder="e.g. Starter Mail, Professional Mail, Enterprise Mail"
            value={plName}
            onChange={(e) => setPlName(e.target.value)}
            required
          />

          <Input
            label="Price (LKR)"
            type="number"
            step="0.01"
            placeholder="e.g. 1500.00"
            value={plPrice}
            onChange={(e) => setPlPrice(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Billing Period</label>
            <select
              value={plBilling}
              onChange={(e) => setPlBilling(e.target.value as PlanBillingType)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
            >
              {BILLING_TYPES.map((b) => (
                <option key={b} value={b} className="bg-bg text-white capitalize">
                  {b.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* SMTP Specific Quota Inputs */}
          {planCategory === 'smtp_hosting' && (
            <div className="p-3 bg-black/60 border border-white/10 rounded-2xl space-y-3">
              <p className="text-xs font-bold text-accent-cyan font-mono flex items-center gap-1.5">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Hosting Package Limits (-1 = Unlimited)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Mailboxes Included</label>
                  <input
                    type="number"
                    value={smtpMailboxesCount}
                    onChange={(e) => setSmtpMailboxesCount(e.target.value)}
                    placeholder="1 or -1"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Storage per Mailbox (GB)</label>
                  <input
                    type="number"
                    value={smtpStorageGb}
                    onChange={(e) => setSmtpStorageGb(e.target.value)}
                    placeholder="1, 5, 20, 50, -1"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Forwarding Rules</label>
                  <input
                    type="number"
                    value={smtpForwardingRules}
                    onChange={(e) => setSmtpForwardingRules(e.target.value)}
                    placeholder="1, 5, 20, 50, -1"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Max Email Aliases</label>
                  <input
                    type="number"
                    value={smtpMaxAliases}
                    onChange={(e) => setSmtpMaxAliases(e.target.value)}
                    placeholder="2, 5, 10, 30, -1"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-text-muted block mb-1">Daily Send Limit (emails/day)</label>
                <input
                  type="number"
                  value={smtpDailyQuota}
                  onChange={(e) => setSmtpDailyQuota(e.target.value)}
                  placeholder="500, 2500, 5000, 10000"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>
          )}

          {/* VPS Specific Resource Inputs */}
          {planCategory === 'vps' && (
            <div className="p-3 bg-black/60 border border-white/10 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-accent-cyan font-mono flex items-center gap-1.5">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                VPS Specs & Leaseweb Margin
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">vCPU Cores</label>
                  <input
                    type="number"
                    value={vpsCpu}
                    onChange={(e) => setVpsCpu(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">RAM (GB)</label>
                  <input
                    type="number"
                    value={vpsRamGb}
                    onChange={(e) => setVpsRamGb(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Storage (GB)</label>
                  <input
                    type="number"
                    value={vpsStorageGb}
                    onChange={(e) => setVpsStorageGb(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-text-muted block mb-1">Leaseweb Cost Price (LKR, for margin tracking)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1000.00"
                  value={leasewebCost}
                  onChange={(e) => setLeasewebCost(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPlanModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={busy}>
              {activePlan ? 'Update Pricing & Specs' : 'Save Pricing Plan'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={handleDeleteProduct}
        title="Delete or Deactivate Product"
        message={`Are you sure you want to delete or deactivate "${deleteProduct?.name}"? If it has existing customer order history, it will be safely deactivated.`}
        confirmLabel="Confirm"
        danger
      />
    </div>
  );
}
