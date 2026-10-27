'use client';

import { useState, useMemo } from 'react';
import Reveal from './motion/Reveal';
import TiltCard from './motion/TiltCard';

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  category: 'languages' | 'cicd' | 'infra' | 'management';
  badge: string;
  color: string;
  glow: string;
  icon: JSX.Element;
}

const FEATURES: FeatureItem[] = [
  {
    id: 'any-language',
    title: 'Any Language',
    description: 'Deploy static sites, APIs, backends, databases, and more with support for all major frameworks.',
    category: 'languages',
    badge: 'Polyglot Runtimes',
    color: 'from-purple-500 to-indigo-500',
    glow: 'rgba(124, 58, 237, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    id: 'any-use-case',
    title: 'Any Use-Case',
    description: 'Supports single servers, multi-server setups, and Docker Swarm clusters.',
    category: 'infra',
    badge: 'Multi-Node & Clusters',
    color: 'from-cyan-500 to-blue-500',
    glow: 'rgba(6, 182, 212, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    id: 'any-service',
    title: 'Any Service',
    description: 'Deploy any Docker-compatible service, plus a wide range of one-click options.',
    category: 'languages',
    badge: 'Docker & 1-Click Catalog',
    color: 'from-teal-400 to-emerald-500',
    glow: 'rgba(20, 184, 166, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'push-to-deploy',
    title: 'Push to Deploy',
    description: 'Git integration with GitHub, GitLab, Bitbucket, Gitea, and other platforms.',
    category: 'cicd',
    badge: 'Automatic Git Triggers',
    color: 'from-violet-500 to-purple-600',
    glow: 'rgba(139, 92, 246, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
  },
  {
    id: 'free-ssl-certificates',
    title: 'Free SSL certificates',
    description: "Automatically sets up and renews Let's Encrypt SSL certificates for custom domains.",
    category: 'infra',
    badge: 'Automated TLS Edge',
    color: 'from-emerald-400 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: 'no-vendor-lock-in',
    title: 'No Vendor Lock-In',
    description: 'Your data and settings stay on your servers for full control and easy portability.',
    category: 'infra',
    badge: '100% Data Sovereignty',
    color: 'from-amber-400 to-orange-500',
    glow: 'rgba(245, 158, 11, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    id: 'automatic-db-backups',
    title: 'Automatic DB Backups',
    description: 'Back up data to S3-compatible storage and restore it with one click if needed.',
    category: 'infra',
    badge: 'S3 Object Backup',
    color: 'from-blue-500 to-indigo-600',
    glow: 'rgba(59, 130, 246, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    description: 'Integrate with CI/CD tools like GitHub Actions, GitLab CI, or Bitbucket Pipelines.',
    category: 'cicd',
    badge: 'CI/CD Integrations',
    color: 'from-sky-400 to-blue-600',
    glow: 'rgba(56, 189, 248, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: 'powerful-api',
    title: 'Powerful API',
    description: 'Automate deployments, manage resources, and integrate with your existing tools easily.',
    category: 'management',
    badge: 'REST API & SDK',
    color: 'from-fuchsia-500 to-pink-600',
    glow: 'rgba(217, 70, 239, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="15" x2="23" y2="15" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="15" x2="4" y2="15" />
      </svg>
    ),
  },
  {
    id: 'real-time-terminal',
    title: 'Real-Time Terminal',
    description: 'Run server commands directly from your browser in real-time.',
    category: 'management',
    badge: 'Browser Shell & Exec',
    color: 'from-green-400 to-emerald-600',
    glow: 'rgba(74, 222, 128, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    id: 'collaborative',
    title: 'Collaborative',
    description: 'Share projects with your team, control roles, and manage permissions.',
    category: 'management',
    badge: 'Team Roles & RBAC',
    color: 'from-purple-400 to-pink-500',
    glow: 'rgba(192, 132, 252, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'pull-request-deployments',
    title: 'Pull Request Deployments',
    description: 'Deploy commits and pull requests separately for quick reviews and faster teamwork.',
    category: 'cicd',
    badge: 'Preview Environments',
    color: 'from-orange-400 to-rose-500',
    glow: 'rgba(251, 146, 60, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
        <line x1="6" y1="9" x2="6" y2="21" />
      </svg>
    ),
  },
  {
    id: 'server-automations',
    title: 'Server Automations',
    description: 'Handles server setup tasks automatically after connection, saving you time.',
    category: 'infra',
    badge: 'Zero-Touch Provisioning',
    color: 'from-indigo-400 to-violet-600',
    glow: 'rgba(129, 140, 248, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    id: 'monitoring',
    title: 'Monitoring',
    description: 'Monitor deployments, servers, disk usage, and receive alerts for issues.',
    category: 'management',
    badge: 'Live Health & Alerts',
    color: 'from-rose-500 to-red-600',
    glow: 'rgba(244, 63, 94, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Capabilities' },
  { id: 'languages', label: 'Languages & Apps' },
  { id: 'cicd', label: 'CI/CD & Git' },
  { id: 'infra', label: 'Infrastructure & Security' },
  { id: 'management', label: 'Management & Observability' },
];

