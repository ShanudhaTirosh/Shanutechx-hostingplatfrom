'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Spinner, ErrorBanner, Button, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import {
  Server,
  Database,
  Mail,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Trash2,
  ExternalLink,
  Plus,
  Lock,
  Globe,
  Radio,
  Zap,
  Key,
  Layers,
  CloudCheck,
  Clock,
} from 'lucide-react';

interface Mailbox {
  id: string;
  email: string;
  username: string;
  smtpHost: string;
  smtpPort: number;
  sslPort: number;
  storageUsedMb: number;
  storageQuotaMb: number;
  dailySendCount: number;
  dailySendLimit: number;
  status: string;
  planName: string;
  webmailUrl: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  isInternal?: boolean;
}

interface UserOption {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

interface NodeOption {
  id: string;
  label: string;
  ip: string;
  isActive: boolean;
  cpuUsagePct?: number;
  ramUsagePct?: number;
}

interface MailConfig {
  mailNodeId: string | null;
  s3Endpoint: string;
  s3BucketName: string;
  s3Region: string;
  s3AccessKeyId: string;
  hasSecretAccessKey: boolean;
  autoSyncAttachments: boolean;
}

interface Telemetry {
  totalMailboxes: number;
  totalStorageMb: number;
  totalUsedStorageMb: number;
  totalSentToday: number;
  totalDomains: number;
  s3Configured: boolean;
  s3BucketName: string | null;
  assignedNode: { id: string; label: string; ip: string; isActive: boolean } | null;
}

export default function DevWebmailControlCenterPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'node_s3' | 'mailboxes' | 'domains'>('node_s3');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cluster Telemetry & Data
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Config Form State
  const [config, setConfig] = useState<MailConfig>({
    mailNodeId: null,
    s3Endpoint: '',
    s3BucketName: '',
    s3Region: 'auto',
    s3AccessKeyId: '',
    hasSecretAccessKey: false,
    autoSyncAttachments: true,
  });
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // S3 Connection Verification State
  const [verifyingS3, setVerifyingS3] = useState(false);
  const [s3Result, setS3Result] = useState<{ ok: boolean; message: string; latencyMs?: number; error?: string } | null>(null);

  // Outbound SMTP Test State
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<any>(null);

