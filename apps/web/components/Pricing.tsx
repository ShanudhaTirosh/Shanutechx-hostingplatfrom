'use client';

import { useEffect, useState } from 'react';
import { Globe, Zap, Code, Bot, MessageSquare, Music, Monitor, Brain, Mail, Database, Package } from 'lucide-react';

import GradientMeshOrb from './GradientMeshOrb';
import Reveal from './motion/Reveal';
import TiltCard from './motion/TiltCard';

function renderCategoryIcon(category: string) {
  const className = "h-5 w-5 text-accent-violet-light";
  switch (category) {
    case 'web_hosting': return <Globe className={className} />;
    case 'node_app_hosting': return <Zap className={className} />;
    case 'python_app_hosting': return <Code className={className} />;
    case 'discordbot_node':
    case 'discordbot_python': return <Bot className={className} />;
    case 'whatsappbot_hosting': return <MessageSquare className={className} />;
    case 'lavalink_hosting': return <Music className={className} />;
    case 'vps': return <Monitor className={className} />;
    case 'ai_subscription': return <Brain className={className} />;
    case 'smtp_hosting': return <Mail className={className} />;
    case 'database_hosting': return <Database className={className} />;
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
  return `LKR ${(cents / 100).toLocaleString('en-LK', { minimumFractionDigits: 0 })}`;
}

interface Plan { id: string; name: string; price: number; billingType: string; }
interface Product { id: string; name: string; category: string; description: string | null; plans: Plan[]; }

export default function Pricing() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  const loginUrl = `${dashboardUrl}/login`;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetch(`${apiBase}/api/products`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setError(true));
  }, [apiBase]);

  const displayed = products?.filter((p) => p.plans.length > 0).slice(0, 6) ?? [];

  return (
    <section id="pricing" className="px-4 py-28 max-w-6xl mx-auto relative">
      {/* Background Orb Accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-65 sm:opacity-80 pointer-events-none">
        <GradientMeshOrb size={600} glowColor="rgba(45,212,191,0.55)" />
      </div>
      <Reveal className="text-center mb-12">
        <span className="glass inline-block rounded-full px-4 py-1 text-xs text-text-muted mb-4">
          Products &amp; Pricing
        </span>
        <h2 className="text-display">
          Host anything, <span className="text-gradient">pay per product</span>
        </h2>
        <p className="text-text-muted mt-3 max-w-2xl mx-auto">
          No complex packages. Pay only for the specific resources you need. Fully managed under our auto-scaling edge network and secure SSL routing.
        </p>
      </Reveal>

      {/* Loading skeleton */}
      {products === null && !error && (
        <div className="grid md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 animate-pulse space-y-4">
              <div className="h-8 w-8 rounded-full bg-white/10" />
              <div className="h-5 w-32 rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/[0.06]" />
              <div className="h-10 w-24 rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {/* Error fallback */}
      {error && (
        <p className="text-center text-text-muted text-sm py-10">
          Could not load products right now. <a href={loginUrl} className="text-accent-violet-light underline">Sign in to browse</a>.
        </p>
      )}

      {/* Products grid */}
      {displayed.length > 0 && (
        <div className="grid md:grid-cols-3 gap-6">
          {displayed.map((product, idx) => {
            const cheapest = product.plans.reduce((min, p) => (p.price < min.price ? p : min), product.plans[0]);
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
                    Most Popular
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
                      {formatPrice(cheapest.price)}
                    </span>
                    <span className="text-text-muted text-xs mb-1.5">
                      {BILLING_LABEL[cheapest.billingType] ?? cheapest.billingType}
                    </span>
                  </div>
                  {product.plans.length > 1 && (
                    <p className="text-text-faint text-[11px] mt-0.5">+ {product.plans.length - 1} more plan{product.plans.length > 2 ? 's' : ''}</p>
                  )}
                </div>

                <a
                  href={loginUrl}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold text-center transition-all hover:opacity-90 ${
                    recommended
                      ? 'bg-brand-gradient text-white shadow-glow-violet'
                      : 'glass text-text-primary hover:bg-white/[0.08]'
                  }`}
                >
                  Order Now →
                </a>

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

      {/* Empty state: no products in DB yet */}
      {products !== null && displayed.length === 0 && !error && (
        <div className="text-center py-16">
          <p className="text-text-muted text-sm mb-4">No products available yet. Check back soon!</p>
          <a
            href={loginUrl}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 font-semibold text-sm text-white hover:opacity-90 transition-opacity shadow-glow-violet"
          >
            Sign in to explore
          </a>
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
