'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, StatCard, Spinner, ErrorBanner, Button } from '@/components/ui';
import { supabaseAdmin, SupabaseHealth, ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { ServiceHealthBar } from '@/components/supabase/ServiceHealthBar';
import { ProjectSwitcher } from '@/components/supabase/ProjectSwitcher';

export default function SupabaseOverviewPage() {
  const [health, setHealth] = useState<SupabaseHealth | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [activeProject, setActiveProject] = useState<ClientSupabaseProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([supabaseAdmin.health(), supabaseAdmin.config()])
      .then(([healthRes, configRes]) => {
        if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
        if (configRes.status === 'fulfilled') setConfig(configRes.value);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Connecting to Supabase stack..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supabase Management Center"
        description="Self-hosted Multi-Project backend suite — Database, Auth, Storage, Edge Functions, and Realtime WebSockets."
      />

      {error && <ErrorBanner message={error} />}

      {/* Multi-Project Switcher Header */}
      <ProjectSwitcher activeProject={activeProject} onSelectProject={setActiveProject} />

      {/* Service Health Overview Bar */}
      {health && (
        <Card className="border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">System Health Status ({activeProject?.name || 'Default'})</h2>
              <p className="text-xs text-text-muted">Live pulse check across all self-hosted container services</p>
            </div>
            <a
              href={config?.studioUrl || 'http://localhost:8000'}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <span>Open Studio UI</span> ↗
            </a>
          </div>
          <ServiceHealthBar services={health.services} />
        </Card>
      )}

      {/* Quick Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label="Auth Service" value="Active (GoTrue)" color="violet" />
        <StatCard label="Database Name" value={activeProject?.dbName || 'postgres'} color="teal" />
        <StatCard label="Storage Engine" value="Active (S3 / R2)" color="green" />
        <StatCard label="Edge Functions" value="Active (Deno)" color="orange" />
      </div>

      {/* Management Navigation Grid */}
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Suite Components</h2>
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/supabase/auth">
          <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-white/5 text-neutral-300 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-text-primary mb-1 group-hover:text-white transition-colors">
              Authentication
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              Manage users, JWT tokens, OAuth providers (Google, GitHub, Discord), and MFA settings.
            </p>
          </Card>
        </Link>

        <Link href="/supabase/database">
          <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-300 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s-8 1.79 8-4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-text-primary mb-1 group-hover:text-white transition-colors">
              Database Studio
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              Table editor, raw SQL runner, schema viewer, and PostgreSQL 17 configuration.
            </p>
          </Card>
        </Link>

        <Link href="/supabase/storage">
          <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h14a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-text-primary mb-1 group-hover:text-white transition-colors">
              Storage Buckets
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              File manager, object bucket policies, image previews, and S3 protocol endpoints.
            </p>
          </Card>
        </Link>

        <Link href="/supabase/functions">
          <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-text-primary mb-1 group-hover:text-white transition-colors">
              Edge Functions
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              Inspect Deno edge runtime functions, trigger invocations, and review execution logs.
            </p>
          </Card>
        </Link>

        <Link href="/supabase/realtime">
          <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-300 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9.9 9.9 0 0114.142 0M2.828 9.9a14.85 14.85 0 0121.214 0" />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-text-primary mb-1 group-hover:text-white transition-colors">
              Realtime WebSockets
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              Live channels monitor, presence status, broadcast message testing, and cluster config.
            </p>
          </Card>
        </Link>

        <Link href="/supabase/settings">
          <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 text-fuchsia-300 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-text-primary mb-1 group-hover:text-white transition-colors">
              SMTP &amp; API Config
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              Configure SMTP Mailer server, send test emails, view ANON &amp; SERVICE keys.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
