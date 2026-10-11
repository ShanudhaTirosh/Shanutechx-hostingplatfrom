'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCommit,
  Layers,
  ShieldCheck,
  Globe2,
  Zap,
  Activity,
  CheckCircle2,
  Terminal,
  Server,
  Radio,
  Cpu,
  Clock,
  ExternalLink,
} from 'lucide-react';
import BorderBeam from './BorderBeam';

interface PipelineStage {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  stepNumber: number;
  badge: string;
  color: string;
  glowColor: string;
  details: {
    title: string;
    description: string;
    specs: { label: string; value: string; icon: React.ElementType }[];
  };
}

const STAGES: PipelineStage[] = [
  {
    id: 'git',
    stepNumber: 1,
    name: 'Git Webhook & Code',
    subtitle: 'Zero-Config Ingestion',
    icon: GitCommit,
    badge: 'STAGE 01',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    details: {
      title: 'Autonomous Ingestion & Webhooks',
      description:
        'Instant webhook dispatch on git push with secure payload verification (deployWebhookSecret). Automatic branch filtering and monorepo workspace detection instantly triggers isolated pipelines.',
      specs: [
        { label: 'Dispatch Latency', value: '< 18ms', icon: Zap },
        { label: 'Security Handshake', value: 'OAuth2 HMAC-SHA256', icon: ShieldCheck },
        { label: 'Supported Providers', value: 'GitHub, GitLab, Custom', icon: GitCommit },
      ],
    },
  },
  {
    id: 'builder',
    stepNumber: 2,
    name: 'Isolated Build Engine',
    subtitle: 'Ephemeral Docker OCI',
    icon: Layers,
    badge: 'STAGE 02',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    details: {
      title: 'High-Throughput Container Fabric',
      description:
        'Zero-downtime multi-stage container compilation within sandboxed cgroups. Automatic layer caching with instant OCI image tagging and real-time vulnerability scan mitigation.',
      specs: [
        { label: 'Cold Start Time', value: '84ms avg', icon: Clock },
        { label: 'Isolation Layer', value: 'Kata / gVisor cgroups', icon: Cpu },
        { label: 'Packaging', value: 'OCI Container Image', icon: Layers },
      ],
    },
  },
  {
    id: 'vault',
    stepNumber: 3,
    name: 'Secrets & Control Plane',
    subtitle: 'AES-256 BullMQ Engine',
    icon: ShieldCheck,
    badge: 'STAGE 03',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    details: {
      title: 'Encrypted Vault & Orchestration',
      description:
        'Environment variables and sensitive tokens encrypted via hardware AES-256-GCM. Dedicated BullMQ distributed worker cluster monitors automated rolling updates and container health.',
      specs: [
        { label: 'Encryption Standard', value: 'AES-256-GCM Hardware', icon: ShieldCheck },
        { label: 'Queue Engine', value: 'Redis BullMQ Cluster', icon: Server },
        { label: 'Heartbeat Health', value: 'Every 3s Active Probe', icon: Activity },
      ],
    },
  },
  {
    id: 'edge',
    stepNumber: 4,
    name: 'Global VPS Fleet & Edge DNS',
    subtitle: 'Anycast Auto-DNS Mesh',
    icon: Globe2,
    badge: 'STAGE 04',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    details: {
      title: 'Global High-Availability Anycast',
      description:
        'Multi-region reverse proxy fabric automatically exposes public ports, provisions automated TLS certificates, and syncs Cloudflare DNS records for sub-15ms edge routing.',
      specs: [
        { label: 'Global Edge RTT', value: '14.2ms avg', icon: Zap },
        { label: 'Auto-DNS Sync', value: 'Cloudflare v4 API', icon: Radio },
        { label: 'TLS Handshake', value: '0-RTT TLS 1.3', icon: ShieldCheck },
      ],
    },
  },
];

const EDGE_REGIONS = [
  { city: 'Tokyo (NRT)', latency: '18ms', status: 'Optimal' },
  { city: 'Frankfurt (FRA)', latency: '21ms', status: 'Optimal' },
  { city: 'US-East (IAD)', latency: '12ms', status: 'Optimal' },
  { city: 'Singapore (SIN)', latency: '15ms', status: 'Optimal' },
];

