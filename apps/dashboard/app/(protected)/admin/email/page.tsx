'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, Spinner, ErrorBanner, Button, useToast } from '@/components/ui';
import { IconExternalLink } from '@/components/Icons';
import { api } from '@/lib/api';
import {
  Mail,
  HardDrive,
  Send,
  Globe,
  ShieldCheck,
  Server,
  Key,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Zap,
  X,
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
}

interface UserOption {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

export default function AdminEmailPage() {
  const [stats, setStats] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global SMTP Tester State
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<any>(null);

  // Password Reveal State
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  // Provisioning Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState('shanutechx.com');
  const [password, setPassword] = useState('');
  const [storageQuotaMb, setStorageQuotaMb] = useState('5120');
  const [dailySendLimit, setDailySendLimit] = useState('1000');
  const [provisioning, setProvisioning] = useState(false);

  const { toast } = useToast();

  async function loadAdminData() {
    setLoading(true);
    try {
      const [statsRes, mbRes, usersRes, telemetryRes] = await Promise.all([
        api.email.adminStats(),
        api.email.mailboxes(),
        api.admin.allUsers().catch(() => ({ users: [] })),
        api.email.getTelemetry().catch(() => null),
      ]);

      setStats(statsRes);
      if (telemetryRes && !('error' in (telemetryRes as any))) setTelemetry(telemetryRes);
      setMailboxes(mbRes.mailboxes || []);
      setUsers(usersRes.users || []);
      if (usersRes.users?.length > 0 && !targetUserId) {
        setTargetUserId(usersRes.users[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin email stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function handleTestGlobalSmtp() {
    setTestingSmtp(true);
    try {
      const res = await api.smtp.verifyConnection();
      setSmtpResult(res);
      if (res.ok) {
        toast(`SMTP Relay Handshake Successful (${res.latencyMs}ms)`, 'success');
      } else {
        toast(`SMTP Verification Failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      toast(`SMTP Error: ${err.message}`, 'error');
    } finally {
      setTestingSmtp(false);
    }
  }

  async function handleRevealPassword(id: string) {
    try {
      const res = await api.smtp.revealPassword(id);
      setRevealedPasswords((prev: Record<string, string>) => ({ ...prev, [id]: res.password }));
      toast('Decrypted mailbox password (Audit Logged)', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to reveal password', 'error');
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
        domain: domain.trim() || undefined,
        password,
        storageQuotaMb: parseInt(storageQuotaMb, 10) || 5120,
        dailySendLimit: parseInt(dailySendLimit, 10) || 1000,
      });

      toast(res.message, 'success');
      setShowProvisionModal(false);
      setUsername('');
      setPassword('');
      loadAdminData();
    } catch (err: any) {
      toast(err.message || 'Failed to provision mail account', 'error');
    } finally {
      setProvisioning(false);
    }
  }

  async function handleDeleteMailbox(id: string, email: string) {
    if (!confirm(`Are you sure you want to delete mailbox "${email}"?`)) return;
    try {
      await api.email.deleteMailbox(id);
      toast(`Deleted mailbox "${email}"`, 'info');
      loadAdminData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete mailbox', 'error');
    }
  }

  if (loading) return <Spinner label="Loading Platform Mail Admin Control Center..." />;

  return (
    <div className="space-y-6 animate-fade-in text-white pb-12">
      <PageHeader
        title="Business Email & Platform Mail Cluster Admin"
        description="Monitor mail relay nodes, provision corporate mail accounts, test global SMTP relays, and inspect customer mailbox allocations."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleTestGlobalSmtp} loading={testingSmtp}>
              <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Test Outbound SMTP Relay
            </Button>
            <Button size="sm" onClick={() => setShowProvisionModal(true)}>
              + Provision Mail Account
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Global SMTP Connection Verification Banner */}
      {smtpResult && (
        <div
          className={`p-4 rounded-2xl border ${
            smtpResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          } text-xs flex items-center justify-between shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-center gap-2.5">
            <span className="font-bold flex items-center gap-1.5">
              {smtpResult.ok ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Global Outbound SMTP Active
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Outbound SMTP Failure:
                </>
              )}
            </span>
            <span className="text-neutral-300">{smtpResult.message}</span>
          </div>
          {smtpResult.latencyMs && (
            <span className="font-mono text-[11px] bg-black/60 border border-white/10 px-2.5 py-1 rounded-full text-neutral-300">
              {smtpResult.latencyMs}ms Latency
            </span>
          )}
        </div>
      )}

      {/* S3 Storage & Dev Webmail Banner */}
      <div className="p-5 rounded-2xl border border-white/10 bg-[#141416] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Mail Cluster Engine & S3 Storage</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                WildDuck Cluster
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {telemetry?.s3Configured
                ? `Attached Storage Bucket: ${telemetry.s3BucketName || 'Active'}`
                : 'S3 Object Storage is unconfigured (Local VPS disk storage in use).'}
              {telemetry?.assignedNode && ` • Host Node: ${telemetry.assignedNode.label} (${telemetry.assignedNode.ip})`}
            </p>
          </div>
        </div>
        <a
          href="/dev/webmail"
          className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs transition-all shadow-md shrink-0 flex items-center gap-1.5"
        >
          <span>Dev Control Center &amp; Storage Setup</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Admin Telemetry Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 border border-white/10 rounded-2xl bg-[#141416] space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400 font-medium">Total Active Mailboxes</p>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300">
              <Mail className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {telemetry?.totalMailboxes ?? stats?.totalMailboxes ?? 0}
          </p>
        </div>

        <div className="p-5 border border-white/10 rounded-2xl bg-[#141416] space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400 font-medium">Allocated Storage</p>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {telemetry?.totalStorageMb ?? stats?.totalStorageMb ?? 0} <span className="text-xs font-normal text-neutral-400">MB</span>
          </p>
        </div>

        <div className="p-5 border border-white/10 rounded-2xl bg-[#141416] space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400 font-medium">Emails Sent Today</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            {telemetry?.totalSentToday ?? stats?.totalSentToday ?? 0}
          </p>
        </div>

        <div className="p-5 border border-white/10 rounded-2xl bg-[#141416] space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400 font-medium">Managed Custom Domains</p>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300">
              <Globe className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {telemetry?.totalDomains ?? stats?.totalDomains ?? 0}
          </p>
        </div>
      </div>

      {/* Customer Mailboxes Table */}
      <div className="bg-[#141416] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Customer Mailbox Quotas &amp; Accounts</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Manage storage allocations, daily message limits, reveal vault credentials, and manage mailbox states.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            {mailboxes.length} Provisioned
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-white/[0.03] text-neutral-400 border-b border-white/10 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Assigned Customer</th>
                <th className="p-3.5">Mailbox Email</th>
                <th className="p-3.5">SMTP Host &amp; Port</th>
                <th className="p-3.5">Password</th>
                <th className="p-3.5">Storage Quota</th>
                <th className="p-3.5">Daily Sends</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {mailboxes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-neutral-400 font-sans">
                    No mailboxes provisioned yet. Click <strong>+ Provision Mail Account</strong> above to add one.
                  </td>
                </tr>
              ) : (
                mailboxes.map((mb: Mailbox) => (
                  <tr key={mb.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 font-sans">
                      <p className="font-bold text-white">{mb.userDisplayName || mb.userEmail}</p>
                      <p className="text-[11px] text-neutral-400 font-mono">{mb.userEmail}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-white font-mono">{mb.email}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">User: {mb.username}</p>
                    </td>
                    <td className="p-3.5 font-mono text-neutral-300">
                      {mb.smtpHost}:{mb.smtpPort}
                    </td>
                    <td className="p-3.5 font-mono">
                      {revealedPasswords[mb.id] ? (
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          {revealedPasswords[mb.id]}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRevealPassword(mb.id)}
                          className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-neutral-400" />
                          <span>Reveal</span>
                        </button>
                      )}
                    </td>
                    <td className="p-3.5 text-neutral-300 font-mono">
                      <div className="space-y-1">
                        <span>{mb.storageUsedMb} / {mb.storageQuotaMb} MB</span>
                        <div className="w-20 bg-neutral-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-400 h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.round((mb.storageUsedMb / Math.max(1, mb.storageQuotaMb)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-neutral-300 font-mono">
                      {mb.dailySendCount} / {mb.dailySendLimit}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                          mb.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {mb.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteMailbox(mb.id, mb.email)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/15 rounded-3xl p-6 md:p-8 w-full max-w-lg space-y-5 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Provision Customer Mailbox</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Assign a dedicated mailbox on the WildDuck mail cluster.
                </p>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Assign To User Account <span className="text-red-400">*</span>
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                >
                  {users.map((u: UserOption) => (
                    <option key={u.id} value={u.id} className="bg-[#121215] text-white">
                      {u.displayName ? `${u.displayName} (${u.email})` : u.email} [{u.role}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">
                    Username / Prefix <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="support"
                    className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="shanutechx.com"
                    className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">
                    Storage Quota (MB)
                  </label>
                  <input
                    type="number"
                    value={storageQuotaMb}
                    onChange={(e) => setStorageQuotaMb(e.target.value)}
                    placeholder="5120"
                    className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">
                    Daily Send Limit (emails/day)
                  </label>
                  <input
                    type="number"
                    value={dailySendLimit}
                    onChange={(e) => setDailySendLimit(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning}
                  className="px-5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold shadow-md transition-colors disabled:opacity-50"
                >
                  {provisioning ? 'Provisioning...' : 'Provision Mailbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
