'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import {
  Mail,
  ExternalLink,
  Key,
  Shield,
  HardDrive,
  Copy,
  Check,
  RefreshCw,
  Server,
  Layers,
  Settings,
  ArrowRight,
  Lock,
  Globe,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { WebmailCredentialsModal } from '@/components/webmail/WebmailCredentialsModal';

interface MailboxItem {
  id: string;
  email: string;
  username: string;
  domain: string;
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
  aliases?: string[];
  maxAliases?: number;
  isExpired: boolean;
  isSuspended: boolean;
}

export default function WebmailLaunchpadPage() {
  const { toast } = useToast();
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // Modals state
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [credsMailboxId, setCredsMailboxId] = useState<string | undefined>();

  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordMailbox, setPasswordMailbox] = useState<MailboxItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Quick clipboard copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadMailboxes = async () => {
    setLoading(true);
    try {
      const res = await api.email.mailboxes();
      const list = res.mailboxes || [];
      setMailboxes(list);
      if (list.length > 0 && !selectedMailboxId) {
        setSelectedMailboxId(list[0].id);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to load mail accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMailboxes();
  }, []);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast(`Copied ${key} to clipboard`, 'success');
  };

  const handleLaunchWebmail = async (mailboxId: string) => {
    setLaunchingId(mailboxId);
    try {
      const res = await api.webmail.getSsoTicket(mailboxId);
      if (res.ssoToken) {
        // Build standalone webmail URL: port 3002 or relative
        const webmailPort = window.location.hostname === 'localhost' ? 'http://localhost:3002' : '/webmail';
        const targetUrl = `${webmailPort}?ssoToken=${encodeURIComponent(res.ssoToken)}`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        toast('Standalone Webmail launched in new tab', 'success');
      } else {
        toast('Failed to generate SSO ticket', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to launch standalone webmail', 'error');
    } finally {
      setLaunchingId(null);
    }
  };

  const handleOpenPasswordModal = (mb: MailboxItem) => {
    setPasswordMailbox(mb);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordMailbox) return;
    if (newPassword.length < 8) {
      toast('Password must be at least 8 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await api.email.changePassword(passwordMailbox.id, newPassword);
      toast(res.message || 'Mailbox password updated successfully', 'success');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast(err.message || 'Failed to update mailbox password', 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Business Webmail</h1>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Standalone Architecture
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Access your mailbox via our dedicated high-performance webmail client or connect via desktop & mobile mail applications.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/email"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition-colors inline-flex items-center gap-2"
          >
            <Settings className="w-4 h-4 text-gray-400" />
            Manage Accounts & DNS
          </Link>
          {mailboxes.length > 0 && (
            <button
              onClick={() => handleLaunchWebmail(selectedMailboxId || mailboxes[0].id)}
              disabled={!!launchingId}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/20 transition-all inline-flex items-center gap-2 disabled:opacity-50"
            >
              {launchingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Launch Webmail Client
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-gray-400">Loading business mailboxes...</p>
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10 max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Mail className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-white">No Mailboxes Provisioned Yet</h2>
          <p className="text-sm text-gray-400">
            You don't have any active business mailboxes. Provision custom domain email addresses under your subscription plan to get started.
          </p>
          <div className="pt-2">
            <Link
              href="/email"
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configure Mailboxes & DNS
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main 2 columns: Mailbox cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Active Business Mailboxes ({mailboxes.length})
              </h2>
              <button
                onClick={loadMailboxes}
                className="text-xs text-gray-400 hover:text-gray-200 inline-flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {mailboxes.map((mb) => {
                const isSelected = mb.id === selectedMailboxId;
                const storagePercent = Math.min(100, Math.round((mb.storageUsedMb / (mb.storageQuotaMb || 1024)) * 100));
                const isStorageWarning = storagePercent >= 80;

                return (
                  <div
                    key={mb.id}
                    className={`p-6 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-gradient-to-b from-white/[0.06] to-white/[0.02] border-indigo-500/40 shadow-xl shadow-indigo-500/5'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    }`}
                    onClick={() => setSelectedMailboxId(mb.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-semibold text-lg flex-shrink-0">
                          {mb.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white text-base">{mb.email}</h3>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                mb.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {mb.status.toUpperCase()}
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-gray-400 border border-white/10">
                              {mb.planName}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Domain: <span className="text-gray-300 font-mono">{mb.domain}</span>
                          </p>
                        </div>
                      </div>

                      {/* Primary SSO Launch Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchWebmail(mb.id);
                        }}
                        disabled={launchingId === mb.id}
                        className="px-4 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium text-xs inline-flex items-center gap-2 shadow-md transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        {launchingId === mb.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        Open Webmail
                      </button>
                    </div>

                    {/* Storage usage meter */}
                    <div className="mt-6 pt-5 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                          Storage Quota ({mb.storageUsedMb} MB / {mb.storageQuotaMb} MB)
                        </span>
                        <span className={`font-mono font-medium ${isStorageWarning ? 'text-amber-400' : 'text-gray-300'}`}>
                          {storagePercent}% Used
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            storagePercent >= 90
                              ? 'bg-red-500'
                              : storagePercent >= 75
                              ? 'bg-amber-500'
                              : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                          }`}
                          style={{ width: `${storagePercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Aliases badge section */}
                    {mb.aliases && mb.aliases.length > 0 && (
                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">Aliases:</span>
                        {mb.aliases.map((alias) => (
                          <span
                            key={alias}
                            className="px-2 py-0.5 text-xs font-mono rounded bg-white/[0.04] border border-white/10 text-gray-300"
                          >
                            {alias}@{mb.domain}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Secondary Actions Bar */}
                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCredsMailboxId(mb.id);
                            setShowCredsModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Key className="w-3.5 h-3.5 text-indigo-400" />
                          Client Setup & Credentials
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPasswordModal(mb);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          Change Password
                        </button>
                      </div>

                      <Link
                        href={`/email?mailboxId=${mb.id}`}
                        className="text-xs text-gray-400 hover:text-indigo-400 inline-flex items-center gap-1 transition-colors"
                      >
                        Advanced Mailbox Settings <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: Connection details & guides */}
          <div className="space-y-6">
            {/* Third-Party Client Connection Card */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
                <Server className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">Email Client Settings (IMAP / SMTP)</h3>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                Connect your business mailbox with Apple Mail, Outlook, Thunderbird, or mobile mail apps using these verified server endpoints:
              </p>

              <div className="space-y-3 font-mono text-xs">
                {/* Incoming IMAP */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-gray-400 text-[11px] font-sans">
                    <span>Incoming (IMAP / SSL)</span>
                    <button
                      onClick={() => copyText('mail.shanutechx.com', 'IMAP Host')}
                      className="text-gray-400 hover:text-white"
                    >
                      {copiedKey === 'IMAP Host' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-white font-medium">mail.shanutechx.com</div>
                  <div className="text-gray-500 text-[11px]">Port: 993 &bull; Security: SSL/TLS</div>
                </div>

                {/* Outgoing SMTP */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-gray-400 text-[11px] font-sans">
                    <span>Outgoing (SMTP / SSL)</span>
                    <button
                      onClick={() => copyText('mail.shanutechx.com', 'SMTP Host')}
                      className="text-gray-400 hover:text-white"
                    >
                      {copiedKey === 'SMTP Host' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-white font-medium">mail.shanutechx.com</div>
                  <div className="text-gray-500 text-[11px]">Port: 465 (SSL) or 587 (STARTTLS)</div>
                </div>

                {/* Username */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <div className="text-gray-400 text-[11px] font-sans">Authentication Username</div>
                  <div className="text-indigo-300 font-medium truncate">Your full email address</div>
                  <div className="text-gray-500 text-[11px]">Password: Your mailbox password</div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setCredsMailboxId(selectedMailboxId || mailboxes[0]?.id);
                    setShowCredsModal(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  View Decrypted Credentials & Code
                </button>
              </div>
            </div>

            {/* Standalone Client Highlights */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/20 via-purple-950/10 to-transparent border border-indigo-500/20 space-y-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <Shield className="w-4 h-4" />
                <h4 className="font-semibold text-xs uppercase tracking-wider">Enterprise Security</h4>
              </div>
              <ul className="text-xs text-gray-300 space-y-2.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Single-use encrypted SSO tickets (60s TTL)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Isolated standalone browser tab architecture</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Zero cross-origin credential exposure</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>WildDuck enterprise mail storage backend</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Webmail Credentials Modal */}
      {showCredsModal && (
        <WebmailCredentialsModal
          isOpen={showCredsModal}
          onClose={() => setShowCredsModal(false)}
          selectedMailboxId={credsMailboxId}
        />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && passwordMailbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-white/15 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Change Mailbox Password</h3>
                  <p className="text-xs text-gray-400 font-mono">{passwordMailbox.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Confirm New Password</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                Updating this password will immediately update your IMAP, POP3, and SMTP authentication credentials and encrypt the secret in the platform vault.
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {updatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
