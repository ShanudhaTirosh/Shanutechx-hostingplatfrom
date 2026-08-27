'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseAdmin, ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { useAuth } from '@/lib/useAuth';

export default function SupabaseStudioLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ClientSupabaseProject[]>([]);
  const [activeProject, setActiveProject] = useState<ClientSupabaseProject | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    supabaseAdmin.projects
      .list()
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0) {
          setActiveProject(res.projects[0]);
        }
      })
      .catch(() => {});
  }, []);

  const navItems = [
    {
      label: 'Project Overview',
      href: '/supabase',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'Table Editor',
      href: '/supabase/database?tab=tables',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'SQL Editor',
      href: '/supabase/database?tab=sql',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Database',
      href: '/supabase/database',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
    {
      label: 'Authentication',
      href: '/supabase/auth',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'Storage',
      href: '/supabase/storage',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h14a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      label: 'Edge Functions',
      href: '/supabase/functions',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Realtime',
      href: '/supabase/realtime',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9.9 9.9 0 0114.142 0M2.828 9.9a14.85 14.85 0 0121.214 0" />
        </svg>
      ),
    },
    {
      label: 'Advisors',
      href: '/supabase/advisors',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      label: 'Observability',
      href: '/supabase/observability',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'Logs',
      href: '/supabase/logs',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      label: 'Integrations',
      href: '/supabase/integrations',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a2 2 0 002 2h1a2 2 0 110 4h-1a2 2 0 00-2 2v1a2 2 0 11-4 0v-1a2 2 0 00-2-2H7a2 2 0 110-4h1a2 2 0 002-2V4z" />
        </svg>
      ),
    },
    {
      label: 'Project Settings',
      href: '/supabase/settings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const orgName = user?.email ? `${user.email.split('@')[0]}'s Org` : "ShanudhaTirosh's Org";

  return (
    <div className="min-h-screen bg-[#0c0d12] text-text-primary flex flex-col font-sans">
      {/* Official Supabase Studio Top Navigation Bar */}
      <header className="h-14 border-b border-white/[0.08] bg-[#0d0e14] px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          {/* Supabase Brand Icon */}
          <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <svg className="w-4 h-4 fill-emerald-400" viewBox="0 0 24 24">
              <path d="M13.8 2.1l-10.7 13c-.4.5-.1 1.2.6 1.2h7.8l-1.5 5.6c-.2.9 1 1.4 1.6.7l10.7-13c.4-.5.1-1.2-.6-1.2h-7.8l1.5-5.6c.2-.9-1-1.4-1.6-.7z" />
            </svg>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Dynamic Org Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary">{orgName}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-white/[0.06] text-text-muted border border-white/[0.08]">
              FREE
            </span>
          </div>

          <span className="text-text-faint text-xs">/</span>

          {/* Dynamic Project Selector */}
          <div className="flex items-center gap-2">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) setActiveProject(found);
              }}
              className="bg-transparent text-xs font-bold text-emerald-400 focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0f111a] text-text-primary">
                  {p.name}
                </option>
              ))}
            </select>

            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              main PRODUCTION
            </span>
          </div>
        </div>

        {/* Right Top Actions */}
        <div className="flex items-center gap-3">
          {/* Connection Pulse */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-semibold text-emerald-300">Connected</span>
          </div>

          {/* Quick Search */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
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
              const isActive = pathname === item.href || (item.href !== '/supabase' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-accent-violet/20 text-accent-violet-light border border-accent-violet/30 font-semibold shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={isActive ? 'text-accent-violet-light' : 'text-text-muted'}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-white/[0.06] space-y-2">
            <a
              href="https://supabase.com/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Documentation ↗</span>
            </a>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#0c0d12]">{children}</main>
      </div>
    </div>
  );
}
