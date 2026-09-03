import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import {
  ShieldCheck,
  Zap,
  Globe,
  Lock,
  ArrowRight,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  Server,
  Key,
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'V2Ray & High-Speed Proxies | STX Store - ShanuTechX',
  description: 'Ultra-low latency VMess, VLess, Trojan & ShadowSocks obfuscated VPN nodes. Unlimited bandwidth, zero throttling, and instant configuration credentials.',
  keywords: ['V2Ray', 'VMess', 'VLess', 'Trojan VPN', 'ShadowSocks', 'High Speed Proxy', 'STX Store', 'Netflix 4K', 'Spotify Premium', 'CapCut Pro'],
  openGraph: {
    title: 'V2Ray & Premium Digital Goods | ShanuTechX Store',
    description: 'High-Speed V2Ray VPN Proxies & Premium Digital Accounts (Netflix, Spotify, CapCut Pro, Google AI Pro, Claude Pro).',
    url: 'https://store.shanutechx.com',
  },
};

export default function V2RayPage() {
  const storeUrl = 'https://store.shanutechx.com';

  const FEATURES = [
    {
      icon: ShieldCheck,
      title: 'VMess, VLess & Trojan Protocols',
      desc: 'Next-generation obfuscated proxy protocols designed to bypass deep packet inspection and network throttling with zero latency overhead.',
    },
    {
      icon: Zap,
      title: '10 Gbps High-Bandwidth Nodes',
      desc: 'Powered by NVMe edge nodes across Frankfurt, Singapore, Tokyo, and US East with 99.9% uptime SLA guarantee.',
    },
    {
      icon: Lock,
      title: 'Zero-Log Privacy Architecture',
      desc: 'We enforce strict zero-logging policy. No IP logs, connection timestamps, or web traffic records are ever stored.',
    },
    {
      icon: Key,
      title: 'Instant Config QR Code & VLESS URL',
      desc: 'Get your VLESS/VMess config URI strings or scan QR codes instantly in v2rayN, Shadowrocket, NekoBox, and Clash clients.',
    },
  ];

  const DIGITAL_GOODS = [
    { name: 'Netflix 4K Premium', desc: 'Private 4K UHD Profile', price: 'Best Price', color: 'from-red-500/20 to-red-950/40 border-red-500/30' },
    { name: 'Spotify Premium', desc: 'Individual / Family Upgrade', price: 'Instant Delivery', color: 'from-green-500/20 to-green-950/40 border-green-500/30' },
    { name: 'CapCut Pro', desc: 'Full AI Video Editor Unlocked', price: 'Subscription', color: 'from-sky-500/20 to-sky-950/40 border-sky-500/30' },
    { name: 'Google One AI Pro', desc: 'Gemini Advanced 2TB Cloud', price: 'Verified Account', color: 'from-amber-500/20 to-amber-950/40 border-amber-500/30' },
    { name: 'Claude Pro', desc: 'Anthropic Claude 3.5 Sonnet', price: 'High Capacity', color: 'from-purple-500/20 to-purple-950/40 border-purple-500/30' },
    { name: 'ChatGPT Plus', desc: 'GPT-4o & DALL-E 3 Unlocked', price: 'Instant Login', color: 'from-emerald-500/20 to-emerald-950/40 border-emerald-500/30' },
  ];

  // JSON-LD Schema for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'V2Ray Proxies & STX Digital Goods Store',
    description: 'High-speed V2Ray VPN Proxies & Premium Digital Accounts (Netflix 4K, Spotify, CapCut Pro, Google AI Pro, Claude Pro).',
    url: 'https://store.shanutechx.com',
    brand: {
      '@type': 'Brand',
      name: 'ShanuTechX',
    },
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 space-y-20 relative z-10 w-full">
        {/* Hero Section */}
        <div className="relative text-center space-y-6 pt-4">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.7} glowColor="rgba(56, 189, 248, 0.6)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-mono font-bold tracking-widest uppercase shadow-glow-sky">
              <ShieldCheck className="h-4 w-4 text-sky-400" />
              ULTRA-FAST V2RAY PROXIES &amp; DIGITAL STORE
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
              V2Ray VPN Nodes &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400">Digital Goods Store</span>
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Get high-speed VMess, VLess &amp; Trojan proxy configurations, or purchase premium digital subscriptions at <span className="text-purple-400 font-bold font-mono">store.shanutechx.com</span>.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white font-extrabold text-sm shadow-glow-violet transition-all flex items-center gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                Visit STX Store (store.shanutechx.com)
                <ExternalLink className="h-4 w-4 ml-1 text-purple-200" />
              </a>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="bg-[#080a1f]/80 border border-white/10 rounded-3xl p-6 space-y-3 hover:border-sky-500/40 transition-all shadow-xl backdrop-blur-md"
              >
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-white">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Digital Goods Marketplace Section */}
        <div className="space-y-8 bg-[#08091c]/90 border border-purple-500/20 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                OFFICIAL DIGITAL GOODS STORE
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Premium Accounts &amp; Software Licenses
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
                Get instant automated delivery for verified Netflix 4K, Spotify, CapCut Pro, Google One AI Pro, Claude Pro, and ChatGPT Plus subscriptions.
              </p>
            </div>
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 rounded-2xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 font-bold text-xs font-mono transition-all shrink-0 flex items-center gap-2 shadow-glow-violet"
            >
              Open STX Store <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {DIGITAL_GOODS.map((item, idx) => (
              <a
                key={idx}
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`bg-gradient-to-br ${item.color} border rounded-2xl p-5 space-y-2 hover:scale-[1.02] transition-all shadow-lg group`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-white group-hover:text-purple-300 transition-colors">
                    {item.name}
                  </h4>
                  <span className="text-[10px] font-mono font-bold uppercase bg-white/10 px-2 py-0.5 rounded text-white/90">
                    {item.price}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{item.desc}</p>
                <div className="pt-2 flex items-center text-[11px] font-mono font-bold text-purple-300 group-hover:translate-x-1 transition-transform">
                  Buy on store.shanutechx.com &rarr;
                </div>
              </a>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
