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
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

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
  { id: 'all', label: 'All Products', icon: Package },
  { id: 'vps', label: 'Cloud VPS', icon: Server },
  { id: 'web', label: 'Web Apps', icon: Globe },
  { id: 'bot', label: '24/7 Bots', icon: Bot },
  { id: 'database', label: 'Databases', icon: Database },
  { id: 'digital', label: 'Digital Goods & Store', icon: ShoppingBag },
  { id: 'vpn', label: 'V2Ray Proxies', icon: ShieldCheck },
];

// Fallback catalog if DB has no products listed yet
const STATIC_CATALOG: Product[] = [
  {
    id: 'p-vps-starter',
    name: 'Cloud VPS - Starter NVMe Node',
    category: 'vps',
    description: '1 vCPU, 2GB RAM, 30GB NVMe SSD storage, 1TB Bandwidth, Root SSH & Dedicated IPv4',
    plans: [
      { id: 'plan-vps-1', name: 'Starter 30-Day', price: 250000, billingType: 'monthly' },
      { id: 'plan-vps-2', name: 'Starter Yearly (2 Months Free)', price: 2500000, billingType: 'yearly' },
    ],
  },
  {
    id: 'p-vps-pro',
    name: 'Cloud VPS - Performance NVMe Node',
    category: 'vps',
    description: '4 vCPU, 8GB RAM, 100GB NVMe SSD storage, 4TB Bandwidth, Root SSH & Anycast IP',
    plans: [
      { id: 'plan-vps-p1', name: 'Pro 30-Day', price: 650000, billingType: 'monthly' },
      { id: 'plan-vps-p2', name: 'Pro Yearly', price: 6500000, billingType: 'yearly' },
    ],
  },
  {
    id: 'p-app-node',
    name: 'Node.js & Python Web App Hosting',
    category: 'web',
    description: 'Automated GitHub webhooks, isolated Docker container execution, custom SSL domain & environment vault',
    plans: [
      { id: 'plan-app-1', name: 'Developer Plan', price: 120000, billingType: 'monthly' },
      { id: 'plan-app-2', name: 'Production Scale Plan', price: 350000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-bot-daemon',
    name: '24/7 Discord & WhatsApp Bot Daemon',
    category: 'bot',
    description: 'Continuous bot process supervisor (PM2), auto-restart on API disconnect, QR code session persistence',
    plans: [
      { id: 'plan-bot-1', name: 'Standard Bot Host', price: 99000, billingType: 'monthly' },
      { id: 'plan-bot-2', name: 'High-Mem Multi-Bot Host', price: 220000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-db-postgres',
    name: 'Managed PostgreSQL & Redis Database Cluster',
    category: 'db',
    description: 'Managed PostgreSQL 16 with pgvector or Redis 7 cache. Automated daily R2 backups & snapshot restores',
    plans: [
      { id: 'plan-db-1', name: 'Starter DB Cluster', price: 180000, billingType: 'monthly' },
      { id: 'plan-db-2', name: 'High-Availability Cluster', price: 490000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-v2ray-proxy',
    name: 'V2Ray & High-Speed Proxy Credentials',
    category: 'vpn',
    description: 'Ultra-low latency VMess, VLess & Trojan protocol proxy nodes with zero log privacy & obfs encryption',
    plans: [
      { id: 'plan-vpn-1', name: 'VIP Proxy Pass (30 Days)', price: 85000, billingType: 'monthly' },
      { id: 'plan-vpn-2', name: 'VIP Proxy Annual Pass', price: 850000, billingType: 'yearly' },
    ],
  },
  {
    id: 'p-digital-store',
    name: 'STX Digital Goods & Premium Accounts',
    category: 'digital',
    description: 'Instant delivery for Netflix 4K, Spotify Premium, CapCut Pro, Google One AI Pro, Claude Pro & ChatGPT Plus',
    plans: [
      { id: 'plan-dig-1', name: 'Netflix 4K Ultra HD Pass', price: 150000, billingType: 'monthly' },
      { id: 'plan-dig-2', name: 'Google AI Pro (Gemini 2TB)', price: 220000, billingType: 'monthly' },
    ],
  },
];

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>(STATIC_CATALOG);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<'default' | 'price-low' | 'price-high' | 'name'>('default');

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetch(`${apiBase}/api/products`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
      })
      .catch(() => {
        // Fallback to static catalog if API server is offline
      });
  }, [apiBase]);

  // Compute minimum plan price for sorting
  const getMinPrice = (p: Product) => {
    if (!p.plans || p.plans.length === 0) return 999999999;
    return Math.min(...p.plans.map((plan) => plan.price));
  };

  // Filtered & Sorted Products list
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Search filter
        const matchesQuery =
          searchQuery === '' ||
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          product.plans.some((plan) => plan.name.toLowerCase().includes(searchQuery.toLowerCase()));

        // Category filter
        const cat = product.category ? product.category.toLowerCase() : '';
        const matchesCategory =
          selectedCategory === 'all' ||
          cat.includes(selectedCategory) ||
          (selectedCategory === 'vps' && (cat.includes('vps') || product.name.toLowerCase().includes('vps'))) ||
          (selectedCategory === 'web' && (cat.includes('web') || cat.includes('node') || cat.includes('python') || product.name.toLowerCase().includes('app'))) ||
          (selectedCategory === 'bot' && (cat.includes('bot') || product.name.toLowerCase().includes('bot'))) ||
          (selectedCategory === 'database' && (cat.includes('db') || cat.includes('database') || product.name.toLowerCase().includes('database'))) ||
          (selectedCategory === 'digital' && (cat.includes('digital') || product.name.toLowerCase().includes('digital') || product.name.toLowerCase().includes('account'))) ||
          (selectedCategory === 'vpn' && (cat.includes('vpn') || cat.includes('v2ray') || product.name.toLowerCase().includes('v2ray')));

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
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
            <span className="text-xs font-mono text-slate-400 mr-2 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-purple-400" /> Filter:
            </span>
            {CATEGORY_KEYS.map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 border ${
                    active
                      ? 'bg-purple-600/30 border-purple-500 text-white shadow-glow-violet'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[#08091c] border border-white/10 rounded-3xl p-12 text-center space-y-3">
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
                  className={`bg-[#08091c]/90 border rounded-3xl p-7 space-y-6 flex flex-col justify-between transition-all shadow-xl backdrop-blur-md relative overflow-hidden group ${
                    product.isPopular ? 'border-purple-500/60 shadow-glow-violet' : 'border-white/10 hover:border-purple-500/40'
                  }`}
                >
                  {product.isPopular && (
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-[10px] font-bold text-white shadow-md flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> {product.badge || 'Popular Choice'}
                    </div>
                  )}

                  {/* Top Header */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between border-b border-white/10 pb-4 gap-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-md">
                          {product.category || 'Platform Service'}
                        </span>
                        <h3 className="font-extrabold text-xl text-white pt-2">{product.name}</h3>
                      </div>
                      {product.plans && product.plans.length > 0 && minPrice < 999999999 && (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono text-slate-400 block">Starting from</span>
                          <span className="text-sm font-extrabold text-teal-400 font-mono">
                            {formatPrice(minPrice)}
                          </span>
                        </div>
                      )}
                    </div>

                    {product.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">{product.description}</p>
                    )}

                    {/* Plans List */}
                    {product.plans && product.plans.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        <h4 className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          Available Plans &amp; Cycles
                        </h4>
                        <div className="space-y-2">
                          {product.plans.map((plan) => (
                            <div
                              key={plan.id}
                              className={`flex justify-between items-center text-xs rounded-xl px-3.5 py-2.5 border transition-all ${
                                plan.isPopular
                                  ? 'bg-purple-500/10 border-purple-500/40 text-white'
                                  : 'bg-white/5 border-white/10 hover:border-purple-500/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 font-medium text-slate-200">
                                <Check className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                                <span>{plan.name}</span>
                                {plan.isPopular && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    {plan.badge || 'Popular'}
                                  </span>
                                )}
                              </div>
                              <div className="text-right font-mono">
                                <span className="text-teal-300 font-extrabold">{formatPrice(plan.price)}</span>
                                <span className="text-[10px] text-slate-400 ml-1">
                                  {BILLING_LABEL[plan.billingType] ?? plan.billingType}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Button CTA */}
                  <div className="pt-4 border-t border-white/10">
                    <a
                      href={`${dashboardUrl}/catalog`}
                      className="w-full py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 shadow-glow-violet"
                    >
                      Order {product.name} <ArrowRight className="h-4 w-4" />
                    </a>
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
