'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getCentralStudioUrl, ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { useAuth } from '@/lib/useAuth';
import { SupabaseProjectProvider, useSupabaseProject } from '@/lib/SupabaseProjectContext';
import {
  Layers,
  Table,
  Terminal,
  Database,
  Users,
  HardDrive,
  Cpu,
  Activity,
  Settings,
  Key,
  ExternalLink,
  Search,
} from 'lucide-react';

const STATUS_PILLS: Record<string, { bg: string; dot: string }> = {
  ACTIVE: { bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', dot: 'bg-emerald-400' },
  PROVISIONING: { bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300', dot: 'bg-amber-400 animate-pulse' },
  STOPPED: { bg: 'bg-slate-500/10 border-slate-500/30 text-slate-300', dot: 'bg-slate-400' },
  FAILED: { bg: 'bg-red-500/10 border-red-500/30 text-red-300', dot: 'bg-red-400 animate-pulse' },
  SUSPENDED: { bg: 'bg-orange-500/10 border-orange-500/30 text-orange-300', dot: 'bg-orange-400' },
};

function SupabaseStudioLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || '';
  const { user } = useAuth();
  const { projects, activeProject, setActiveProject, loading } = useSupabaseProject();

  const studioUrl = activeProject ? getCentralStudioUrl(activeProject) : null;
  const statusInfo = activeProject
    ? STATUS_PILLS[activeProject.status] || STATUS_PILLS.ACTIVE
    : STATUS_PILLS.ACTIVE;

  const navItems = [
    {
      label: 'Studio Home',
      href: '/supabase',
      viewKey: 'overview',
      icon: <Layers className="w-4 h-4 shrink-0" />,
      exact: true,
    },
    {
      label: 'Table Editor',
      href: '/supabase?view=editor',
      viewKey: 'editor',
      icon: <Table className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'SQL Editor',
      href: '/supabase?view=sql',
      viewKey: 'sql',
      icon: <Terminal className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Database',
      href: '/supabase/database',
      viewKey: 'database',
      icon: <Database className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Authentication',
      href: '/supabase/auth',
      viewKey: 'auth',
      icon: <Users className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Storage',
      href: '/supabase/storage',
      viewKey: 'storage',
      icon: <HardDrive className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Edge Functions',
      href: '/supabase/functions',
      viewKey: 'functions',
      icon: <Cpu className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Realtime',
      href: '/supabase/realtime',
      viewKey: 'realtime',
      icon: <Activity className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Project Settings',
      href: '/supabase?view=settings',
      viewKey: 'settings',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'API & Keys',
      href: '/supabase?view=api',
      viewKey: 'api',
      icon: <Key className="w-4 h-4 shrink-0" />,
    },
  ];

  const orgName = user?.email ? `${user.email.split('@')[0]}'s Org` : "ShanudhaTirosh's Org";

  return (
    <div className="min-h-screen bg-[#0c0d12] text-text-primary flex flex-col font-sans">
      {/* Official Supabase Studio Top Navigation Bar */}
      <header className="h-14 border-b border-white/[0.08] bg-[#0d0e14] px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          {/* Supabase Brand Icon */}
          <Link
            href="/supabase"
            className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 hover:bg-emerald-500/30 transition-colors"
            title="Supabase Studio Platform"
          >
            <svg className="w-4 h-4 fill-emerald-400" viewBox="0 0 24 24">
              <path d="M13.8 2.1l-10.7 13c-.4.5-.1 1.2.6 1.2h7.8l-1.5 5.6c-.2.9 1 1.4 1.6.7l10.7-13c.4-.5.1-1.2-.6-1.2h-7.8l1.5-5.6c.2-.9-1-1.4-1.6-.7z" />
            </svg>
          </Link>

          <div className="h-4 w-px bg-white/10" />

          {/* Dynamic Org Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary">{orgName}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              CLOUD PLATFORM
            </span>
          </div>

          <span className="text-text-faint text-xs">/</span>

          {/* Dynamic Project Selector */}
          <div className="flex items-center gap-2">
            {projects.length === 0 ? (
              <span className="text-xs text-text-muted italic">No projects yet</span>
            ) : (
              <select
                value={activeProject?.id || ''}
                onChange={(e) => {
                  const found = projects.find((p) => p.id === e.target.value);
                  if (found) setActiveProject(found);
                }}
                className="bg-[#0f111a] border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50 cursor-pointer max-w-[200px] truncate"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0f111a] text-text-primary">
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {activeProject && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${statusInfo.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dot}`} />
                {activeProject.status}
              </span>
            )}
          </div>
        </div>

        {/* Right Top Actions */}
        <div className="flex items-center gap-3">
          {/* Direct Launch Studio Button */}
          {activeProject && activeProject.status === 'ACTIVE' && studioUrl && (
            <a
              href={studioUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-sm"
              title="Launch official Supabase Studio in new window"
            >
              <span>Launch Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Connection Pulse */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-semibold text-emerald-300">Live Studio API</span>
          </div>

          {/* Quick Search hint */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-text-muted">
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-white/[0.08] text-text-faint">Ctrl+K</kbd>
          </div>

          {/* User Avatar */}
          <div className="h-7 w-7 rounded-full bg-accent-violet/30 border border-accent-violet/50 flex items-center justify-center text-xs font-bold text-accent-violet-light">
            {user?.email ? user.email.charAt(0).toUpperCase() : 'S'}
          </div>
        </div>
      </header>

      {/* Main Studio Body with Left Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Official Studio Left Navigation Sidebar */}
        <aside className="w-56 border-r border-white/[0.08] bg-[#0d0e14] p-3 shrink-0 flex flex-col justify-between overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => {
              let isActive = false;
              if (item.exact) {
                isActive = pathname === '/supabase' && (!currentView || currentView === 'overview');
              } else if (item.href.startsWith('/supabase?view=')) {
                isActive = pathname === '/supabase' && currentView === item.viewKey;
              } else {
                isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={isActive ? 'text-emerald-400' : 'text-text-muted'}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-white/[0.06] space-y-2">
            {activeProject && (
              <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[11px] text-text-faint space-y-1">
                <div className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Target Host</div>
                <div className="font-mono text-emerald-300 truncate">{activeProject.nodeIp || '127.0.0.1'}</div>
              </div>
            )}

            <a
              href="https://supabase.com/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Supabase Docs ↗</span>
            </a>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#0c0d12]">{children}</main>
      </div>
    </div>
  );
}

export default function SupabaseStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProjectProvider>
      <SupabaseStudioLayoutInner>{children}</SupabaseStudioLayoutInner>
    </SupabaseProjectProvider>
  );
}
