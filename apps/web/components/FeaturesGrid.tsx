'use client';

import React from 'react';
import Link from 'next/link';
import { Cpu, GitBranch, Bot, Database, Layers, ShieldCheck, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    badge: 'NVME COMPUTE & VPS',
    badgeColor: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.3)',
    badgeText: '#38bdf8',
    icon: <Cpu className="h-5 w-5 text-sky-400" />,
    title: 'Cloud VPS & Root SSH',
    desc: 'High-speed NVMe compute nodes with root SSH access, dedicated bandwidth, and multi-provider availability (Leaseweb, Linode, DigitalOcean & BreezeHost).',
    href: '/vps',
  },
  {
    badge: 'DEPLOY & GIT CI/CD',
    badgeColor: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.3)',
    badgeText: '#34d399',
    icon: <GitBranch className="h-5 w-5 text-emerald-400" />,
    title: 'App & Repo Hosting',
    desc: 'Instant automated deployment from GitHub, GitLab, or ZIP packages for Node.js, Python, Go, and static web apps with free automatic SSL & custom domains.',
    href: '/deployments',
  },
  {
    badge: 'DAEMON ORCHESTRATION',
    badgeColor: 'rgba(168, 85, 247, 0.15)',
    badgeBorder: 'rgba(168, 85, 247, 0.3)',
    badgeText: '#c084fc',
    icon: <Bot className="h-5 w-5 text-purple-400" />,
    title: '24/7 Bot Hosting',
    desc: 'Dedicated 24/7 background daemon hosting for Discord.js, Telegram Bot API, and Baileys WhatsApp messaging gateways with automated process supervision.',
    href: '/bots',
  },
  {
    badge: 'MANAGED CLUSTERS',
    badgeColor: 'rgba(59, 130, 246, 0.15)',
    badgeBorder: 'rgba(59, 130, 246, 0.3)',
    badgeText: '#60a5fa',
    icon: <Database className="h-5 w-5 text-blue-400" />,
    title: 'Managed Databases',
    desc: 'One-click automated database cluster provisioning for PostgreSQL 16, MySQL 8, Redis, and MongoDB with automated Cloudflare R2 backup storage.',
    href: '/databases',
  },
  {
    badge: 'TEMPLATE STORE',
    badgeColor: 'rgba(236, 72, 153, 0.15)',
    badgeBorder: 'rgba(236, 72, 153, 0.3)',
    badgeText: '#f472b6',
    icon: <Layers className="h-5 w-5 text-pink-400" />,
    title: '1-Click Catalog',
    desc: 'Instant one-click deployment of WordPress, N8n automation, Plausible analytics, and 15+ production Docker Compose application stacks.',
    href: '/catalog',
  },
  {
    badge: 'AUTONOMOUS ENGINE',
    badgeColor: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
    badgeText: '#fbbf24',
    icon: <ShieldCheck className="h-5 w-5 text-amber-400" />,
    title: 'Instant Provisioning & Vault',
    desc: 'Automated container creation, live WebSockets SSH terminal, AES-256-GCM secrets vault, and instant credential delivery upon payment approval.',
    href: `${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001'}/dashboard`,
  },
];

export default function FeaturesGrid() {
  return (
    <section
      style={{
        maxWidth: '1160px',
        margin: '40px auto',
        padding: '0 24px',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: '44px' }}>
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            margin: '0 0 12px 0',
          }}
        >
          Why Choose ShanuTechX Platform?
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: '#94a3b8',
            maxWidth: '650px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Autonomous enterprise cloud hosting, high-speed NVMe compute, container orchestration &amp; 24/7 managed infrastructure.
        </p>
      </div>

      {/* 6 Feature Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {FEATURES.map((feat, idx) => (
          <Link
            key={idx}
            href={feat.href}
            style={{
              textDecoration: 'none',
              background: 'rgba(11, 11, 15, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '28px 24px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            className="hover:scale-[1.02] hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-2xl group"
          >
            <div>
              {/* Capsule Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  background: feat.badgeColor,
                  border: `1px solid ${feat.badgeBorder}`,
                  fontSize: '10px',
                  fontWeight: 800,
                  color: feat.badgeText,
                  letterSpacing: '0.08em',
                  marginBottom: '18px',
                }}
              >
                {feat.badge}
              </div>

              {/* Icon & Title Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  {feat.icon}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  {feat.title}
                </h3>
              </div>

              {/* Description */}
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                {feat.desc}
              </p>
            </div>

            {/* Action Link Footer */}
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: feat.badgeText }}>
              <span>Explore Platform</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
