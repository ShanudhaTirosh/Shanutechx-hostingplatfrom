'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, Button, Spinner, ErrorBanner, Badge } from '@/components/ui';
import { secretsApi, SecretProjectSummary } from '@/lib/secretsApi';

export default function SecretsOverviewPage() {
  const [projects, setProjects] = useState<SecretProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Project Form
  const [name, setName] = useState('');
  const [env, setEnv] = useState<'development' | 'staging' | 'production'>('development');
  const [creating, setCreating] = useState(false);

  const loadProjects = () => {
    setLoading(true);
    secretsApi.projects
      .list()
      .then((res) => setProjects(res.projects))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    secretsApi.projects
      .create({ name, environment: env })
      .then(() => {
        setName('');
        loadProjects();
      })
      .catch((err) => alert(err.message))
      .finally(() => setCreating(false));
  };

  if (loading) return <Spinner label="Loading Secrets Vault..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Secrets Vault (Infisical)"
        description="Centralized secrets manager for API tokens, database connection strings, and encryption keys."
      />

      {error && <ErrorBanner message={error} />}

      {/* Top Header Actions */}
      <div className="flex justify-end">
        <Link
          href="/secrets/audit"
          className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-text-muted hover:text-text-primary text-xs font-medium border border-white/[0.08] transition-all"
        >
          View Access Audit Logs
        </Link>
      </div>

      {/* Create Project Form */}
      <Card className="border border-white/[0.06]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Create Secret Environment Project
        </h3>
        <form onSubmit={handleCreateProject} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Project Name (e.g. LiveKit Cluster Secrets)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
            required
          />
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as any)}
            className="rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
          >
            <option value="development">development</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
          <Button type="submit" size="sm" disabled={creating}>
            {creating ? 'Creating...' : '+ Create Vault Project'}
          </Button>
        </form>
      </Card>

      {/* Projects Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Secret Projects ({projects.length})
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/secrets/${p.id}`}>
              <Card className="h-full border border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04] transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm text-text-primary group-hover:text-white transition-colors">
                      {p.name}
                    </h4>
                    <p className="font-mono text-[10px] text-text-faint">{p.id}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                      p.environment === 'production'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    }`}
                  >
                    {p.environment}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06] text-xs">
                  <span className="text-text-muted">{p.secretCount} secrets stored</span>
                  <span className="text-accent-teal-bright group-hover:translate-x-0.5 transition-transform">
                    Manage Secrets →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
