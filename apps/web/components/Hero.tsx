'use client';

import React from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Zap, Code, Bot, Globe, Monitor, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import HeroCanvas from './HeroCanvas';
import MagneticButton from './motion/MagneticButton';
import TiltCard from './motion/TiltCard';
import CountUp from './motion/CountUp';

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
  { icon: Monitor, label: 'VPS Node Engine' },
];

const STATS = [
  { value: '99.99%', label: 'Platform Uptime' },
  { value: '<30s', label: 'Deploy Velocity' },
  { value: '15+', label: 'One-Click Apps' },
];

const TERMINAL_LINES = [
  { text: 'stx deploy --git github.com/shanudha/express-api --branch main', prompt: true },
  { text: '> Building container image node:20-alpine...' },
  { text: '> Provisioning PostgreSQL database cluster & vault secrets...' },
  { text: 'Deployment complete (18.4s)', success: true },
  { text: 'https://express-api-production.shanutech.cloud', link: true },
];

const HEADLINE_LINE_1 = 'Autonomous Cloud Hosting for';
const HEADLINE_LINE_2 = 'Modern Engineers';

function HeadlineWords({ text, className, delayOffset = 0 }: { text: string; className?: string; delayOffset?: number }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: delayOffset + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
          {i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  );
}

function TerminalCard() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduceMotion = useReducedMotion();

  return (
    <TiltCard
      strength={4}
      spotlight={false}
      className="mt-14 w-full max-w-3xl rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-xl shadow-2xl overflow-hidden text-left"
    >
      <div ref={ref}>
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
          {TERMINAL_LINES.map((line, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: idx * 0.35 }}
              className={
                line.prompt
                  ? 'flex items-center gap-2 text-white'
                  : line.success
                    ? 'flex items-center gap-2 text-emerald-400 font-semibold pl-4'
                    : line.link
                      ? 'pl-4 text-teal-300 underline'
                      : 'text-white/60 pl-4'
              }
            >
              {line.prompt && <span className="text-purple-400">$</span>}
              {line.success && <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>{line.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </TiltCard>
  );
}

export default function Hero({ title, subtitle }: HeroProps) {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  return (
    <section className="relative flex flex-col items-center text-center pt-36 md:pt-44 pb-24 px-4 overflow-hidden font-sans">
      {/* 3D Backdrop Canvas (client-only, dynamically imported) */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none">
        <HeroCanvas />
        <div className="dot-pattern absolute inset-0 opacity-25" />
      </div>

      {/* Hero Announcement Badge */}
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-md mb-8 hover:border-purple-500/40 transition-colors cursor-default overflow-hidden"
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
        <span className="text-xs font-medium text-text-muted">
          ShanuTechX Engine Live • <span className="text-white font-bold">Autonomous Cloud Orchestration</span>
        </span>
      </motion.div>

      {/* Heading */}
      <div className="max-w-4xl">
        {title ? (
          <h1 className="text-display-lg text-white">
            <HeadlineWords text={title} delayOffset={0.15} />
          </h1>
        ) : (
          <h1 className="text-display-lg text-white">
            <HeadlineWords text={HEADLINE_LINE_1} delayOffset={0.15} />
            <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">
              <HeadlineWords text={HEADLINE_LINE_2} delayOffset={0.15 + HEADLINE_LINE_1.split(' ').length * 0.06} />
            </span>
          </h1>
        )}
      </div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="max-w-2xl mt-6 text-text-muted text-base md:text-lg leading-relaxed"
      >
        {subtitle || DEFAULT_SUBTITLE}
      </motion.p>

      {/* Badge Pills */}
      <div className="flex items-center gap-2 flex-wrap justify-center mt-8 mb-8">
        {BADGES.map((badge, i) => {
          const Icon = badge.icon;
          return (
            <motion.span
              key={badge.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.65 + i * 0.06 }}
              whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}
              className="glass rounded-full px-3.5 py-1.5 text-xs font-medium text-text-muted flex items-center gap-1.5 hover:text-white hover:border-white/20 transition-colors"
            >
              <Icon className="h-3.5 w-3.5 text-purple-400" />
              {badge.label}
            </motion.span>
          );
        })}
      </div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.95 }}
        className="mt-2 flex items-center justify-center"
      >
        <div className="relative">
          <span className="absolute -inset-2 rounded-full bg-brand-gradient opacity-40 blur-xl animate-glow-pulse pointer-events-none" />
          <MagneticButton
            href={`${dashboardUrl}/login`}
            className="btn-shimmer relative rounded-full px-8 py-3.5 font-extrabold text-white text-sm shadow-glow-violet flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-transform"
          >
            <span>Get Started</span>
            <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        </div>
      </motion.div>

      {/* Interactive Glass Terminal Preview */}
      <TerminalCard />

      {/* Stats Row */}
      <div className="mt-16 flex items-center gap-8 md:gap-16">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-teal-300">
              <CountUp value={stat.value} />
            </div>
            <div className="text-xs text-text-muted mt-1 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