  // Password Reveal & SSO State
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [launchingSsoId, setLaunchingSsoId] = useState<string | null>(null);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);

  // Mail Provisioning Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [username, setUsername] = useState('');
  const [domainStr, setDomainStr] = useState('');
  const [password, setPassword] = useState('');
  const [storageQuotaMb, setStorageQuotaMb] = useState('5120');
  const [dailySendLimit, setDailySendLimit] = useState('1000');
  const [isInternal, setIsInternal] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  // Custom Domain Add State
  const [newDomainInput, setNewDomainInput] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);

  const { toast } = useToast();

  async function loadAllData() {
    setLoading(true);
    try {
      const [telemetryRes, configRes, nodesRes, mbRes, domainsRes, usersRes] = await Promise.all([
        api.email.getTelemetry().catch(() => null),
        api.email.getConfig().catch(() => null),
        api.nodes.list().catch(() => ({ nodes: [] })),
        api.email.mailboxes().catch(() => ({ mailboxes: [] })),
        api.email.domains().catch(() => ({ domains: [] })),
        api.admin.allUsers().catch(() => ({ users: [] })),
      ]);

      if (telemetryRes) setTelemetry(telemetryRes);
      if (configRes?.config) {
        setConfig(configRes.config);
      }
      setNodes(nodesRes.nodes || []);
      setMailboxes(mbRes.mailboxes || []);
      setDomains(domainsRes.domains || []);
      setUsers(usersRes.users || []);

      if (usersRes.users?.length > 0 && !targetUserId) {
        setTargetUserId(usersRes.users[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load Webmail Dev Control Center data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  async function handleSaveConfig(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await api.email.saveConfig({
        mailNodeId: config.mailNodeId || undefined,
        s3Endpoint: config.s3Endpoint.trim(),
        s3BucketName: config.s3BucketName.trim(),
        s3Region: config.s3Region.trim(),
        s3AccessKeyId: config.s3AccessKeyId.trim(),
        s3SecretAccessKey: s3SecretAccessKey ? s3SecretAccessKey.trim() : undefined,
        autoSyncAttachments: config.autoSyncAttachments,
      });

      toast(res.message, 'success');
      setS3SecretAccessKey('');
      loadAllData();
    } catch (err: any) {
      toast(err.message || 'Failed to save mail cluster config', 'error');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleVerifyS3Connection() {
    setVerifyingS3(true);
    setS3Result(null);
    try {
      const res = await api.email.verifyS3({
        s3Endpoint: config.s3Endpoint.trim(),
        s3BucketName: config.s3BucketName.trim(),
        s3Region: config.s3Region.trim(),
        s3AccessKeyId: config.s3AccessKeyId.trim(),
        s3SecretAccessKey: s3SecretAccessKey ? s3SecretAccessKey.trim() : undefined,
      });

      setS3Result(res);
      if (res.ok) {
        toast(`S3 Verification Success! Ping Latency: ${res.latencyMs}ms`, 'success');
      } else {
        toast(`S3 Handshake Failed: ${res.message || res.error}`, 'error');
      }
    } catch (err: any) {
      toast(`S3 Verification Error: ${err.message}`, 'error');
    } finally {
      setVerifyingS3(false);
    }
  }

  async function handleTestGlobalSmtp() {
    setTestingSmtp(true);
    try {
      const res = await (api as any).smtp.verifyConnection();
      setSmtpResult(res);
      if (res.ok) {
        toast(`Outbound SMTP Relay Success (${res.latencyMs}ms)`, 'success');
      } else {
        toast(`SMTP Relay Failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      toast(`SMTP Test Error: ${err.message}`, 'error');
    } finally {
      setTestingSmtp(false);
    }
  }

  async function handleRevealPassword(id: string) {
    try {
      const res = await api.email.credentials(id);
      if (res.password) {
        setRevealedPasswords((prev) => ({ ...prev, [id]: res.password! }));
        toast('Decrypted mailbox password (Audit Logged)', 'info');
      } else {
        toast('Password not found in vault', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to decrypt credentials', 'error');
    }
  }

  async function handleLaunchSso(id: string) {
    setLaunchingSsoId(id);
    try {
      const res = await api.smtp.getSsoTicket(id);
      if (res.webmailUrl) {
        window.open(res.webmailUrl, '_blank');
      } else {
        window.open('http://localhost:3002', '_blank');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to generate SSO ticket', 'error');
    } finally {
      setLaunchingSsoId(null);
    }
  }

  async function handleProvisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUserId || !username || !password) {
      toast('Please complete all required fields', 'error');
      return;
    }

    setProvisioning(true);
    try {
      const res = await api.email.adminProvision({
        targetUserId,
        username,
        domain: domainStr.trim() || undefined,
        password,
        storageQuotaMb: parseInt(storageQuotaMb, 10) || 5120,
        dailySendLimit: parseInt(dailySendLimit, 10) || 1000,
        isInternal,
      });

      toast(res.message, 'success');
      setShowProvisionModal(false);
      setUsername('');
      setPassword('');
      loadAllData();
    } catch (err: any) {
      toast(err.message || 'Failed to provision mail account', 'error');
    } finally {
      setProvisioning(false);
    }
  }

  async function handleDeleteMailbox(id: string, emailStr: string) {
    if (!confirm(`Are you sure you want to delete mailbox "${emailStr}"?`)) return;
    try {
      await api.email.deleteMailbox(id);
      toast(`Deleted mailbox "${emailStr}"`, 'info');
      loadAllData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete mailbox', 'error');
    }
  }

  async function handleAddDomainSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newDomainInput.trim()) return;

    setAddingDomain(true);
    try {
      await api.email.addDomain(newDomainInput.trim());
      toast(`Added domain "${newDomainInput.trim()}"`, 'success');
      setNewDomainInput('');
      loadAllData();
    } catch (err: any) {
      toast(err.message || 'Failed to add custom domain', 'error');
    } finally {
      setAddingDomain(false);
    }
  }

  async function handleVerifyDomain(id: string) {
    setVerifyingDomainId(id);
    try {
      const res = await api.email.verifyDomain(id);
      toast(res.message, res.verified ? 'success' : 'info');
      loadAllData();
    } catch (err: any) {
      toast(err.message || 'Failed to verify domain DNS', 'error');
    } finally {
      setVerifyingDomainId(null);
    }
  }

  if (loading) return <Spinner label="Loading Webmail Cluster Control Center..." />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <PageHeader
        title="Webmail & Mail Cluster Control Center"
        description="Configure target VPS host nodes for Webmail execution, attach S3/R2 object storage for attachment offloading, monitor mail cluster telemetry, and manage mailboxes."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleTestGlobalSmtp} loading={testingSmtp}>
              <Zap className="w-4 h-4 mr-1 text-amber-400" />
              Test Outbound SMTP
            </Button>
            <Button size="sm" variant="secondary" onClick={handleVerifyS3Connection} loading={verifyingS3}>
              <HardDrive className="w-4 h-4 mr-1 text-sky-400" />
              Verify S3 Handshake
            </Button>
            <Button size="sm" onClick={() => setShowProvisionModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Provision Mail Account
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* S3 Handshake Banner */}
      {s3Result && (
        <div
          className={`p-4 rounded-2xl border ${
            s3Result.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          } text-xs flex items-center justify-between shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-center gap-2">
            {s3Result.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <div>
              <span className="font-bold">{s3Result.ok ? 'S3/R2 Object Store Live Handshake Verified' : 'S3 Handshake Failed:'}</span>
              <p className="opacity-90">{s3Result.message || s3Result.error}</p>
            </div>
          </div>
          {s3Result.latencyMs && (
            <span className="font-mono text-[11px] bg-slate-900 border border-slate-700/60 px-3 py-1 rounded-full text-emerald-400 font-semibold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> {s3Result.latencyMs}ms Latency
            </span>
          )}
        </div>
      )}

      {/* Outbound SMTP Banner */}
      {smtpResult && (
        <div
          className={`p-4 rounded-2xl border ${
            smtpResult.ok
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          } text-xs flex items-center justify-between shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <span className="font-bold">{smtpResult.ok ? 'Outbound SMTP Relay Active' : 'Outbound SMTP Relay Failure:'}</span>
              <p className="opacity-90">{smtpResult.message}</p>
            </div>
          </div>
          {smtpResult.latencyMs && (
            <span className="font-mono text-[11px] bg-slate-900 border border-slate-700/60 px-3 py-1 rounded-full text-sky-400 font-semibold">
              {smtpResult.latencyMs}ms
            </span>
          )}
        </div>
      )}

      {/* Telemetry Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-slate-900/60 border-slate-800/80 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Mailboxes Active</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{telemetry?.totalMailboxes ?? mailboxes.length}</h3>
            </div>
            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
              <Mail className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Across all customer & dev accounts
          </p>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800/80 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Storage Usage</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">
                {((telemetry?.totalUsedStorageMb ?? 0) / 1024).toFixed(1)} GB
              </h3>
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-white">
              <HardDrive className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (((telemetry?.totalUsedStorageMb ?? 0) / Math.max(1, telemetry?.totalStorageMb ?? 1)) * 100)
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
              <span>Used of {((telemetry?.totalStorageMb ?? 0) / 1024).toFixed(0)} GB quota</span>
              <span className="font-semibold text-neutral-300">
                {(((telemetry?.totalUsedStorageMb ?? 0) / Math.max(1, telemetry?.totalStorageMb ?? 1)) * 100).toFixed(0)}%
              </span>
            </p>
          </div>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800/80 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Target VPS Host Node</p>
              <h3 className="text-lg font-bold text-slate-100 mt-1 truncate max-w-[160px]">
                {telemetry?.assignedNode ? telemetry.assignedNode.label : 'Default Host Node'}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <Server className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1 font-mono">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            {telemetry?.assignedNode ? telemetry.assignedNode.ip : 'Local Cluster Engine'}
          </p>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800/80 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">S3 Attachment Storage</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    telemetry?.s3Configured
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {telemetry?.s3Configured ? 'Attached' : 'Local Disk Only'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 truncate">
            {telemetry?.s3BucketName ? `Bucket: ${telemetry.s3BucketName}` : 'Attach Cloudflare R2 / S3 for external VPS'}
          </p>
        </Card>
      </div>

      {/* Main Tabbed Interface */}
      <Card className="bg-slate-900/70 border-slate-800/80 backdrop-blur-xl overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800/80 px-6 pt-4 gap-6">
          <button
            onClick={() => setActiveTab('node_s3')}
            className={`pb-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'node_s3'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            VPS Node & S3 Storage Config
          </button>

          <button
            onClick={() => setActiveTab('mailboxes')}
            className={`pb-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'mailboxes'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            Mailboxes & Provisioning ({mailboxes.length})
          </button>

          <button
            onClick={() => setActiveTab('domains')}
            className={`pb-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'domains'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            Domains & DNS Records ({domains.length})
          </button>
        </div>

        {/* Tab 1 Content — Target VPS Node & S3 Storage Settings */}
        {activeTab === 'node_s3' && (
          <form onSubmit={handleSaveConfig} className="p-6 space-y-8">
            {/* Section A: Target VPS Host Node Selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-slate-100">Target VPS Host Node Selection</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4 max-w-3xl">
                Choose which registered VPS compute node hosts the Webmail stack (WildDuck IMAP/SMTP engine, Redis, & Webmail UI). 
                If unselected, the platform defaults to running on the main system compute engine.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div
                  onClick={() => setConfig((prev) => ({ ...prev, mailNodeId: null }))}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    config.mailNodeId === null
                      ? 'bg-sky-500/10 border-sky-500 text-sky-200 shadow-md shadow-sky-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-100">Default System Node</span>
                    {config.mailNodeId === null && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                  </div>
                  <p className="text-xs opacity-75">Run Webmail natively on the primary cluster API node</p>
                </div>

                {nodes.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => setConfig((prev) => ({ ...prev, mailNodeId: n.id }))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      config.mailNodeId === n.id
                        ? 'bg-sky-500/10 border-sky-500 text-sky-200 shadow-md shadow-sky-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-100">{n.label}</span>
                      {config.mailNodeId === n.id && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                    </div>
                    <p className="text-xs font-mono text-slate-400 mb-2">IP: {n.ip}</p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        n.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {n.isActive ? 'Active Node' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-slate-800/80" />

            {/* Section B: S3 / Cloudflare R2 Attachment Vault Storage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-100">S3 / Cloudflare R2 Storage Attachment Extension</h3>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleVerifyS3Connection}
                  loading={verifyingS3}
                >
                  <CloudCheck className="w-4 h-4 mr-1 text-emerald-400" />
                  Verify S3 Connection
                </Button>
              </div>
              <p className="text-xs text-slate-400 mb-6 max-w-3xl">
                Extend webmail attachment storage beyond VPS local storage limits by connecting Cloudflare R2, AWS S3, or any S3-compatible object store.
                Credentials are encrypted using AES-256 GCM before storage.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    S3 Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={config.s3Endpoint}
                    onChange={(e) => setConfig((prev) => ({ ...prev, s3Endpoint: e.target.value }))}
                    placeholder="https://<account-id>.r2.cloudflarestorage.com"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Cloudflare R2 or AWS S3 endpoint hostname</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    value={config.s3BucketName}
                    onChange={(e) => setConfig((prev) => ({ ...prev, s3BucketName: e.target.value }))}
                    placeholder="shanutechx-webmail-attachments"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    S3 Region
                  </label>
                  <input
                    type="text"
                    value={config.s3Region}
                    onChange={(e) => setConfig((prev) => ({ ...prev, s3Region: e.target.value }))}
                    placeholder="auto"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    value={config.s3AccessKeyId}
                    onChange={(e) => setConfig((prev) => ({ ...prev, s3AccessKeyId: e.target.value }))}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Secret Access Key (Encrypted at Rest)</span>
                    {config.hasSecretAccessKey && (
                      <span className="text-[11px] text-emerald-400 font-normal flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Secret already set in vault
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={s3SecretAccessKey}
                    onChange={(e) => setS3SecretAccessKey(e.target.value)}
                    placeholder={config.hasSecretAccessKey ? '•••••••••••••••• (Leave blank to keep current secret)' : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={config.autoSyncAttachments}
                    onChange={(e) => setConfig((prev) => ({ ...prev, autoSyncAttachments: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                  />
                  <label htmlFor="autoSync" className="text-xs text-slate-300 cursor-pointer">
                    <span className="font-bold text-slate-100 block">Auto-Sync Webmail Attachments to S3</span>
                    Automatically stream incoming and outgoing email file attachments directly into the configured S3 bucket to save VPS local disk space.
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800/80">
              <Button type="submit" loading={savingConfig}>
                Save Webmail Cluster Config
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2 Content — Mailbox Accounts List & Provisioning */}
        {activeTab === 'mailboxes' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">Provisioned Webmail Accounts</h3>
                <p className="text-xs text-slate-400">View customer mailboxes, inspect resource usage, and provision staff or customer accounts.</p>
              </div>
              <Button size="sm" onClick={() => setShowProvisionModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Provision Mailbox
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Mailbox Email</th>
                    <th className="p-3.5">Owner User</th>
                    <th className="p-3.5">Storage Quota</th>
                    <th className="p-3.5">Daily Limits</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {mailboxes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No mailboxes provisioned yet.
                      </td>
                    </tr>
                  ) : (
                    mailboxes.map((mb) => (
                      <tr key={mb.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-bold text-slate-100">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-sky-400" />
                            <span>{mb.email}</span>
                            {mb.isInternal && (
                              <span className="text-[10px] bg-white/10 text-neutral-300 border border-white/15 px-2 py-0.5 rounded-full font-semibold">
                                System / Permanent
                              </span>
                            )}
                          </div>
                          {revealedPasswords[mb.id] && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                {revealedPasswords[mb.id]}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(revealedPasswords[mb.id]);
                                  setCopiedPasswordId(mb.id);
                                  setTimeout(() => setCopiedPasswordId(null), 2000);
                                }}
                                className="text-[10px] text-slate-400 hover:text-white underline font-mono"
                                title="Copy Password"
                              >
                                {copiedPasswordId === mb.id ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="block text-slate-200">{mb.userEmail}</span>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {mb.userId}</span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-200">
                            {mb.storageUsedMb} MB / {mb.storageQuotaMb} MB
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="text-slate-300">
                            {mb.dailySendCount} / {mb.dailySendLimit} per day
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              mb.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {mb.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRevealPassword(mb.id)}
                            title="Reveal Decrypted Password"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleLaunchSso(mb.id)}
                            disabled={launchingSsoId === mb.id}
                            title="Launch Standalone Webmail SSO"
                          >
                            {launchingSsoId === mb.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            <span className="ml-1 text-xs">SSO</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteMailbox(mb.id, mb.email)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Password Reveal Container */}
            {Object.keys(revealedPasswords).length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4" /> Decrypted Mailbox Credentials (Audit Logged)
                </h4>
                {Object.entries(revealedPasswords).map(([id, pass]) => {
                  const mb = mailboxes.find((m) => m.id === id);
                  return (
                    <div key={id} className="text-xs font-mono text-slate-200 flex justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span>{mb?.email || id}:</span>
                      <span className="text-amber-400 font-bold">{pass}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3 Content — Custom Domains & DNS Setup */}
        {activeTab === 'domains' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">Custom Email Domains & DNS Verification</h3>
                <p className="text-xs text-slate-400">Configure custom domain MX, SPF, DKIM, and DMARC records for corporate email delivery.</p>
              </div>
            </div>

            {/* Add Domain Form */}
            <form onSubmit={handleAddDomainSubmit} className="flex gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <input
                type="text"
                value={newDomainInput}
                onChange={(e) => setNewDomainInput(e.target.value)}
                placeholder="example.com"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
              <Button type="submit" loading={addingDomain}>
                + Add Domain
              </Button>
            </form>

            <div className="space-y-4">
              {domains.map((dom) => (
                <div key={dom.id} className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-sky-400" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 font-mono">{dom.domain}</h4>
                        <span className="text-[11px] text-slate-400">Registered: {new Date(dom.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          dom.status === 'verified'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {dom.status === 'verified' ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> DNS Verified</span>
                        ) : (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" /> Pending DNS</span>
                        )}
                      </span>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleVerifyDomain(dom.id)}
                        loading={verifyingDomainId === dom.id}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Verify DNS
                      </Button>
                    </div>
                  </div>

                  {/* DNS Record Snippets */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans font-bold text-sky-400">MX Record</span>
                      <p className="text-slate-200 mt-1 select-all">{dom.mxRecord}</p>
                    </div>

                    <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans font-bold text-sky-400">SPF Record (TXT)</span>
                      <p className="text-slate-200 mt-1 select-all">{dom.spfRecord}</p>
                    </div>

                    <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans font-bold text-sky-400">DKIM Record (TXT)</span>
                      <p className="text-slate-200 mt-1 truncate select-all">{dom.dkimRecord}</p>
                    </div>

                    <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans font-bold text-sky-400">DMARC Record (TXT)</span>
                      <p className="text-slate-200 mt-1 select-all">{dom.dmarcRecord}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-sky-400" /> Provision Corporate Mail Account
              </h3>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Target Customer / Staff User
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName ? `${u.displayName} (${u.email})` : u.email} [{u.role}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="support"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={domainStr}
                    onChange={(e) => setDomainStr(e.target.value)}
                    placeholder="shanutechx.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Initial Account Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Storage Quota (MB)
                  </label>
                  <input
                    type="number"
                    value={storageQuotaMb}
                    onChange={(e) => setStorageQuotaMb(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Daily Send Limit
                  </label>
                  <input
                    type="number"
                    value={dailySendLimit}
                    onChange={(e) => setDailySendLimit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="internalFlag"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700"
                />
                <label htmlFor="internalFlag" className="text-xs text-slate-300 cursor-pointer font-medium">
                  Mark as Permanent Free System / Staff Mailbox
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setShowProvisionModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={provisioning}>
                  Provision Account Now
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
