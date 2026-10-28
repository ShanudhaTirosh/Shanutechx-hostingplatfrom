'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GradientMeshOrb from '@/components/GradientMeshOrb';
import {
  Search,
  Filter,
  ArrowUpDown,
  Check,
  Server,
  Zap,
  Bot,
  Database,
  Globe,
  Package,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

interface Plan {
  id: string;
  name: string;
  price: number; // in cents or smallest currency unit
  billingType: string;
  isPopular?: boolean;
  badge?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  description: string | null;
  plans: Plan[];
  isPopular?: boolean;
  badge?: string;
}

const BILLING_LABEL: Record<string, string> = {
  one_time: 'one-time',
  monthly: '/month',
  quarterly: '/3 months',
  semiannual: '/6 months',
  yearly: '/year',
};

function formatPrice(cents: number) {
  const amount = Math.floor(cents / 100);
  return `LKR ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const CATEGORY_KEYS = [
  { id: 'all', label: 'All Cloud Services', icon: Package },
  { id: 'vps', label: 'VPS Hosting', icon: Server },
  { id: 'smtp', label: 'SMTP & Email', icon: Zap },
  { id: 'web_hosting', label: 'Web Hosting', icon: Globe },
  { id: 'database', label: 'Managed Databases', icon: Database },
  { id: 'app_catalog', label: 'App Catalog', icon: Package },
  { id: 'bot_hosting', label: 'Bot Hosting', icon: Bot },
  { id: 'app_deployment', label: 'App Deployment', icon: Globe },
];

export default function PricingPage() {
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<'default' | 'price-low' | 'price-high' | 'name'>('default');

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBase}/api/products`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (Array.isArray(data.products)) {
          // Filter out any third-party or proxy products from hosting catalog
          const valid = data.products.filter(
            (p: Product) =>
              p.category !== 'vpn' &&
              p.category !== 'digital' &&
              !p.name.toLowerCase().includes('v2ray')
          );
          setProducts(valid);
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        console.error('[PricingPage] Failed to fetch products from DB:', err);
        setProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiBase]);

  // Compute minimum plan price for sorting
  const getMinPrice = (p: Product) => {
    if (!p.plans || p.plans.length === 0) return 999999999;
    return Math.min(...p.plans.map((plan) => plan.price));
  };

  // Filtered & Sorted Products list
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products
      .filter((product) => {
        // Search filter
        const matchesQuery =
          searchQuery === '' ||
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (product.plans || []).some((plan) => plan.name.toLowerCase().includes(searchQuery.toLowerCase()));

        // Category filter
        const cat = product.category ? product.category.toLowerCase() : '';
        const matchesCategory =
          selectedCategory === 'all' ||
          cat === selectedCategory ||
          (selectedCategory === 'vps' && cat.includes('vps')) ||
          (selectedCategory === 'smtp' && (cat.includes('smtp') || cat.includes('mail') || cat.includes('email'))) ||
          (selectedCategory === 'web_hosting' && (cat.includes('web') || product.name.toLowerCase().includes('web'))) ||
          (selectedCategory === 'database' && (cat.includes('db') || cat.includes('database'))) ||
          (selectedCategory === 'app_catalog' && (cat.includes('catalog') || product.name.toLowerCase().includes('catalog'))) ||
          (selectedCategory === 'bot_hosting' && (cat.includes('bot') || product.name.toLowerCase().includes('bot'))) ||
          (selectedCategory === 'app_deployment' && (cat.includes('deployment') || product.name.toLowerCase().includes('deployment')));

        return matchesQuery && matchesCategory;
      })
      .sort((a, b) => {
        if (sortOption === 'price-low') {
          return getMinPrice(a) - getMinPrice(b);
        }
        if (sortOption === 'price-high') {
          return getMinPrice(b) - getMinPrice(a);
        }
        if (sortOption === 'name') {
          return a.name.localeCompare(b.name);
        }
        return 0; // Default order
      });
  }, [products, searchQuery, selectedCategory, sortOption]);

  return (
    <main className="min-h-screen bg-transparent text-white flex flex-col justify-between selection:bg-purple-500 selection:text-white font-sans relative overflow-hidden">
      <Navbar />

      <div className="flex-1 pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full relative z-10">
        {/* Header Hero Section */}
        <div className="relative text-center space-y-6 pt-4 mb-12">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.7} glowColor="rgba(124, 58, 237, 0.6)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <Sparkles className="h-4 w-4 text-purple-400" />
              TRANSPARENT CLOUD PRICING
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
              Products &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">Specifications</span>
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Explore hardware specifications, container runtimes, and pricing plans. Filter by product type or search for specific parameters.
            </p>
          </div>
        </div>

        {/* Official Digital Goods & V2Ray Proxies Store Notice Banner */}
        <div className="bg-gradient-to-r from-purple-950/70 via-[#0d0f2b] to-indigo-950/70 border border-purple-500/30 rounded-3xl p-6 sm:p-7 mb-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-purple-600/10 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              <ShoppingBag className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold uppercase mb-1">
                Notice to Customers
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Looking for Digital Goods, AI Accounts &amp; V2Ray Proxies?
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-xl leading-relaxed">
                Netflix 4K, Spotify, CapCut Pro, ChatGPT Plus, Claude, and high-speed V2Ray / VMess / Trojan proxies are sold exclusively on our dedicated store at <span className="text-purple-300 font-bold font-mono">store.shanutechx.com</span>.
              </p>
            </div>
          </div>
          <a
            href="https://store.shanutechx.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono transition-all shrink-0 flex items-center gap-2 shadow-glow-violet cursor-pointer"
          >
            <span>Visit STX Store Portal</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Search, Filter & Sorting Bar Controls */}
        <div className="bg-[#08091c]/90 border border-white/10 rounded-3xl p-6 mb-12 space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input Box */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products or plans..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sort Selector Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <ArrowUpDown className="h-4 w-4 text-purple-400 shrink-0" />
              <span className="text-xs font-mono text-slate-400 shrink-0">Sort By:</span>
              <select
                value={sortOption}
                onChange={(e: any) => setSortOption(e.target.value)}
                className="bg-[#0c0e29] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono transition-colors"
              >
                <option value="default">Default Order</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Product Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center gap-3">
            <span className="text-xs font-mono text-white/70 flex items-center gap-1.5 shrink-0">
              <Filter className="h-3.5 w-3.5 text-white" /> Filter:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORY_KEYS.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 border cursor-pointer ${
                      active
                        ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                        : 'bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#08091c]/90 border border-purple-500/20 rounded-3xl p-7 space-y-6 animate-pulse">
                <div className="h-4 w-28 bg-white/10 rounded" />
                <div className="h-6 w-48 bg-white/10 rounded" />
                <div className="h-16 w-full bg-white/5 rounded-xl" />
                <div className="h-10 w-full bg-white/10 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-[#08091c] border border-purple-500/20 rounded-3xl p-12 text-center space-y-3">
            <Package className="h-10 w-10 text-purple-400 mx-auto" />
            <p className="text-sm font-bold text-white">No products match your search or filter criteria</p>
            <p className="text-xs text-slate-400">Try clearing the search query or changing category filter.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSortOption('default');
              }}
              className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold hover:bg-purple-600/30 transition-all mt-2"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredProducts.map((product) => {
              const minPrice = getMinPrice(product);
              return (
                <div
                  key={product.id}
                  className="bg-gradient-to-b from-[#0e1030]/90 via-[#0a0c27]/95 to-[#060719] border border-purple-500/20 hover:border-purple-500/50 rounded-3xl p-7 space-y-6 flex flex-col justify-between transition-all duration-300 shadow-2xl hover:shadow-[0_0_35px_rgba(168,85,247,0.2)] backdrop-blur-md relative overflow-hidden group"
                >
                  <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />
                  {product.isPopular && (
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-glow-violet flex items-center gap-1 font-mono border border-purple-400/40">
                      <Sparkles className="h-3.5 w-3.5 text-purple-200" /> {product.badge || 'Popular'}
                    </div>
                  )}

                  {/* Top Header */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between border-b border-purple-500/20 pb-4 gap-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-md">
                          {product.category || 'Platform Service'}
                        </span>
                        <h3 className="font-extrabold text-xl text-white pt-2.5">{product.name}</h3>
                      </div>
                      {product.plans && product.plans.length > 0 && minPrice < 999999999 && (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono text-purple-300/70 block uppercase">Starting from</span>
                          <span className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-indigo-200 to-teal-200 font-mono">
                            {formatPrice(minPrice)}
                          </span>
                        </div>
                      )}
                    </div>

                    {product.description && (
                      <p className="text-xs text-slate-300 leading-relaxed">{product.description}</p>
                    )}

                    {/* Plans List */}
                    {product.plans && product.plans.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        <h4 className="text-[11px] font-mono font-bold text-purple-300/80 uppercase tracking-wider">
                          Available Plans &amp; Cycles
                        </h4>
                        <div className="space-y-2">
                          {product.plans.map((plan) => (
                            <div
                              key={plan.id}
                              className="flex justify-between items-center text-xs rounded-xl px-3.5 py-2.5 border border-purple-500/20 bg-white/[0.03] hover:border-purple-500/50 hover:bg-purple-950/30 transition-all"
                            >
                              <div className="flex items-center gap-2 font-medium text-white">
                                <Check className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                <span>{plan.name}</span>
                                {plan.isPopular && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                                    {plan.badge || 'Popular'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right font-mono">
                                  <span className="text-white font-extrabold">{formatPrice(plan.price)}</span>
                                  <span className="text-[10px] text-slate-400 ml-1">
                                    {BILLING_LABEL[plan.billingType] ?? plan.billingType}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    addItem({
                                      id: plan.id,
                                      name: `${product.name} — ${plan.name}`,
                                      category: product.category,
                                      price: plan.price,
                                      currency: 'LKR',
                                      billingType: plan.billingType || 'monthly',
                                    })
                                  }
                                  className="p-1.5 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-200 hover:bg-purple-600 hover:text-white transition-all cursor-pointer shadow-sm"
                                  title="Add plan to cart"
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Button CTA */}
                  <div className="pt-4 border-t border-purple-500/20 flex gap-2">
                    {product.plans && product.plans.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const primaryPlan = product.plans.find((p) => p.isPopular) || product.plans[0];
                          addItem({
                            id: primaryPlan.id,
                            name: `${product.name} — ${primaryPlan.name}`,
                            category: product.category,
                            price: primaryPlan.price,
                            currency: 'LKR',
                            billingType: primaryPlan.billingType || 'monthly',
                          });
                        }}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] font-bold text-xs uppercase tracking-wider font-mono text-white transition-all flex items-center justify-center gap-2 shadow-glow-violet cursor-pointer"
                      >
                        <ShoppingCart className="h-4 w-4 text-white" /> Add to Cart — {product.name}
                      </button>
                    ) : (
                      <a
                        href={`${dashboardUrl}/catalog`}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] font-bold text-xs uppercase tracking-wider font-mono text-white transition-all flex items-center justify-center gap-2 shadow-glow-violet"
                      >
                        Order {product.name} <ArrowRight className="h-4 w-4 text-white" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQs Section */}
        <div className="mt-20 border-t border-white/10 pt-16">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-2xl font-extrabold text-white">Need Custom Server Specs?</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Require custom RAM/CPU core allocations, dedicated physical host nodes, or high-throughput private networking? Our team builds custom infrastructure setups.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 font-bold text-xs text-white shadow-glow-violet hover:from-purple-500 hover:to-indigo-500 transition-all"
            >
              Contact Sales &amp; Custom Solutions <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
