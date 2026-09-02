import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { HelpCircle, BookOpen, Terminal, Shield, Zap, Server, LifeBuoy, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Help Center & Guides | ShanuTechX Cloud',
  description: 'Find guides, tutorials, and support articles for deploying VPS, Web Apps, Discord Bots, and Managed Databases.',
};

export default function HelpPage() {
  const categories = [
    {
      icon: Server,
      title: 'Cloud VPS Setup',
      desc: 'Learn how to SSH into your root VPS node, configure UFW firewalls, and manage disk snapshots.',
      href: '/vps',
    },
    {
      icon: Terminal,
      title: 'Web App & Git Deployment',
      desc: 'Connect GitHub webhooks or upload ZIP packages to automatically build and deploy Node.js and Python apps.',
      href: '/app-hosting',
    },
    {
      icon: Zap,
      title: '24/7 Bot Hosting',
      desc: 'Deploy Discord, Telegram, and WhatsApp bots with automatic restart policies and token vault encryption.',
      href: '/bot-hosting',
    },
    {
      icon: Shield,
      title: 'Managed Databases',
      desc: 'Provision PostgreSQL, MySQL, Redis, and MongoDB clusters with automated daily R2 backups.',
      href: '/databases',
    },
  ];

  return (
    <div className="min-h-screen bg-[#030014] text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#7c3aed26_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-16 relative z-10 w-full">
        <div className="relative text-center space-y-6 pt-6">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.8} glowColor="rgba(124, 58, 237, 0.65)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <LifeBuoy className="h-3.5 w-3.5 text-purple-400" />
              KNOWLEDGE BASE
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              ShanuTechX <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">Help Center</span>
            </h1>
            <p className="text-base text-text-muted leading-relaxed max-w-2xl mx-auto">
              Everything you need to configure, deploy, and scale your cloud infrastructure.
            </p>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div
                key={idx}
                className="bg-[#090a1c]/90 border border-white/10 rounded-3xl p-6 space-y-4 flex flex-col justify-between hover:border-purple-500/50 transition-all shadow-xl backdrop-blur-md group"
              >
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-white">{cat.title}</h3>
                  <p className="text-xs text-text-muted leading-relaxed">{cat.desc}</p>
                </div>
                <Link
                  href={cat.href}
                  className="pt-4 text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors"
                >
                  Explore Guides <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
