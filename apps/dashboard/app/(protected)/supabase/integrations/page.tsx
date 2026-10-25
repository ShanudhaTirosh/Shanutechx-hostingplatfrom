'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Button, Spinner } from '@/components/ui';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default function SupabaseIntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'webhooks' | 'vault' | 'fdw'>('webhooks');
  const [integrationsData, setIntegrationsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseAdmin
      .integrations()
      .then((res) => {
        setIntegrationsData(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading database webhooks, vault secrets, and FDW wrappers..." />;

  const webhooks = integrationsData?.webhooks || [];
  const vaultSecrets = integrationsData?.vaultSecrets || [];
  const fdw = integrationsData?.fdw || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supabase Integrations & Vault Manager"
        description="Database Webhooks, pg_vault encrypted secrets manager, and Foreign Data Wrappers (FDW)."
      />

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        {[
          { id: 'webhooks', label: `Database Webhooks (${webhooks.length})` },
          { id: 'vault', label: `Vault Encrypted Secrets (${vaultSecrets.length})` },
          { id: 'fdw', label: `Foreign Data Wrappers (${fdw.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-accent-violet text-white shadow-md'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Database Webhooks */}
      {activeTab === 'webhooks' && (
        <Card title="Database Webhooks" description="Trigger HTTP requests on PostgreSQL row events (INSERT, UPDATE, DELETE).">
          <div className="space-y-4 pt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-white/[0.03] text-text-muted border-b border-white/10 uppercase">
                  <tr>
                    <th className="p-3">Webhook Name</th>
                    <th className="p-3">Table</th>
                    <th className="p-3">Events</th>
                    <th className="p-3">Endpoint URL</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {webhooks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-text-muted">No database webhooks configured.</td>
                    </tr>
                  ) : (
                    webhooks.map((wh: any) => (
                      <tr key={wh.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-semibold text-white font-sans">{wh.name}</td>
                        <td className="p-3 text-emerald-400">{wh.table}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-accent-violet/20 text-accent-violet font-bold">
                            {(wh.events || []).join(', ')}
                          </span>
                        </td>
                        <td className="p-3 text-text-muted truncate max-w-xs">{wh.url}</td>
                        <td className="p-3 text-right">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            {wh.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 2: Vault Encrypted Secrets */}
      {activeTab === 'vault' && (
        <Card title="pg_vault Encrypted Secrets" description="Securely store API keys and environment credentials in encrypted PostgreSQL vault.">
          <div className="space-y-3 pt-2">
            {vaultSecrets.length === 0 ? (
              <p className="text-xs text-text-muted">No secrets stored in vault.</p>
            ) : (
              vaultSecrets.map((secret: any) => (
                <div key={secret.id} className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-accent-cyan">{secret.name} ({secret.keyName})</span>
                    <p className="text-[11px] text-text-muted mt-0.5">{secret.description}</p>
                  </div>
                  <span className="text-[10px] text-text-faint font-mono bg-white/[0.06] px-2 py-1 rounded border border-white/[0.08]">Encrypted in Vault</span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: Foreign Data Wrappers */}
      {activeTab === 'fdw' && (
        <Card title="Foreign Data Wrappers (FDW)" description="Query external data sources directly inside PostgreSQL.">
          <div className="grid md:grid-cols-2 gap-4 pt-2">
            {fdw.map((item: any) => (
              <div key={item.id} className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-text-primary">{item.name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {item.status}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed font-mono">Wrapper: {item.wrapper}</p>
                <p className="text-[11px] text-text-faint leading-relaxed font-mono">Server: {item.serverName}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

