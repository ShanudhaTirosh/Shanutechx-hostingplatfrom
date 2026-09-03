import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import VpsCatalogShowcase from '../../components/VpsCatalogShowcase';
import NetworkMap from '../../components/NetworkMap';
import DiscordBanner from '../../components/DiscordBanner';
import { fetchProducts } from '../../lib/api';

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
      <div className="fixed inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none z-0" />

      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-20 relative z-10 w-full">
        {/* Hero Section with Vibrant Gradient Mesh Orb */}
        <div className="relative text-center space-y-6 pt-6 pb-2">
          {/* Centered Large GradientMeshOrb Background */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={520} opacity={0.85} glowColor="rgba(147, 51, 234, 0.75)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              CLOUD INFRASTRUCTURE
            </div>

            {/* Main Title */}
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              Cloud VPS <span className="text-purple-400">Infrastructure</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-text-muted leading-relaxed max-w-2xl mx-auto font-sans">
              High-performance, unmanaged server allocations engineered for scalable networking deployments.
            </p>
          </div>
        </div>

        {/* Dynamic VPS Catalog Showcase Component (Interactive Duration & Providers) */}
        <VpsCatalogShowcase products={products} dashboardUrl={dashboardUrl} />

        {/* Global Network Footprint Live Telemetry Component */}
        <NetworkMap />

        {/* Discord & Community CTA Banner matching Image 2 */}
        <DiscordBanner className="py-4" />
      </main>

      <Footer />
    </div>
  );
}
