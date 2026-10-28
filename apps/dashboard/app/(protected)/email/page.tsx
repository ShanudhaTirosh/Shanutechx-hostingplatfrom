'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import DynamicDnsSetupGuide from '@/components/email/DynamicDnsSetupGuide';
import {
  Mail,
  Inbox,
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
  ChevronRight,
  Sliders,
  HardDrive,
  Check,
  Send,
  AlertTriangle,
  Sparkles,
  Plug,
  Layers,
  ArrowUpRight,
  Zap,
  UserCircle,
  Shield,
  Eye,
  EyeOff,
  X,
  Loader2,
} from 'lucide-react';
import { MailboxProfileModal, type MailboxProfileData } from '@/components/email/MailboxProfileModal';
import { MailboxStaffAccessModal } from '@/components/email/MailboxStaffAccessModal';
import { ProductCard } from '@/components/ProductCard';
import { ProductDetailsModal } from '@/components/ProductDetailsModal';

export interface EmailPlanQuotas {
  isDev: boolean;
  planName: string;
  hasActivePlan: boolean;
  maxStorageMb: number;
  allocatedStorageMb: number;
  remainingStorageMb: number;
  maxMailboxes: number;
  usedMailboxes: number;
  remainingMailboxes: number;
  dailySendLimit: number;
  maxDomains: number;
  usedDomains: number;
  remainingDomains: number;
  features: {
    customDomain: boolean;
    webmailAccess: boolean;
    smtpAccess: boolean;
    apiAccess: boolean;
  };
}

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
  isInternal?: boolean;
  profile?: MailboxProfileData;
  mailboxAcl?: any[];
  myPermissions?: ('read' | 'write' | 'manage')[];
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

  // Change Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordMailbox, setPasswordMailbox] = useState<Mailbox | null>(null);
  const [newMailboxPassword, setNewMailboxPassword] = useState('');
  const [confirmMailboxPassword, setConfirmMailboxPassword] = useState('');
  const [showNewMailboxPassword, setShowNewMailboxPassword] = useState(false);
  const [updatingMailboxPassword, setUpdatingMailboxPassword] = useState(false);

  // Plan Quotas state
  const [planQuotas, setPlanQuotas] = useState<EmailPlanQuotas | null>(null);

  // Create Mailbox modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createDomain, setCreateDomain] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createShowPassword, setCreateShowPassword] = useState(false);
  const [createQuotaMb, setCreateQuotaMb] = useState<number>(1024);
  const [creatingMailbox, setCreatingMailbox] = useState(false);

  // Adjust Quota modal state
  const [quotaModalMailbox, setQuotaModalMailbox] = useState<Mailbox | null>(null);
  const [targetQuotaMb, setTargetQuotaMb] = useState<number>(1024);
  const [updatingQuota, setUpdatingQuota] = useState(false);

  // Profile modal state
  const [profileModalMailbox, setProfileModalMailbox] = useState<Mailbox | null>(null);

  // Staff Access delegation modal state (dev role)
  const [staffAccessMailbox, setStaffAccessMailbox] = useState<Mailbox | null>(null);

  // Website Connect & API modal state
  const [websiteConnectMailbox, setWebsiteConnectMailbox] = useState<Mailbox | null>(null);
  const [websiteConnectData, setWebsiteConnectData] = useState<any | null>(null);
  const [loadingWebsiteConnect, setLoadingWebsiteConnect] = useState(false);
  const [websiteConnectTab, setWebsiteConnectTab] = useState<'wordpress' | 'resend' | 'nextjs' | 'nodejs' | 'laravel' | 'php' | 'python' | 'test'>('wordpress');
  const [testRecipient, setTestRecipient] = useState('');
  const [testSubject, setTestSubject] = useState('Transactional test from website');
  const [testBody, setTestBody] = useState('This is a test transactional email sent via ShanuTechX email API.');
  const [sendingTestMail, setSendingTestMail] = useState(false);

  // DNS Verification Details per domain
  const [dnsCheckDetails, setDnsCheckDetails] = useState<Record<string, { mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean; message: string }>>({});

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

  // Email Plans & Upgrade Modal state
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [emailPlans, setEmailPlans] = useState<any[]>([]);
  const [loadingEmailPlans, setLoadingEmailPlans] = useState(false);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<{
    name: string;
    price: number;
    specs: Record<string, any>;
    features: string[];
  } | null>(null);

  const handleOpenPlansModal = async () => {
    setShowPlansModal(true);
    setLoadingEmailPlans(true);
    try {
      const res = await api.email.plans();
      setEmailPlans(res.plans || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load email plans', 'error');
    } finally {
      setLoadingEmailPlans(false);
    }
  };

  const { toast } = useToast();

  const webmailBaseUrl = process.env.NEXT_PUBLIC_WEBMAIL_URL || 'http://localhost:3002';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mbRes, domRes, quotasRes] = await Promise.all([
        api.email.mailboxes().catch(() => ({ mailboxes: [] })),
        api.email.domains().catch(() => ({ domains: [] })),
        api.email.planQuotas().catch(() => null),
      ]);

      const list = mbRes.mailboxes || [];
      setMailboxes(list);
      if (list.length > 0 && !selectedMailboxId) {
        setSelectedMailboxId(list[0].id);
      }

      setDomains(domRes.domains || []);
      if (quotasRes) {
        setPlanQuotas(quotasRes);
      }

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

  const [deletingMailboxId, setDeletingMailboxId] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  const handleOpenWebmail = async (targetMailbox?: Mailbox) => {
    const target = targetMailbox || activeMailbox;
    try {
      if (target?.id) {
        const ticketRes = await api.webmail.getSsoTicket(target.id).catch(() => null);
        if (ticketRes?.ssoToken) {
          const dest = ticketRes.webmailUrl || target?.webmailUrl || webmailBaseUrl;
          const separator = dest.includes('?') ? '&' : '?';
          window.open(`${dest}${separator}ssoToken=${encodeURIComponent(ticketRes.ssoToken)}`, '_blank');
          return;
        }
      }
    } catch {}
    const webmailUrl = target?.webmailUrl || webmailBaseUrl;
    window.open(webmailUrl, '_blank');
  };

  const handleDeleteMailbox = async (mb: Mailbox) => {
    if (!window.confirm(`Are you sure you want to delete mailbox "${mb.email}"? All emails and mailbox data will be permanently removed.`)) {
      return;
    }
    setDeletingMailboxId(mb.id);
    try {
      await api.email.deleteMailbox(mb.id);
      toast(`Mailbox ${mb.email} deleted successfully`, 'success');
      setMailboxes((prev) => prev.filter((m) => m.id !== mb.id));
      if (selectedMailboxId === mb.id) {
        const remaining = mailboxes.filter((m) => m.id !== mb.id);
        setSelectedMailboxId(remaining.length > 0 ? remaining[0].id : '');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to delete mailbox', 'error');
    } finally {
      setDeletingMailboxId(null);
    }
  };

  const handleDeleteDomain = async (domainItem: DomainRecord) => {
    if (!window.confirm(`Are you sure you want to disconnect domain "${domainItem.domain}"? Active mailboxes using this domain must be removed first.`)) {
      return;
    }
    setDeletingDomain(domainItem.domain);
    try {
      await api.email.deleteDomain(domainItem.id || domainItem.domain);
      toast(`Domain ${domainItem.domain} disconnected successfully`, 'success');
      setDomains((prev) => prev.filter((d) => d.domain !== domainItem.domain && d.id !== domainItem.id));
    } catch (err: any) {
      toast(err.message || 'Failed to delete domain', 'error');
    } finally {
      setDeletingDomain(null);
    }
  };

  const handleOpenPasswordModal = (mb: Mailbox) => {
    setPasswordMailbox(mb);
    setNewMailboxPassword('');
    setConfirmMailboxPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordMailbox) return;
    if (newMailboxPassword.length < 8) {
      toast('Password must be at least 8 characters long', 'error');
      return;
    }
    if (newMailboxPassword !== confirmMailboxPassword) {
      toast('Passwords do not match', 'error');
      return;
    }

    setUpdatingMailboxPassword(true);
    try {
      const res = await api.email.changePassword(passwordMailbox.id, newMailboxPassword);
      toast(res.message || 'Mailbox password updated and synchronized with mail server', 'success');
      setShowPasswordModal(false);
      setNewMailboxPassword('');
      setConfirmMailboxPassword('');
      if (activeMailbox?.id === passwordMailbox.id) {
        setRevealedPassword(null);
        setShowPassword(false);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update mailbox password', 'error');
    } finally {
      setUpdatingMailboxPassword(false);
    }
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
      await api.email.addAlias(activeMailbox.id, newAliasPrefix.trim().toLowerCase());
      toast('Alias created and registered on mail server!', 'success');
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
      await api.email.removeAlias(activeMailbox.id, prefix);
      toast('Alias deleted from mail server', 'info');
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

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleOpenWebsiteConnect = async (mb: Mailbox) => {
    setWebsiteConnectMailbox(mb);
    setLoadingWebsiteConnect(true);
    setWebsiteConnectTab('wordpress');
    try {
      const data = await api.email.websiteConnect(mb.id);
      setWebsiteConnectData(data);
    } catch (err: any) {
      toast(err.message || 'Failed to load website connect parameters', 'error');
    } finally {
      setLoadingWebsiteConnect(false);
    }
  };

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = createUsername.trim().toLowerCase();
    const domain = createDomain.trim().toLowerCase() || (domains[0]?.domain || 'shanutechx.com');
    if (!username) {
      toast('Username is required', 'error');
      return;
    }
    if (!createPassword || createPassword.length < 8) {
      toast('Password must be at least 8 characters', 'error');
      return;
    }
    setCreatingMailbox(true);
    try {
      const email = `${username}@${domain}`;
      await api.email.createMailbox({
        email,
        password: createPassword,
        storageQuotaMb: createQuotaMb,
        customDomain: domain,
      });
      toast(`Mailbox ${email} provisioned successfully!`, 'success');
      setShowCreateModal(false);
      setCreateUsername('');
      setCreatePassword('');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to create mailbox', 'error');
    } finally {
      setCreatingMailbox(false);
    }
  };

  const handleUpdateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaModalMailbox) return;
    setUpdatingQuota(true);
    try {
      const res = await api.email.updateQuota(quotaModalMailbox.id, targetQuotaMb);
      toast(res.message || 'Mailbox quota updated successfully!', 'success');
      setQuotaModalMailbox(null);
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to update mailbox quota', 'error');
    } finally {
      setUpdatingQuota(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteConnectMailbox || !testRecipient.trim()) {
      toast('Recipient email is required', 'error');
      return;
    }
    setSendingTestMail(true);
    try {
      const res = await api.email.sendTransactional({
        from: websiteConnectMailbox.email,
        to: testRecipient.trim(),
        subject: testSubject.trim(),
        html: `<p>${testBody.trim()}</p><hr/><p style="font-size:11px;color:#888;">Dispatched via ShanuTechX Transactional Email Engine</p>`,
        mailboxId: websiteConnectMailbox.id,
      });
      toast(`Test transactional email sent! ID: ${res.id || 'ok'}`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch test email', 'error');
    } finally {
      setSendingTestMail(false);
    }
  };

  const handleRecheckDns = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await api.email.verifyDomain(domainId);
      setDnsCheckDetails((prev) => ({
        ...prev,
        [domainId]: {
          mx: !!res.mxVerified,
          spf: !!res.spfVerified,
          dkim: !!res.dkimVerified,
          dmarc: !!res.dmarcVerified,
          message: res.message || '',
        },
      }));
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
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 font-sans p-4 md:p-8 space-y-8 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white text-black font-bold flex items-center justify-center font-bold text-2xl shadow-xl shadow-md">
            <Mail className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Business Email & DNS Management</span>
              <span className="bg-white/10 text-white border border-white/15 text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
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
            onClick={() => {
              setCreateUsername('');
              setCreatePassword(generateStrongPassword());
              setCreateDomain(domains[0]?.domain || 'shanutechx.com');
              setCreateQuotaMb(Math.min(1024, planQuotas?.remainingStorageMb || 1024));
              setShowCreateModal(true);
            }}
            className="px-5 py-3 rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold text-xs md:text-sm shadow-xl shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Mailbox</span>
          </button>
          <button
            onClick={() => handleOpenWebmail()}
            className="px-5 py-3 rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold text-xs md:text-sm shadow-md transition-all flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Launch Webmail Portal</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        {[
          { id: 'mailboxes', label: 'Mailboxes & Storage Quotas', icon: Mail },
          { id: 'dns', label: 'Domain & DNS Checklist', icon: Globe },
          { id: 'credentials', label: 'Client Setup (IMAP / SMTP)', icon: KeyRound },
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
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
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
          {/* PLAN QUOTAS SUMMARY CARD */}
          {planQuotas && (
            <div className="bg-[#0c0d12] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-white" />
                      <span>Subscription Plan & Storage Quotas</span>
                    </h2>
                    <span
                      className={`text-[11px] font-black uppercase px-3 py-1 rounded-full border ${
                        planQuotas.isDev
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-white/10 text-white border-white/15'
                      }`}
                    >
                      {planQuotas.isDev ? 'Dev Superuser — Full Platform Bypass' : planQuotas.planName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {planQuotas.isDev
                      ? 'You have unrestricted enterprise superuser privileges. Storage and mailbox allocations are not constrained.'
                      : 'Storage quota, mailbox quantity, and daily send limits are strictly hardened and bounded by your active plan.'}
                  </p>
                </div>

                {!planQuotas.isDev && (
                  <button
                    onClick={handleOpenPlansModal}
                    className="text-xs font-bold text-white hover:text-neutral-300 flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-4 py-2 rounded-xl border border-white/10 transition-all self-start md:self-auto cursor-pointer"
                  >
                    <span>Manage Plan & Add-ons</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* 3 Metric Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Storage Pool */}
                <div className="bg-[#0a0a0c]/60 border border-white/10/80 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-white" />
                      <span>Storage Pool Usage</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {planQuotas.isDev
                        ? `${planQuotas.allocatedStorageMb} MB (Dev)`
                        : `${Math.min(100, Math.round((planQuotas.allocatedStorageMb / (planQuotas.maxStorageMb || 1)) * 100))}%`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        !planQuotas.isDev && planQuotas.remainingStorageMb <= 0
                          ? 'bg-red-500'
                          : !planQuotas.isDev && planQuotas.remainingStorageMb < 512
                          ? 'bg-amber-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{
                        width: planQuotas.isDev
                          ? '35%'
                          : `${Math.min(100, Math.max(4, Math.round((planQuotas.allocatedStorageMb / (planQuotas.maxStorageMb || 1)) * 100)))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                    <span>Allocated: {planQuotas.allocatedStorageMb} MB</span>
                    <span>
                      {planQuotas.isDev
                        ? 'Unlimited Pool'
                        : `Max: ${planQuotas.maxStorageMb} MB (${planQuotas.remainingStorageMb} MB left)`}
                    </span>
                  </div>
                </div>

                {/* 2. Mailbox Slots */}
                <div className="bg-[#0a0a0c]/60 border border-white/10/80 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-white" />
                      <span>Mailbox Slots</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {planQuotas.isDev ? `${planQuotas.usedMailboxes} Active` : `${planQuotas.usedMailboxes} / ${planQuotas.maxMailboxes}`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        !planQuotas.isDev && planQuotas.remainingMailboxes <= 0
                          ? 'bg-red-500'
                          : !planQuotas.isDev && planQuotas.remainingMailboxes === 1
                          ? 'bg-amber-500'
                          : 'bg-purple-500'
                      }`}
                      style={{
                        width: planQuotas.isDev
                          ? '40%'
                          : `${Math.min(100, Math.max(4, Math.round((planQuotas.usedMailboxes / (planQuotas.maxMailboxes || 1)) * 100)))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                    <span>Used: {planQuotas.usedMailboxes}</span>
                    <span>
                      {planQuotas.isDev
                        ? 'Unlimited Slots'
                        : `${planQuotas.remainingMailboxes} available slot${planQuotas.remainingMailboxes === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>

                {/* 3. Daily Rate & Protocols */}
                <div className="bg-[#0a0a0c]/60 border border-white/10/80 rounded-2xl p-5 space-y-2 text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    <span>Sending Limits & Gateways</span>
                  </span>
                  <div className="space-y-1 font-mono text-[11px] pt-1">
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Daily Send Rate:</span>
                      <span className="font-bold text-emerald-400">{planQuotas.dailySendLimit.toLocaleString()} emails / day</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Custom Domains:</span>
                      <span className="font-bold text-white">
                        {planQuotas.isDev ? `${planQuotas.usedDomains} (Unlimited)` : `${planQuotas.usedDomains} / ${planQuotas.maxDomains}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">REST API & SMTP:</span>
                      <span className="font-bold text-white">Active & Enabled</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Banner if exhausted */}
              {!planQuotas.isDev && (planQuotas.remainingStorageMb <= 0 || planQuotas.remainingMailboxes <= 0) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                    <p className="text-xs text-red-200">
                      {planQuotas.remainingStorageMb <= 0 && planQuotas.remainingMailboxes <= 0
                        ? 'Your plan storage pool and mailbox slots are fully allocated. Upgrade your subscription to add more mailboxes or storage.'
                        : planQuotas.remainingStorageMb <= 0
                        ? 'Your storage pool is fully exhausted. Adjust existing mailbox quotas or upgrade your plan to provision more.'
                        : 'You have reached the maximum mailbox limit for your active plan. Upgrade your plan for additional accounts.'}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenPlansModal}
                    className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-bold text-xs rounded-xl shadow-md shrink-0 cursor-pointer"
                  >
                    Upgrade Plan
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Provisioned Corporate Mailboxes</h2>
              <span className="text-xs text-slate-400 font-mono">Total: {mailboxes.length} Mailboxes</span>
            </div>

            <button
              onClick={() => {
                setCreateUsername('');
                setCreatePassword(generateStrongPassword());
                setCreateDomain(domains[0]?.domain || 'shanutechx.com');
                setCreateQuotaMb(Math.min(1024, planQuotas?.remainingStorageMb || 1024));
                setShowCreateModal(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold text-xs shadow-lg shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>+ Create Mailbox</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mailboxes.length === 0 ? (
              <div className="col-span-full bg-slate-900/50 border border-white/10 rounded-3xl p-12 text-center space-y-4">
                <Mail className="h-12 w-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No Mailboxes Provisioned Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click "+ Create Mailbox" above to provision your first business email account with dedicated storage quota.
                </p>
                <button
                  onClick={() => {
                    setCreateUsername('');
                    setCreatePassword(generateStrongPassword());
                    setCreateDomain(domains[0]?.domain || 'shanutechx.com');
                    setCreateQuotaMb(Math.min(1024, planQuotas?.remainingStorageMb || 1024));
                    setShowCreateModal(true);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Mailbox</span>
                </button>
              </div>
            ) : (
              mailboxes.map((mb) => {
                const usedPct = Math.min(100, Math.round((mb.storageUsedMb / (mb.storageQuotaMb || 1024)) * 100));
                const hasAliases = Array.isArray(mb.aliases) && mb.aliases.length > 0;

                return (
                  <div
                    key={mb.id}
                    className={`bg-slate-900 border rounded-3xl p-6 space-y-5 transition-all shadow-xl ${
                      selectedMailboxId === mb.id ? 'border-white/30 shadow-md' : 'border-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Avatar / Initials */}
                      <div className="relative shrink-0">
                        {mb.profile?.avatarUrl ? (
                          <img
                            src={mb.profile.avatarUrl}
                            alt={mb.profile?.displayName || mb.username}
                            className="h-12 w-12 rounded-2xl object-cover border-2 border-white/30/40 shadow-md shadow-md"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-white/10 text-white font-bold text-base flex items-center justify-center border border-white/20 shadow-md">
                            {(mb.profile?.displayName || mb.username || 'M').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {mb.isInternal && (
                          <span
                            className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full ring-2 ring-slate-900 shadow-sm"
                            title="System Mailbox"
                          >
                            <Shield className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      {/* Display Name & Email */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white truncate">
                            {mb.profile?.displayName || mb.username}
                          </span>
                          {mb.isInternal && (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              System
                            </span>
                          )}
                          {mb.myPermissions && userRole !== 'dev' && (
                            <span className="bg-white/10 text-neutral-300 border border-white/15 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {mb.myPermissions.includes('write') ? 'Read & Write' : 'Read-Only'}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-white block truncate mt-0.5">{mb.email}</span>
                        {mb.profile?.jobTitle && (
                          <span className="text-[11px] text-slate-400 font-sans block truncate mt-0.5">
                            {mb.profile.jobTitle} {mb.profile.company ? `• ${mb.profile.company}` : ''}
                          </span>
                        )}
                      </div>

                      <span
                        className={`shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          mb.isSuspended ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {mb.isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </div>

                    {/* Storage Usage Bar & Adjust Quota button */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                        <span>Storage Quota</span>
                        <div className="flex items-center gap-2">
                          <span>{mb.storageUsedMb} / {mb.storageQuotaMb} MB ({usedPct}%)</span>
                          <button
                            onClick={() => {
                              setQuotaModalMailbox(mb);
                              setTargetQuotaMb(mb.storageQuotaMb || 1024);
                            }}
                            className="text-white hover:text-neutral-300 font-sans font-bold text-[10px] bg-white/10 hover:bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 flex items-center gap-1 transition-all"
                            title="Adjust Storage Quota"
                          >
                            <Sliders className="h-3 w-3" />
                            <span>Adjust</span>
                          </button>
                        </div>
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
                            <span key={alias} className="bg-slate-800 text-slate-200 text-[11px] font-mono px-2.5 py-1 rounded-xl border border-white/10/60">
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
                          className="w-full bg-white/10 hover:bg-white/10 text-white border border-white/15 rounded-2xl py-2 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Configure Alias Prompt</span>
                        </button>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Profile & Branding Button */}
                        <button
                          onClick={() => setProfileModalMailbox(mb)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all flex items-center gap-1.5 border border-white/15"
                          title="Configure Mailbox Profile Picture & Info"
                        >
                          <UserCircle className="h-3.5 w-3.5 text-white" />
                          <span>Profile & Branding</span>
                        </button>

                        {/* Dev Staff Access Delegation Button */}
                        {userRole === 'dev' && (
                          <button
                            onClick={() => setStaffAccessMailbox(mb)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 border border-amber-500/30"
                            title="Manage Staff Access (Dev Superuser)"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                            <span>Staff Access</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenWebsiteConnect(mb)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/10 text-neutral-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 border border-white/15"
                        >
                          <Plug className="h-3.5 w-3.5 text-white" />
                          <span>Connect & API</span>
                        </button>

                        <button
                          onClick={() => handleOpenPasswordModal(mb)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 border border-amber-500/20"
                          title="Change Mailbox Password"
                        >
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                          <span>Change Password</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => {
                            setSelectedMailboxId(mb.id);
                            setActiveTab('credentials');
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 p-1"
                          title="SMTP Credentials"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Credentials</span>
                        </button>

                        <button
                          onClick={() => handleDeleteMailbox(mb)}
                          disabled={deletingMailboxId === mb.id}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold text-xs transition-all flex items-center gap-1 border border-red-500/20 disabled:opacity-50"
                          title="Delete Mailbox"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>

                        <button
                          onClick={() => handleOpenWebmail(mb)}
                          className="px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs shadow-md transition-all flex items-center gap-1"
                        >
                          <span>Webmail</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
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

          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-4 gap-4">
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
                  className="bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  disabled={addingDomain}
                  className="bg-white text-black hover:bg-neutral-200 font-bold text-xs px-4 py-2 rounded-2xl shadow-lg transition-all"
                >
                  {addingDomain ? 'Adding...' : '+ Add Domain'}
                </button>
              </form>
            </div>

            {domains.map((dom) => (
              <div key={dom.id} className="bg-[#0a0a0c] border border-white/10 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRecheckDns(dom.id)}
                      disabled={verifyingDomainId === dom.id}
                      className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all flex items-center gap-2"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${verifyingDomainId === dom.id ? 'animate-spin' : ''}`} />
                      <span>Re-check DNS</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDomain(dom)}
                      disabled={deletingDomain === dom.domain}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-bold px-3 py-2 rounded-xl shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Disconnect Domain"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                {/* DNS Records Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="text-[11px] font-extrabold text-slate-500 uppercase border-b border-white/10">
                        <th className="pb-3">Record Type</th>
                        <th className="pb-3">Host / Name</th>
                        <th className="pb-3">Target Value</th>
                        <th className="pb-3">Priority</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      <tr>
                        <td className="py-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>MX</span>
                            {dnsCheckDetails[dom.id]?.mx ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">Check Required</span>
                            )}
                          </div>
                        </td>
                        <td>@</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.mxRecord || '10 mail.shanutechx.com'}</td>
                        <td>10</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.mxRecord || '10 mail.shanutechx.com', 'MX Record')}
                            className="text-white hover:text-neutral-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>TXT (SPF)</span>
                            {dnsCheckDetails[dom.id]?.spf ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">Check Required</span>
                            )}
                          </div>
                        </td>
                        <td>@</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.spfRecord || 'v=spf1 include:mail.shanutechx.com ~all'}</td>
                        <td>-</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.spfRecord || 'v=spf1 include:mail.shanutechx.com ~all', 'SPF Record')}
                            className="text-white hover:text-neutral-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>TXT (DKIM)</span>
                            {dnsCheckDetails[dom.id]?.dkim ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">Check Required</span>
                            )}
                          </div>
                        </td>
                        <td>wildduck._domainkey</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.dkimRecord || 'v=DKIM1; k=rsa; p=MIGf...'}</td>
                        <td>-</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.dkimRecord || 'v=DKIM1; k=rsa; p=MIGf...', 'DKIM Record')}
                            className="text-white hover:text-neutral-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>TXT (DMARC)</span>
                            {dnsCheckDetails[dom.id]?.dmarc ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">Check Required</span>
                            )}
                          </div>
                        </td>
                        <td>_dmarc</td>
                        <td className="truncate max-w-xs text-slate-200">{dom.dmarcRecord || `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${dom.domain}`}</td>
                        <td>-</td>
                        <td className="text-right">
                          <button
                            onClick={() => copyToClipboard(dom.dmarcRecord || `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${dom.domain}`, 'DMARC Record')}
                            className="text-white hover:text-neutral-300 font-bold text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {dnsCheckDetails[dom.id]?.message && (
                  <div className="bg-slate-900 border border-white/10 rounded-2xl p-3 text-xs font-mono text-slate-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-white shrink-0" />
                    <span>{dnsCheckDetails[dom.id].message}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DEVELOPER CREDENTIALS & CODE SNIPPETS */}
      {activeTab === 'credentials' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-white/10 pb-4">
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
                className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-white/30"
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
              <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 space-y-3 text-xs">
                <span className="font-extrabold text-white uppercase tracking-wider block">Outbound SMTP Server</span>
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

              <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 space-y-3 text-xs">
                <span className="font-extrabold text-white uppercase tracking-wider block">Inbound IMAP Server</span>
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Host:</span>
                    <span className="text-white font-bold">{activeMailbox?.smtpHost || 'mail.shanutechx.com'}</span>
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
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 space-y-4">
              <span className="font-extrabold text-xs uppercase tracking-wider text-neutral-300 block">Account Authentication</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block mb-1">Username / Email</span>
                  <div className="bg-[#0a0a0c] p-3 rounded-xl border border-white/10 flex justify-between items-center">
                    <span>{activeMailbox?.email || 'me@shanutechx.com'}</span>
                    <button onClick={() => copyToClipboard(activeMailbox?.email || 'me@shanutechx.com', 'Username')} className="text-white font-bold text-[11px]">
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Password</span>
                  <div className="bg-[#0a0a0c] p-3 rounded-xl border border-white/10 flex justify-between items-center">
                    <span>{showPassword ? revealedPassword : '••••••••••••'}</span>
                    <button onClick={handleRevealPassword} className="text-white font-bold text-[11px]">
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
                  <Code2 className="h-4 w-4 text-white" /> Code Integration Snippet
                </span>

                <div className="flex items-center gap-1 bg-[#0a0a0c] p-1 rounded-xl border border-white/10">
                  {[
                    { id: 'node', label: 'Node.js (Nodemailer)' },
                    { id: 'python', label: 'Python (smtplib)' },
                    { id: 'curl', label: 'cURL' },
                  ].map((snip) => (
                    <button
                      key={snip.id}
                      onClick={() => setSelectedCodeSnippet(snip.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedCodeSnippet === snip.id ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {snip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
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
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white">Mailbox Alias Management</h2>
              <p className="text-xs text-slate-400">Configure alias addresses (e.g. sales@domain.com, support@domain.com) routed directly into this mailbox.</p>
            </div>

            {/* Mailbox Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Active Mailbox</label>
              <select
                value={selectedMailboxId}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-white/30"
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
                <div className="flex-1 flex items-center bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white">
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
                  className="bg-white text-black hover:bg-neutral-200 font-bold text-xs px-5 py-3 rounded-2xl shadow-lg transition-all"
                >
                  {addingAlias ? 'Adding...' : '+ Add Alias'}
                </button>
              </div>
            </form>

            {/* Active Aliases List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Aliases ({activeMailbox?.aliases?.length || 0})</span>
              {(!activeMailbox?.aliases || activeMailbox.aliases.length === 0) ? (
                <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-6 text-center text-xs text-slate-500">
                  No aliases configured yet for this mailbox.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMailbox.aliases.map((alias) => (
                    <div key={alias} className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-3 px-4 flex items-center justify-between text-xs font-mono text-white">
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
              className="bg-white text-black hover:bg-neutral-200 font-bold text-xs px-4 py-2.5 rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Mail Host Node
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mailHosts.map((h) => (
              <div key={h.id} className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-white" />
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

                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
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
              <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-bold text-sm text-white">Add WildDuck Mail Host Node</h3>
                  <button onClick={() => setShowAddHostModal(false)} className="text-slate-400 hover:text-white text-xs"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
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
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
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
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
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
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={hostIsDefault}
                      onChange={(e) => setHostIsDefault(e.target.checked)}
                      className="rounded bg-[#0a0a0c] border-white/10 text-indigo-600"
                    />
                    <label htmlFor="isDefault" className="text-xs text-slate-300 font-bold">Set as Default Primary Host Node</label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
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
                      className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold"
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
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <span className="text-lg font-black text-white font-mono">{healthInfo.tasksCount}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400 block">Total Storage Allocated</span>
                <span className="text-lg font-black text-white font-mono">{healthInfo.totalStorageMb} MB</span>
              </div>
            </div>
          )}

          {/* Bulk Provisioning Form */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white">Bulk Mailbox Creation (CSV or Naming Pattern)</h2>
              <p className="text-xs text-slate-400">Generate multiple corporate mailboxes simultaneously (e.g. employee1@domain.com ... employee10@domain.com).</p>
            </div>

            <form onSubmit={handleBulkProvision} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Assign to Customer User Account</label>
                <select
                  value={bulkUserId}
                  onChange={(e) => setBulkUserId(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-3 text-xs font-mono text-white"
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
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
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
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
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
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Quota per Mailbox (MB)</label>
                  <input
                    type="number"
                    value={bulkQuota}
                    onChange={(e) => setBulkQuota(parseInt(e.target.value, 10) || 1024)}
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
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
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submittingBulk}
                  className="bg-white text-black hover:bg-neutral-200 font-bold text-xs px-6 py-3 rounded-2xl shadow-lg transition-all"
                >
                  {submittingBulk ? 'Provisioning Mailboxes...' : `+ Provision ${bulkCount} Mailboxes Now`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. CREATE MAILBOX MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-lg space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-black text-base text-white">Create New Corporate Mailbox</h3>
                <p className="text-xs text-slate-400 mt-0.5">Provision an isolated mailbox with custom storage quota and credentials.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleCreateMailbox} className="space-y-4">
              {/* Email Address Prefix & Domain */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Email Address</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    placeholder="alex"
                    className="flex-1 bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  />
                  <span className="text-slate-400 font-mono text-xs">@</span>
                  <select
                    value={createDomain}
                    onChange={(e) => setCreateDomain(e.target.value)}
                    className="bg-[#0a0a0c] border border-white/10 rounded-2xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  >
                    {domains.length > 0 ? (
                      domains.map((d) => (
                        <option key={d.id} value={d.domain}>
                          {d.domain}
                        </option>
                      ))
                    ) : (
                      <option value="shanutechx.com">shanutechx.com</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Password Generator */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">Mailbox Password</label>
                  <button
                    type="button"
                    onClick={() => setCreatePassword(generateStrongPassword())}
                    className="text-[11px] font-bold text-white hover:text-neutral-300 flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Generate Strong
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={createShowPassword ? 'text' : 'password'}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-white pr-20 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateShowPassword(!createShowPassword)}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    {createShowPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Storage Quota Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Choose Storage Quota</label>
                  <span className="text-xs font-mono text-white font-bold">{createQuotaMb} MB</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[512, 1024, 2048, 5120].map((mb) => {
                    const exceeds = !planQuotas?.isDev && (planQuotas?.remainingStorageMb ?? 0) < mb;
                    return (
                      <button
                        key={mb}
                        type="button"
                        disabled={exceeds}
                        onClick={() => setCreateQuotaMb(mb)}
                        className={`py-2 rounded-xl text-xs font-bold font-mono transition-all border ${
                          createQuotaMb === mb
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : exceeds
                            ? 'bg-[#0a0a0c]/40 text-slate-600 border-white/10/40 cursor-not-allowed'
                            : 'bg-[#0a0a0c] text-slate-300 border-white/10 hover:border-white/10'
                        }`}
                      >
                        {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Quota input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Custom (MB):</span>
                  <input
                    type="number"
                    min={100}
                    max={planQuotas?.isDev ? 100000 : planQuotas?.remainingStorageMb || 10240}
                    value={createQuotaMb}
                    onChange={(e) => setCreateQuotaMb(Math.max(100, parseInt(e.target.value, 10) || 100))}
                    className="w-28 bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  />
                  {planQuotas && !planQuotas.isDev && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      (Pool remaining: {planQuotas.remainingStorageMb} MB)
                    </span>
                  )}
                </div>

                {/* Quota warning */}
                {planQuotas && !planQuotas.isDev && createQuotaMb > planQuotas.remainingStorageMb && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Requested quota exceeds your remaining plan pool ({planQuotas.remainingStorageMb} MB).</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    creatingMailbox ||
                    (!planQuotas?.isDev && (planQuotas?.remainingStorageMb ?? 0) < createQuotaMb) ||
                    (!planQuotas?.isDev && (planQuotas?.remainingMailboxes ?? 0) <= 0)
                  }
                  className="px-6 py-2.5 rounded-2xl bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-xs font-bold shadow-md transition-all"
                >
                  {creatingMailbox ? 'Provisioning...' : 'Create Mailbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADJUST QUOTA MODAL */}
      {quotaModalMailbox && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-md space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-black text-base text-white">Adjust Storage Quota</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{quotaModalMailbox.email}</p>
              </div>
              <button onClick={() => setQuotaModalMailbox(null)} className="text-slate-400 hover:text-white p-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleUpdateQuota} className="space-y-4">
              <div className="bg-[#0a0a0c] p-4 rounded-2xl border border-white/10 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Used:</span>
                  <span className="text-white font-bold">{quotaModalMailbox.storageUsedMb} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Quota:</span>
                  <span className="text-white font-bold">{quotaModalMailbox.storageQuotaMb} MB</span>
                </div>
                {planQuotas && !planQuotas.isDev && (
                  <div className="flex justify-between border-t border-white/10 pt-1.5 text-slate-300">
                    <span className="text-slate-400">Plan Pool Left:</span>
                    <span className="text-emerald-400 font-bold">{planQuotas.remainingStorageMb} MB</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Select New Quota (MB)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[512, 1024, 2048, 5120].map((mb) => {
                    const maxAllowed = planQuotas?.isDev
                      ? 100000
                      : (quotaModalMailbox.storageQuotaMb || 0) + (planQuotas?.remainingStorageMb || 0);
                    const exceeds = !planQuotas?.isDev && mb > maxAllowed;
                    return (
                      <button
                        key={mb}
                        type="button"
                        disabled={exceeds}
                        onClick={() => setTargetQuotaMb(mb)}
                        className={`py-2 rounded-xl text-xs font-bold font-mono transition-all border ${
                          targetQuotaMb === mb
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : exceeds
                            ? 'bg-[#0a0a0c]/40 text-slate-600 border-white/10/40 cursor-not-allowed'
                            : 'bg-[#0a0a0c] text-slate-300 border-white/10 hover:border-white/10'
                        }`}
                      >
                        {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Custom (MB):</span>
                  <input
                    type="number"
                    min={Math.max(100, quotaModalMailbox.storageUsedMb)}
                    value={targetQuotaMb}
                    onChange={(e) => setTargetQuotaMb(parseInt(e.target.value, 10) || 1024)}
                    className="w-32 bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setQuotaModalMailbox(null)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingQuota}
                  className="px-6 py-2.5 rounded-2xl bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-xs font-bold shadow-md transition-all"
                >
                  {updatingQuota ? 'Saving...' : 'Apply New Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. WEBSITE CONNECT & API INTEGRATION MODAL */}
      {websiteConnectMailbox && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-4xl space-y-6 shadow-2xl animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Plug className="h-5 w-5 text-white" />
                  <h3 className="font-black text-lg text-white">Connect Website & Email REST API</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Programmatic integration credentials and Resend-compatible API for <span className="font-mono text-neutral-300 font-bold">{websiteConnectMailbox.email}</span>
                </p>
              </div>
              <button
                onClick={() => setWebsiteConnectMailbox(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {loadingWebsiteConnect ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="h-8 w-8 text-white animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Loading connection parameters & security tokens...</p>
              </div>
            ) : websiteConnectData ? (
              <div className="space-y-6">
                {/* Credentials Quick Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#0a0a0c] p-3 rounded-2xl border border-white/10 text-xs">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">SMTP Host</span>
                    <span className="font-mono text-white font-bold truncate block">{websiteConnectData.mailbox.smtpHost}</span>
                  </div>
                  <div className="bg-[#0a0a0c] p-3 rounded-2xl border border-white/10 text-xs">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Ports</span>
                    <span className="font-mono text-white font-bold block">587 (TLS) / 465 (SSL)</span>
                  </div>
                  <div className="bg-[#0a0a0c] p-3 rounded-2xl border border-white/10 text-xs">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Username</span>
                    <span className="font-mono text-white font-bold truncate block">{websiteConnectData.credentials.username}</span>
                  </div>
                  <div className="bg-[#0a0a0c] p-3 rounded-2xl border border-white/10 text-xs">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Password</span>
                    <span className="font-mono text-emerald-400 font-bold truncate block">
                      {websiteConnectData.credentials.password ? '••••••••' : 'Configured'}
                    </span>
                  </div>
                </div>

                {/* Sub-Tabs for Integration Types */}
                <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto">
                  {[
                    { id: 'wordpress', label: 'WordPress (WP Mail SMTP)' },
                    { id: 'resend', label: 'Resend-Style REST API' },
                    { id: 'nextjs', label: 'Next.js 14 App Router' },
                    { id: 'nodejs', label: 'Node.js (Nodemailer)' },
                    { id: 'laravel', label: 'Laravel .env' },
                    { id: 'php', label: 'PHP (PHPMailer)' },
                    { id: 'python', label: 'Python (smtplib)' },
                    { id: 'test', label: 'Live Test Send' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setWebsiteConnectTab(t.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        websiteConnectTab === t.id
                          ? 'bg-white text-black font-bold shadow-md'
                          : 'bg-[#0a0a0c] text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab: WordPress */}
                {websiteConnectTab === 'wordpress' && (
                  <div className="space-y-4 text-xs font-sans">
                    <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 text-slate-300">
                      <p className="font-bold text-white mb-1">WordPress Integration via WP Mail SMTP / FluentSMTP / Easy WP SMTP</p>
                      <p className="text-slate-400 text-xs">
                        Install your preferred SMTP plugin, select <strong>Other SMTP</strong>, and copy the parameters below:
                      </p>
                    </div>

                    <div className="bg-[#0a0a0c] rounded-2xl border border-white/10 overflow-hidden font-mono text-xs">
                      <table className="w-full text-left">
                        <tbody className="divide-y divide-slate-800/80">
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">From Email</td>
                            <td className="p-3 text-white">{websiteConnectData.configs.wordpress.fromEmail}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => copyToClipboard(websiteConnectData.configs.wordpress.fromEmail, 'From Email')} className="text-white hover:text-neutral-300 font-bold">Copy</button>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">Mailer</td>
                            <td className="p-3 text-white">Other SMTP</td>
                            <td className="p-3 text-right"></td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">SMTP Host</td>
                            <td className="p-3 text-white">{websiteConnectData.configs.wordpress.smtpHost}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => copyToClipboard(websiteConnectData.configs.wordpress.smtpHost, 'SMTP Host')} className="text-white hover:text-neutral-300 font-bold">Copy</button>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">Encryption</td>
                            <td className="p-3 text-emerald-400">TLS</td>
                            <td className="p-3 text-right"></td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">SMTP Port</td>
                            <td className="p-3 text-white">587 (or 465 SSL)</td>
                            <td className="p-3 text-right">
                              <button onClick={() => copyToClipboard('587', 'Port')} className="text-white hover:text-neutral-300 font-bold">Copy</button>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">Auto TLS</td>
                            <td className="p-3 text-white">ON</td>
                            <td className="p-3 text-right"></td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">Authentication</td>
                            <td className="p-3 text-white">ON</td>
                            <td className="p-3 text-right"></td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">SMTP Username</td>
                            <td className="p-3 text-white">{websiteConnectData.configs.wordpress.smtpUsername}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => copyToClipboard(websiteConnectData.configs.wordpress.smtpUsername, 'Username')} className="text-white hover:text-neutral-300 font-bold">Copy</button>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-900/50">
                            <td className="p-3 text-slate-400 font-bold">SMTP Password</td>
                            <td className="p-3 text-emerald-400">{websiteConnectData.configs.wordpress.smtpPassword || '••••••••'}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => copyToClipboard(websiteConnectData.configs.wordpress.smtpPassword, 'Password')} className="text-white hover:text-neutral-300 font-bold">Copy</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab: Resend REST API */}
                {websiteConnectTab === 'resend' && (
                  <div className="space-y-4">
                    <div className="bg-[#0a0a0c] p-4 rounded-2xl border border-white/10 text-xs space-y-1">
                      <span className="text-white font-bold uppercase tracking-wider block text-[11px]">Resend-Compatible REST API Endpoint</span>
                      <p className="text-white font-mono text-xs">{websiteConnectData.apiEndpoint || 'POST /api/v1/emails'}</p>
                      <p className="text-slate-400 text-[11px] pt-1">
                        Use Bearer Token authentication with your platform API key or Basic Auth with mailbox credentials.
                      </p>
                    </div>

                    <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                      <button
                        onClick={() => copyToClipboard(websiteConnectData.configs.resendRestApi.curlSnippet, 'cURL Snippet')}
                        className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                      >
                        <Copy className="h-3 w-3" /> Copy cURL
                      </button>
                      <pre className="text-emerald-400">{websiteConnectData.configs.resendRestApi.curlSnippet}</pre>
                    </div>

                    <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                      <button
                        onClick={() => copyToClipboard(websiteConnectData.configs.resendRestApi.fetchSnippet, 'Fetch Snippet')}
                        className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                      >
                        <Copy className="h-3 w-3" /> Copy Fetch
                      </button>
                      <pre className="text-neutral-300">{websiteConnectData.configs.resendRestApi.fetchSnippet}</pre>
                    </div>
                  </div>
                )}

                {/* Tab: Next.js */}
                {websiteConnectTab === 'nextjs' && (
                  <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                    <button
                      onClick={() => copyToClipboard(websiteConnectData.configs.nextjsSnippet, 'Next.js Snippet')}
                      className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                    >
                      <Copy className="h-3 w-3" /> Copy Next.js Code
                    </button>
                    <pre className="text-neutral-300">{websiteConnectData.configs.nextjsSnippet}</pre>
                  </div>
                )}

                {/* Tab: Node.js */}
                {websiteConnectTab === 'nodejs' && (
                  <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                    <button
                      onClick={() => copyToClipboard(websiteConnectData.configs.nodejsSnippet, 'Node.js Snippet')}
                      className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                    >
                      <Copy className="h-3 w-3" /> Copy Node.js Code
                    </button>
                    <pre className="text-emerald-400">{websiteConnectData.configs.nodejsSnippet}</pre>
                  </div>
                )}

                {/* Tab: Laravel */}
                {websiteConnectTab === 'laravel' && (
                  <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                    <button
                      onClick={() => copyToClipboard(websiteConnectData.configs.laravelEnv, 'Laravel .env')}
                      className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                    >
                      <Copy className="h-3 w-3" /> Copy .env
                    </button>
                    <pre className="text-amber-400">{websiteConnectData.configs.laravelEnv}</pre>
                  </div>
                )}

                {/* Tab: PHP */}
                {websiteConnectTab === 'php' && (
                  <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                    <button
                      onClick={() => copyToClipboard(websiteConnectData.configs.phpSnippet, 'PHP Snippet')}
                      className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                    >
                      <Copy className="h-3 w-3" /> Copy PHP Code
                    </button>
                    <pre className="text-neutral-300">{websiteConnectData.configs.phpSnippet}</pre>
                  </div>
                )}

                {/* Tab: Python */}
                {websiteConnectTab === 'python' && (
                  <div className="relative bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
                    <button
                      onClick={() => copyToClipboard(websiteConnectData.configs.pythonSnippet, 'Python Snippet')}
                      className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow"
                    >
                      <Copy className="h-3 w-3" /> Copy Python Code
                    </button>
                    <pre className="text-blue-300">{websiteConnectData.configs.pythonSnippet}</pre>
                  </div>
                )}

                {/* Tab: Live Test Send */}
                {websiteConnectTab === 'test' && (
                  <form onSubmit={handleSendTestEmail} className="bg-[#0a0a0c] p-5 rounded-2xl border border-white/10 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Send Real-Time Transactional Email</h4>
                      <p className="text-xs text-slate-400">
                        Dispatches a live test email directly through the Resend-style transactional REST API.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Recipient Email Address</label>
                      <input
                        type="email"
                        required
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Email Subject</label>
                      <input
                        type="text"
                        required
                        value={testSubject}
                        onChange={(e) => setTestSubject(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Message Body</label>
                      <textarea
                        rows={3}
                        required
                        value={testBody}
                        onChange={(e) => setTestBody(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={sendingTestMail}
                        className="px-6 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs shadow-lg transition-all flex items-center gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{sendingTestMail ? 'Dispatching...' : 'Send Live Test Email'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Profile & Avatar Modal */}
      {profileModalMailbox && (
        <MailboxProfileModal
          mailbox={profileModalMailbox}
          onClose={() => setProfileModalMailbox(null)}
          onSaved={(updatedProfile) => {
            setMailboxes((prev) =>
              prev.map((m) =>
                m.id === profileModalMailbox.id ? { ...m, profile: updatedProfile } : m
              )
            );
            setProfileModalMailbox(null);
            fetchData();
          }}
        />
      )}

      {/* Dev Staff Access Delegation Modal */}
      {staffAccessMailbox && (
        <MailboxStaffAccessModal
          mailbox={staffAccessMailbox}
          onClose={() => setStaffAccessMailbox(null)}
          onUpdate={() => {
            fetchData();
          }}
        />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && passwordMailbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Change Mailbox Password</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{passwordMailbox.email}</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">New Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      const p = generateStrongPassword();
                      setNewMailboxPassword(p);
                      setConfirmMailboxPassword(p);
                    }}
                    className="text-[11px] text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewMailboxPassword ? 'text' : 'password'}
                    required
                    value={newMailboxPassword}
                    onChange={(e) => setNewMailboxPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-[#121216] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewMailboxPassword(!showNewMailboxPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewMailboxPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Confirm Password</label>
                <input
                  type={showNewMailboxPassword ? 'text' : 'password'}
                  required
                  value={confirmMailboxPassword}
                  onChange={(e) => setConfirmMailboxPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full bg-[#121216] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30 font-mono"
                />
              </div>

              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Password will be re-encrypted with AES-256 in the secure vault and immediately synchronized with the WildDuck mail server.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingMailboxPassword}
                  className="px-5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {updatingMailboxPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{updatingMailboxPassword ? 'Saving...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Email Plans & Upgrade Modal */}
      {showPlansModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121215] border border-white/15 rounded-3xl p-6 md:p-8 w-full max-w-4xl space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-white" />
                  <span>Available Email & Storage Plans</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Active paid enterprise tiers with dedicated WildDuck storage and send allocations.
                </p>
              </div>
              <button
                onClick={() => setShowPlansModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingEmailPlans ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
                <span>Fetching live plans from catalog...</span>
              </div>
            ) : emailPlans.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 text-xs">
                No active plans currently found in the catalog.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {emailPlans.map((plan) => {
                  const isCurrent =
                    planQuotas?.planName &&
                    (planQuotas.planName.toLowerCase().includes(plan.name.toLowerCase()) ||
                      plan.name.toLowerCase().includes(planQuotas.planName.toLowerCase()));
                  const formattedStorage =
                    plan.storageQuotaMb >= 1024
                      ? `${plan.storageQuotaMb / 1024} GB`
                      : `${plan.storageQuotaMb} MB`;

                  return (
                    <ProductCard
                      key={plan.id}
                      id={plan.id}
                      name={plan.name}
                      category="smtp"
                      categoryLabel="SMTP & Email"
                      billingType={plan.billingType}
                      price={plan.priceLkr}
                      currency="Rs"
                      discountBadge={isCurrent ? 'Current Plan' : '27% under retail'}
                      isCurrent={!!isCurrent}
                      tierChips={[
                        { label: 'Quarterly', priceText: `Rs ${plan.priceLkr.toLocaleString()}` },
                        {
                          label: 'Monthly Eqv',
                          priceText: `Rs ${plan.monthlyEquivalentLkr.toLocaleString()}`,
                        },
                        { label: 'Multi-Domain', priceText: 'Included' },
                      ]}
                      features={[
                        { icon: '🧠', text: 'WildDuck Enterprise Engine' },
                        { icon: '💾', text: `${formattedStorage} High-Speed NVMe Storage` },
                        {
                          icon: '⚡',
                          text: `${plan.dailyQuota.toLocaleString()} High-Deliverability Sends/Day`,
                        },
                        { icon: '🌐', text: `Up to ${plan.maxAliases} Email Aliases & Routing` },
                      ]}
                      logistics={[
                        { icon: 'truck', text: 'Held for you; delivered when you ask' },
                        { icon: 'clock', text: 'Instant automated provisioning upon approval' },
                        { icon: 'box', text: 'Ask for it within 7 days of buying' },
                      ]}
                      termsNote="Minimum 3-month commitment per order"
                      inStock={true}
                      buyLabel={isCurrent ? 'Active Plan' : 'Buy'}
                      disabled={!!isCurrent}
                      onDetails={() =>
                        setSelectedPlanDetail({
                          name: plan.name,
                          price: plan.priceLkr,
                          specs: {
                            storage: formattedStorage,
                            dailySends: `${plan.dailyQuota} sends/day`,
                            aliases: `${plan.maxAliases} aliases`,
                            billing: plan.billingType,
                          },
                          features: [
                            '100% DKIM, SPF & DMARC Verified Delivery',
                            'Modern Webmail Suite & WildDuck Webmail Interface',
                            'Standard IMAP (993) & SMTP (465/587) TLS Access',
                            'SpamAssassin & ClamAV Zero-Tolerance Anti-Spam',
                          ],
                        })
                      }
                      onBuy={() => {
                        window.location.href = `/orders?planId=${plan.id}`;
                      }}
                    />
                  );
                })}
              </div>
            )}

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
              <span>Automatic provisioning upon payment confirmation.</span>
              <button
                onClick={() => setShowPlansModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Plan Details Modal */}
      {selectedPlanDetail && (
        <ProductDetailsModal
          isOpen={true}
          onClose={() => setSelectedPlanDetail(null)}
          productName={selectedPlanDetail.name}
          category="SMTP & Email"
          price={selectedPlanDetail.price}
          currency="Rs"
          specs={selectedPlanDetail.specs}
          features={selectedPlanDetail.features}
          buyLabel="Order Plan Now"
          onProceedToBuy={() => {
            const plan = emailPlans.find((p) => p.name === selectedPlanDetail.name);
            if (plan) window.location.href = `/orders?planId=${plan.id}`;
          }}
        />
      )}
    </div>
  );
}
