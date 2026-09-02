import React from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { fetchProducts } from '../../lib/api';
import { LayoutGrid, Sparkles, Rocket, ArrowRight, Package } from 'lucide-react';

export const metadata = {
  title: '1-Click App Catalog & Templates | SHANUTECHX Cloud',
  description: 'Deploy 15+ pre-configured software stacks in one click including WordPress, N8n, Plausible, Nextcloud, Ghost, Strapi, and Grafana.',
};

export const revalidate = 0; // Dynamic DB fetching

export default async function AppCatalogPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  // Fetch 1-click catalog products from API/DB
  const products = await fetchProducts('app_catalog');

  return (
    <div className="min-h-screen bg-[#03040c] text-white font-sans selection:bg-purple-500 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-36 pb-20 px-6 max-w-7xl mx-auto overflow-hidden text-center">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] opacity-35 pointer-events-none -z-10">
          <GradientMeshOrb />
        </div>

        <div className="space-y-6 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <LayoutGrid className="h-3.5 w-3.5" /> 1-Click App Template Store
          </span>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            1-Click <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-500">App Catalog</span>
          </h1>

          <p className="text-text-muted text-base leading-relaxed">
            Deploy pre-configured open-source application stacks instantly. We handle database configuration, SSL certificate issuance, and persistent volumes automatically.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href={`${dashboardUrl}/catalog`}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-glow-violet transition-all flex items-center gap-2"
            >
              Browse &amp; Deploy Stacks <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* App Templates Grid (Fetched Live from DB) */}
      <section className="py-16 px-6 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-mono uppercase font-bold text-indigo-400 tracking-widest">Live Database Catalog</span>
          <h2 className="text-3xl font-extrabold text-white">Featured 1-Click Software Stacks</h2>
        </div>

        {products.length === 0 ? (
          <div className="bg-[#080918] border border-white/10 rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto">
            <Package className="h-12 w-12 text-purple-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">No Catalog Products Published Yet</h3>
            <p className="text-xs text-text-muted">
              Admins &amp; Devs can add 1-click app catalog products in the Control Panel under <strong className="text-white">Admin &gt; Products &amp; Plans</strong>.
            </p>
            <a
              href={`${dashboardUrl}/admin/services`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-violet transition-all"
            >
              Open Admin Products Manager →
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((tmpl, idx) => (
              <div
                key={tmpl.id || idx}
                className="bg-[#080918] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-purple-500/40 transition-all duration-300 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-extrabold text-purple-400">📦</span>
                    <span className="text-[10px] font-mono uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-full font-bold">
                      {tmpl.category.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-lg text-white">{tmpl.name}</h3>
                    <p className="text-xs text-text-muted leading-relaxed mt-2">
                      {tmpl.description || 'Pre-configured Docker Compose application stack ready for instant 1-click deployment.'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-white/[0.08]">
                  <a
                    href={`${dashboardUrl}/catalog`}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-purple-600 text-white font-bold text-xs border border-white/10 hover:border-purple-500 transition-all flex items-center justify-center gap-1.5"
                  >
                    Deploy Stack <Rocket className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Request a Template Banner */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900/50 border border-purple-500/30 rounded-3xl p-10 text-center space-y-6">
          <Sparkles className="h-10 w-10 text-purple-400 mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Don't See Your Favorite Open-Source App?</h2>
          <p className="text-xs text-text-muted max-w-xl mx-auto">
            Our engineering team adds new Docker Compose templates every week. Request a new software template and we'll add it to the catalog!
          </p>
          <a
            href={`${dashboardUrl}/tickets`}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white text-slate-950 font-black text-xs hover:bg-slate-200 transition-all shadow-lg"
          >
            Submit Template Request
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
