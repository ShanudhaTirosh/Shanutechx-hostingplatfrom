'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';

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
}

interface Domain {
  id: string;
  domain: string;
  status: 'verified' | 'pending_dns';
  mxRecord: string;
  spfRecord: string;
  dkimRecord: string;
  dmarcRecord: string;
  createdAt: string;
}

interface EmailMessage {
  id: string;
  from: string;
  fromAvatar?: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  folder: 'inbox' | 'starred' | 'drafts' | 'sent' | 'spam' | 'trash';
  tag?: 'Documents' | 'Work' | 'News' | 'Important';
  isRead: boolean;
  isStarred: boolean;
  hasAttachments?: boolean;
  attachments?: { filename: string; sizeStr: string; url?: string }[];
  timestamp: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
}

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

interface UpcomingEvent {
  id: string;
  title: string;
  dateStr: string;
  timeStr: string;
  participants: string[];
}

const DEMO_MESSAGES: EmailMessage[] = [
  {
    id: 'msg-1',
    from: 'Mike Robertson',
    fromAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    to: 'me@shanutechx.com',
    subject: 'Landing page design system update',
    snippet: 'Hey team, I updated the typography hierarchy and color variables for the new landing page...',
    body: 'Hey team,\n\nI updated the typography hierarchy and color variables for the new landing page components. Please take a look at the attached preview and share feedback before end of day.\n\nBest regards,\nMike',
    folder: 'inbox',
    tag: 'Work',
    isRead: false,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      { filename: 'design-system-v2.pdf', sizeStr: '2.4 MB' },
      { filename: 'component-spec.png', sizeStr: '850 KB' },
    ],
    timestamp: '10:42 AM',
  },
  {
    id: 'msg-2',
    from: 'TechCrunch Newsletter',
    to: 'me@shanutechx.com',
    subject: 'Weekly AI Roundup & Cloud Infrastructure Trends',
    snippet: 'This week in AI: Next-generation agentic assistants, serverless scale-to-zero databases...',
    body: 'Welcome to this week\'s edition of TechCrunch Cloud & AI Insights. In today\'s issue:\n- Autonomous Agentic Coding\n- Edge compute optimization\n- Multi-cloud PaaS deployment tools',
    folder: 'inbox',
    tag: 'News',
    isRead: false,
    isStarred: false,
    timestamp: 'Yesterday',
  },
  {
    id: 'msg-3',
    from: 'Finance Department',
    to: 'me@shanutechx.com',
    subject: 'Invoice #STX-2026-8890 Paid Successfully',
    snippet: 'Your monthly payment for ShanuTechX Enterprise Hosting has been processed successfully...',
    body: 'Dear Customer,\n\nYour invoice #STX-2026-8890 has been paid successfully via Stripe. Thank you for choosing ShanuTechX PaaS Cloud platform.',
    folder: 'inbox',
    tag: 'Documents',
    isRead: true,
    isStarred: false,
    timestamp: '18 May',
  },
  {
    id: 'msg-4',
    from: 'Security Operations',
    to: 'me@shanutechx.com',
    subject: 'SSL Certificate Auto-Renewal Notice for Domain',
    snippet: 'Let\'s Encrypt SSL certificate for custom domain webmail.shanutechx.com renewed...',
    body: 'Automated notification: Let\'s Encrypt SSL certificate auto-renewed successfully for webmail.shanutechx.com.',
    folder: 'inbox',
    tag: 'Important',
    isRead: true,
    isStarred: true,
    timestamp: '15 May',
  },
];

const INITIAL_TODOS: TodoItem[] = [
  { id: 't1', title: 'Design landing page for Oylers', completed: true },
  { id: 't2', title: 'AI research & study', completed: true },
  { id: 't3', title: 'Setup Claude Code for Mike', completed: false },
  { id: 't4', title: 'Publish 3 designs on Dribbble', completed: false },
  { id: 't5', title: 'Buy more coffee filters', completed: false },
];

const INITIAL_EVENTS: UpcomingEvent[] = [
  { id: 'e1', title: 'Brainstorm UI Redesign', dateStr: '16 May', timeStr: '10:30 AM', participants: ['M', 'S', 'A'] },
  { id: 'e2', title: 'Team Sync & Standup', dateStr: '18 May', timeStr: '12:00 PM', participants: ['D', 'K'] },
];

