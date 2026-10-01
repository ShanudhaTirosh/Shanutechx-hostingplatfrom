'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import DynamicDnsSetupGuide from '@/components/email/DynamicDnsSetupGuide';
import {
  Mail,
  KeyRound,
  Globe,
  Tag,
  Users,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Server,
  Lock,
  Unlock,
  Key,
  Database,
  Code2,
  ChevronRight
} from 'lucide-react';

interface Mailbox {
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
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  isSuspended: boolean;
  allowedAdminIds?: string[];
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  customDomain?: string;
  aliases?: string[];
  maxAliases?: number;
  mailHostId?: string;
}

interface DomainRecord {
  id: string;
  domain: string;
  status: 'verified' | 'pending_dns';
  mxRecord: string;
  spfRecord: string;
  dkimRecord: string;
  dmarcRecord: string;
  createdAt: string;
}

interface MailHost {
  id: string;
  label: string;
  hostname: string;
  apiUrl: string;
  status: string;
  isDefault: boolean;
  storageUsedBytes: number;
  storageTotalBytes: number;
  activeConnections: number;
  mailboxCount: number;
  domainCount: number;
}

export default function BusinessEmailManagementDashboard() {
  const [activeTab, setActiveTab] = useState<'mailboxes' | 'dns' | 'credentials' | 'aliases' | 'admin_hosts' | 'admin_bulk'>('mailboxes');

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [mailHosts, setMailHosts] = useState<MailHost[]>([]);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCodeSnippet, setSelectedCodeSnippet] = useState<'node' | 'python' | 'curl'>('node');

  // New Alias input state
  const [newAliasPrefix, setNewAliasPrefix] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);

  // New Domain input state
  const [newDomainName, setNewDomainName] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);

  // Admin Mail Host state
  const [showAddHostModal, setShowAddHostModal] = useState(false);
  const [hostLabel, setHostLabel] = useState('');
  const [hostHostname, setHostHostname] = useState('');
  const [hostApiUrl, setHostApiUrl] = useState('http://localhost:8080');
  const [hostApiKey, setHostApiKey] = useState('');
  const [hostIsDefault, setHostIsDefault] = useState(false);
  const [submittingHost, setSubmittingHost] = useState(false);

  // Bulk Provisioning state
  const [bulkUserId, setBulkUserId] = useState('');
  const [bulkDomain, setBulkDomain] = useState('');
  const [bulkPattern, setBulkPattern] = useState('user{n}');
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkQuota, setBulkQuota] = useState(1024);
  const [bulkHostId, setBulkHostId] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // User details & roles
  const [userRole, setUserRole] = useState<string>('customer');
  const [usersList, setUsersList] = useState<any[]>([]);

  const { toast } = useToast();

  const webmailBaseUrl = process.env.NEXT_PUBLIC_WEBMAIL_URL || 'http://localhost:3002';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mbRes, domRes] = await Promise.all([
        api.email.mailboxes().catch(() => ({ mailboxes: [] })),
        api.email.domains().catch(() => ({ domains: [] })),
      ]);

      const list = mbRes.mailboxes || [];
      setMailboxes(list);
      if (list.length > 0 && !selectedMailboxId) {
        setSelectedMailboxId(list[0].id);
      }

      setDomains(domRes.domains || []);

      // Fetch user role & admin info
      const profile = await api.auth.me().catch(() => null);
      if (profile?.user?.role) {
        setUserRole(profile.user.role);
        if (profile.user.role === 'admin' || profile.user.role === 'dev') {
          fetchAdminData();
        }
      }
    } catch (err: any) {
      toast(err.message || 'Failed to load mailbox management data', 'error');
    }
  };

  const fetchAdminData = async () => {
    try {
      const [hostsRes, healthRes, usersRes] = await Promise.all([
        api.email.getHosts().catch(() => ({ hosts: [] })),
        api.email.getSystemHealth().catch(() => null),
        api.admin.allUsers().catch(() => ({ users: [] })),
      ]);
      setMailHosts(hostsRes.hosts || []);
      setHealthInfo(healthRes);
      setUsersList(usersRes.users || []);
    } catch (_) {}
  };

  const activeMailbox = mailboxes.find((m) => m.id === selectedMailboxId) || mailboxes[0];

  const handleOpenWebmail = (targetMailbox?: Mailbox) => {
    const target = targetMailbox || activeMailbox;
    const webmailUrl = target?.webmailUrl || webmailBaseUrl;
    window.open(webmailUrl, '_blank');
  };

  const handleRevealPassword = async () => {
    if (!activeMailbox) return;
    try {
      const res = await api.email.credentials(activeMailbox.id);
      setRevealedPassword(res.password || '••••••••');
      setShowPassword(true);
    } catch (err: any) {
      toast(err.message || 'Failed to reveal password', 'error');
    }
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMailbox || !newAliasPrefix.trim()) return;
    setAddingAlias(true);
    try {
      await api.smtp.addAlias(activeMailbox.id, newAliasPrefix.trim().toLowerCase());
      toast('Alias created successfully!', 'success');
      setNewAliasPrefix('');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to add alias', 'error');
    } finally {
      setAddingAlias(false);
    }
  };

  const handleRemoveAlias = async (prefix: string) => {
    if (!activeMailbox) return;
    try {
      await api.smtp.removeAlias(activeMailbox.id, prefix);
      toast('Alias removed', 'info');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to remove alias', 'error');
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.includes('.')) {
      toast('Please enter a valid domain name (e.g. company.com)', 'error');
      return;
    }
    setAddingDomain(true);
    try {
      const res = await api.email.addDomain(newDomainName.trim().toLowerCase());
      toast(`Custom domain ${newDomainName} added!`, 'success');
      setDomains((prev) => [...prev, res.domain]);
      setNewDomainName('');
    } catch (err: any) {
      toast(err.message || 'Failed to add domain', 'error');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRecheckDns = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await api.email.verifyDomain(domainId);
      toast(res.message || 'DNS verification checked', res.verified ? 'success' : 'info');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'DNS check failed', 'error');
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleAddMailHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingHost(true);
    try {
      const res = await api.email.addHost({
        label: hostLabel,
        hostname: hostHostname,
        apiUrl: hostApiUrl,
        apiKey: hostApiKey,
        isDefault: hostIsDefault,
      });
      toast(res.message || 'Mail host node added successfully!', 'success');
      setShowAddHostModal(false);
      setHostLabel('');
      setHostHostname('');
      setHostApiKey('');
      fetchAdminData();
    } catch (err: any) {
      toast(err.message || 'Failed to add mail host', 'error');
    } finally {
      setSubmittingHost(false);
    }
  };

  const handleTestMailHost = async (hostId: string) => {
    try {
      const res = await api.email.testHost(hostId);
      toast(`Host test status: ${res.status}`, res.status === 'healthy' ? 'success' : 'error');
      fetchAdminData();
    } catch (err: any) {
      toast(err.message || 'Host test failed', 'error');
    }
  };

  const handleDeleteMailHost = async (hostId: string, label: string) => {
    if (!confirm(`Are you sure you want to remove mail host "${label}"?`)) return;
    try {
      await api.email.deleteHost(hostId);
      toast(`Mail host ${label} removed`, 'info');
      fetchAdminData();
    } catch (err: any) {
      toast(err.message || 'Failed to remove mail host', 'error');
    }
  };

  const handleBulkProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBulk(true);
    try {
      const res = await api.email.bulkProvision({
        targetUserId: bulkUserId || (usersList[0]?.id || ''),
        domain: bulkDomain,
        pattern: bulkPattern,
        count: bulkCount,
        password: bulkPassword,
        storageQuotaMb: bulkQuota,
        mailHostId: bulkHostId || undefined,
      });
      toast(res.message || 'Bulk mailboxes created!', 'success');
      setBulkPassword('');
      fetchData();
      if (userRole === 'admin' || userRole === 'dev') fetchAdminData();
    } catch (err: any) {
      toast(err.message || 'Bulk provisioning failed', 'error');
    } finally {
      setSubmittingBulk(false);
    }
  };

  const handleMailboxAction = async (mailboxId: string, action: 'suspend' | 'unsuspend' | 'reset_password') => {
    try {
      let newPass: string | undefined;
      if (action === 'reset_password') {
        const promptPass = prompt('Enter new password for this mailbox (minimum 8 characters):');
        if (!promptPass || promptPass.length < 8) return toast('Password must be at least 8 characters', 'error');
        newPass = promptPass;
      }
      const res = await api.email.updateMailboxStatus(mailboxId, { action, newPassword: newPass });
      toast(res.message || `Action ${action} completed successfully`, 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || `Failed to perform ${action}`, 'error');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard!`, 'success');
  };

  // Code Snippet Templates
  const getCodeSnippet = () => {
    const host = activeMailbox?.smtpHost || 'mail.shanutechx.com';
    const user = activeMailbox?.email || 'me@shanutechx.com';
    const pass = revealedPassword || 'YOUR_PASSWORD';

    if (selectedCodeSnippet === 'node') {
      return `const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: '${host}',
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: '${user}',
    pass: '${pass}'
  }
});

