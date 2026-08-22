'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, Spinner, ErrorBanner, Button, Badge, useToast } from '@/components/ui';
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
  to: string;
  subject: string;
  body: string;
  folder: 'inbox' | 'drafts' | 'scheduled' | 'sent' | 'spam' | 'trash';
  isRead: boolean;
  isStarred: boolean;
  hasAttachment?: boolean;
  timestamp: string;
}

const DEMO_MESSAGES: EmailMessage[] = [
  {
    id: 'msg-1',
    from: 'Martynas Sipavičius <martynas@hostinger.com>',
    to: 'me',
    subject: 'Re: Services',
    body: `Sounds good to me. I am interested in learning more about the Stress Relief option.\n\nCould you please provide more details?\n\n---\nThis message and its attachments may contain privileged and confidential information. If you are not the intended recipient, do not use, copy, or disclose this information.`,
    folder: 'inbox',
    isRead: false,
    isStarred: true,
    hasAttachment: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'msg-2',
    from: 'Hostinger Business Email <welcome@hostinger.com>',
    to: 'me',
    subject: 'Get started with business email',
    body: 'Welcome to your professional business email workspace! Configure custom domain DNS records, set up IMAP/SMTP on mobile, and manage your mailboxes effortlessly.',
    folder: 'inbox',
    isRead: true,
    isStarred: false,
    hasAttachment: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'msg-3',
    from: 'SHANUTECHX Security <security@shanutechx.com>',
    to: 'me',
    subject: 'SSL Certificate Auto-Renewed for custom domain',
    body: 'Your Let\'s Encrypt SSL certificate for custom email domain has been auto-renewed successfully.',
    folder: 'inbox',
    isRead: true,
    isStarred: false,
    hasAttachment: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export default function CustomerEmailPage() {
  const [activeTab, setActiveTab] = useState<'webmail' | 'smtp' | 'dns'>('webmail');
  const [viewMode, setViewMode] = useState<'column' | 'row'>('column');

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>(DEMO_MESSAGES);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'drafts' | 'scheduled' | 'sent' | 'spam' | 'trash'>('inbox');
  const [filterFilter, setFilterFilter] = useState<'all' | 'unread' | 'read' | 'starred'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(DEMO_MESSAGES[0]);

  const [loading, setLoading] = useState(true);
  const [noSubscription, setNoSubscription] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [smtpProducts, setSmtpProducts] = useState<any[]>([]);

  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [newDomainStr, setNewDomainStr] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);

  const { toast } = useToast();

  async function loadData() {
    setLoading(true);
    setNoSubscription(false);
    try {
      const [mbRes, domRes, msgRes, prodRes] = await Promise.all([
        api.email.mailboxes().catch(() => ({ mailboxes: [] })),
        api.email.domains().catch(() => ({ domains: [] })),
        api.email.messages(activeFolder).catch(() => ({ messages: [] })),
        api.products.list('smtp_hosting' as any).catch(() => ({ products: [] })),
      ]);
      setMailboxes(mbRes.mailboxes || []);
      setDomains(domRes.domains || []);
      if (msgRes.messages && msgRes.messages.length > 0) {
        setMessages(msgRes.messages);
        setSelectedMessage(msgRes.messages[0]);
      }
      setSmtpProducts(prodRes.products || []);
      if (mbRes.mailboxes?.length > 0 && !composeFrom) {
        setComposeFrom(mbRes.mailboxes[0].email);
      }
      setError(null);
    } catch (err: any) {
      if (err.message?.includes('purchaseRequired') || err.message?.includes('purchase')) {
        setNoSubscription(true);
      } else {
        setError(err.message || 'Failed to load email service data');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeFolder]);

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setSendingEmail(true);
    try {
      await api.email.send({
        from: composeFrom || 'me@domain.com',
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
      toast(`Email sent to ${composeTo}!`, 'success');
      setShowComposeModal(false);
      const newMsg: EmailMessage = {
        id: `msg-${Date.now()}`,
        from: composeFrom || 'me@domain.com',
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        folder: 'sent',
        isRead: true,
        isStarred: false,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [newMsg, ...prev]);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (err: any) {
      toast(err.message || 'Failed to send email', 'error');
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    setAddingDomain(true);
    try {
      await api.email.addDomain(newDomainStr);
      toast(`Added domain ${newDomainStr}! Please configure DNS records.`, 'success');
      setShowAddDomainModal(false);
      setNewDomainStr('');
      loadData();
    } catch (err: any) {
      toast(err.message || 'Failed to add domain', 'error');
    } finally {
      setAddingDomain(false);
    }
  }

  async function handleVerifyDomain(domainId: string) {
    setVerifyingDomainId(domainId);
    try {
      const res = await api.email.verifyDomain(domainId);
      toast(res.message, res.verified ? 'success' : 'info');
      loadData();
    } catch (err: any) {
      toast(err.message || 'DNS Verification failed', 'error');
    } finally {
      setVerifyingDomainId(null);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast(`Copied ${label} to clipboard!`, 'info');
  }

  function toggleStar(msgId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isStarred: !m.isStarred } : m))
    );
  }

  const filteredMessages = messages.filter((m) => {
    const matchesFolder = m.folder === activeFolder || (activeFolder === 'inbox' && !m.folder);
    const matchesFilter =
      filterFilter === 'all'
        ? true
        : filterFilter === 'unread'
        ? !m.isRead
        : filterFilter === 'read'
        ? m.isRead
        : filterFilter === 'starred'
        ? m.isStarred
        : true;
    const matchesSearch =
      !searchQuery ||
      m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.body.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesFilter && matchesSearch;
  });

  if (loading) return <Spinner label="Loading Hostinger Mail Workspace..." />;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <PageHeader
        title="Hostinger Mail Workspace"
        description="Production-grade business email studio supporting Hostinger Mail, Postal, and custom SMTP hosts."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('webmail')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'webmail' ? 'bg-indigo-600 text-white shadow-glow-violet' : 'glass text-text-muted hover:text-white'
              }`}
            >
              ✉ Webmail Studio
            </button>
            <button
              onClick={() => setActiveTab('smtp')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'smtp' ? 'bg-indigo-600 text-white shadow-glow-violet' : 'glass text-text-muted hover:text-white'
              }`}
            >
              ⚡ SMTP Credentials
            </button>
            <button
              onClick={() => setActiveTab('dns')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'dns' ? 'bg-indigo-600 text-white shadow-glow-violet' : 'glass text-text-muted hover:text-white'
              }`}
            >
              🌐 Domains &amp; DNS
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* ── TAB 1: HOSTINGER-STYLE WEBMAIL STUDIO ── */}
      {activeTab === 'webmail' && (
        <div className="bg-[#0b0c16] border border-white/10 rounded-3xl overflow-hidden shadow-2xl min-h-[720px] flex flex-col">
          {/* Top Search & Utilities Bar */}
          <div className="bg-[#121324] border-b border-white/[0.08] px-4 py-3 flex items-center justify-between gap-4">
            {/* Hostinger Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="h-6 w-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                H
              </span>
              <span className="font-extrabold text-sm tracking-tight text-white">HOSTINGER <span className="text-text-muted font-normal">| Mail</span></span>
            </div>

            {/* Search Input */}
            <div className="flex-1 max-w-xl relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail"
                className="w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-1.5 pl-10 pr-10 text-xs text-white placeholder:text-text-muted focus:outline-none focus:border-indigo-500 transition-all"
              />
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              </button>
            </div>

            {/* Header Right Action Icons */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowLayoutModal(true)}
                title="Select Layout View Mode"
                className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
              <button className="flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-3 py-1 text-xs font-semibold hover:bg-indigo-500/30 transition-all">
                <span>✨ Ask Kodee AI</span>
              </button>
              <div className="h-7 w-7 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                D
              </div>
            </div>
          </div>

          {/* Main 3-Pane Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* PANE 1: Hostinger Left Sidebar */}
            <div className="w-56 bg-[#0e0f1d] border-r border-white/[0.08] p-3 flex flex-col justify-between shrink-0">
              <div className="space-y-4">
                {/* Primary CTA: + New message */}
                <button
                  onClick={() => setShowComposeModal(true)}
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 text-xs flex items-center justify-center gap-2 shadow-glow-violet transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>New message</span>
                </button>

                {/* Folder Links */}
                <nav className="space-y-0.5 text-xs">
                  {[
                    { id: 'inbox', label: 'Inbox', icon: '📥', count: 119 },
                    { id: 'drafts', label: 'Drafts', icon: '📝', count: 6 },
                    { id: 'scheduled', label: 'Scheduled', icon: '⏰', count: 0 },
                    { id: 'sent', label: 'Sent', icon: '📤', count: 0 },
                    { id: 'spam', label: 'Spam', icon: '⚠️', count: 5 },
                    { id: 'trash', label: 'Trash', icon: '🗑️', count: 5 },
                  ].map((folder) => {
                    const active = activeFolder === folder.id;
                    return (
                      <button
                        key={folder.id}
                        onClick={() => { setActiveFolder(folder.id as any); setSelectedMessage(null); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium ${
                          active
                            ? 'bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30'
                            : 'text-text-muted hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span>{folder.icon}</span>
                          <span>{folder.label}</span>
                        </span>
                        {folder.count > 0 && (
                          <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${active ? 'bg-indigo-600 text-white' : 'bg-white/10 text-text-muted'}`}>
                            {folder.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>

                <div className="pt-2 border-t border-white/[0.06] space-y-1">
                  <button className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-text-muted hover:text-white">
                    <span className="flex items-center gap-2">📁 Folders</span>
                    <span>+</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:text-white">
                    👥 Contacts
                  </button>
                </div>
              </div>

              {/* Bottom Storage Meter Bar (Hostinger Style) */}
              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-text-muted">
                    <span>Storage</span>
                    <span className="text-white font-bold">434.68 MB / 50 GB</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className="bg-indigo-500 h-full rounded-full w-[12%]" />
                  </div>
                </div>

                <div className="space-y-1">
                  <button className="w-full bg-white/5 hover:bg-white/10 rounded-xl py-1.5 px-3 text-[11px] text-text-muted text-center font-medium transition-colors">
                    💬 Send feedback
                  </button>
                  <button className="w-full bg-[#16182e] hover:bg-[#1f2242] border border-indigo-500/30 rounded-xl py-1.5 px-3 text-[11px] text-indigo-300 font-bold text-center flex items-center justify-center gap-1.5 transition-colors">
                    🚀 Setup guide 0/5
                  </button>
                </div>
              </div>
            </div>

            {/* PANE 2: Middle Email Thread List */}
            <div className={`${viewMode === 'column' ? 'w-80 border-r border-white/[0.08]' : 'flex-1'} bg-[#0d0e1b] flex flex-col shrink-0 overflow-hidden`}>
              {/* Filter Pills Header */}
              <div className="p-3 border-b border-white/[0.06] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <input type="checkbox" className="rounded bg-black/40 border-white/20" />
                  <span className="text-xs font-bold text-white capitalize">{activeFolder}</span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1">
                  {[
                    { id: 'all', label: 'All mail' },
                    { id: 'unread', label: 'Unread' },
                    { id: 'read', label: 'Read' },
                    { id: 'starred', label: 'Starred' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterFilter(tab.id as any)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                        filterFilter === tab.id
                          ? 'bg-white text-black font-bold'
                          : 'text-text-muted hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-xs">
                    No messages in {activeFolder}.
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isSelected = selectedMessage?.id === msg.id;
                    return (
                      <div
                        key={msg.id}
                        onClick={() => setSelectedMessage(msg)}
                        className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1 relative ${
                          isSelected
                            ? 'bg-indigo-600/15 border-l-4 border-indigo-500'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-semibold truncate ${msg.isRead ? 'text-text-muted' : 'text-white font-bold'}`}>
                            {msg.from.split('<')[0].trim()}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-text-faint font-mono">
                            {msg.hasAttachment && <span>📎</span>}
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs truncate ${msg.isRead ? 'text-text-muted' : 'text-white font-medium'}`}>
                            {msg.subject}
                          </p>
                          <button
                            onClick={(e) => toggleStar(msg.id, e)}
                            className="text-text-faint hover:text-amber-400 shrink-0"
                          >
                            {msg.isStarred ? '★' : '☆'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PANE 3: Right Reading Pane (Hostinger Column View) */}
            {viewMode === 'column' && (
              <div className="flex-1 bg-[#0b0c16] flex flex-col overflow-hidden">
                {selectedMessage ? (
                  <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
                    {/* Reading Action Toolbar */}
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                      <div className="flex items-center gap-3 text-text-muted">
                        <button title="Archive" className="hover:text-white p-1">📥</button>
                        <button title="Snooze" className="hover:text-white p-1">⏰</button>
                        <button title="Delete" className="hover:text-white p-1">🗑️</button>
                        <button title="Mark Unread" className="hover:text-white p-1">✉️</button>
                      </div>

                      <button className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-xl px-3 py-1 text-xs font-semibold hover:bg-indigo-500/20 transition-all">
                        <span>✨ Summarize Thread</span>
                      </button>
                    </div>

                    {/* Subject Header */}
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">{selectedMessage.subject}</h2>
                    </div>

                    {/* Sender Header Card */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {selectedMessage.from[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{selectedMessage.from}</p>
                          <p className="text-xs text-text-muted mt-0.5">to me ▼</p>
                        </div>
                      </div>
                      <span className="text-xs text-text-faint font-mono">
                        {new Date(selectedMessage.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {/* Collapsible Quote Block button (...) */}
                    <div className="space-y-3">
                      <button className="text-xs bg-white/5 hover:bg-white/10 rounded px-2 py-0.5 text-text-muted font-bold">
                        ...
                      </button>

                      {/* Rendered Email Body */}
                      <div className="bg-[#101122] border border-white/[0.08] rounded-2xl p-6 text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-sans shadow-inner">
                        {selectedMessage.body}
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
                      <button
                        onClick={() => {
                          setComposeTo(selectedMessage.from);
                          setComposeSubject(`Re: ${selectedMessage.subject}`);
                          setShowComposeModal(true);
                        }}
                        className="rounded-xl glass border border-white/15 px-5 py-2 text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2 transition-all"
                      >
                        <span>↩ Reply</span>
                      </button>
                      <button
                        onClick={() => {
                          setComposeSubject(`Fwd: ${selectedMessage.subject}`);
                          setComposeBody(`\n\n---------- Forwarded message ---------\nFrom: ${selectedMessage.from}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.body}`);
                          setShowComposeModal(true);
                        }}
                        className="rounded-xl glass border border-white/15 px-5 py-2 text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2 transition-all"
                      >
                        <span>↪ Forward</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-text-muted space-y-3">
                    <span className="text-4xl">📬</span>
                    <p className="text-sm font-semibold text-white">Select a message to read</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: SMTP CREDENTIALS ── */}
      {activeTab === 'smtp' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {mailboxes.length === 0 ? (
              <Card className="flex flex-col items-center py-12 text-center space-y-3 md:col-span-2">
                <span className="text-4xl">📭</span>
                <p className="text-text-muted text-sm">No SMTP accounts provisioned yet.</p>
              </Card>
            ) : (
              mailboxes.map((mb) => (
                <div key={mb.id} className="glass border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white font-mono">{mb.email}</h4>
                      <p className="text-[11px] text-text-muted">{mb.planName}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                      {mb.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-black/50 border border-white/10 rounded-xl p-3">
                    <div>
                      <span className="text-text-faint block">SMTP Host</span>
                      <span className="text-indigo-400 font-bold">{mb.smtpHost}</span>
                    </div>
                    <div>
                      <span className="text-text-faint block">Ports</span>
                      <span className="text-white">{mb.smtpPort} (TLS) / {mb.sslPort} (SSL)</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(`SMTP Host: ${mb.smtpHost}\nPort: ${mb.smtpPort}\nUsername: ${mb.username}`, 'SMTP details')}
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      📋 Copy Config
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: DOMAINS & DNS ── */}
      {activeTab === 'dns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">Configure MX, SPF, DKIM, and DMARC records for custom email domain verification.</p>
            <Button size="sm" onClick={() => setShowAddDomainModal(true)}>+ Add Domain</Button>
          </div>
          {domains.map((dom) => (
            <Card key={dom.id} className="border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white font-mono">{dom.domain}</h4>
                <Button size="sm" onClick={() => handleVerifyDomain(dom.id)} loading={verifyingDomainId === dom.id}>Verify DNS</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Compose Email Floating Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121324] border border-white/15 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>✉</span> New Message
              </h3>
              <button onClick={() => setShowComposeModal(false)} className="text-text-muted hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">To</label>
                <input
                  type="email" required value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@domain.com"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Subject</label>
                <input
                  type="text" required value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Message Body</label>
                <textarea
                  rows={6} required value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowComposeModal(false)}>Discard</Button>
                <Button type="submit" size="sm" loading={sendingEmail}>Send Email →</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Select Layout View Mode Modal */}
      {showLayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121324] border border-white/15 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-sm text-white">Select layout</h3>
              <button onClick={() => setShowLayoutModal(false)} className="text-text-muted hover:text-white">✕</button>
            </div>
            <p className="text-xs text-text-muted">Choose how your inbox is displayed:</p>
            <div className="space-y-3">
              <label
                onClick={() => setViewMode('row')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  viewMode === 'row' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'glass border-white/10 text-text-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input type="radio" checked={viewMode === 'row'} onChange={() => {}} className="accent-indigo-500" />
                  <span className="text-xs font-bold">Row View</span>
                </div>
                <span className="text-xs">☰</span>
              </label>

              <label
                onClick={() => setViewMode('column')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  viewMode === 'column' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'glass border-white/10 text-text-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input type="radio" checked={viewMode === 'column'} onChange={() => {}} className="accent-indigo-500" />
                  <span className="text-xs font-bold">Column View (3-Pane)</span>
                </div>
                <span className="text-xs">|||</span>
              </label>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <Button size="sm" onClick={() => setShowLayoutModal(false)}>Apply Layout</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