export default function RedesignedMailboxStudioPage() {
  const [activeTab, setActiveTab] = useState<'webmail' | 'smtp_creds' | 'dns' | 'aliases' | 'contacts' | 'billing' | 'delegation'>('webmail');
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'drafts' | 'sent' | 'spam' | 'trash'>('inbox');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [messages, setMessages] = useState<EmailMessage[]>(DEMO_MESSAGES);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(DEMO_MESSAGES[0]);

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
  const [newTodoText, setNewTodoText] = useState('');
  const [events, setEvents] = useState<UpcomingEvent[]>(INITIAL_EVENTS);

  // Modals & Inputs
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [attachments, setAttachments] = useState<{ filename: string; sizeStr: string }[]>([]);
  const [sending, setSending] = useState(false);

  const [newAliasPrefix, setNewAliasPrefix] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);

  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');

  const [newCustomDomain, setNewCustomDomain] = useState('');
  const [verifyingDnsId, setVerifyingDnsId] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchMailboxes();
    fetchDomains();
    fetchContacts();

    api.email.todos().then((d) => {
      if (d.todos) setTodos(d.todos);
    }).catch(() => {});
    api.email.events().then((d) => {
      if (d.events) setEvents(d.events);
    }).catch(() => {});
  }, []);

  const fetchMailboxes = () => {
    api.email.mailboxes().then((res) => {
      const list = res.mailboxes || [];
      setMailboxes(list);
      if (list.length > 0 && !selectedMailboxId) {
        setSelectedMailboxId(list[0].id);
      }
    }).catch(() => {});
  };

  const fetchDomains = () => {
    api.email.domains().then((res) => setDomains(res.domains || [])).catch(() => {});
  };

  const fetchContacts = () => {
    api.email.contacts()
      .then((res) => setContacts(res.contacts || []))
      .catch(() => {});

    api.products.list('smtp_hosting')
      .then((res) => {
        const prod = res.products?.find((p) => p.category === 'smtp_hosting') || res.products?.[0];
        if (prod?.plans) setAvailablePlans(prod.plans);
      })
      .catch(() => {});
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMailbox || !newAliasPrefix.trim()) return;
    setAddingAlias(true);
    try {
      await api.smtp.addAlias(activeMailbox.id, newAliasPrefix.trim().toLowerCase());
      toast(`Alias created successfully!`, 'success');
      setNewAliasPrefix('');
      fetchMailboxes();
    } catch (err: any) {
      toast(err.message || 'Failed to create alias', 'error');
    } finally {
      setAddingAlias(false);
    }
  };

  const handleRemoveAlias = async (prefix: string) => {
    if (!activeMailbox) return;
    try {
      await api.smtp.removeAlias(activeMailbox.id, prefix);
      toast(`Alias removed`, 'info');
      fetchMailboxes();
    } catch (err: any) {
      toast(err.message || 'Failed to remove alias', 'error');
    }
  };

  useEffect(() => {
    api.email.messages(activeFolder).then((res) => {
      if (res.messages && res.messages.length > 0) {
        const formatted: EmailMessage[] = res.messages.map((m: any) => ({
          id: m.id,
          from: m.from || m.senderEmail || m.senderName || 'Sender',
          to: m.to || m.recipientEmail || 'me@domain.com',
          subject: m.subject || '(No subject)',
          snippet: m.snippet || m.body?.slice(0, 80) || '',
          body: m.body || m.htmlBody || '',
          folder: m.folder || activeFolder,
          tag: m.tag || undefined,
          isRead: !!m.isRead,
          isStarred: !!m.isStarred,
          hasAttachments: !!m.hasAttachments,
          attachments: m.attachmentsJson ? JSON.parse(JSON.stringify(m.attachmentsJson)) : [],
          timestamp: m.timestamp || new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages(formatted);
        setSelectedMessage(formatted[0]);
      }
    }).catch(() => {});
  }, [activeFolder]);

  const activeMailbox = mailboxes.find((m) => m.id === selectedMailboxId) || mailboxes[0];

  const handleRevealPassword = async () => {
    if (!activeMailbox) return;
    try {
      const res = await api.email.credentials(activeMailbox.id);
      setRevealedPassword(res.password || '••••••••');
      setShowPassword(true);
    } catch (err: any) {
      toast(err.message || 'Failed to reveal credentials', 'error');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard!`, 'success');
  };

  const toggleStar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = messages.find((m) => m.id === id);
    if (!target) return;
    const nextStarred = !target.isStarred;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStarred: nextStarred } : m))
    );
    api.email.patchMessage(id, { isStarred: nextStarred }).catch(() => {});
  };

  const handleDeleteMessage = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.email.deleteMessage(id);
      toast('Message moved to Trash', 'info');
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(messages.find((m) => m.id !== id) || null);
      }
    } catch {
      toast('Failed to delete message', 'error');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.email.send({
        from: activeMailbox?.email || 'me@shanutechx.com',
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
      toast(`Email dispatched to ${composeTo}!`, 'success');
      setShowComposeModal(false);
      const newMsg: EmailMessage = {
        id: `msg-${Date.now()}`,
        from: activeMailbox?.email || 'Me',
        to: composeTo,
        subject: composeSubject,
        snippet: composeBody.slice(0, 80),
        body: composeBody,
        folder: 'sent',
        isRead: true,
        isStarred: false,
        hasAttachments: attachments.length > 0,
        attachments,
        timestamp: 'Just now',
      };
      setMessages((prev) => [newMsg, ...prev]);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setAttachments([]);
    } catch (err: any) {
      toast(err.message || 'Failed to send email', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!composeTo && !composeSubject && !composeBody) return;
    const draftMsg: EmailMessage = {
      id: `draft-${Date.now()}`,
      from: activeMailbox?.email || 'Me',
      to: composeTo || '(No recipient)',
      subject: composeSubject ? `[Draft] ${composeSubject}` : '[Draft] No Subject',
      snippet: composeBody.slice(0, 80) || 'Empty draft...',
      body: composeBody,
      folder: 'drafts',
      isRead: true,
      isStarred: false,
      timestamp: 'Draft saved',
    };
    setMessages((prev) => [draftMsg, ...prev]);
    toast('Draft saved to Drafts folder', 'info');
    setShowComposeModal(false);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.email.createContact({
        name: newContactName,
        email: newContactEmail,
        phone: newContactPhone,
        company: newContactCompany,
      });
      toast(`Contact ${newContactName} saved successfully!`, 'success');
      setContacts((prev) => [...prev, data.contact]);
      setShowAddContactModal(false);
      setNewContactName('');
      setNewContactEmail('');
      setNewContactPhone('');
      setNewContactCompany('');
    } catch (err: any) {
      toast(err.message || 'Failed to add contact', 'error');
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomDomain.includes('.')) {
      toast('Please enter a valid domain name (e.g. mycompany.com)', 'error');
      return;
    }
    try {
      const res = await api.email.addDomain(newCustomDomain);
      toast(`Custom domain ${newCustomDomain} added! Please configure DNS records.`, 'success');
      setDomains((prev) => [...prev, res.domain]);
      setNewCustomDomain('');
    } catch (err: any) {
      toast(err.message || 'Failed to add domain', 'error');
    }
  };

  const handleVerifyDns = async (domainId: string) => {
    setVerifyingDnsId(domainId);
    try {
      const res = await api.email.verifyDomain(domainId);
      toast(res.message || 'DNS verification completed', res.verified ? 'success' : 'info');
      fetchDomains();
    } catch (err: any) {
      toast(err.message || 'DNS verification failed', 'error');
    } finally {
      setVerifyingDnsId(null);
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (activeFolder === 'starred' && !m.isStarred) return false;
    if (activeFolder !== 'starred' && m.folder !== activeFolder) return false;
    if (activeTag && m.tag !== activeTag) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.subject.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadMessages = filteredMessages.filter((m) => !m.isRead);
  const readMessages = filteredMessages.filter((m) => m.isRead);

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-[#1c1d22] font-sans p-4 md:p-6 flex flex-col gap-6 animate-fade-in">
      {/* Top Header & Navigation Studio Bar */}
      <div className="bg-white rounded-3xl p-4 px-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-indigo-500/20">
            ✉️
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>ShanuTechX Business Email & Webmail Studio</span>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Hostinger & Gmail Tier</span>
            </h1>
            <p className="text-xs text-slate-500">Enterprise SMTP hosting, dynamic DNS, webmail client, and client setup</p>
          </div>
        </div>

        {/* Studio Mode Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
          {[
            { id: 'webmail', label: '📥 Webmail Client' },
            { id: 'smtp_creds', label: '🔑 SMTP Credentials' },
            { id: 'dns', label: '🌐 Custom Domains & DNS' },
            { id: 'aliases', label: '🏷️ Email Aliases' },
            { id: 'contacts', label: '👥 Contacts' },
            { id: 'billing', label: '💳 Plan & Billing' },
            { id: 'delegation', label: '🛡️ Admin Access' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container Area */}
      {activeTab === 'webmail' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* COLUMN 1: LEFT NAVIGATION SIDEBAR (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              {/* Account Dropdown Switcher */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1">Select Active Mailbox</label>
                <select
                  value={selectedMailboxId}
                  onChange={(e) => setSelectedMailboxId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {mailboxes.length > 0 ? (
                    mailboxes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.email} ({m.planName})
                      </option>
                    ))
                  ) : (
                    <option value="">me@shanutechx.com (System Default)</option>
                  )}
                </select>
              </div>

              {/* New Email Button */}
              <button
                onClick={() => setShowComposeModal(true)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <span className="text-base">+</span>
                <span>Compose New Email</span>
              </button>

              {/* Folder Navigation */}
              <div className="space-y-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 mb-2">Folders</p>
                {[
                  { id: 'inbox', label: 'Inbox', icon: '📥' },
                  { id: 'starred', label: 'Starred', icon: '★' },
                  { id: 'drafts', label: 'Drafts', icon: '📝' },
                  { id: 'sent', label: 'Sent', icon: '📤' },
                  { id: 'spam', label: 'Spam', icon: '⚠️' },
                  { id: 'trash', label: 'Trash', icon: '🗑️' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveFolder(item.id as any); setActiveTag(null); }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                      activeFolder === item.id && !activeTag
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-sm">{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                  </button>
                ))}
              </div>

              {/* Tags Section */}
              <div className="space-y-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 mb-2">Filter Tags</p>
                {[
                  { name: 'Documents', color: 'bg-emerald-500' },
                  { name: 'Work', color: 'bg-indigo-500' },
                  { name: 'News', color: 'bg-amber-500' },
                  { name: 'Important', color: 'bg-rose-500' },
                ].map((tag) => (
                  <button
                    key={tag.name}
                    onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs font-medium transition-all ${
                      activeTag === tag.name ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${tag.color}`} />
                      <span>{tag.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Storage Meter Bar */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">Storage Usage</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {((activeMailbox?.storageUsedMb || 434) / 1024).toFixed(2)} GB / {((activeMailbox?.storageQuotaMb || 1024) / 1024).toFixed(0)} GB
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((activeMailbox?.storageUsedMb || 434) / (activeMailbox?.storageQuotaMb || 1024)) * 100
                      ) || 15
                    )}%`,
                  }}
                />
              </div>
              <button
                onClick={() => setActiveTab('billing')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-sm"
              >
                Upgrade Mailbox Storage
              </button>
            </div>
          </div>

          {/* COLUMN 2: CENTER EMAIL LIST (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <h2 className="text-sm font-bold text-slate-900 capitalize flex items-center gap-2">
                <span>{activeFolder}</span>
                {activeTag && <span className="text-xs font-normal text-slate-500">/ {activeTag}</span>}
              </h2>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="bg-slate-100 border border-slate-200 rounded-full py-1.5 px-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[720px] pr-1">
              {filteredMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No messages in {activeFolder}
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMessage?.id === msg.id
                        ? 'bg-indigo-50/70 border-indigo-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                      {msg.from[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 truncate">{msg.from}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 truncate">{msg.subject}</p>
                      <p className="text-[11px] text-slate-500 truncate">{msg.snippet}</p>
                      {msg.hasAttachments && (
                        <span className="inline-block mt-1 text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                          📎 {msg.attachments?.length || 1} Attachment(s)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={(e) => toggleStar(msg.id, e)} className="text-slate-300 hover:text-amber-400 text-sm">
                        {msg.isStarred ? '★' : '☆'}
                      </button>
                      <button onClick={(e) => handleDeleteMessage(msg.id, e)} className="text-slate-300 hover:text-rose-500 text-xs">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: RIGHT EMAIL READING PANE (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
            {selectedMessage ? (
              <div className="space-y-6 overflow-y-auto max-h-[720px] pr-1">
                {/* Header */}
                <div className="border-b border-slate-100 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">
                      {selectedMessage.folder}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{selectedMessage.timestamp}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">{selectedMessage.subject}</h2>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                      {selectedMessage.from[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{selectedMessage.from}</p>
                      <p className="text-[11px] text-slate-500">To: {selectedMessage.to}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {selectedMessage.body}
                </div>

                {/* Attachments Section */}
                {selectedMessage.hasAttachments && selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-900">Attachments ({selectedMessage.attachments.length})</p>
                    <div className="space-y-2">
                      {selectedMessage.attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-100 rounded-xl text-xs border border-slate-200">
                          <span className="font-medium text-slate-800 truncate">📄 {att.filename} ({att.sizeStr})</span>
                          <button
                            onClick={() => toast(`Downloading ${att.filename}...`, 'info')}
                            className="text-indigo-600 font-bold hover:underline text-[11px]"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply / Forward Actions Bar */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setComposeTo(selectedMessage.from);
                      setComposeSubject(`Re: ${selectedMessage.subject}`);
                      setComposeBody(`\n\n--- On ${selectedMessage.timestamp}, ${selectedMessage.from} wrote:\n> ${selectedMessage.body}`);
                      setShowComposeModal(true);
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm"
                  >
                    ↩ Reply
                  </button>
                  <button
                    onClick={() => {
                      setComposeSubject(`Fwd: ${selectedMessage.subject}`);
                      setComposeBody(`\n\n--- Forwarded message ---\nFrom: ${selectedMessage.from}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.body}`);
                      setShowComposeModal(true);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition-all"
                  >
                    ➔ Forward
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
                Select a message to view content
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SMTP CONNECTION CREDENTIALS */}
      {activeTab === 'smtp_creds' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6 max-w-4xl mx-auto w-full">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">SMTP & IMAP Connection Credentials</h2>
            <p className="text-xs text-slate-500">Configure external mail apps (Outlook, Apple Mail, Thunderbird, iOS, Android) using standard parameters.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Outbound SMTP Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-700">Outbound SMTP Server</h3>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">Active</span>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Server Hostname</span>
                  <div className="flex items-center justify-between mt-1 bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-slate-900 font-bold">
                    <span>{activeMailbox?.smtpHost || `mail.shanutechx.com`}</span>
                    <button onClick={() => copyToClipboard(activeMailbox?.smtpHost || `mail.shanutechx.com`, 'SMTP Host')} className="text-indigo-600 text-[11px]">Copy</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">STARTTLS Port</span>
                    <div className="mt-1 bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-slate-900 font-bold">
                      587
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">SSL/TLS Port</span>
                    <div className="mt-1 bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-slate-900 font-bold">
                      465
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inbound IMAP Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-700">Inbound IMAP Server</h3>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">Active</span>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Server Hostname</span>
                  <div className="flex items-center justify-between mt-1 bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-slate-900 font-bold">
                    <span>{activeMailbox?.smtpHost.replace(/^mail\./, 'imap.') || `imap.shanutechx.com`}</span>
                    <button onClick={() => copyToClipboard(activeMailbox?.smtpHost.replace(/^mail\./, 'imap.') || `imap.shanutechx.com`, 'IMAP Host')} className="text-indigo-600 text-[11px]">Copy</button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">SSL/TLS Port</span>
                  <div className="mt-1 bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-slate-900 font-bold">
                    993
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Authentication Details */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">Authentication Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px] mb-1">Username / Full Email</span>
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 font-mono font-bold text-slate-900">
                  <span>{activeMailbox?.email || 'me@shanutechx.com'}</span>
                  <button onClick={() => copyToClipboard(activeMailbox?.email || 'me@shanutechx.com', 'Username')} className="text-indigo-600 font-bold text-[11px]">Copy</button>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] mb-1">Password</span>
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 font-mono font-bold text-slate-900">
                  <span>{showPassword ? revealedPassword : '••••••••••••'}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={handleRevealPassword} className="text-slate-600 font-bold text-[11px] hover:text-indigo-600">
                      {showPassword ? 'Hide' : 'Reveal'}
                    </button>
                    {revealedPassword && (
                      <button onClick={() => copyToClipboard(revealedPassword, 'Password')} className="text-indigo-600 font-bold text-[11px]">Copy</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* External Client Setup Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">Setup Guide for Email Clients</h3>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>1. Open <strong>Outlook</strong> / <strong>Apple Mail</strong> / <strong>Thunderbird</strong> and select <i>Add Account</i>.</p>
              <p>2. Choose <strong>Manual Setup (IMAP/SMTP)</strong>.</p>
              <p>3. Enter the Host, Port (587 STARTTLS for Outbound, 993 SSL for Inbound), and Full Email Username above.</p>
              <p>4. Save settings and initiate sync.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM DOMAINS & DYNAMIC DNS */}
      {activeTab === 'dns' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6 max-w-5xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Custom Domains & Dynamic DNS Record List</h2>
              <p className="text-xs text-slate-500">Configure DNS records (MX, SPF, DKIM, DMARC) on your domain registrar (Namecheap, Cloudflare, GoDaddy).</p>
            </div>
            <form onSubmit={handleAddDomain} className="flex items-center gap-2">
              <input
                type="text"
                value={newCustomDomain}
                onChange={(e) => setNewCustomDomain(e.target.value)}
                placeholder="mycompany.com"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm hover:bg-indigo-700">
                + Add Domain
              </button>
            </form>
          </div>

          {domains.map((dom) => (
            <div key={dom.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-sm text-slate-900 font-mono">{dom.domain}</span>
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${dom.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {dom.status === 'verified' ? '✓ Verified' : '⏳ Pending DNS Check'}
                  </span>
                </div>
                <button
                  onClick={() => handleVerifyDns(dom.id)}
                  disabled={verifyingDnsId === dom.id}
                  className="bg-slate-900 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl hover:bg-slate-800 shadow-sm"
                >
                  {verifyingDnsId === dom.id ? 'Checking DNS...' : 'Verify Records Now'}
                </button>
              </div>

              {/* Records Checklist Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-[11px] font-extrabold text-slate-400 uppercase border-b border-slate-200">
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Host / Name</th>
                      <th className="pb-2">Value / Target</th>
                      <th className="pb-2">Priority</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 font-mono text-slate-800">
                    <tr>
                      <td className="py-2.5 font-bold text-indigo-700">MX</td>
                      <td>@</td>
                      <td className="truncate max-w-xs">{dom.mxRecord || '10 mail.shanutechx.com'}</td>
                      <td>10</td>
                      <td className="text-right">
                        <button onClick={() => copyToClipboard(dom.mxRecord || '10 mail.shanutechx.com', 'MX Record')} className="text-indigo-600 font-bold text-[11px]">Copy</button>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-indigo-700">TXT (SPF)</td>
                      <td>@</td>
                      <td className="truncate max-w-xs">{dom.spfRecord || 'v=spf1 mx ip4:154.53.56.88 ~all'}</td>
                      <td>-</td>
                      <td className="text-right">
                        <button onClick={() => copyToClipboard(dom.spfRecord || 'v=spf1 mx ip4:154.53.56.88 ~all', 'SPF Record')} className="text-indigo-600 font-bold text-[11px]">Copy</button>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-indigo-700">TXT (DKIM)</td>
                      <td>default._domainkey</td>
                      <td className="truncate max-w-xs">{dom.dkimRecord || 'v=DKIM1; k=rsa; p=MIGf...'}</td>
                      <td>-</td>
                      <td className="text-right">
                        <button onClick={() => copyToClipboard(dom.dkimRecord || 'v=DKIM1; k=rsa; p=MIGf...', 'DKIM Record')} className="text-indigo-600 font-bold text-[11px]">Copy</button>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-indigo-700">TXT (DMARC)</td>
                      <td>_dmarc</td>
                      <td className="truncate max-w-xs">{dom.dmarcRecord || `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${dom.domain}`}</td>
                      <td>-</td>
                      <td className="text-right">
                        <button onClick={() => copyToClipboard(dom.dmarcRecord || `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${dom.domain}`, 'DMARC Record')} className="text-indigo-600 font-bold text-[11px]">Copy</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: EMAIL ALIASES MANAGEMENT */}
      {activeTab === 'aliases' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6 max-w-5xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Custom Domain Email Aliases & Sender Identities</h2>
              <p className="text-xs text-slate-500">Create alias addresses (e.g. sales@domain, info@domain) that deliver to {activeMailbox?.email || 'your primary inbox'}.</p>
            </div>
            <form onSubmit={handleAddAlias} className="flex items-center gap-2">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                <input
                  type="text"
                  value={newAliasPrefix}
                  onChange={(e) => setNewAliasPrefix(e.target.value)}
                  placeholder="sales"
                  className="bg-transparent text-slate-900 font-mono font-bold focus:outline-none w-24 text-right"
                />
                <span className="text-slate-400 font-mono pl-1">@{activeMailbox?.customDomain || 'shanutechx.com'}</span>
              </div>
              <button
                type="submit"
                disabled={addingAlias}
                className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {addingAlias ? 'Creating...' : '+ Add Alias'}
              </button>
            </form>
          </div>

          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-indigo-950">Alias Quota Usage: </span>
              <span className="font-mono text-indigo-700 font-bold">
                {activeMailbox?.aliases?.length || 0} / {activeMailbox?.maxAliases === -1 ? '∞ Unlimited' : (activeMailbox?.maxAliases || 10)} Aliases Used
              </span>
            </div>
            <span className="text-slate-500 text-[11px]">Enforced by plan tier</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(!activeMailbox?.aliases || activeMailbox.aliases.length === 0) ? (
              <div className="col-span-full text-center py-10 text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">
                No custom domain aliases added yet. Use the form above to add <code className="font-mono text-indigo-600">sales</code>, <code className="font-mono text-indigo-600">support</code>, or <code className="font-mono text-indigo-600">info</code>.
              </div>
            ) : (
              activeMailbox.aliases.map((aliasPrefix: string) => {
                const fullAlias = `${aliasPrefix}@${activeMailbox.customDomain || 'shanutechx.com'}`;
                return (
                  <div key={aliasPrefix} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Sender Identity</span>
                        <button
                          onClick={() => handleRemoveAlias(aliasPrefix)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                        >
                          Remove
                        </button>
                      </div>
                      <h3 className="font-bold text-sm font-mono text-slate-900 truncate">{fullAlias}</h3>
                      <p className="text-[11px] text-slate-500">Delivers to & sends from primary mailbox</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          setComposeFrom(fullAlias);
                          setShowComposeModal(true);
                        }}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        ✉️ Compose as Alias
                      </button>
                      <button
                        onClick={() => copyToClipboard(fullAlias, 'Alias Address')}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CONTACTS MANAGEMENT */}
      {activeTab === 'contacts' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6 max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Email Address Book & Contacts</h2>
              <p className="text-xs text-slate-500">Manage saved contacts for quick email dispatch.</p>
            </div>
            <button
              onClick={() => setShowAddContactModal(true)}
              className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm hover:bg-indigo-700"
            >
              + Add Contact
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 text-xs font-medium">
                No contacts saved yet. Click "+ Add Contact" to get started.
              </div>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-slate-900">{c.name}</h3>
                      {c.company && <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-md">{c.company}</span>}
                    </div>
                    <p className="text-xs font-mono text-indigo-600">{c.email}</p>
                    {c.phone && <p className="text-[11px] text-slate-500">📞 {c.phone}</p>}
                  </div>
                  <button
                    onClick={() => {
                      setComposeTo(c.email);
                      setShowComposeModal(true);
                    }}
                    className="mt-3 w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs py-2 rounded-xl hover:bg-slate-100 shadow-sm"
                  >
                    ✉️ Compose Email
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PLAN & BILLING */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-8 max-w-5xl mx-auto w-full">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Email Hosting Subscription, Upgrades & Renewal</h2>
            <p className="text-xs text-slate-500">View current plan usage, active subscription status, or purchase/upgrade email hosting plans with a 3-month minimum commitment.</p>
          </div>

          {activeMailbox && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{activeMailbox.planName || 'Business Mail Hosting'}</h3>
                  <p className="text-xs text-slate-500 font-mono">{activeMailbox.email}</p>
                </div>
                <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${activeMailbox.isSuspended ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {activeMailbox.isSuspended ? 'Suspended / Expired' : 'Active Subscription'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-white p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 text-[11px] block">Storage Quota</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {activeMailbox.storageQuotaMb === -1 ? '∞ Unlimited' : `${(activeMailbox.storageQuotaMb / 1024).toFixed(0)} GB`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Daily Send Limit</span>
                  <span className="font-bold text-slate-900 font-mono">{activeMailbox.dailySendLimit} / day</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Max Aliases</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {activeMailbox.maxAliases === -1 ? '∞ Unlimited' : (activeMailbox.maxAliases || 10)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Expires On</span>
                  <span className="font-bold text-indigo-700 font-mono">
                    {activeMailbox.expiresAt ? new Date(activeMailbox.expiresAt).toLocaleDateString() : 'Permanent (Free)'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await api.email.renew(activeMailbox.id);
                      toast(res.message || 'Subscription renewed!', 'success');
                      fetchMailboxes();
                    } catch (err: any) {
                      toast(err.message || 'Failed to renew', 'error');
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-sm"
                >
                  Renew Subscription (+3 Months)
                </button>
              </div>
            </div>
          )}

          {/* Email Hosting Plans Storefront Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Available Email Hosting Plans</h3>
                <p className="text-xs text-slate-500">Configure prices in Dev Dashboard. All plans require a minimum 3-month purchase commitment.</p>
              </div>
              <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
                🔒 3-Month Minimum Commitment
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePlans.map((plan) => {
                const specs = plan.specsJson || {};
                return (
                  <div key={plan.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 flex flex-col justify-between hover:border-indigo-300 transition-all shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900">{plan.name}</h4>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-mono">
                          3 Months
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xl font-extrabold text-indigo-600 font-mono">
                          LKR {(plan.price / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          (LKR {((plan.price / 100) / 3).toLocaleString('en-US', { maximumFractionDigits: 0 })} / month)
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-xs text-slate-700 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-600 font-bold">✓</span>
                          <span>{specs.mailboxesCount === -1 ? 'Unlimited' : (specs.mailboxesCount || 1)} Mailbox Included</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-600 font-bold">✓</span>
                          <span>{specs.storageLimitGb === -1 ? 'Unlimited Storage' : `${specs.storageLimitGb || 1} GB Storage per Mailbox`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-600 font-bold">✓</span>
                          <span>{specs.forwardingRules === -1 ? 'Unlimited Forwarding Rules' : `${specs.forwardingRules || 1} Forwarding Rule(s)`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-600 font-bold">✓</span>
                          <span>{specs.maxAliases === -1 || specs.emailAliases === -1 ? 'Unlimited Email Aliases' : `${specs.maxAliases || specs.emailAliases || 2} Email Aliases`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-600 font-bold">✓</span>
                          <span>{specs.dailyQuota || 500} emails/day send limit</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          await api.cart.addItem({ planId: plan.id }, 1);
                          toast(`Added ${plan.name} to cart!`, 'success');
                          window.location.href = '/cart';
                        } catch (err: any) {
                          toast(err.message || 'Failed to add to cart', 'error');
                        }
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all"
                    >
                      Purchase Plan (3-Month Commitment) →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ADMIN DELEGATION & ACCESS */}
      {activeTab === 'delegation' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-6 max-w-4xl mx-auto w-full">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Admin Delegation & Access Management</h2>
            <p className="text-xs text-slate-500">Grant delegated admins read/send permissions on client mailboxes on their behalf.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
            <p className="font-bold">🛡️ Delegation Rules:</p>
            <p>- Delegated admins can read emails, send emails, and manage settings on behalf of assigned clients.</p>
            <p>- Non-dev admins cannot create new email accounts within client spaces (only provision/assign existing ones).</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Delegated Admin Access List</h3>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-slate-600">Mailbox ID: <code className="font-mono text-indigo-700">{activeMailbox?.id}</code></p>
              <p className="text-xs text-slate-600">Assigned Admins: <code className="font-mono text-slate-800">{activeMailbox?.allowedAdminIds?.join(', ') || 'None (Owner Only)'}</code></p>
            </div>
          </div>
        </div>
      )}

      {/* COMPOSE EMAIL MODAL */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">New Email Message</h3>
              <button onClick={() => setShowComposeModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">From (Sender Identity)</label>
                <select
                  value={composeFrom || activeMailbox?.email || ''}
                  onChange={(e) => setComposeFrom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={activeMailbox?.email || 'me@shanutechx.com'}>
                    {activeMailbox?.email || 'me@shanutechx.com'} (Primary Mailbox)
                  </option>
                  {activeMailbox?.aliases?.map((aliasPrefix: string) => {
                    const full = `${aliasPrefix}@${activeMailbox.customDomain || 'shanutechx.com'}`;
                    return (
                      <option key={aliasPrefix} value={full}>
                        {full} (Alias Identity)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">To</label>
                <input
                  type="email" required value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@domain.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Subject</label>
                <input
                  type="text" required value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Message</label>
                <textarea
                  rows={6} required value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write message..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              
              {/* Attachment simulator */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const filename = `attachment-${Date.now().toString().slice(-4)}.pdf`;
                    setAttachments((prev) => [...prev, { filename, sizeStr: '1.2 MB' }]);
                    toast(`Attached ${filename}`, 'info');
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  📎 Attach File
                </button>
                {attachments.length > 0 && <span className="text-[11px] text-slate-500 font-mono">{attachments.length} file(s) attached</span>}
              </div>

              <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={handleSaveDraft} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                  Save Draft
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowComposeModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                  <button type="submit" disabled={sending} className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md">
                    {sending ? 'Sending...' : 'Send Email →'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CONTACT MODAL */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Add New Contact</h3>
              <button onClick={() => setShowAddContactModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleCreateContact} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Full Name</label>
                <input
                  type="text" required value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Email Address</label>
                <input
                  type="email" required value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Phone (Optional)</label>
                <input
                  type="text" value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="+1 234 567 890"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Company / Tag (Optional)</label>
                <input
                  type="text" value={newContactCompany}
                  onChange={(e) => setNewContactCompany(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddContactModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md">
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
