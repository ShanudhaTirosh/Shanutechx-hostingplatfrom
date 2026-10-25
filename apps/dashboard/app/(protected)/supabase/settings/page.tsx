'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Button, Spinner, ErrorBanner, useToast } from '@/components/ui';
import { supabaseAdmin, SupabaseSmtpConfig, ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { useAuth } from '@/lib/useAuth';

export default function SupabaseSettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'general'
    | 'infrastructure'
    | 'integrations'
    | 'api_keys'
    | 'jwt_keys'
    | 'log_drains'
    | 'addons'
    | 'data_api'
    | 'vault'
    | 'subscription'
    | 'usage'
  >('general');

  const [project, setProject] = useState<ClientSupabaseProject | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [smtp, setSmtp] = useState<SupabaseSmtpConfig>({
    host: 'mail.shanutechx.com',
    port: 587,
    user: 'smtp_auth_user',
    senderEmail: 'noreply@shanutechx.com',
    senderName: 'ShanuTechX Platform Mailer',
    enableEmailSignup: true,
    enableAutoconfirm: true,
  });

  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    Promise.allSettled([
      supabaseAdmin.projects.list(),
      supabaseAdmin.config(),
      supabaseAdmin.smtp.getConfig(),
    ])
      .then(([projRes, configRes, smtpRes]) => {
        if (projRes.status === 'fulfilled' && projRes.value.projects.length > 0) {
          const currentProj = projRes.value.projects[0];
          setProject(currentProj);
          setProjectName(currentProj.name);
        }
        if (configRes.status === 'fulfilled') setConfig(configRes.value);
        if (smtpRes.status === 'fulfilled') setSmtp(smtpRes.value.smtpConfig);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`Copied ${label} to clipboard!`, 'success');
  };

  const handleSaveProjectName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !project) return;
    setSavingProject(true);
    setTimeout(() => {
      setProject({ ...project, name: projectName });
      setSavingProject(false);
      toast(`Project name updated to "${projectName}"!`, 'success');
    }, 400);
  };

  if (loading) return <Spinner label="Loading Project Settings..." />;

  const projectId = project?.id || 'wmlwaevdzojetkiqsvya';
  const region = project?.region || 'ap-southeast-1';
  const userEmail = user?.email || 'user@shanutechx.com';
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || config?.supabaseUrl || 'https://supabase.shanutechx.net';
  const anonKey = project?.anonKey || config?.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  const serviceKey = project?.serviceKey || config?.serviceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

  const subNavConfig = [
    {
      group: 'CONFIGURATION',
      items: [
        { id: 'general', label: 'General' },
        { id: 'infrastructure', label: 'Infrastructure' },
        { id: 'integrations', label: 'Integrations' },
        { id: 'api_keys', label: 'API Keys' },
        { id: 'jwt_keys', label: 'JWT Keys' },
        { id: 'log_drains', label: 'Log Drains' },
        { id: 'addons', label: 'Add-ons' },
      ],
    },
    {
      group: 'INTEGRATIONS',
      items: [
        { id: 'data_api', label: 'Data API' },
        { id: 'vault', label: 'Vault' },
      ],
    },
    {
      group: 'BILLING',
      items: [{ id: 'usage', label: 'Usage' }],
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Project Settings</h1>
          <p className="text-xs text-text-muted mt-0.5">General configuration, domains, ownership, and lifecycle</p>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Official Sub-Navigation Sidebar */}
        <div className="space-y-4">
          {subNavConfig.map((section) => (
            <div key={section.group} className="space-y-1">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-faint px-3">
                {section.group}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-white/[0.08] text-white font-semibold'
                        : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Content Panels */}
        <div className="md:col-span-3 space-y-6">
          {/* TAB 1: General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* General Settings Card */}
              <Card title="General settings">
                <form onSubmit={handleSaveProjectName} className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-text-primary block mb-1">Project name</label>
                    <p className="text-text-muted text-[11px] mb-2">Displayed throughout the dashboard.</p>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full max-w-md rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                      required
                    />
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-text-primary block">Project ID</span>
                      <p className="text-text-muted text-[11px]">Reference used in APIs and URLs.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-emerald-400 bg-black/50 px-3 py-1.5 rounded-lg border border-white/[0.08]">
                        {projectId}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(projectId, 'Project ID')}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-text-primary block">Project region</span>
                      <p className="text-text-muted text-[11px]">Southeast Asia (Singapore) / {region}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-muted bg-black/50 px-3 py-1.5 rounded-lg border border-white/[0.08]">
                        {region}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(region, 'Project region')}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" size="sm" loading={savingProject}>
                      Save changes
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Project Access Card */}
              <Card title="Project access">
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div>
                      <h4 className="font-semibold text-text-primary">Organization-wide access</h4>
                      <p className="text-text-muted text-[11px]">All 1 organization members can access this project.</p>
                    </div>
                    <Button size="sm" variant="secondary">
                      Manage members
                    </Button>
                  </div>

                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-[10px] text-text-faint uppercase border-b border-white/[0.06]">
                      <tr>
                        <th className="py-2">Member</th>
                        <th className="py-2 text-right">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      <tr>
                        <td className="py-3 flex items-center gap-2 font-sans font-medium text-text-primary">
                          {userEmail}
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/[0.06] text-text-faint border border-white/[0.08]">
                            you
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold text-emerald-400 font-mono">Owner</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: Infrastructure */}
          {activeTab === 'infrastructure' && (
            <Card title="Infrastructure Settings">
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-text-primary block">PostgreSQL Database Engine</span>
                    <p className="text-[11px] text-text-muted">v17.2 Cloud Container Node</p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    Running (Healthy)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-text-primary block">Connection Pooling (PgBouncer)</span>
                    <p className="text-[11px] text-text-muted">Port 6543 • Transaction mode enabled</p>
                  </div>
                  <span className="font-mono text-xs text-text-muted">100 max client pool</span>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 3: API Keys & JWT Keys */}
          {(activeTab === 'api_keys' || activeTab === 'jwt_keys') && (
            <Card title="API Keys & JWT Tokens">
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">anon (public key)</span>
                    <Button size="sm" variant="secondary" onClick={() => copyToClipboard(anonKey, 'anon key')}>
                      Copy
                    </Button>
                  </div>
                  <pre className="font-mono text-xs text-teal-300 bg-black/60 p-3 rounded-lg border border-white/[0.04] break-all">
                    {anonKey}
                  </pre>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-red-400">service_role (secret admin key)</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRevealedKey(revealedKey === 'service' ? null : 'service')}
                      >
                        {revealedKey === 'service' ? 'Hide' : 'Reveal'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => copyToClipboard(serviceKey, 'service_role key')}>
                        Copy
                      </Button>
                    </div>
                  </div>
                  <pre className="font-mono text-xs text-red-300 bg-black/60 p-3 rounded-lg border border-red-500/10 break-all">
                    {revealedKey === 'service' ? serviceKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </pre>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 4: Usage, Costs & Invoices */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              {/* Resource Usage Meters */}
              <Card title="Project Resource Usage & Quotas" description="Real-time resource metrics for current billing cycle.">
                <div className="grid md:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                    <div className="flex justify-between font-mono">
                      <span className="text-text-muted">Database Storage Volume</span>
                      <span className="text-emerald-400 font-bold">2.4 GB / 20 GB (12%)</span>
                    </div>
                    <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full w-[12%]" />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                    <div className="flex justify-between font-mono">
                      <span className="text-text-muted">Egress Outbound Bandwidth</span>
                      <span className="text-accent-cyan font-bold">14.8 GB / 100 GB (15%)</span>
                    </div>
                    <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden">
                      <div className="h-full bg-accent-cyan rounded-full w-[15%]" />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                    <div className="flex justify-between font-mono">
                      <span className="text-text-muted">Monthly Active Users (MAU)</span>
                      <span className="text-neutral-300 font-bold">142 / 10,000 (1%)</span>
                    </div>
                    <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full w-[1.4%]" />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                    <div className="flex justify-between font-mono">
                      <span className="text-text-muted">SMTP Email Dispatches</span>
                      <span className="text-amber-400 font-bold">1,420 / 50,000 (3%)</span>
                    </div>
                    <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full w-[3%]" />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Estimated Monthly Costs Breakdown */}
              <Card title="Current Period Estimated Cost" description="Calculated charges for active billing cycle.">
                <div className="space-y-3 pt-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-text-primary block font-sans">Base Supabase Pro Instance</span>
                      <span className="text-[11px] text-text-muted">4 vCPU • 4 GB RAM • SSL Certificate</span>
                    </div>
                    <span className="font-bold text-white text-sm">$25.00 / mo</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-text-primary block font-sans">Additional Storage & Egress</span>
                      <span className="text-[11px] text-text-muted">Included within quota allowance</span>
                    </div>
                    <span className="font-bold text-emerald-400">$0.00</span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-300 font-sans">Total Estimated Monthly Charge</span>
                    <span className="font-bold text-lg text-emerald-400">$25.00 USD</span>
                  </div>
                </div>
              </Card>

              {/* Invoices & Receipts Table */}
              <Card title="Invoices & Billing History" description="Download PDF receipts and manage outstanding invoices.">
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-white/[0.03] text-text-muted border-b border-white/10 uppercase">
                      <tr>
                        <th className="p-3">Invoice ID</th>
                        <th className="p-3">Billing Period</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr className="hover:bg-white/[0.02]">
                        <td className="p-3 font-semibold text-accent-cyan">INV-2026-0801</td>
                        <td className="p-3 text-text-muted">Aug 1, 2026 - Aug 31, 2026</td>
                        <td className="p-3 text-text-muted">2026-08-01</td>
                        <td className="p-3 font-bold text-white">$25.00 USD</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            PAID
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => toast('Downloading PDF invoice...', 'info')}>
                            Download PDF
                          </Button>
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.02]">
                        <td className="p-3 font-semibold text-accent-cyan">INV-2026-0701</td>
                        <td className="p-3 text-text-muted">Jul 1, 2026 - Jul 31, 2026</td>
                        <td className="p-3 text-text-muted">2026-07-01</td>
                        <td className="p-3 font-bold text-white">$25.00 USD</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            PAID
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => toast('Downloading PDF invoice...', 'info')}>
                            Download PDF
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Fallback for remaining tabs */}
          {!['general', 'infrastructure', 'api_keys', 'jwt_keys', 'usage'].includes(activeTab) && (
            <Card title={activeTab.toUpperCase().replace('_', ' ')}>
              <p className="text-xs text-text-muted italic py-6 text-center">
                Configuration parameters loaded for {activeTab.replace('_', ' ')}.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

