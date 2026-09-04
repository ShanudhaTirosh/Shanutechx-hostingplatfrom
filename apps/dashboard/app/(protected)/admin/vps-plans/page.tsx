'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Product, Plan, ProductCategory, PlanBillingType } from '@/lib/types';
import {
  ServerIcon,
  DatabaseIcon,
  CpuIcon,
  SparklesIcon,
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  TagIcon,
  CloudIcon,
  ActivityIcon,
} from '@/components/Icons';

const CATEGORY_TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Products & Plans' },
  { id: 'vps_hosting', label: 'VPS Hosting' },
  { id: 'managed_database', label: 'Managed Databases' },
  { id: 'app_container', label: 'App Containers' },
  { id: 'email_hosting', label: 'Email & Mailboxes' },
  { id: 'media_livekit', label: 'Media & LiveKit' },
  { id: 'cloud_storage', label: 'Cloud Storage' },
  { id: 'web_hosting', label: 'Web Hosting' },
  { id: 'ai_subscription', label: 'AI Subscriptions' },
  { id: 'custom_service', label: 'Custom Services' },
];

export default function AdminProductsAndPlansPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [targetProductForPlan, setTargetProductForPlan] = useState<Product | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [saving, setSaving] = useState(false);

  // Product Form state
  const [prodCategory, setProdCategory] = useState<ProductCategory>('vps_hosting');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodIconUrl, setProdIconUrl] = useState('');
  const [prodIsPopular, setProdIsPopular] = useState(false);
  const [prodBadge, setProdBadge] = useState('Popular Choice');

  // Plan Form state
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState<number>(4500);
  const [planCurrency, setPlanCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [planBillingType, setPlanBillingType] = useState<PlanBillingType>('monthly');
  const [planIsPopular, setPlanIsPopular] = useState(false);
  const [planBadge, setPlanBadge] = useState('Best Value');

  // Specs Form state
  const [ramGb, setRamGb] = useState<number>(4);
  const [cpuCores, setCpuCores] = useState<number>(2);
  const [storageGb, setStorageGb] = useState<number>(60);
  const [bandwidth, setBandwidth] = useState('30 TB');

  function fetchCatalog() {
    setLoading(true);
    api.products
      .list()
      .then((data) => setProducts(data.products || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Product Modal Handlers
  function openAddProductModal() {
    setEditingProduct(null);
    setProdCategory(activeTab === 'all' ? 'vps_hosting' : (activeTab as ProductCategory));
    setProdName('');
    setProdDesc('');
    setProdIconUrl('');
    setProdIsPopular(false);
    setProdBadge('Popular Choice');
    setShowProductModal(true);
  }

  function openEditProductModal(product: Product) {
    setEditingProduct(product);
    setProdCategory(product.category);
    setProdName(product.name);
    setProdDesc(product.description || '');
    setProdIconUrl(product.iconUrl || '');
    setProdIsPopular(!!product.isPopular);
    setProdBadge(product.badge || '');
    setShowProductModal(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!prodName.trim()) return;

    setSaving(true);
    try {
      if (editingProduct) {
        await api.products.updateProduct(editingProduct.id, {
          category: prodCategory,
          name: prodName.trim(),
          description: prodDesc.trim() || null,
          iconUrl: prodIconUrl.trim() || null,
          isPopular: prodIsPopular,
          badge: prodBadge.trim() || null,
        });
      } else {
        await api.products.createProduct({
          category: prodCategory,
          name: prodName.trim(),
          description: prodDesc.trim() || null,
          iconUrl: prodIconUrl.trim() || null,
          isPopular: prodIsPopular,
          badge: prodBadge.trim() || null,
        });
      }
      setShowProductModal(false);
      setEditingProduct(null);
      fetchCatalog();
    } catch (err: any) {
      alert(`Failed to save product: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Are you sure you want to delete or deactivate this product?')) return;
    try {
      await api.products.deleteProduct(id);
      fetchCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Plan Modal Handlers
  function openAddPlanModal(product: Product) {
    setTargetProductForPlan(product);
    setEditingPlan(null);
    setPlanName('');
    setPlanPrice(4500);
    setPlanCurrency('LKR');
    setPlanBillingType('monthly');
    setPlanIsPopular(false);
    setPlanBadge('Best Value');
    setRamGb(4);
    setCpuCores(2);
    setStorageGb(60);
    setBandwidth('30 TB');
    setShowPlanModal(true);
  }

  function openEditPlanModal(product: Product, plan: Plan) {
    setTargetProductForPlan(product);
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(plan.price);
    setPlanCurrency(plan.currency as 'LKR' | 'USD');
    setPlanBillingType(plan.billingType);
    setPlanIsPopular(!!plan.isPopular);
    setPlanBadge(plan.badge || '');

    const specs = (plan.specsJson as any) || {};
    setRamGb(specs.ramGB || specs.ramGb || 4);
    setCpuCores(specs.cpuCores || 2);
    setStorageGb(specs.storageGB || specs.storageGb || 60);
    setBandwidth(specs.bandwidth || '30 TB');
    setShowPlanModal(true);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!targetProductForPlan || !planName.trim()) return;

    setSaving(true);
    const specsJson = {
      ramGB: Number(ramGb),
      cpuCores: Number(cpuCores),
      storageGB: Number(storageGb),
      bandwidth: bandwidth.trim(),
    };

    try {
      if (editingPlan) {
        await api.products.updatePlan(editingPlan.id, {
          name: planName.trim(),
          price: Number(planPrice),
          currency: planCurrency,
          billingType: planBillingType,
          isPopular: planIsPopular,
          badge: planBadge.trim() || null,
          specsJson,
        });
      } else {
        await api.products.createPlan(targetProductForPlan.id, {
          name: planName.trim(),
          price: Number(planPrice),
          currency: planCurrency,
          billingType: planBillingType,
          isPopular: planIsPopular,
          badge: planBadge.trim() || null,
          specsJson,
        });
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      setTargetProductForPlan(null);
      fetchCatalog();
    } catch (err: any) {
      alert(`Failed to save plan: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Are you sure you want to deactivate this pricing plan?')) return;
    try {
      await api.products.deletePlan(id);
      fetchCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Filtered list
  const filteredProducts = products.filter((prod) => {
    const matchesTab = activeTab === 'all' || prod.category === activeTab || (activeTab === 'vps_hosting' && (prod.category === 'vps' || prod.category === 'vps_hosting'));
    const matchesSearch =
      searchQuery === '' ||
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
              <ShieldCheckIcon className="h-3.5 w-3.5" /> Admin & Dev Management Portal
            </span>
            <span className="text-xs text-text-faint">• Live Database Catalog</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-2.5 flex items-center gap-2">
            Products & Pricing Plans Management
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Standardized product catalog & direct pricing manager for VPS, Databases, App Hosting, Email, Media, and Cloud Services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddProductModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-500/25 flex items-center gap-1.5 transition-all"
          >
            <PlusIcon className="h-4 w-4" /> Add Product Category
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="Search products or plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-text-muted focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Main Catalog View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {error}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-10 text-center space-y-3">
          <ServerIcon className="h-10 w-10 text-text-muted mx-auto" />
          <p className="text-sm font-semibold text-white">No products found in this category.</p>
          <p className="text-xs text-text-muted">Create your first product to configure pricing tiers and feature options.</p>
          <button
            onClick={openAddProductModal}
            className="px-4 py-2 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold hover:bg-purple-600/30 transition-all inline-flex items-center gap-1.5"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Create First Product
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-[#0b0c16] border border-white/10 hover:border-white/20 rounded-2xl p-6 space-y-5 transition-all relative overflow-hidden"
            >
              {/* Product Top Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {product.category}
                    </span>
                    {product.isPopular && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <SparklesIcon className="h-3 w-3" /> {product.badge || 'Popular User Choice'}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      product.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {product.isActive ? 'Active Catalog' : 'Disabled'}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
                    {product.name}
                  </h2>
                  {product.description && (
                    <p className="text-xs text-text-muted max-w-2xl">{product.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAddPlanModal(product)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Add Pricing Tier
                  </button>
                  <button
                    onClick={() => openEditProductModal(product)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-all"
                    title="Edit Product Details"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                    title="Delete Product"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Nested Pricing Plans Cards */}
              {product.plans.length === 0 ? (
                <div className="p-4 bg-white/[0.02] border border-dashed border-white/10 rounded-xl text-center">
                  <p className="text-xs text-text-muted">No pricing plans created for this product yet.</p>
                  <button
                    onClick={() => openAddPlanModal(product)}
                    className="mt-2 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    + Add standard pricing plan
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {product.plans.map((plan) => {
                    const specs = (plan.specsJson as any) || {};
                    return (
                      <div
                        key={plan.id}
                        className={`bg-[#121324] border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all relative ${
                          plan.isPopular ? 'border-purple-500/50 shadow-lg shadow-purple-500/10' : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        {plan.isPopular && (
                          <div className="absolute -top-3 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-[10px] font-bold text-white shadow-md flex items-center gap-1">
                            <SparklesIcon className="h-3 w-3" /> {plan.badge || 'Popular'}
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white">{plan.name}</h3>
                            <span className="text-[10px] text-text-muted uppercase font-semibold">
                              {plan.billingType}
                            </span>
                          </div>

                          {/* Direct Retail Price */}
                          <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl space-y-1">
                            <span className="text-[10px] text-text-muted">Direct Retail Price:</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-extrabold text-white">
                                {plan.currency === 'USD' ? '$' : 'LKR '}
                                {plan.price.toLocaleString()}
                              </span>
                              <span className="text-xs text-text-muted">
                                /{plan.billingType === 'yearly' ? 'yr' : 'mo'}
                              </span>
                            </div>
                          </div>

                          {/* Specs summary */}
                          <div className="space-y-1.5 text-xs text-text-muted font-mono pt-1">
                            {specs.ramGB !== undefined && (
                              <p className="flex justify-between border-b border-white/5 pb-1">
                                <span>RAM:</span> <span className="text-white font-bold">{specs.ramGB} GB</span>
                              </p>
                            )}
                            {specs.cpuCores !== undefined && (
                              <p className="flex justify-between border-b border-white/5 pb-1">
                                <span>CPU:</span> <span className="text-white font-bold">{specs.cpuCores} Cores</span>
                              </p>
                            )}
                            {specs.storageGB !== undefined && (
                              <p className="flex justify-between border-b border-white/5 pb-1">
                                <span>Disk:</span> <span className="text-white font-bold">{specs.storageGB} GB NVMe</span>
                              </p>
                            )}
                            {specs.bandwidth && (
                              <p className="flex justify-between">
                                <span>Bandwidth:</span> <span className="text-white font-bold">{specs.bandwidth}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Plan Actions */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                          <button
                            onClick={() => openEditPlanModal(product, plan)}
                            className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1"
                          >
                            <PencilIcon className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                            title="Deactivate Plan"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TagIcon className="h-5 w-5 text-purple-400" />
              {editingProduct ? 'Edit Product Category' : 'Create Product Category'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Permanent Category</label>
                <select
                  value={prodCategory}
                  onChange={(e: any) => setProdCategory(e.target.value)}
                  className="w-full bg-[#121324] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="vps_hosting">VPS Hosting</option>
                  <option value="managed_database">Managed Databases (Postgres, MySQL, Redis, MongoDB)</option>
                  <option value="app_container">App Containers (Node.js, Python, Docker)</option>
                  <option value="email_hosting">Email & Mailboxes (SMTP & Webmail)</option>
                  <option value="media_livekit">Media & LiveKit Audio/Video Streaming</option>
                  <option value="cloud_storage">Cloud Storage & Backups (R2/S3)</option>
                  <option value="web_hosting">Web Hosting</option>
                  <option value="ai_subscription">AI Subscriptions</option>
                  <option value="custom_service">Custom Managed Service</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Product Title / Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise VPS Node, Production PostgreSQL"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Description</label>
                <textarea
                  placeholder="Summarize product features and specifications..."
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Popular User Badge Toggles */}
              <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <SparklesIcon className="h-4 w-4 text-amber-400" /> Mark as Popular / Recommended Choice
                    </span>
                    <p className="text-[11px] text-text-muted">Shows glowing highlight badge on storefront & catalog cards</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prodIsPopular}
                    onChange={(e) => setProdIsPopular(e.target.checked)}
                    className="h-4 w-4 rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500"
                  />
                </div>

                {prodIsPopular && (
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Custom Badge Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Popular Choice, Recommended, Pro, Enterprise"
                      value={prodBadge}
                      onChange={(e) => setProdBadge(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-600/30 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      {showPlanModal && targetProductForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TagIcon className="h-5 w-5 text-purple-400" />
              {editingPlan ? `Edit Plan for ${targetProductForPlan.name}` : `Add Plan to ${targetProductForPlan.name}`}
            </h3>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Plan Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Starter, Business Pro, NVMe Turbo"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Direct Price *</label>
                  <input
                    type="number"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Currency</label>
                  <select
                    value={planCurrency}
                    onChange={(e: any) => setPlanCurrency(e.target.value)}
                    className="w-full bg-[#121324] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="LKR">LKR (Rs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Billing Cycle</label>
                  <select
                    value={planBillingType}
                    onChange={(e: any) => setPlanBillingType(e.target.value)}
                    className="w-full bg-[#121324] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semiannual">Semi-annual</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
              </div>

              {/* Specs Fields */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">RAM (GB)</label>
                  <input
                    type="number"
                    value={ramGb}
                    onChange={(e) => setRamGb(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">CPU Cores</label>
                  <input
                    type="number"
                    value={cpuCores}
                    onChange={(e) => setCpuCores(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">SSD Storage (GB)</label>
                  <input
                    type="number"
                    value={storageGb}
                    onChange={(e) => setStorageGb(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Bandwidth Limit</label>
                  <input
                    type="text"
                    value={bandwidth}
                    onChange={(e) => setBandwidth(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Popular Plan Badge Toggle */}
              <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <SparklesIcon className="h-4 w-4 text-amber-400" /> Popular / Featured Plan Badge
                    </span>
                    <p className="text-[11px] text-text-muted">Highlight this pricing plan on storefront cards</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={planIsPopular}
                    onChange={(e) => setPlanIsPopular(e.target.checked)}
                    className="h-4 w-4 rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500"
                  />
                </div>

                {planIsPopular && (
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Badge Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Best Value, Recommended"
                      value={planBadge}
                      onChange={(e) => setPlanBadge(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-600/30 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
