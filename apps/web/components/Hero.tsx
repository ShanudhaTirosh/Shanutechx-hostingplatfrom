'use client';

import React from 'react';
import { Zap, Code, Bot, Globe, Monitor, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import GradientMeshOrb from './GradientMeshOrb';

interface HeroProps {
  title?: string;
  subtitle?: string;
}

const DEFAULT_SUBTITLE =
  'Deploy web apps, Node.js & Python backends, and Discord bots in seconds. Automatic SSL, custom subdomains, PostgreSQL/Redis, and real-time container telemetry.';

const BADGES = [
  { icon: Zap, label: 'Node.js 20' },
  { icon: Code, label: 'Python 3.12' },
  { icon: Bot, label: 'Discord & WA Bots' },
  { icon: Globe, label: 'Webmail & Web Apps' },
  { icon: Monitor, label: 'VPS Cockpit' },
];

const STATS = [
  { value: '99.99%', label: 'Platform Uptime' },
  { value: '<30s', label: 'Deploy Velocity' },
  { value: '15+', label: 'One-Click Apps' },
];

export default function Hero({ title, subtitle }: HeroProps) {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  return (
    <section className="relative flex flex-col items-center text-center pt-36 md:pt-44 pb-24 px-4 overflow-hidden font-sans">
      {/* Dynamic Background Mesh Orb */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="absolute top-8 left-1/2 -translate-x-1/2 scale-125 sm:scale-150 md:scale-175 opacity-90 sm:opacity-95">
          <GradientMeshOrb size={700} glowColor="rgba(139,92,246,0.75)" />
        </div>
        <div className="dot-pattern absolute inset-0 opacity-25" />
      </div>

      {/* Hero Announcement Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-md mb-8 animate-fade-in hover:border-purple-500/40 transition-all cursor-default">
        <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
        <span className="text-xs font-medium text-text-muted">
          ShanuTechX Engine Live • <span className="text-white font-bold">Autonomous Cloud Orchestration</span>
        </span>
      </div>

      {/* Heading */}
      <div className="animate-slide-up max-w-4xl">
        {title ? (
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
            {title}
          </h1>
        ) : (
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.06] text-white">
            Autonomous Cloud Hosting for
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300 block mt-1">Modern Engineers</span>
          </h1>
        )}
      </div>

      {/* Subtitle */}
      <p className="max-w-2xl mt-6 text-text-muted text-base md:text-lg leading-relaxed animate-slide-up delay-100">
        {subtitle || DEFAULT_SUBTITLE}
      </p>

      {/* Badge Pills */}
      <div className="flex items-center gap-2 flex-wrap justify-center mt-8 mb-8 animate-fade-in">
        {BADGES.map((badge) => {
          const Icon = badge.icon;
          return (
            <span
              key={badge.label}
              className="glass rounded-full px-3.5 py-1.5 text-xs font-medium text-text-muted flex items-center gap-1.5 hover:text-white hover:border-white/20 transition-all"
            >
              <Icon className="h-3.5 w-3.5 text-purple-400" />
              {badge.label}
            </span>
          );
        })}
      </div>

      {/* CTA Button */}
      <div className="mt-2 flex items-center justify-center animate-slide-up delay-200">
        <a
          href={`${dashboardUrl}/login`}
          className="btn-shimmer rounded-full px-8 py-3.5 font-extrabold text-white text-sm shadow-glow-violet flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-all"
        >
          <span>Get Started</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* Interactive Glass Terminal Preview */}
      <div className="mt-14 w-full max-w-3xl rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-xl shadow-2xl overflow-hidden text-left animate-slide-up delay-300">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs font-mono text-text-muted">shanutechx ~ container-daemon</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-teal-400">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            Active
          </div>
        </div>

        {/* Terminal Code Body */}
        <div className="p-5 font-mono text-xs space-y-2.5 text-text-muted leading-relaxed">
          <div className="flex items-center gap-2 text-white">
            <span className="text-purple-400">$</span>
            <span>stx deploy --git github.com/shanudha/express-api --branch main</span>
          </div>
          <div className="text-white/60 pl-4">➜ Building container image node:20-alpine...</div>
          <div className="text-white/60 pl-4">➜ Provisioning PostgreSQL database cluster &amp; vault secrets...</div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold pl-4">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Deployment complete (18.4s)</span>
          </div>
          <div className="pl-4 text-teal-300 underline">
            https://express-api-production.shanutech.cloud
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mt-16 flex items-center gap-8 md:gap-16 animate-fade-in delay-400">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-teal-300">{stat.value}</div>
            <div className="text-xs text-text-muted mt-1 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