export default function Features() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredFeatures = useMemo(() => {
    return FEATURES.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.badge.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <section id="features" className="px-4 py-28 max-w-7xl mx-auto relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-accent-violet/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Header */}
      <Reveal className="text-center mb-16 max-w-3xl mx-auto">
        <span className="glass inline-block rounded-full px-4 py-1 text-xs text-accent-teal-bright font-medium mb-4 shadow-glow-teal">
          Complete Platform Capabilities
        </span>
        <h2 className="text-display">
          Everything you need to <span className="text-gradient">build &amp; scale</span>
        </h2>
        <p className="text-text-muted mt-4 text-base md:text-lg leading-relaxed">
          From single servers to multi-node clusters, full automated SSL, live terminal execution, and automatic backups — zero vendor lock-in.
        </p>

        {/* Search & Category Filter Controls */}
        <div className="mt-10 space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search platform capabilities..."
              className="w-full glass rounded-full px-5 py-3 pl-11 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent-violet/50 transition-all shadow-inner"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary p-0.5"
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                    active
                      ? 'bg-brand-gradient text-white shadow-glow-violet scale-105'
                      : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Grid of 14 Feature Cards */}
      {filteredFeatures.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl border border-white/[0.08] max-w-md mx-auto">
          <p className="text-text-muted text-sm">No capabilities match &quot;{searchQuery}&quot;</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-3 text-xs text-accent-teal-bright hover:underline font-medium"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFeatures.map((feat, idx) => (
            <Reveal key={feat.id} index={idx % 6}>
              <TiltCard
                strength={5}
                className="glass-card h-full rounded-2xl p-6 relative group overflow-hidden flex flex-col justify-between hover:border-white/20"
                style={{ '--glow-color': feat.glow } as React.CSSProperties}
              >
                {/* Subtle top light bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feat.color} opacity-80 group-hover:opacity-100 transition-opacity`} />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    {/* Icon */}
                    <div
                      className={`h-11 w-11 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
                      style={{ boxShadow: `0 4px 20px ${feat.glow}` }}
                    >
                      {feat.icon}
                    </div>
                    {/* Badge */}
                    <span className="text-[11px] font-semibold text-text-muted glass rounded-full px-2.5 py-0.5 border border-white/10">
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-white transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-text-muted text-xs leading-relaxed mb-6">
                    {feat.description}
                  </p>
                </div>

                {/* Action footer */}
                <div className="pt-4 border-t border-white/[0.05] flex items-center justify-between text-xs">
                  <span className="text-accent-teal-bright font-medium flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <span>Explore in Dashboard</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                  <span className="text-text-faint font-mono text-[10px]">Active</span>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      )}

      {/* Bottom CTA Banner */}
      <Reveal className="mt-20 glass rounded-3xl p-8 md:p-12 text-center relative overflow-hidden border border-accent-violet/30 shadow-glow-violet">
        <div className="absolute inset-0 bg-brand-gradient opacity-[0.06] pointer-events-none" />
        <h3 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
          Ready to deploy with complete freedom?
        </h3>
        <p className="text-text-muted text-sm max-w-xl mx-auto mb-8 leading-relaxed">
          Connect your GitHub or GitLab repositories, launch Docker Swarm clusters, or deploy custom databases in minutes with no vendor lock-in.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001'}/login`}
            className="btn-shimmer rounded-full px-8 py-3.5 font-semibold text-white text-sm shadow-glow-violet"
          >
            Launch Your First App →
          </a>
          <a
            href="/pricing"
            className="glass rounded-full px-8 py-3.5 font-medium text-text-primary text-sm hover:bg-white/[0.08] transition-colors"
          >
            View Hardware Specifications
          </a>
        </div>
      </Reveal>
    </section>
  );
}
