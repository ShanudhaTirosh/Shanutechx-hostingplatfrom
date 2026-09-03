import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import VpsCatalogShowcase from '../../components/VpsCatalogShowcase';
import { fetchProducts } from '../../lib/api';
import { ShieldCheck, Cpu, HardDrive, Zap, Globe, MessageSquare, Terminal } from 'lucide-react';

export const metadata = {
  title: 'Cloud VPS Infrastructure | ShanuTechX',
  description: 'High-performance, unmanaged server allocations engineered for scalable networking deployments.',
};

export default async function VpsHostingPage() {
  const products = await fetchProducts('vps');
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Background Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />

      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-24 relative z-10 w-full">
        {/* Hero Section with Vibrant Gradient Mesh Orb */}
        <div className="relative text-center space-y-6 pt-8 pb-4">
          {/* Centered Large GradientMeshOrb Background */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={520} opacity={0.85} glowColor="rgba(147, 51, 234, 0.75)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            {/* Pill Badge matching vps.png */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              CLOUD INFRASTRUCTURE
            </div>

            {/* Main Title matching vps.png */}
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              Cloud VPS <span className="text-purple-400">Infrastructure</span>
            </h1>

            {/* Subtitle matching vps.png */}
            <p className="text-base md:text-lg text-text-muted leading-relaxed max-w-2xl mx-auto font-sans">
              High-performance, unmanaged server allocations engineered for scalable networking deployments.
            </p>
          </div>
        </div>

        {/* Dynamic VPS Catalog Showcase Component (Interactive Duration & Providers) */}
        <VpsCatalogShowcase products={products} dashboardUrl={dashboardUrl} />

        {/* Global Network Footprint Section (Matching vps.png) */}
        <section className="bg-[#08091a] border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden space-y-10 shadow-2xl">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-[11px] font-mono font-bold tracking-widest text-purple-400 uppercase bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
              WORLDWIDE COVERAGE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Global Network Footprint
            </h2>
            <p className="text-sm text-text-muted leading-relaxed font-sans">
              Strategically deployed nodes across major regions for low-latency networking.
            </p>
          </div>

          {/* Glowing Animated 3D Dotted World Map Graphic */}
          <div className="relative py-8 flex items-center justify-center">
            <div className="relative w-full max-w-2xl aspect-[2/1] flex items-center justify-center">
              {/* Globe Ambient Glow */}
              <div className="absolute inset-0 bg-purple-600/10 rounded-full blur-3xl" />
              
              <svg viewBox="0 0 800 400" className="w-full h-full opacity-85">
                {/* World Map Dotted Grid Overlay */}
                <g fill="rgba(168, 85, 247, 0.25)">
                  {Array.from({ length: 40 }).map((_, r) =>
                    Array.from({ length: 80 }).map((_, c) => (
                      <circle key={`${r}-${c}`} cx={c * 10 + 5} cy={r * 10 + 5} r="1" />
                    ))
                  )}
                </g>

                {/* Glowing Regional Nodes */}
                {/* UK Node */}
                <g className="animate-pulse">
                  <circle cx="380" cy="120" r="6" fill="#a855f7" />
                  <circle cx="380" cy="120" r="14" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.6" />
                </g>
                {/* DE Node */}
                <g className="animate-pulse" style={{ animationDelay: '0.2s' }}>
                  <circle cx="410" cy="130" r="6" fill="#a855f7" />
                  <circle cx="410" cy="130" r="14" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.6" />
                </g>
                {/* US East Node */}
                <g className="animate-pulse" style={{ animationDelay: '0.4s' }}>
                  <circle cx="240" cy="150" r="6" fill="#a855f7" />
                  <circle cx="240" cy="150" r="14" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.6" />
                </g>
                {/* Japan Node */}
                <g className="animate-pulse" style={{ animationDelay: '0.6s' }}>
                  <circle cx="670" cy="170" r="6" fill="#a855f7" />
                  <circle cx="670" cy="170" r="14" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.6" />
                </g>
                {/* Singapore Node */}
                <g className="animate-pulse" style={{ animationDelay: '0.8s' }}>
                  <circle cx="620" cy="240" r="6" fill="#a855f7" />
                  <circle cx="620" cy="240" r="14" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.6" />
                </g>
                {/* India Node */}
                <g className="animate-pulse" style={{ animationDelay: '1.0s' }}>
                  <circle cx="560" cy="210" r="6" fill="#a855f7" />
                  <circle cx="560" cy="210" r="14" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.6" />
                </g>
              </svg>
            </div>
          </div>

          {/* Regional Latency Ping Tickers along bottom (Matching vps.png) */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-text-muted">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <strong className="text-white">UK Hub</strong> ~84ms
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <strong className="text-white">DE Hub</strong> ~92ms
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <strong className="text-white">US Hub</strong> ~135ms
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <strong className="text-white">JP Hub</strong> ~70ms
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <strong className="text-white">IN Hub</strong> ~45ms
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <strong className="text-white">AU Hub</strong> ~160ms
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <strong className="text-white">SG Hub</strong> ~55ms
            </div>
          </div>
        </section>

        {/* Discord & Community CTA Banner (Matching vps.png) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-6">
          <div className="bg-[#090b1e] border border-white/10 p-2 rounded-full inline-flex items-center gap-3 shadow-2xl">
            <a
              href="https://discord.gg/shanutechx"
              target="_blank"
              rel="noreferrer"
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-full font-extrabold text-xs inline-flex items-center gap-2 transition-all shadow-glow-violet"
            >
              <MessageSquare className="h-4 w-4" />
              Join our Discord
            </a>
            <span className="text-xs font-mono text-text-muted pr-4 flex items-center gap-1.5">
              Live support &amp; drops →
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
