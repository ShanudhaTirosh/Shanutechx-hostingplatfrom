import React from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { fetchProducts } from '../../lib/api';
import { Database, RefreshCw, Lock, Zap, ArrowRight, CheckCircle2, Package } from 'lucide-react';

export const metadata = {
  title: 'Managed Database Hosting | PostgreSQL, MySQL, Redis & MongoDB | SHANUTECHX Cloud',
  description: 'Deploy fully managed, high-performance database clusters with automated backups, connection pooling, and one-click provisioning.',
};

export const revalidate = 0; // Dynamic DB fetching

const DB_ENGINES = [
  {
    name: 'PostgreSQL 16',
    desc: 'Advanced relational database with JSONB support, pgvector indexing, and full ACID compliance.',
    badge: 'Popular SQL',
    icon: '🐘',
  },
  {
    name: 'MySQL 8',
    desc: 'High-throughput relational database optimized for web applications, WordPress, and ecommerce.',
    badge: 'Web Standard',
    icon: '🐬',
  },
  {
    name: 'Redis 7',
    desc: 'In-memory data structure store for high-speed caching, session management, and pub/sub queues.',
    badge: 'In-Memory Cache',
    icon: '🔴',
  },
  {
    name: 'MongoDB 6',
    desc: 'Flexible document-oriented NoSQL database for unstructured data and scalable microservices.',
    badge: 'NoSQL Document',
    icon: '🍃',
  },
];

export default async function ManagedDatabasesPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  // Fetch database products from API/DB
  const products = await fetchProducts('database_hosting');

  const allPlans = products.flatMap((p) =>
    (p.plans || []).map((plan) => ({
      ...plan,
      productName: p.name,
      productDescription: p.description,
    }))
  );

  return (
    <div className="min-h-screen bg-[#03040c] text-white font-sans selection:bg-teal-500 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-36 pb-20 px-6 max-w-7xl mx-auto overflow-hidden text-center">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] opacity-35 pointer-events-none -z-10">
          <GradientMeshOrb />
        </div>

        <div className="space-y-6 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-teal-500/10 text-teal-300 border border-teal-500/20">
            <Database className="h-3.5 w-3.5" /> High-Performance Data Engine
          </span>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Managed <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-emerald-300 to-indigo-500">Database Hosting</span>
          </h1>

          <p className="text-text-muted text-base leading-relaxed">
            Provision production-ready PostgreSQL, MySQL, Redis, or MongoDB clusters in seconds. We handle automated backups, security patching, and scaling.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href={`${dashboardUrl}/services`}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-sm shadow-glow-violet transition-all flex items-center gap-2"
            >
              Provision Database Now <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/pricing"
              className="px-8 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all"
            >
              View Full Price Matrix
            </Link>
          </div>
        </div>
      </section>

      {/* Database Engines Supported */}
      <section className="py-16 px-6 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-mono uppercase font-bold text-teal-400 tracking-widest">Database Engines</span>
          <h2 className="text-3xl font-extrabold text-white">Supported Managed Engines</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {DB_ENGINES.map((db, idx) => (
            <div key={idx} className="bg-[#080918] border border-white/10 rounded-3xl p-6 space-y-3 hover:border-teal-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{db.icon}</span>
                <span className="text-[10px] font-mono uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-md">
                  {db.badge}
                </span>
              </div>
              <h3 className="font-extrabold text-base text-white">{db.name}</h3>
              <p className="text-xs text-text-muted leading-relaxed">{db.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Database Pricing Grid (Fetched Live from DB) */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="text-center space-y-3 mb-14">
          <span className="text-xs font-mono uppercase font-bold text-teal-400 tracking-widest">Live Database Catalog</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Managed Database Plans</h2>
        </div>

        {allPlans.length === 0 ? (
          <div className="bg-[#080918] border border-white/10 rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto">
            <Package className="h-12 w-12 text-teal-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">No Database Plans Published Yet</h3>
            <p className="text-xs text-text-muted">
              Admins &amp; Devs can add Database products and plans in the Control Panel under <strong className="text-white">Admin &gt; Products &amp; Plans</strong>.
            </p>
            <a
              href={`${dashboardUrl}/admin/services`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-glow-violet transition-all"
            >
              Open Admin Products Manager →
            </a>
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
                  className="bg-[#080918] border border-white/10 hover:border-teal-500/40 rounded-3xl p-8 flex flex-col justify-between transition-all"
                >
                  <div className="space-y-4">
                    <span className="text-[11px] font-mono uppercase text-teal-400 font-bold block mb-1">
                      {plan.productName}
                    </span>
                    <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>

                    <div className="flex items-baseline gap-1 pt-2">
                      <span className="text-4xl font-black text-white">{formattedPrice}</span>
                      <span className="text-xs font-mono text-text-muted">/{plan.billingType.replace('_', ' ')}</span>
                    </div>

                    <ul className="space-y-3 pt-6 border-t border-white/[0.08] text-xs text-text-muted">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                        <span>PostgreSQL / MySQL / Redis / MongoDB</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                        <span>Automated Daily Snapshot Backups</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                        <span>AES-256 Encrypted Connection Vault</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                        <span>Connection Pooling Enabled</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-8">
                    <a
                      href={`${dashboardUrl}/services`}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-glow-violet transition-all flex items-center justify-center gap-2"
                    >
                      Provision {plan.name} <ArrowRight className="h-4 w-4" />
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
