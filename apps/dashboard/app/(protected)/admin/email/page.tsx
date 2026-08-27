'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Spinner, ErrorBanner, Button, Modal, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';

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
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const [statsRes, mbRes, usersRes] = await Promise.all([
        api.email.adminStats(),
        api.email.mailboxes(),
        api.admin.allUsers().catch(() => ({ users: [] })),
      ]);
      setStats(statsRes);
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

  if (loading) return <Spinner label="Loading Admin Shared SMTP Manager..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Admin Shared SMTP & Email Service Manager"
        description="Monitor mail relay nodes, provision customer email accounts, configure custom resource quotas, and assign limits."
        action={
          <Button size="sm" onClick={() => setShowProvisionModal(true)}>
            + Provision Mail Account
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Admin Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
            <p className="text-xs text-text-muted">Total Active Mailboxes</p>
            <p className="text-xl font-bold text-white font-mono">{stats.totalMailboxes}</p>
          </div>
          <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
            <p className="text-xs text-text-muted">Allocated Storage Quota</p>
            <p className="text-xl font-bold text-accent-cyan font-mono">{stats.totalStorageMb} MB</p>
          </div>
          <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
            <p className="text-xs text-text-muted">Emails Sent Today</p>
            <p className="text-xl font-bold text-emerald-400 font-mono">{stats.totalSentToday}</p>
          </div>
          <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
            <p className="text-xs text-text-muted">Verified Email Domains</p>
            <p className="text-xl font-bold text-accent-violet-light font-mono">{stats.totalDomains}</p>
          </div>
        </div>
      )}

      {/* Customer Mailboxes Table */}
      <Card
        title="Customer Mailbox Quotas & Access Control"
        description="Manage storage limits, daily send quotas, and assigned user accounts for shared SMTP host."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-white/[0.03] text-text-muted border-b border-white/10 uppercase">
              <tr>
                <th className="p-3">Assigned User</th>
                <th className="p-3">Email Address / Username</th>
                <th className="p-3">SMTP Host</th>
                <th className="p-3">Storage Quota</th>
                <th className="p-3">Daily Send Limit</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {mailboxes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-muted font-sans">
                    No mailboxes provisioned yet. Click <strong>+ Provision Mail Account</strong> above to add one.
                  </td>
                </tr>
              ) : (
                mailboxes.map((mb) => (
                  <tr key={mb.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-sans">
                      <p className="font-bold text-white">{mb.userDisplayName || mb.userEmail}</p>
                      <p className="text-[10px] text-text-muted">{mb.userEmail}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-accent-cyan font-mono">{mb.email}</p>
                      <p className="text-[10px] text-text-faint font-mono">{mb.username}</p>
                    </td>
                    <td className="p-3 font-mono text-white">
                      {mb.smtpHost}:{mb.smtpPort}
                    </td>
                    <td className="p-3 text-white font-mono">
                      {mb.storageUsedMb} / {mb.storageQuotaMb} MB
                    </td>
                    <td className="p-3 text-white font-mono">
                      {mb.dailySendCount} / {mb.dailySendLimit} msgs
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          mb.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {mb.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteMailbox(mb.id, mb.email)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Admin Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Provision Customer Mail Account
              </h3>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-text-muted hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">
                  Assign To User Account <span className="text-red-400">*</span>
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-bg text-white">
                      {u.displayName ? `${u.displayName} (${u.email})` : u.email} [{u.role}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">
                    Username / Prefix <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. support or john"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="shanutechx.com"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">
                    Storage Quota (MB)
                  </label>
                  <input
                    type="number"
                    value={storageQuotaMb}
                    onChange={(e) => setStorageQuotaMb(e.target.value)}
                    placeholder="5120"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">
                    Daily Send Limit (emails/day)
                  </label>
                  <input
                    type="number"
                    value={dailySendLimit}
                    onChange={(e) => setDailySendLimit(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowProvisionModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={provisioning}>
                  Provision Mailbox
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