export default function TelemetryArchitectureFlow() {
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [liveThroughput, setLiveThroughput] = useState<number>(43120);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveThroughput((prev) => prev + Math.floor(Math.random() * 81 - 40));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const currentStage = STAGES[activeStageIndex];

  return (
    <section className="relative w-full py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      {/* Ambient Backdrop Radial Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-60"
      >
        <div className="h-[450px] w-[800px] rounded-full bg-gradient-to-tr from-purple-700/20 via-sky-500/15 to-emerald-500/15 blur-[140px]" />
      </div>

      {/* Header section with telemetry radar badge */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 backdrop-blur-md text-xs font-semibold text-sky-400 mb-4 shadow-lg shadow-sky-500/5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
          AUTONOMOUS CLOUD ORCHESTRATION PIPELINE
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
          Real-Time Delivery &{' '}
          <span className="bg-gradient-to-r from-sky-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            Container Mesh
          </span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
          From developer commit to distributed Anycast VPS compute. Watch how ShanuTechX automates
          zero-downtime builds, secrets isolation, and global edge routing.
        </p>
      </div>

      {/* Live Telemetry Ticker HUD */}
      <div className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-5xl mx-auto">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl text-center shadow-lg shadow-black/40">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Edge Throughput
          </div>
          <div className="text-2xl font-mono font-bold text-white tracking-tight">
            {liveThroughput.toLocaleString()} <span className="text-xs text-slate-400 font-normal">req/s</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl text-center shadow-lg shadow-black/40">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Container Cold-Start
          </div>
          <div className="text-2xl font-mono font-bold text-white tracking-tight">
            84 <span className="text-xs text-slate-400 font-normal">ms</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl text-center shadow-lg shadow-black/40">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-sky-400" /> Avg Anycast RTT
          </div>
          <div className="text-2xl font-mono font-bold text-white tracking-tight">
            14.2 <span className="text-xs text-slate-400 font-normal">ms</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl text-center shadow-lg shadow-black/40">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Core Uptime SLA
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 tracking-tight">
            99.99<span className="text-xs text-emerald-500 font-normal">%</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Motion Architecture Board */}
      <div className="relative max-w-5xl mx-auto rounded-3xl bg-[#090b16]/90 border border-slate-800/90 backdrop-blur-2xl p-6 sm:p-9 shadow-2xl overflow-hidden">
        <BorderBeam size={220} duration={9} borderRadius={24} colorFrom="#a855f7" colorTo="#38bdf8" />

        {/* 4 Interactive Stage Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative z-10 mb-8">
          {STAGES.map((stage, idx) => {
            const IconComponent = stage.icon;
            const isSelected = idx === activeStageIndex;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStageIndex(idx)}
                className={`group relative p-4 rounded-2xl text-left transition-all duration-200 outline-none cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900/95 border-2 shadow-xl'
                    : 'bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/80'
                }`}
                style={{
                  borderColor: isSelected ? stage.color : undefined,
                  boxShadow: isSelected ? `0 10px 25px -6px ${stage.glowColor}` : undefined,
                }}
              >
                {/* Top Badge & Icon */}
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${stage.color}15`,
                      color: stage.color,
                      border: `1px solid ${stage.color}35`,
                    }}
                  >
                    {stage.badge}
                  </span>
                  <div
                    className="p-1.5 rounded-lg transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: isSelected ? `${stage.color}25` : 'rgba(255,255,255,0.04)',
                      color: stage.color,
                    }}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-sm font-bold text-white mb-0.5 leading-snug">{stage.name}</div>
                <div className="text-[11px] text-slate-400">{stage.subtitle}</div>
              </button>
            );
          })}
        </div>

        {/* Dynamic PCB Circuit Flow Trace */}
        <div className="relative h-10 w-full hidden sm:flex items-center justify-between px-10 mb-8 select-none">
          {/* Base Inactive Track */}
          <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800/80 rounded-full" />

          {/* Active Highlight Track */}
          <motion.div
            className="absolute left-10 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
            style={{
              background: `linear-gradient(90deg, #38bdf8, ${currentStage.color})`,
              boxShadow: `0 0 8px ${currentStage.color}`,
            }}
            animate={{
              width: `${(activeStageIndex / (STAGES.length - 1)) * 100}%`,
            }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          />

          {/* 4 Stage Nexus Nodes */}
          {STAGES.map((s, idx) => {
            const isCompletedOrActive = idx <= activeStageIndex;
            const isCurrent = idx === activeStageIndex;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStageIndex(idx)}
                className="relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-300 cursor-pointer"
                style={{
                  backgroundColor: isCurrent ? s.color : '#090b16',
                  borderColor: isCompletedOrActive ? s.color : '#334155',
                  color: isCurrent ? '#000000' : isCompletedOrActive ? s.color : '#64748b',
                  boxShadow: isCurrent ? `0 0 14px ${s.color}` : 'none',
                }}
              >
                {s.stepNumber}
                {isCurrent && (
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-60 pointer-events-none"
                    style={{ backgroundColor: s.color }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Stage Deep-Dive Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-7 p-6 sm:p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative"
          >
            {/* Left Column: Deep Dive Specs */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentStage.color }}
                />
                <span
                  className="text-[11px] font-mono font-bold tracking-wider uppercase"
                  style={{ color: currentStage.color }}
                >
                  {currentStage.badge} Architectural Detail
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2.5">
                {currentStage.details.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
                {currentStage.details.description}
              </p>

              {/* 3 Specs Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {currentStage.details.specs.map((spec, i) => {
                  const SpecIcon = spec.icon;
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                        <SpecIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{spec.label}</span>
                      </div>
                      <div className="text-xs font-semibold font-mono text-white">
                        {spec.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Live Regional Latency Radar or Command Terminal */}
            <div className="lg:col-span-5 flex flex-col justify-center bg-slate-950/90 rounded-xl p-4 sm:p-5 border border-slate-800/90 font-mono text-xs shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-slate-400 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] text-slate-300 font-sans font-medium">
                    stx-orchestrator-telemetry.sh
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE PING
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-slate-400 text-[11px]">
                  <span className="text-sky-400">$</span> stx route --verify-mesh --target=global
                </div>
                <div className="text-slate-500 text-[10px]">
                  Tracing autonomous Anycast distribution routes:
                </div>

                <div className="space-y-1.5 pt-1">
                  {EDGE_REGIONS.map((region, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1 px-2.5 rounded bg-slate-900/60 border border-slate-800/50 text-[11px]"
                    >
                      <span className="text-slate-200">{region.city}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-semibold">{region.latency}</span>
                        <span className="text-[10px] text-slate-400">{region.status}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-[10px] text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>All 4 compute regions synced via Cloudflare DNS</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
