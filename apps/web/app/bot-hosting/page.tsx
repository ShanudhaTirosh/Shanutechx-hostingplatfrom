import React from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { fetchProducts } from '../../lib/api';
import { Bot, ShieldCheck, Activity, Terminal, ArrowRight, CheckCircle2, RefreshCw, Package, MessageSquare, Send } from 'lucide-react';

export const metadata = {
  title: '24/7 Bot Hosting | Discord, Telegram & WhatsApp Bots | SHANUTECHX Cloud',
  description: 'Run Node.js and Python Discord bots, Telegram bots, and WhatsApp messaging gateways 24/7 with zero downtime, real-time logs, and auto-restart.',
};

export const revalidate = 0; // Dynamic DB fetching

const BOT_TYPES = [
  {
    title: 'Discord.js & Python Bots',
    desc: 'Support for Discord.js v14, Eris, discord.py, Nextcord, and Lavalink audio streaming nodes.',
    icon: Bot,
  },
  {
    title: 'WhatsApp Gateways (Baileys)',
    desc: 'Keep your Baileys QR session state persistent across container restarts with persistent volumes.',
    icon: MessageSquare,
  },
  {
    title: 'Telegram & Custom Bot Daemons',
    desc: 'Telebot, python-telegram-bot, GramJS, and custom webhook handlers running with continuous monitoring.',
    icon: Send,
  },
];

export default async function BotHostingPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  // Fetch bot hosting products from API/DB
  const products = await fetchProducts('bot_hosting');

  const allPlans = products.flatMap((p) =>
    (p.plans || []).map((plan) => ({
      ...plan,
      productName: p.name,
      productDescription: p.description,
    }))
  );

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-purple-500 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-36 pb-20 px-6 max-w-7xl mx-auto overflow-hidden text-center">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] opacity-35 pointer-events-none -z-10">
          <GradientMeshOrb />
        </div>

        <div className="space-y-6 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-pink-500/10 text-pink-300 border border-pink-500/20">
            <Bot className="h-3.5 w-3.5" /> Always-Online Bot Runtime Engine
          </span>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            High-Uptime <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-500">24/7 Bot Hosting</span>
          </h1>

          <p className="text-text-muted text-base leading-relaxed">
            Host your Discord, Telegram, and WhatsApp bots with zero downtime. Built-in process supervisor automatically recovers crashed bot processes in milliseconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href={`${dashboardUrl}/services`}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-glow-violet transition-all flex items-center gap-2"
            >
              Deploy Your Bot Now <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/pricing"
              className="px-8 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all"
            >
              View All Specs
            </Link>
          </div>
        </div>
      </section>

      {/* Bot Types Supported */}
      <section className="py-16 px-6 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="grid md:grid-cols-3 gap-8">
          {BOT_TYPES.map((type, idx) => (
            <div key={idx} className="bg-[#080918] border border-white/10 rounded-3xl p-8 space-y-4 hover:border-pink-500/40 transition-all">
              <type.icon className="h-8 w-8 text-pink-400" />
              <h3 className="font-extrabold text-lg text-white">{type.title}</h3>
              <p className="text-xs text-text-muted leading-relaxed">{type.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bot Pricing Grid (Fetched Live from DB) */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="text-center space-y-3 mb-14">
          <span className="text-xs font-mono uppercase font-bold text-pink-400 tracking-widest">Live Database Catalog</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Bot Hosting Plans &amp; Runtimes</h2>
        </div>

        {allPlans.length === 0 ? (
          <div className="bg-[#080918] border border-white/10 rounded-3xl p-12 text-center space-y-3 max-w-xl mx-auto">
            <Package className="h-10 w-10 text-pink-400 mx-auto" />
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
                  className="bg-[#080918] border border-white/10 hover:border-pink-500/40 rounded-3xl p-8 flex flex-col justify-between transition-all"
                >
                  <div className="space-y-4">
                    <span className="text-[11px] font-mono uppercase text-pink-400 font-bold block mb-1">
                      {plan.productName}
                    </span>
                    <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>

                    <div className="flex items-baseline gap-1 pt-2">
                      <span className="text-4xl font-black text-white">{formattedPrice}</span>
                      <span className="text-xs font-mono text-text-muted">/{plan.billingType.replace('_', ' ')}</span>
                    </div>

                    <ul className="space-y-3 pt-6 border-t border-white/[0.08] text-xs text-text-muted">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0" />
                        <span>Node.js 20 &amp; Python 3.11 Runtimes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0" />
                        <span>Real-Time Console WebSocket Logs</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0" />
                        <span>Process Supervisor Auto-Restart</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0" />
                        <span>Encrypted Secrets Vault</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-8">
                    <a
                      href={`${dashboardUrl}/services`}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow-glow-violet transition-all flex items-center justify-center gap-2"
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
