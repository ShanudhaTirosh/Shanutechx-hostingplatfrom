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
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-300 flex items-center justify-center mb-3 text-lg">
              👤
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
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-300 flex items-center justify-center mb-3 text-lg">
              🗄️
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
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-3 text-lg">
              📦
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
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center mb-3 text-lg">
              ⚡
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
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-300 flex items-center justify-center mb-3 text-lg">
              📡
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
            <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 text-fuchsia-300 flex items-center justify-center mb-3 text-lg">
              ⚙️
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
