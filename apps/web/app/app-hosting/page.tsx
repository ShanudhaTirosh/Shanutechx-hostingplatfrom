import React from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { fetchProducts } from '../../lib/api';
import { Code2, ArrowRight, CheckCircle2, Package, Terminal, Cpu, Zap, Container, Sparkles, FolderArchive } from 'lucide-react';

export const metadata = {
  title: 'Web App & Repository Hosting | SHANUTECHX Cloud',
  description: 'Deploy web applications directly from GitHub, GitLab, or ZIP archives with automated build pipelines, custom SSL domains, and zero-downtime deployments.',
};

export const revalidate = 0; // Dynamic DB fetching

const STACKS = [
  { name: 'Node.js', desc: 'Express, Next.js, Remix, NestJS', icon: Terminal },
  { name: 'Python', desc: 'Django, FastAPI, Flask', icon: Cpu },
  { name: 'Go & Rust', desc: 'Compiled High-Speed Binaries', icon: Zap },
  { name: 'Docker / Compose', desc: 'Custom Dockerfile & Multi-container', icon: Container },
  { name: 'Static Frontend', desc: 'React, Vue, HTML5, Tailwind', icon: Sparkles },
  { name: 'ZIP Package', desc: 'Direct Drag & Drop Source Upload', icon: FolderArchive },
];

export default async function AppHostingPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  // Fetch web app hosting products across categories
  const webProducts = await fetchProducts('web_hosting');
  const catalogProducts = await fetchProducts('app_catalog');

  const products = [...webProducts, ...catalogProducts];

  const allPlans = products.flatMap((p) =>
    (p.plans || []).map((plan) => ({
      ...plan,
      productName: p.name,
      productDescription: p.description,
    }))
  );

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-36 pb-20 px-6 max-w-7xl mx-auto overflow-hidden text-center">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] opacity-35 pointer-events-none -z-10">
          <GradientMeshOrb />
        </div>

        <div className="space-y-6 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Code2 className="h-3.5 w-3.5" /> Instant Code Deployment Engine
          </span>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Deploy Web Apps from <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-500">Git or ZIP Archives</span>
          </h1>

          <p className="text-text-muted text-base leading-relaxed">
            Connect your GitHub repository or upload a ZIP archive. Our automated build engine detects runtime dependencies, compiles your source code, and provisions custom SSL domains in seconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href={`${dashboardUrl}/deployments`}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-glow-violet transition-all flex items-center gap-2"
            >
              Deploy App Now <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/pricing"
              className="px-8 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all"
            >
              Compare All Plans
            </Link>
          </div>
        </div>
      </section>

      {/* Deployment Sources Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-mono uppercase font-bold text-indigo-400 tracking-widest">Multi-Language &amp; Runtime Support</span>
          <h2 className="text-3xl font-extrabold text-white">Supported Application Frameworks</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {STACKS.map((stack, idx) => (
            <div key={idx} className="bg-[#080918] border border-white/10 rounded-3xl p-6 flex items-start gap-4 hover:border-indigo-500/40 transition-all">
              <stack.icon className="h-6 w-6 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-base text-white">{stack.name}</h3>
                <p className="text-xs text-text-muted mt-1">{stack.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Grid (Fetched Live from DB) */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="text-center space-y-3 mb-14">
          <span className="text-xs font-mono uppercase font-bold text-indigo-400 tracking-widest">Live Database Catalog</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">App Hosting Plans &amp; Pricing</h2>
        </div>

        {allPlans.length === 0 ? (
          <div className="bg-[#080918] border border-white/10 rounded-3xl p-12 text-center space-y-3 max-w-xl mx-auto">
            <Package className="h-10 w-10 text-indigo-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              No products are currently listed. Check back soon or contact support.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {allPlans.map((plan, idx) => {
              const formattedPrice = (plan.price / 100).toLocaleString('en-US', {
                style: 'currency',
                currency: plan.currency || 'USD',
              });

              return (
                <div
                  key={plan.id || idx}
                  className="bg-[#080918] border border-white/10 hover:border-indigo-500/40 rounded-3xl p-8 flex flex-col justify-between transition-all"
                >
                  <div className="space-y-4">
                    <span className="text-[11px] font-mono uppercase text-indigo-400 font-bold block mb-1">
                      {plan.productName}
                    </span>
                    <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>

                    <div className="flex items-baseline gap-1 pt-2">
                      <span className="text-4xl font-black text-white">{formattedPrice}</span>
                      <span className="text-xs font-mono text-text-muted">/{plan.billingType.replace('_', ' ')}</span>
                    </div>

                    <ul className="space-y-3 pt-6 border-t border-white/[0.08] text-xs text-text-muted">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span>Git Webhook Auto-Deploy</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span>ZIP Package Upload Support</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span>Custom Domain SSL Certificate</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span>Process Auto-Restart &amp; Logs</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-8">
                    <a
                      href={`${dashboardUrl}/deployments`}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-glow-violet transition-all flex items-center justify-center gap-2"
                    >
                      Deploy {plan.name} <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
