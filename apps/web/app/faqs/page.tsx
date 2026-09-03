'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Server,
  Code2,
  Bot,
  Database,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export default function FaqsPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  const ALL_FAQS = [
    // Category 1: VPS
    {
      category: 'vps',
      q: 'How fast are Cloud VPS instances provisioned after payment approval?',
      a: 'Cloud VPS compute instances are provisioned automatically within 15 seconds after payment approval. Your dedicated IPv4, SSH port, and root credentials appear immediately in your Control Panel dashboard.',
    },
    {
      category: 'vps',
      q: 'What operating systems are supported on Cloud VPS?',
      a: 'We support Ubuntu 24.04 LTS, Ubuntu 22.04 LTS, Debian 12, AlmaLinux 9, Rocky Linux 9, Alpine Linux, and custom ISO uploads.',
    },
    {
      category: 'vps',
      q: 'Do I get full root access and dedicated IPv4 address?',
      a: 'Yes. Every Cloud VPS allocation includes full root access via SSH, dedicated IPv4 address, customizable rDNS, and raw kernel access.',
    },
    {
      category: 'vps',
      q: 'Can I reinstall or format my VPS operating system at any time?',
      a: 'Yes. You can trigger instant OS re-installs, root password resets, and reboot cycles directly from the Control Panel or Web Terminal.',
    },

    // Category 2: App Hosting
    {
      category: 'app',
      q: 'How does code deployment from GitHub or ZIP archives work?',
      a: 'Connect your GitHub repository or upload a compressed .zip archive. Our edge build engine automatically compiles your code, detects package dependencies, provisions Docker containers, and attaches custom Let\'s Encrypt SSL certificates.',
    },
    {
      category: 'app',
      q: 'Which web application frameworks and runtimes are supported?',
      a: 'We support Node.js (Express, Next.js, Remix, NestJS), Python (Django, FastAPI, Flask), Go, Rust, static HTML/Tailwind frontends, and custom Dockerfile / Docker Compose setups.',
    },
    {
      category: 'app',
      q: 'Can I point my own custom domain to hosted web applications?',
      a: 'Yes! Add your custom domain (e.g. app.yourdomain.com) in your Control Panel, point CNAME/A records to our Anycast gateway, and automated SSL certificates will be issued instantly.',
    },

    // Category 3: Bot Hosting
    {
      category: 'bot',
      q: 'Are Discord, WhatsApp, and Telegram bots hosted 24/7 without sleeping?',
      a: 'Yes! Bot hosting instances run continuous daemons with process supervisors (PM2 / Docker healthchecks). If a bot crashes due to network disconnects, it is automatically rebooted in milliseconds.',
    },
    {
      category: 'bot',
      q: 'How do WhatsApp Baileys bots keep QR code session state persistent?',
      a: 'WhatsApp Baileys bot instances utilize persistent volume mounts. Your QR code session credentials remain safely saved across container reboots so you never need to re-scan.',
    },
    {
      category: 'bot',
      q: 'Where do I safely store DISCORD_TOKEN and API keys?',
      a: 'All sensitive tokens and session credentials are saved into your project\'s Encrypted Secrets Vault (AES-256-GCM) and injected securely into your container environment at runtime.',
    },

    // Category 4: Databases
    {
      category: 'db',
      q: 'Which managed database engines are available?',
      a: 'We offer Managed PostgreSQL 16 (with pgvector), MySQL 8, Redis 7 (In-Memory Session Cache), and MongoDB 6 document databases.',
    },
    {
      category: 'db',
      q: 'How are database backups performed and stored?',
      a: 'Automated daily database snapshot backups are taken and encrypted in Cloudflare R2 object storage with 1-click snapshot restore points.',
    },

    // Category 5: Billing
    {
      category: 'billing',
      q: 'What payment methods are supported on ShanuTechX?',
      a: 'We accept Crypto / Binance USDT, Visa, Mastercard, ezCash, Genie, and Sri Lankan local bank transfer receipts uploaded with automated review workflows.',
    },
    {
      category: 'billing',
      q: 'What is your Uptime SLA Guarantee?',
      a: 'We provide a 99.9% network and compute Uptime SLA backed by multi-region redundant transit providers and real-time public telemetry monitoring.',
    },
  ];

  const categories = [
    { id: 'all', label: 'All Questions', icon: HelpCircle },
    { id: 'vps', label: 'Cloud VPS', icon: Server },
    { id: 'app', label: 'App Hosting', icon: Code2 },
    { id: 'bot', label: '24/7 Bots', icon: Bot },
    { id: 'db', label: 'Databases', icon: Database },
    { id: 'billing', label: 'Billing & Payments', icon: CreditCard },
  ];

  const filteredFaqs = ALL_FAQS.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch =
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  // Structured JSON-LD Schema for Google SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ALL_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      {/* Inject JSON-LD Schema for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 space-y-12 relative z-10 w-full">
        {/* Hero Section */}
        <div className="relative text-center space-y-6 pt-4">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.7} glowColor="rgba(124, 58, 237, 0.6)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <HelpCircle className="h-4 w-4 text-purple-400" />
              FREQUENTLY ASKED QUESTIONS
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
              ShanuTechX <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">Knowledge Base</span>
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Find instant answers to technical questions about VPS provisioning, GitHub app deployments, bot daemons, databases, and billing.
            </p>
          </div>

          {/* Search Box */}
          <div className="max-w-xl mx-auto relative pt-4">
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search FAQs (e.g. SSH, GitHub, Discord Token, USDT)..."
                className="w-full bg-[#080a1f]/90 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 shadow-2xl backdrop-blur-xl transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 text-xs font-mono text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 border-b border-white/10 pb-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 border ${
                  active
                    ? 'bg-purple-600/30 border-purple-500 text-white shadow-glow-violet'
                    : 'bg-[#08091c]/80 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* FAQs Accordion Cards */}
        <div className="space-y-4 max-w-4xl mx-auto">
          {filteredFaqs.length === 0 ? (
            <div className="bg-[#08091c] border border-white/10 rounded-3xl p-12 text-center space-y-3">
              <HelpCircle className="h-10 w-10 text-purple-400 mx-auto" />
              <p className="text-sm font-bold text-white">No matching questions found</p>
              <p className="text-xs text-slate-400">Try searching for keywords like "VPS", "Deploy", "Database", or "Payment".</p>
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  onClick={() => toggleFaq(idx)}
                  className="bg-[#08091c]/90 border border-white/10 hover:border-purple-500/40 rounded-2xl p-6 space-y-3 cursor-pointer transition-all shadow-xl backdrop-blur-md"
                >
                  <h3 className="text-base font-extrabold text-white flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-purple-400 shrink-0" />
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-purple-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
                    )}
                  </h3>

                  {isOpen && (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-2 border-t border-white/5 animate-fade-in">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Support CTA Footer Banner */}
        <div className="bg-[#080a1e] border border-white/10 rounded-3xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-white">Still have questions?</h3>
            <p className="text-xs text-slate-400">Our engineering team is ready to assist you on Discord or Support Tickets.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/help"
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-colors"
            >
              Deployment Manuals
            </Link>
            <a
              href={`${dashboardUrl}/tickets`}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-violet transition-all flex items-center gap-1.5"
            >
              Open Ticket <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
