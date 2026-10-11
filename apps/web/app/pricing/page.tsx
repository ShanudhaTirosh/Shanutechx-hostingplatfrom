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
  { id: 'all', label: 'All Cloud Services', icon: Package },
  { id: 'vps', label: 'Cloud VPS', icon: Server },
  { id: 'web', label: 'Web & App Hosting', icon: Globe },
  { id: 'bot', label: '24/7 Bots', icon: Bot },
  { id: 'database', label: 'Databases', icon: Database },
  { id: 'smtp', label: 'Business Email / SMTP', icon: Zap },
];

// Fallback catalog matching genuine platform plans from seedProducts.ts
const STATIC_CATALOG: Product[] = [
  {
    id: 'p-vps',
    name: 'High-Performance Cloud VPS',
    category: 'vps',
    description: 'Dedicated NVMe SSD compute nodes with unmetered 1Gbps bandwidth, root SSH control, and dedicated IPv4.',
    isPopular: true,
    badge: 'Flagship Compute',
    plans: [
      { id: 'plan-vps-micro', name: 'VPS Micro (1 vCPU, 2GB RAM, 30GB NVMe)', price: 250000, billingType: 'monthly' },
      { id: 'plan-vps-std', name: 'VPS Standard (2 vCPU, 4GB RAM, 80GB NVMe)', price: 500000, billingType: 'monthly', isPopular: true, badge: 'Best Seller' },
      { id: 'plan-vps-pro', name: 'VPS Pro (4 vCPU, 8GB RAM, 160GB NVMe)', price: 950000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-web-hosting',
    name: 'Static & Dynamic Web Hosting',
    category: 'web',
    description: 'Cloud web hosting with automated GitHub deployment (Public & Private repos), free SSL certificates, and custom domains.',
    plans: [
      { id: 'plan-web-starter', name: 'Starter Web Hosting (1GB NVMe, 100GB Bandwidth)', price: 85000, billingType: 'monthly' },
      { id: 'plan-web-pro', name: 'Pro Web Hosting (5GB NVMe, 500GB Bandwidth)', price: 195000, billingType: 'monthly', isPopular: true, badge: 'Popular' },
      { id: 'plan-web-ent', name: 'Enterprise Web Hosting (20GB NVMe, 2TB Bandwidth)', price: 450000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-app-node',
    name: 'Node.js & Next.js App Hosting',
    category: 'web',
    description: 'Nixpacks-powered container hosting with automatic SSL, zero-config domain routing, and environment secrets.',
    plans: [
      { id: 'plan-app-dev', name: 'Developer Node Plan (512MB RAM, 0.5 vCPU)', price: 120000, billingType: 'monthly' },
      { id: 'plan-app-biz', name: 'Business Node Plan (2GB RAM, 1.5 vCPU)', price: 280000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-bot-hosting',
    name: '24/7 Discord & WhatsApp Bot Hosting',
    category: 'bot',
    description: 'Continuous process runner with auto-restart on disconnect, live real-time logs, and persistent volume storage.',
    plans: [
      { id: 'plan-bot-discord-start', name: 'Discord Bot Starter (512MB RAM)', price: 80000, billingType: 'monthly' },
      { id: 'plan-bot-discord-pro', name: 'Discord Bot Pro (2GB RAM)', price: 180000, billingType: 'monthly' },
      { id: 'plan-bot-wa-starter', name: 'WhatsApp Bot Starter (1GB RAM, Persistent Session)', price: 150000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-db-cluster',
    name: 'Managed Databases & Cache',
    category: 'database',
    description: 'Managed PostgreSQL 16, MySQL 8, Redis 7 & MongoDB clusters with automated daily Cloudflare R2 snapshots.',
    plans: [
      { id: 'plan-db-redis', name: 'Managed Redis 7 Cache Cluster', price: 120000, billingType: 'monthly' },
      { id: 'plan-db-postgres', name: 'Managed PostgreSQL 16 Cluster', price: 280000, billingType: 'monthly' },
      { id: 'plan-db-ha', name: 'High-Availability Database Cluster', price: 650000, billingType: 'monthly' },
    ],
  },
  {
    id: 'p-smtp-email',
    name: 'Enterprise Outbound SMTP & Business Email',
    category: 'smtp',
    description: 'High-reputation SMTP mailer with webmail client, custom domain support, DKIM/SPF auto-validation, and forwarding rules.',
    plans: [
      { id: 'plan-smtp-1', name: 'Starter Email (1GB Storage, 1 Mailbox)', price: 450000, billingType: 'quarterly' },
      { id: 'plan-smtp-2', name: 'Standard Email (5GB Storage, 5 Aliases)', price: 1050000, billingType: 'quarterly' },
      { id: 'plan-smtp-3', name: 'Pro Email (20GB Storage, 10 Aliases)', price: 2250000, billingType: 'quarterly' },
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
          // Filter out any third-party or proxy products from hosting catalog
          const valid = data.products.filter(
            (p: Product) =>
              p.category !== 'vpn' &&
              p.category !== 'digital' &&
              !p.name.toLowerCase().includes('v2ray')
          );
          if (valid.length > 0) {
            setProducts(valid);
          }
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
          (selectedCategory === 'smtp' && (cat.includes('smtp') || cat.includes('mail') || cat.includes('email') || product.name.toLowerCase().includes('email')));

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
