'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import {
  LifeBuoy,
  BookOpen,
  Server,
  Code2,
  Bot,
  Database,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('app');
  const [openGuide, setOpenGuide] = useState<string | null>('app-step1');

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  const DEPLOYMENT_GUIDES = [
    {
      id: 'app',
      title: 'Web Apps & Repositories',
      icon: Code2,
      badge: 'Git & ZIP Deployment',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      steps: [
        {
          num: '01',
          title: 'Connect Repository or Upload ZIP Archive',
          desc: 'Log in to your ShanuTechX Control Panel, navigate to Deployments, and click "New Deployment". Select your GitHub repository or drag and drop a compressed .zip package of your project.',
        },
        {
          num: '02',
          title: 'Configure Build Commands & Environment Variables',
          desc: 'Select your runtime (Node.js, Python, Go, Dockerfile). Specify install scripts (npm install, pip install -r requirements.txt) and inject your environment variables into the Encrypted Vault.',
        },
        {
          num: '03',
          title: 'Instant Container Spin-Up & Custom SSL Domain',
          desc: 'Click Deploy. Our edge orchestration engine compiles your code, launches isolated Docker containers, and automatically issues Let\'s Encrypt SSL certificates for your custom domain.',
        },
      ],
    },
    {
      id: 'bot',
      title: '24/7 Discord & WhatsApp Bots',
      icon: Bot,
      badge: 'Always-Online Daemons',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10 border-pink-500/20',
      steps: [
        {
          num: '01',
          title: 'Prepare Bot Tokens & Session Files',
          desc: 'Ensure your bot token or WhatsApp session directory is configured. Add sensitive DISCORD_TOKEN, TELEGRAM_BOT_TOKEN, or session keys to the Secrets Vault.',
        },
        {
          num: '02',
          title: 'Set Process Supervisor & Auto-Restart Policy',
          desc: 'Select the Bot Hosting template. ShanuTechX configures PM2 / Docker healthcheck monitors to restart your bot in milliseconds if it crashes due to Discord API disconnects.',
        },
        {
          num: '03',
          title: 'Stream Live WebSocket Logs & Baileys QR Code',
          desc: 'Access your bot console in real time via WebSockets. For WhatsApp Baileys bots, scan the generated terminal QR code directly from the dashboard web terminal.',
        },
      ],
    },
    {
      id: 'vps',
      title: 'High-Performance Cloud VPS',
      icon: Server,
      badge: 'Root SSH Access',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
      steps: [
        {
          num: '01',
          title: 'Select Region & Compute Allocation',
          desc: 'Choose your VPS host node region (Ashburn US-East, Frankfurt EU-Central, Singapore AP-South, Tokyo AP-Northeast). Select NVMe RAM and vCPU core allocations.',
        },
        {
          num: '02',
          title: 'Receive Instant IPv4 & Root Password Credentials',
          desc: 'Upon approval, your VPS is provisioned in under 15 seconds. Obtain your dedicated IPv4 address, root username, and temporary password from your Dashboard Services tab.',
        },
        {
          num: '03',
          title: 'Connect via Interactive xterm.js Web SSH Terminal',
          desc: 'Use the built-in browser Web Terminal or open your local terminal to run "ssh root@your-vps-ip". Configure UFW firewall rules and install your software stack.',
        },
      ],
    },
    {
      id: 'db',
      title: 'Managed Database Clusters',
      icon: Database,
      badge: 'PostgreSQL, MySQL, Redis, MongoDB',
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10 border-teal-500/20',
      steps: [
        {
          num: '01',
          title: 'Choose Database Engine & Version',
          desc: 'Navigate to Managed Databases and select PostgreSQL 16, MySQL 8, Redis 7 (In-Memory Cache), or MongoDB 6.',
        },
        {
          num: '02',
          title: 'Obtain Secure Connection Strings & Internal URIs',
          desc: 'Retrieve your database host URI, port, database name, username, and encrypted password. Use internal node routing for zero-latency database queries.',
        },
        {
          num: '03',
          title: 'Automated Snapshot Backups & R2 Vault',
          desc: 'Enable automated daily backups stored securely in Cloudflare R2 object storage with 1-click snapshot restore capabilities.',
        },
      ],
    },
    {
      id: 'catalog',
      title: '1-Click App Catalog Templates',
      icon: LayoutGrid,
      badge: 'WordPress, N8n, Plausible & 15+ Apps',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      steps: [
        {
          num: '01',
          title: 'Select Pre-configured Docker Compose Template',
          desc: 'Browse the ShanuTechX Catalog for ready-to-run software templates including WordPress + MySQL, N8n automation, Plausible analytics, and Nextcloud.',
        },
        {
          num: '02',
          title: 'Set Site Name & Initial Admin Credentials',
          desc: 'Fill out the initial setup parameters (admin email, site domain, database passwords). Our system automatically builds the Docker Compose stack.',
        },
        {
          num: '03',
          title: 'Instant Launch & Domain SSL Certificate',
          desc: 'Your application is published in less than 30 seconds with automated reverse proxy routing and SSL certificates pre-installed.',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 space-y-16 relative z-10">
        {/* Header Hero Section */}
        <div className="relative text-center space-y-6 pt-4">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.6} glowColor="rgba(124, 58, 237, 0.5)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <LifeBuoy className="h-4 w-4 text-purple-400" />
              DOCUMENTATION &amp; SUPPORT HUB
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
              Deployment Guides &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">Support Center</span>
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Comprehensive step-by-step instructions for deploying web apps, VPS servers, 24/7 bot daemons, and database clusters — paired with 24/7 ticket support.
            </p>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-white/10 pb-8">
          {DEPLOYMENT_GUIDES.map((g) => {
            const Icon = g.icon;
            const active = selectedCategory === g.id;
            return (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedCategory(g.id);
                  setOpenGuide(`${g.id}-step1`);
                }}
                className={`px-5 py-3 rounded-2xl text-xs font-bold font-mono transition-all flex items-center gap-2.5 border ${
                  active
                    ? 'bg-purple-600/25 border-purple-500 text-white shadow-glow-violet scale-105'
                    : 'bg-[#08091c] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon className={`h-4 w-4 ${g.color}`} />
                <span>{g.title}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Category Step-by-Step Guide Section */}
        {DEPLOYMENT_GUIDES.filter((g) => g.id === selectedCategory).map((guide) => (
          <div key={guide.id} className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#08091c] border border-white/10 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${guide.bgColor}`}>
                  <guide.icon className={`h-6 w-6 ${guide.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">{guide.title} Deployment Manual</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{guide.badge}</p>
                </div>
              </div>

              <a
                href={`${dashboardUrl}/services`}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-glow-violet transition-all flex items-center gap-2 shrink-0"
              >
                Open Control Panel <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Steps Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              {guide.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-[#080a1e] border border-white/10 rounded-3xl p-8 space-y-4 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-lg relative overflow-hidden group"
                >
                  <div className="space-y-3">
                    <span className="text-3xl font-black text-purple-400 font-mono opacity-80 group-hover:scale-110 transition-transform block">
                      {step.num}
                    </span>
                    <h3 className="text-base font-extrabold text-white">{step.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-[11px] font-mono text-emerald-400 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Automated Verification
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Merged Support & Tickets Section */}
        <div className="bg-gradient-to-r from-[#0a0c24] via-[#090b20] to-[#0a0c24] border border-white/10 rounded-3xl p-8 sm:p-12 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase font-bold text-purple-400 tracking-widest block">
              Direct Support &amp; Ticketing Hub
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Need Direct Technical Assistance or Custom Configs?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Our engineering team is available 24/7 to resolve infrastructure issues, assist with custom domain SSL configurations, or approve payment reviews.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            <a
              href={`${dashboardUrl}/tickets`}
              className="bg-[#0f1130] border border-purple-500/30 hover:border-purple-500 p-5 rounded-2xl space-y-2 transition-all group"
            >
              <div className="flex items-center justify-between">
                <MessageSquare className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-extrabold text-sm text-white">Open Support Ticket</h3>
              <p className="text-[11px] text-slate-400">Create a priority ticket in your Client Control Panel.</p>
            </a>

            <a
              href="https://discord.gg/shanutechx"
              target="_blank"
              rel="noreferrer"
              className="bg-[#0f1130] border border-indigo-500/30 hover:border-indigo-500 p-5 rounded-2xl space-y-2 transition-all group"
            >
              <div className="flex items-center justify-between">
                <Bot className="h-5 w-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-extrabold text-sm text-white">24/7 Discord Community</h3>
              <p className="text-[11px] text-slate-400">Join our Discord server for instant staff assistance.</p>
            </a>

            <a
              href="https://wa.me/94771234567"
              target="_blank"
              rel="noreferrer"
              className="bg-[#0f1130] border border-emerald-500/30 hover:border-emerald-500 p-5 rounded-2xl space-y-2 transition-all group"
            >
              <div className="flex items-center justify-between">
                <Zap className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-extrabold text-sm text-white">WhatsApp Live Chat</h3>
              <p className="text-[11px] text-slate-400">Instant messaging hotline with support engineers.</p>
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
