'use client';

import { useEffect, useState } from 'react';
import { Globe, Zap, Code, Bot, MessageSquare, Music, Monitor, Brain, Mail, Database, Package, ShoppingCart, ExternalLink, ShoppingBag } from 'lucide-react';

import { useCart } from '../context/CartContext';
import GradientMeshOrb from './GradientMeshOrb';
import Reveal from './motion/Reveal';
import TiltCard from './motion/TiltCard';

function renderCategoryIcon(category: string) {
  const className = "h-5 w-5 text-accent-violet-light";
  switch (category) {
    case 'vps': return <Monitor className={className} />;
    case 'smtp': return <Mail className={className} />;
    case 'web_hosting': return <Globe className={className} />;
    case 'database': return <Database className={className} />;
    case 'bot_hosting': return <Bot className={className} />;
    case 'app_catalog': default: return <Package className={className} />;
  }
}

const BILLING_LABEL: Record<string, string> = {
  one_time: 'one-time',
  monthly: '/month',
  quarterly: '/3 months',
  semiannual: '/6 months',
  yearly: '/year',
};

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-teal-bright shrink-0">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function formatPrice(cents: number) {
  const amount = Math.floor(cents / 100);
  return `LKR ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

interface Plan { id: string; name: string; price: number; billingType: string; }
interface Product { id: string; name: string; category: string; description: string | null; plans: Plan[]; }

export default function Pricing() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { addItem } = useCart();
  const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetch(`${apiBase}/api/products`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (Array.isArray(d.products)) {
          setProducts(d.products);
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        console.error('[Pricing] Failed to fetch live products from database:', err);
        setProducts([]);
        setError('Unable to load pricing catalog. Please ensure the API is connected.');
      });
  }, [apiBase]);

  const displayed = (products && products.length > 0
    ? products.filter((p) => p.plans && p.plans.length > 0)
    : []
  ).slice(0, 6);

  return (
    <section id="pricing" className="px-4 py-28 max-w-6xl mx-auto relative">
      {/* Background Orb Accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-65 sm:opacity-80 pointer-events-none">
        <GradientMeshOrb size={600} glowColor="rgba(45,212,191,0.55)" />
      </div>
      <Reveal className="text-center mb-10">
        <span className="glass inline-block rounded-full px-4 py-1 text-xs text-text-muted mb-4">
          Products &amp; Pricing
        </span>
        <h2 className="text-display">
          Host anything, <span className="text-gradient">pay per product</span>
        </h2>
        <p className="text-text-muted mt-3 max-w-2xl mx-auto">
          No complex packages. Pay only for the specific resources you need. Fully managed under our auto-scaling edge network.
        </p>

        {/* Monthly / Yearly Billing Toggle */}
        <div className="mt-8 inline-flex items-center gap-2 p-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              billingCycle === 'yearly'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Annual Billing</span>
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              SAVE 30%
            </span>
          </button>
        </div>
      </Reveal>

      {/* Skeleton loader while fetching */}
      {products === null && (
        <div className="grid md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 animate-pulse space-y-4">
              <div className="h-10 w-10 rounded-xl bg-white/10" />
              <div className="h-5 w-36 rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/[0.06]" />
              <div className="h-8 w-28 rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {/* Products grid from API */}
      {products !== null && displayed.length > 0 && (
        <div className="grid md:grid-cols-3 gap-6">
          {displayed.map((product, idx) => {
            const rawCheapest = product.plans.reduce((min, p) => (p.price < min.price ? p : min), product.plans[0]);
            const finalPrice = billingCycle === 'yearly' ? Math.round(rawCheapest.price * 0.7) : rawCheapest.price;
            const recommended = idx === 1;
            return (
              <Reveal key={product.id} index={idx}>
                <TiltCard
                  strength={5}
                  className={`relative h-full rounded-2xl p-6 flex flex-col transition-colors duration-300 ${
                    recommended
                      ? 'glass border-accent-violet/50 ring-1 ring-accent-violet/40 shadow-glow-violet scale-[1.02]'
                      : 'glass hover:bg-white/[0.05] hover:border-white/12'
                  }`}
                >
                  {recommended && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white bg-brand-gradient shadow-glow-violet">
                      Recommended For Your Business
                    </span>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center shrink-0">
                      {renderCategoryIcon(product.category)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary">{product.name}</h3>
                      <p className="text-text-faint text-xs font-medium">{product.plans.length} plan{product.plans.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {product.description && (
                    <p className="text-text-muted text-xs leading-relaxed mb-5 min-h-[36px] line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-text-primary">
                        {formatPrice(finalPrice)}
                      </span>
                      <span className="text-text-muted text-xs mb-1.5">
                        {billingCycle === 'yearly' ? '/month (billed yearly)' : BILLING_LABEL[rawCheapest.billingType] ?? rawCheapest.billingType}
                      </span>
                    </div>
                    {product.plans.length > 1 && (
                      <p className="text-text-faint text-[11px] mt-0.5">+ {product.plans.length - 1} more plan tier{product.plans.length > 2 ? 's' : ''}</p>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      addItem({
                        id: rawCheapest.id,
                        name: `${product.name} — ${rawCheapest.name}`,
                        category: product.category,
                        price: finalPrice,
                        currency: 'LKR',
                        billingType: billingCycle,
                      })
                    }
                    className={`rounded-full px-4 py-2.5 text-sm font-semibold text-center transition-all cursor-pointer ${
                      recommended
                        ? 'bg-brand-gradient text-white shadow-glow-violet hover:opacity-90'
                        : 'glass text-text-primary hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      Add to Cart <ShoppingCart className="w-4 h-4" />
                    </span>
                  </button>

                  {product.description && (
                    <ul className="mt-6 space-y-2.5 text-xs text-text-muted flex-1 border-t border-white/[0.05] pt-5">
                      {product.plans.map((plan) => (
                        <li key={plan.id} className="flex items-start gap-2">
                          <CheckIcon />
                          <span>{plan.name} — {formatPrice(plan.price)} {BILLING_LABEL[plan.billingType] ?? plan.billingType}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Official Digital Goods & V2Ray Proxies External Store Notice */}
      <Reveal className="mt-12">
        <div className="glass rounded-3xl p-7 border border-purple-500/30 bg-gradient-to-r from-purple-950/60 via-[#0d0f2b] to-indigo-950/60 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-purple-600/10 to-transparent pointer-events-none" />
          <div className="flex items-start sm:items-center gap-4 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              <ShoppingBag className="h-7 w-7 text-purple-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
                Official Digital Store
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white">
                Looking for Digital Goods, AI Accounts &amp; V2Ray Proxies?
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Netflix 4K, Spotify, CapCut Pro, ChatGPT Plus, Claude, Google AI Pro, and high-speed V2Ray / VMess / Trojan proxy configurations are sold exclusively through our official store at <span className="text-purple-300 font-bold font-mono">store.shanutechx.com</span>.
              </p>
            </div>
          </div>
          <a
            href="https://store.shanutechx.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] transition-all shrink-0 flex items-center gap-2 font-mono"
          >
            <span>Visit STX Store Portal</span>
            <ExternalLink className="w-4 h-4 text-purple-200" />
          </a>
        </div>
      </Reveal>

      {/* Empty state when database returned zero products */}
      {products !== null && displayed.length === 0 && (
        <div
          style={{
            background: 'rgba(13, 11, 26, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '48px 32px',
            textAlign: 'center',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            maxWidth: '820px',
            margin: '0 auto',
          }}
        >
          <p style={{ fontSize: '15px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>
            No products are currently listed. Check back soon or contact support.
          </p>
        </div>
      )}

      <div className="mt-14 text-center">
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm font-medium text-accent-teal-bright hover:underline"
        >
          <span>Explore all infrastructure specifications, build settings &amp; VPS features</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      </div>
    </section>
  );
}