async function sendMail() {
  const info = await transporter.sendMail({
    from: '"Business App" <${user}>',
    to: "customer@example.com",
    subject: "Hello from ShanuTechX Business Email",
    text: "Transactional mail body",
  });
  console.log("Message sent: %s", info.messageId);
}

sendMail().catch(console.error);`;
    } else if (selectedCodeSnippet === 'python') {
      return `import smtplib
from email.mime.text import MIMEText

smtp_server = "${host}"
port = 587
sender_email = "${user}"
password = "${pass}"

message = MIMEText("Transactional mail body")
message["Subject"] = "Hello from ShanuTechX Business Email"
message["From"] = sender_email
message["To"] = "customer@example.com"

with smtplib.SMTP(smtp_server, port) as server:
    server.starttls()
    server.login(sender_email, password)
    server.sendmail(sender_email, ["customer@example.com"], message.as_string())
print("Email sent successfully!")`;
    } else {
      return `curl --ssl-reqd \\
  --url 'smtp://${host}:587' \\
  --user '${user}:${pass}' \\
  --mail-from '${user}' \\
  --mail-rcpt 'customer@example.com' \\
  --upload-file - <<EOF
From: "${user}" <${user}>
To: customer@example.com
Subject: Hello from ShanuTechX

This is a test email sent via cURL command line.
EOF`;
    }
  };

  const isAdminOrDev = userRole === 'admin' || userRole === 'dev';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 space-y-8 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-xl shadow-indigo-500/20">
            <Mail className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Business Email & DNS Management</span>
              <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                WildDuck Engine
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Manage corporate mailboxes, custom domain DNS verification, SMTP developer credentials, and multi-node mail hosts.
            </p>
          </div>
        </div>

        {/* Global Action Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleOpenWebmail()}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs md:text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Launch Webmail Portal ↗</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'mailboxes', label: 'Mailboxes & Aliases', icon: Mail },
          { id: 'dns', label: 'Domain & DNS Checklist', icon: Globe },
          { id: 'credentials', label: 'Developer Credentials', icon: KeyRound },
          { id: 'aliases', label: 'Alias Configuration', icon: Tag },
          ...(isAdminOrDev
            ? [
                { id: 'admin_hosts', label: 'Mail Hosts (Nodes)', icon: Server },
                { id: 'admin_bulk', label: 'Bulk Creation & Health', icon: Database },
              ]
            : []),
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MAILBOXES LIST & ALIAS PROMPTS */}
      {activeTab === 'mailboxes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight">Provisioned Corporate Mailboxes</h2>
            <span className="text-xs text-slate-400 font-mono">Total: {mailboxes.length} Mailboxes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mailboxes.length === 0 ? (
              <div className="col-span-full bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
                <Mail className="h-12 w-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No Mailboxes Provisioned Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Mailboxes are automatically provisioned upon subscription payment approval or by platform administrators.
                </p>
              </div>
            ) : (
              mailboxes.map((mb) => {
                const usedPct = Math.min(100, Math.round((mb.storageUsedMb / (mb.storageQuotaMb || 1024)) * 100));
                const hasAliases = Array.isArray(mb.aliases) && mb.aliases.length > 0;

                return (
                  <div
                    key={mb.id}
                    className={`bg-slate-900 border rounded-3xl p-6 space-y-5 transition-all shadow-xl ${
                      selectedMailboxId === mb.id ? 'border-indigo-500 shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono font-bold text-sm text-indigo-400 block truncate">{mb.email}</span>
                        <span className="text-[11px] text-slate-400 font-sans block mt-0.5">{mb.planName || 'Pro Business Email'}</span>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          mb.isSuspended ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {mb.isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </div>

                    {/* Storage Usage Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono text-slate-400">
                        <span>Storage Usage</span>
                        <span>{mb.storageUsedMb} / {mb.storageQuotaMb} MB ({usedPct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-amber-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.max(4, usedPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Aliases Pill / Prompt */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Email Aliases</span>
                      {hasAliases ? (
                        <div className="flex flex-wrap gap-1.5">
                          {mb.aliases!.map((alias) => (
                            <span key={alias} className="bg-slate-800 text-slate-200 text-[11px] font-mono px-2.5 py-1 rounded-xl border border-slate-700/60">
                              {alias}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedMailboxId(mb.id);
                            setActiveTab('aliases');
                          }}
                          className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl py-2 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Configure Alias Prompt</span>
                        </button>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                      <button
                        onClick={() => {
                          setSelectedMailboxId(mb.id);
                          setActiveTab('credentials');
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>SMTP Credentials</span>
                      </button>

                      <button
                        onClick={() => handleOpenWebmail(mb)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1"
                      >
                        <span>Open Webmail</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DOMAIN & DNS CHECKLIST */}
      {activeTab === 'dns' && (
        <div className="space-y-8 max-w-5xl mx-auto">
          <DynamicDnsSetupGuide
            domain={activeMailbox?.customDomain || activeMailbox?.domain || 'shanutechx.com'}
            planTier={activeMailbox?.planName || 'pro'}
            aliases={activeMailbox?.aliases}
            smtpUsername={activeMailbox?.username}
          />

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
              <div>
                <h2 className="text-base font-bold text-white">Custom Domain Registration & DNS Verification</h2>
                <p className="text-xs text-slate-400">Check required MX, SPF, DKIM, and DMARC records for your custom domain.</p>
              </div>

              <form onSubmit={handleAddDomain} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="company.com"
                  className="bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={addingDomain}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-2xl shadow-lg transition-all"
                >
                  {addingDomain ? 'Adding...' : '+ Add Domain'}
                </button>
              </form>
            </div>

            {domains.map((dom) => (
              <div key={dom.id} className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-base text-white">{dom.domain}</span>
                    <span
                      className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                        dom.status === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {dom.status === 'verified' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      <span>{dom.status === 'verified' ? 'All DNS Records Verified' : 'DNS Check Pending'}</span>
                    </span>
                  </div>

                  <button
                    onClick={() => handleRecheckDns(dom.id)}
                    disabled={verifyingDomainId === dom.id}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all flex items-center gap-2"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${verifyingDomainId === dom.id ? 'animate-spin' : ''}`} />
                    <span>Re-check DNS</span>
                  </button>
                </div>

                {/* DNS Records Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="text-[11px] font-extrabold text-slate-500 uppercase border-b border-slate-800">
                        <th className="pb-3">Record Type</th>
                        <th className="pb-3">Host / Name</th>
                        <th className="pb-3">Target Value</th>
                        <th className="pb-3">Priority</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      <tr>
                        <td className="py-3 font-bold text-indigo-400">MX</td>
                        <td>@</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.mxRecord || '10 mail.shanutechx.com'}</td>
                        <td>10</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.mxRecord || '10 mail.shanutechx.com', 'MX Record')}
                            className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-indigo-400">TXT (SPF)</td>
                        <td>@</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.spfRecord || 'v=spf1 include:mail.shanutechx.com ~all'}</td>
                        <td>-</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.spfRecord || 'v=spf1 include:mail.shanutechx.com ~all', 'SPF Record')}
                            className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-indigo-400">TXT (DKIM)</td>
                        <td>default._domainkey</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.dkimRecord || 'v=DKIM1; k=rsa; p=MIGf...'}</td>
                        <td>-</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.dkimRecord || 'v=DKIM1; k=rsa; p=MIGf...', 'DKIM Record')}
                            className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-indigo-400">TXT (DMARC)</td>
                        <td>_dmarc</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.dmarcRecord || `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${dom.domain}`}</td>
                        <td>-</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.dmarcRecord || `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${dom.domain}`, 'DMARC Record')}
                            className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DEVELOPER CREDENTIALS & CODE SNIPPETS */}
      {activeTab === 'credentials' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">SMTP & IMAP Developer Credentials</h2>
              <p className="text-xs text-slate-400">Use these parameters for programmatic email sending via Node.js Nodemailer, Python, or cURL.</p>
            </div>

            {/* Mailbox Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Select Mailbox Account</label>
              <select
                value={selectedMailboxId}
                onChange={(e) => {
                  setSelectedMailboxId(e.target.value);
                  setShowPassword(false);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              >
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email} ({m.smtpHost})
                  </option>
                ))}
              </select>
            </div>

            {/* Connection Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                <span className="font-extrabold text-indigo-400 uppercase tracking-wider block">Outbound SMTP Server</span>
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Host:</span>
                    <span className="text-white font-bold">{activeMailbox?.smtpHost || 'mail.shanutechx.com'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">STARTTLS Port:</span>
                    <span className="text-white font-bold">587</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SSL/TLS Port:</span>
                    <span className="text-white font-bold">465</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Security:</span>
                    <span className="text-emerald-400 font-bold">STARTTLS / TLS</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                <span className="font-extrabold text-indigo-400 uppercase tracking-wider block">Inbound IMAP Server</span>
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Host:</span>
                    <span className="text-white font-bold">{activeMailbox?.smtpHost.replace(/^mail\./, 'imap.') || 'imap.shanutechx.com'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SSL/TLS Port:</span>
                    <span className="text-white font-bold">993</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Security:</span>
                    <span className="text-emerald-400 font-bold">SSL / TLS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Authentication Credentials */}
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5 space-y-4">
              <span className="font-extrabold text-xs uppercase tracking-wider text-indigo-300 block">Account Authentication</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block mb-1">Username / Email</span>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                    <span>{activeMailbox?.email || 'me@shanutechx.com'}</span>
                    <button onClick={() => copyToClipboard(activeMailbox?.email || 'me@shanutechx.com', 'Username')} className="text-indigo-400 font-bold text-[11px]">
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Password</span>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                    <span>{showPassword ? revealedPassword : '••••••••••••'}</span>
                    <button onClick={handleRevealPassword} className="text-indigo-400 font-bold text-[11px]">
                      {showPassword ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Snippets Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-indigo-400" /> Code Integration Snippet
                </span>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'node', label: 'Node.js (Nodemailer)' },
                    { id: 'python', label: 'Python (smtplib)' },
                    { id: 'curl', label: 'cURL' },
                  ].map((snip) => (
                    <button
                      key={snip.id}
                      onClick={() => setSelectedCodeSnippet(snip.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedCodeSnippet === snip.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {snip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                <button
                  onClick={() => copyToClipboard(getCodeSnippet(), 'Code Snippet')}
                  className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <pre className="text-emerald-400">{getCodeSnippet()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EMAIL ALIAS CONFIGURATION */}
      {activeTab === 'aliases' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Mailbox Alias Management</h2>
              <p className="text-xs text-slate-400">Configure alias addresses (e.g. sales@domain.com, support@domain.com) routed directly into this mailbox.</p>
            </div>

            {/* Mailbox Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Active Mailbox</label>
              <select
                value={selectedMailboxId}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              >
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email} ({m.aliases?.length || 0} aliases)
                  </option>
                ))}
              </select>
            </div>

            {/* Add New Alias Form */}
            <form onSubmit={handleAddAlias} className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">Add New Alias</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-white">
                  <input
                    type="text"
                    value={newAliasPrefix}
                    onChange={(e) => setNewAliasPrefix(e.target.value)}
                    placeholder="sales"
                    className="bg-transparent focus:outline-none flex-1"
                  />
                  <span className="text-slate-500">@{activeMailbox?.domain || 'domain.com'}</span>
                </div>
                <button
                  type="submit"
                  disabled={addingAlias}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-lg transition-all"
                >
                  {addingAlias ? 'Adding...' : '+ Add Alias'}
                </button>
              </div>
            </form>

            {/* Active Aliases List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Aliases ({activeMailbox?.aliases?.length || 0})</span>
              {(!activeMailbox?.aliases || activeMailbox.aliases.length === 0) ? (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
                  No aliases configured yet for this mailbox.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMailbox.aliases.map((alias) => (
                    <div key={alias} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 px-4 flex items-center justify-between text-xs font-mono text-white">
                      <span>{alias}</span>
                      <button
                        onClick={() => handleRemoveAlias(alias.split('@')[0])}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN MAIL HOSTS (NODES) */}
      {isAdminOrDev && activeTab === 'admin_hosts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">WildDuck Mail Server Nodes (Hosts)</h2>
              <p className="text-xs text-slate-400">Add and manage cluster nodes for distributed mail hosting.</p>
            </div>
            <button
              onClick={() => setShowAddHostModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Mail Host Node
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mailHosts.map((h) => (
              <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-indigo-400" />
                    <span className="font-bold text-sm text-white">{h.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase ${
                      h.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {h.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hostname:</span>
                    <span>{h.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">API URL:</span>
                    <span className="truncate max-w-[180px]">{h.apiUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mailboxes:</span>
                    <span>{h.mailboxCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Domains:</span>
                    <span>{h.domainCount}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleTestMailHost(h.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                  >
                    Test Connection
                  </button>
                  <button
                    onClick={() => handleDeleteMailHost(h.id, h.label)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs border border-red-500/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Mail Host Modal */}
          {showAddHostModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white">Add WildDuck Mail Host Node</h3>
                  <button onClick={() => setShowAddHostModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
                </div>

                <form onSubmit={handleAddMailHost} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Host Label</label>
                    <input
                      type="text"
                      required
                      value={hostLabel}
                      onChange={(e) => setHostLabel(e.target.value)}
                      placeholder="e.g. Mail Node US-East-1"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Hostname</label>
                    <input
                      type="text"
                      required
                      value={hostHostname}
                      onChange={(e) => setHostHostname(e.target.value)}
                      placeholder="mail-node1.example.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">API URL</label>
                    <input
                      type="url"
                      required
                      value={hostApiUrl}
                      onChange={(e) => setHostApiUrl(e.target.value)}
                      placeholder="http://1.2.3.4:8080"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">WildDuck API Key</label>
                    <input
                      type="password"
                      required
                      value={hostApiKey}
                      onChange={(e) => setHostApiKey(e.target.value)}
                      placeholder="Secret API key"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={hostIsDefault}
                      onChange={(e) => setHostIsDefault(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-indigo-600"
                    />
                    <label htmlFor="isDefault" className="text-xs text-slate-300 font-bold">Set as Default Primary Host Node</label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowAddHostModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingHost}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                    >
                      {submittingHost ? 'Testing & Saving...' : 'Save Mail Host'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ADMIN BULK PROVISIONING & HEALTH */}
      {isAdminOrDev && activeTab === 'admin_bulk' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Health Summary Banner */}
          {healthInfo && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 block">Overall Cluster Status</span>
                <span className="text-lg font-black text-emerald-400 font-mono uppercase">{healthInfo.overallStatus}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400 block">Active Mail Hosts</span>
                <span className="text-lg font-black text-white font-mono">{healthInfo.healthyHosts} / {healthInfo.totalHosts}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400 block">Pending Queue Tasks</span>
                <span className="text-lg font-black text-indigo-400 font-mono">{healthInfo.tasksCount}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400 block">Total Storage Allocated</span>
                <span className="text-lg font-black text-purple-400 font-mono">{healthInfo.totalStorageMb} MB</span>
              </div>
            </div>
          )}

          {/* Bulk Provisioning Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Bulk Mailbox Creation (CSV or Naming Pattern)</h2>
              <p className="text-xs text-slate-400">Generate multiple corporate mailboxes simultaneously (e.g. employee1@domain.com ... employee10@domain.com).</p>
            </div>

            <form onSubmit={handleBulkProvision} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Assign to Customer User Account</label>
                <select
                  value={bulkUserId}
                  onChange={(e) => setBulkUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-mono text-white"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName ? `${u.displayName} (${u.email})` : u.email} [{u.role}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Domain Name</label>
                  <input
                    type="text"
                    required
                    value={bulkDomain}
                    onChange={(e) => setBulkDomain(e.target.value)}
                    placeholder="company.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Username Naming Pattern</label>
                  <input
                    type="text"
                    required
                    value={bulkPattern}
                    onChange={(e) => setBulkPattern(e.target.value)}
                    placeholder="user{n}"
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Number of Mailboxes (N)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Quota per Mailbox (MB)</label>
                  <input
                    type="number"
                    value={bulkQuota}
                    onChange={(e) => setBulkQuota(parseInt(e.target.value, 10) || 1024)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Password for All</label>
                  <input
                    type="password"
                    required
                    value={bulkPassword}
                    onChange={(e) => setBulkPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submittingBulk}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-lg transition-all"
                >
                  {submittingBulk ? 'Provisioning Mailboxes...' : `+ Provision ${bulkCount} Mailboxes Now`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
