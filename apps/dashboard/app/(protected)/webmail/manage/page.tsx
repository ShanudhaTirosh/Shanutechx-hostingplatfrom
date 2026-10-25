'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import {
  Globe,
  Mail,
  ShieldCheck,
  HardDrive,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  Copy,
  AlertTriangle,
  Lock,
  ChevronRight,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface QuotaMeters {
  planName: string;
  quotas: {
    mailboxes: { used: number; limit: number };
    storageMb: { used: number; limit: number };
    domains: { used: number; limit: number };
    aliases: { used: number; limit: number };
  };
}

interface DomainItem {
  domain: string;
  status: string;
  records: {
    mx: string;
    spf: string;
    dkim: string;
    dkimHost?: string;
    dmarc: string;
  };
}

export default function CustomerMailManagementHub() {
  const [planUsage, setPlanUsage] = useState<QuotaMeters | null>(null);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [connectingDomain, setConnectingDomain] = useState(false);
  const [selectedDomainForWizard, setSelectedDomainForWizard] = useState<DomainItem | null>(null);
  const [dnsChecks, setDnsChecks] = useState<any>(null);
  const [verifyingDns, setVerifyingDns] = useState(false);

  // Mailbox & Alias State
  const [newMailboxPrefix, setNewMailboxPrefix] = useState('');
  const [newMailboxPass, setNewMailboxPass] = useState('');
  const [creatingMailbox, setCreatingMailbox] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadHubData();
  }, []);

  const loadHubData = async () => {
    setLoading(true);
    try {
      const [usageRes, domainsRes] = await Promise.all([
        api.get('/webmail/plan-usage').catch(() => null),
        api.get('/webmail/domains').catch(() => ({ domains: [] })),
      ]);

      const usage = usageRes?.quotas ? usageRes : usageRes?.data;
      if (usage?.quotas) setPlanUsage(usage);

      const domainList = Array.isArray(domainsRes?.domains)
        ? domainsRes.domains
        : Array.isArray(domainsRes?.data?.domains)
        ? domainsRes.data.domains
        : [];
      setDomains(domainList);
    } catch (err: any) {
      toast('Failed to load mailbox hub data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setConnectingDomain(true);
    try {
      const res = await api.post('/webmail/domains', { domain: newDomain.trim() });
      toast(`Domain ${newDomain} connected! Please configure DNS records below.`, 'success');
      setNewDomain('');
      loadHubData();
      const payload = res?.dnsRecords ? res : res?.data;
      if (payload?.dnsRecords) {
        setSelectedDomainForWizard({
          domain: payload.domain,
          status: 'pending',
          records: {
            mx: payload.dnsRecords.mx.value,
            spf: payload.dnsRecords.spf.value,
            dkim: payload.dnsRecords.dkim.value,
            dkimHost: payload.dnsRecords.dkim.host || 'wildduck._domainkey',
            dmarc: payload.dnsRecords.dmarc.value,
          },
        });
      }
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || 'Failed to connect domain', 'error');
    } finally {
      setConnectingDomain(false);
    }
  };

  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  const handleVerifyDns = async (domain: string) => {
    setVerifyingDns(true);
    try {
      const res = await api.post(`/webmail/domains/${domain}/verify`);
      const verifyData = res?.checks ? res : res?.data;
      if (verifyData?.checks) {
        setDnsChecks(verifyData.checks);
      }
      if (verifyData?.verified) {
        toast(`DNS records for ${domain} fully verified and active!`, 'success');
      } else {
        toast(`DNS verification in progress. Check details below.`, 'info');
      }
      loadHubData();
    } catch (err: any) {
      toast('DNS verification failed', 'error');
    } finally {
      setVerifyingDns(false);
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    if (!confirm(`Are you sure you want to disconnect custom domain "${domain}"?`)) return;
    setDeletingDomain(domain);
    try {
      await api.delete(`/webmail/domains/${domain}`);
      toast(`Domain ${domain} disconnected successfully`, 'success');
      if (selectedDomainForWizard?.domain === domain) {
        setSelectedDomainForWizard(null);
      }
      loadHubData();
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || 'Failed to disconnect domain', 'error');
    } finally {
      setDeletingDomain(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('Copied to clipboard!', 'success');
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const q = planUsage?.quotas;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="h-7 w-7 text-indigo-600 dark:text-white" />
            Customer Mailbox & SMTP Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage custom domains, setup DNS records, create mailboxes & email aliases under your plan limits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/email"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Mail className="h-3.5 w-3.5 text-white" />
            Mailboxes &amp; SMTP
          </a>
          <a
            href="/webmail"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-white text-black px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Launch Webmail UI
          </a>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-neutral-300">
            {planUsage?.planName || 'Pro Mail Tier'}
          </span>
        </div>
      </div>

      {/* Real-time Plan Quota Usage Meters */}
      {q && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-sm font-medium">Mailboxes</span>
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {q.mailboxes.used} / {q.mailboxes.limit}
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-white text-black"
                style={{ width: `${Math.min(100, (q.mailboxes.used / q.mailboxes.limit) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-sm font-medium">Storage Quota</span>
              <HardDrive className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {(q.storageMb.used / 1024).toFixed(1)} GB / {(q.storageMb.limit / 1024).toFixed(1)} GB
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, (q.storageMb.used / q.storageMb.limit) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-sm font-medium">Custom Domains</span>
              <Globe className="h-5 w-5 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {q.domains.used} / {q.domains.limit}
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min(100, (q.domains.used / q.domains.limit) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-sm font-medium">Email Aliases</span>
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {q.aliases.used} / {q.aliases.limit}
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-purple-500"
                style={{ width: `${Math.min(100, (q.aliases.used / q.aliases.limit) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Connect Domain & DNS Setup Wizard */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Globe className="h-5 w-5 text-white" />
          Connect Custom Domain & Auto DNS Setup Wizard
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Add your organization's custom domain to send and receive verified emails via WildDuck SMTP.
        </p>

        <form onSubmit={handleConnectDomain} className="mt-4 flex max-w-xl gap-3">
          <input
            type="text"
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-white/30 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={connectingDomain}
            className="flex items-center gap-2 rounded-lg bg-white text-black px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {connectingDomain ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Connect Domain
          </button>
        </form>

        {/* List of Connected Domains */}
        <div className="mt-6 space-y-4">
          {domains.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
              No custom domains connected yet. Connect your domain above to configure DNS.
            </div>
          ) : (
            domains.map((d) => (
              <div
                key={d.domain}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{d.domain}</span>
                    {d.status === 'active' || d.status === 'verified' ? (
                      <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified &amp; Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <Clock className="h-3 w-3" />
                        DNS Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedDomainForWizard(d)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      View DNS Records
                    </button>
                    <button
                      onClick={() => handleVerifyDns(d.domain)}
                      disabled={verifyingDns}
                      className="flex items-center gap-1.5 rounded-md bg-white text-black px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {verifyingDns ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      1-Click Verify DNS
                    </button>
                    <button
                      onClick={() => handleDeleteDomain(d.domain)}
                      disabled={deletingDomain === d.domain}
                      title="Disconnect Custom Domain"
                      className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                    >
                      {deletingDomain === d.domain ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* DNS Checks status if ran */}
                {dnsChecks && (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className={`flex items-center gap-2 rounded p-2 text-xs font-medium ${dnsChecks.mx ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                      {dnsChecks.mx ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      MX Record
                    </div>
                    <div className={`flex items-center gap-2 rounded p-2 text-xs font-medium ${dnsChecks.spf ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                      {dnsChecks.spf ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      SPF Record
                    </div>
                    <div className={`flex items-center gap-2 rounded p-2 text-xs font-medium ${dnsChecks.dkim ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                      {dnsChecks.dkim ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      DKIM TXT
                    </div>
                    <div className={`flex items-center gap-2 rounded p-2 text-xs font-medium ${dnsChecks.dmarc ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                      {dnsChecks.dmarc ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      DMARC TXT
                    </div>
                  </div>
                )}

                {/* DNS Records Detail Table */}
                {selectedDomainForWizard?.domain === d.domain && (
                  <div className="mt-4 space-y-3 rounded-lg bg-white p-4 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Required DNS Records for {d.domain}</h3>
                    
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between rounded bg-slate-100 p-2 dark:bg-slate-800">
                        <div>
                          <span className="font-bold text-indigo-600 dark:text-white">MX @:</span> {d.records.mx} (Priority 10)
                        </div>
                        <button onClick={() => copyToClipboard(d.records.mx)} className="text-slate-400 hover:text-slate-600">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded bg-slate-100 p-2 dark:bg-slate-800">
                        <div>
                          <span className="font-bold text-indigo-600 dark:text-white">TXT @ (SPF):</span> {d.records.spf}
                        </div>
                        <button onClick={() => copyToClipboard(d.records.spf)} className="text-slate-400 hover:text-slate-600">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded bg-slate-100 p-2 dark:bg-slate-800">
                        <div className="overflow-hidden text-ellipsis">
                          <span className="font-bold text-indigo-600 dark:text-white">TXT {d.records.dkimHost || 'wildduck._domainkey'}:</span> {d.records.dkim}
                        </div>
                        <button onClick={() => copyToClipboard(d.records.dkim)} className="ml-2 flex-shrink-0 text-slate-400 hover:text-slate-600" title="Copy DKIM Record">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded bg-slate-100 p-2 dark:bg-slate-800">
                        <div>
                          <span className="font-bold text-indigo-600 dark:text-white">TXT _dmarc:</span> {d.records.dmarc}
                        </div>
                        <button onClick={() => copyToClipboard(d.records.dmarc)} className="text-slate-400 hover:text-slate-600">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
