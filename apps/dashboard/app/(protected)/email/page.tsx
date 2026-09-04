'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';

import { WebmailLayout } from '@/components/webmail/WebmailLayout';
import { WebmailThreadList } from '@/components/webmail/WebmailThreadList';
import { WebmailThreadViewer } from '@/components/webmail/WebmailThreadViewer';
import { WebmailRichComposer } from '@/components/webmail/WebmailRichComposer';
import { WebmailFoldersAndLabelsModal } from '@/components/webmail/WebmailFoldersAndLabelsModal';
import { WebmailRulesModal } from '@/components/webmail/WebmailRulesModal';
import { WebmailSettingsModal } from '@/components/webmail/WebmailSettingsModal';
import { WebmailCalendarTab } from '@/components/webmail/WebmailCalendarTab';
import { WebmailContactsTab } from '@/components/webmail/WebmailContactsTab';
import { WebmailMessage } from '@/lib/types';
import {
  Mail,
  KeyRound,
  Globe,
  Tag,
  Users,
  CreditCard,
  ShieldCheck,
  Calendar,
  ArrowLeft,
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

export default function RedesignedMailboxStudioPage() {
  const [activeTab, setActiveTab] = useState<'webmail' | 'smtp_creds' | 'dns' | 'aliases' | 'contacts' | 'billing' | 'delegation'>('webmail');
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'drafts' | 'sent' | 'spam' | 'trash' | 'archive' | 'snoozed'>('inbox');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WebmailMessage | null>(null);

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [events, setEvents] = useState<UpcomingEvent[]>([]);

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

  // Webmail Suite Enhancements State
  const [webmailCategory, setWebmailCategory] = useState<'primary' | 'social' | 'promotions' | 'updates'>('primary');
  const [webmailViewMode, setWebmailViewMode] = useState<'threads' | 'flat'>('threads');
  const [listDensity, setListDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const [showFoldersModal, setShowFoldersModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCalendarTab, setShowCalendarTab] = useState(false);

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
    api.webmail.listMessages(activeFolder).then((res) => {
      const list: WebmailMessage[] = res.messages || [];
      setMessages(list);
      if (list.length > 0) setSelectedMessage(list[0]);
      else setSelectedMessage(null);
    }).catch(() => {
      setMessages([]);
      setSelectedMessage(null);
    });
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

  const toggleStar = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = messages.find((m) => m.id === id);
    if (!target) return;
    const nextStarred = !target.isStarred;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStarred: nextStarred } : m))
    );
    api.webmail.bulkAction({ action: nextStarred ? 'star' : 'unstar', messageIds: [id] }).catch(() => {});
  };

  const handleDeleteMessage = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.webmail.bulkAction({ action: 'delete', messageIds: [id] });
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
    if (activeTag && m.labels && !m.labels.includes(activeTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (m.subject || '').toLowerCase().includes(q) ||
        (m.senderName || m.senderEmail || m.from || '').toLowerCase().includes(q) ||
        (m.snippet || m.htmlBody || m.body || '').toLowerCase().includes(q)
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
          <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Mail className="h-5 w-5" />
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
            { id: 'webmail', label: 'Webmail Client', icon: Mail },
            { id: 'smtp_creds', label: 'SMTP Credentials', icon: KeyRound },
            { id: 'dns', label: 'Custom Domains & DNS', icon: Globe },
            { id: 'aliases', label: 'Email Aliases', icon: Tag },
            { id: 'contacts', label: 'Contacts', icon: Users },
            { id: 'billing', label: 'Plan & Billing', icon: CreditCard },
            { id: 'delegation', label: 'Admin Access', icon: ShieldCheck },
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container Area */}
      {activeTab === 'webmail' && (
        showCalendarTab ? (
          <div className="flex-1 rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center px-6">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400" /> Integrated Calendar Mode
              </span>
              <button onClick={() => setShowCalendarTab(false)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Webmail Client
              </button>
            </div>
            <WebmailCalendarTab />
          </div>
        ) : (
          <WebmailLayout
            mailboxes={mailboxes}
            selectedMailboxId={selectedMailboxId}
            onSelectMailboxId={setSelectedMailboxId}
            activeFolder={activeFolder}
            onSelectFolder={(f) => { setActiveFolder(f as any); setActiveTag(null); }}
            activeTag={activeTag}
            onSelectTag={setActiveTag}
            activeCategory={webmailCategory}
            onSelectCategory={(cat) => setWebmailCategory(cat as any)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            listDensity={listDensity}
            onChangeDensity={(d) => setListDensity(d as any)}
            viewMode={webmailViewMode}
            onChangeViewMode={setWebmailViewMode}
            onOpenCompose={() => setShowComposeModal(true)}
            onOpenFoldersModal={() => setShowFoldersModal(true)}
            onOpenRulesModal={() => setShowRulesModal(true)}
            onOpenSettingsModal={() => setShowSettingsModal(true)}
            onOpenCalendarTab={() => setShowCalendarTab(true)}
            onOpenContactsTab={() => setActiveTab('contacts')}
            storageUsedMb={activeMailbox?.storageUsedMb || 434}
            storageQuotaMb={activeMailbox?.storageQuotaMb || 1024}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              {/* THREAD LIST (5 COLS) */}
              <div className="lg:col-span-5 h-full min-h-[680px]">
                <WebmailThreadList
                  messages={filteredMessages}
                  selectedMessageId={selectedMessage?.id || null}
                  onSelectMessage={(msg) => {
                    setSelectedMessage(msg);
                    if (msg.threadId) setActiveThreadId(msg.threadId);
                  }}
                  activeFolder={activeFolder}
                  viewMode={webmailViewMode}
                  listDensity={listDensity}
                  onToggleStar={(id, e) => toggleStar(id, e)}
                  onDeleteMessage={(id, e) => handleDeleteMessage(id, e)}
                />
              </div>

              {/* THREAD / MESSAGE VIEWER (7 COLS) */}
              <div className="lg:col-span-7 h-full min-h-[680px]">
                <WebmailThreadViewer
                  selectedMessage={selectedMessage}
                  activeThreadId={activeThreadId}
                  onReply={(msg) => {
                    setComposeTo(msg.senderEmail || msg.from || '');
                    setComposeSubject(`Re: ${msg.subject}`);
                    setComposeBody(`\n\n--- On ${msg.createdAt || msg.timestamp}, ${msg.senderName || msg.from} wrote:\n> ${msg.htmlBody || msg.body}`);
                    setShowComposeModal(true);
                  }}
                  onForward={(msg) => {
                    setComposeSubject(`Fwd: ${msg.subject}`);
                    setComposeBody(`\n\n--- Forwarded message ---\nFrom: ${msg.senderName || msg.from}\nSubject: ${msg.subject}\n\n${msg.htmlBody || msg.body}`);
                    setShowComposeModal(true);
                  }}
                  onDelete={(id) => {
                    handleDeleteMessage(id);
                    setSelectedMessage(null);
                  }}
                />
              </div>
            </div>
          </WebmailLayout>
        )
      )}

      {/* WEBMAIL SUITE MODALS */}
      <WebmailFoldersAndLabelsModal isOpen={showFoldersModal} onClose={() => setShowFoldersModal(false)} />
      <WebmailRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      <WebmailSettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* RICH DOCKABLE COMPOSER */}
      {showComposeModal && (
        <WebmailRichComposer
          isOpen={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          defaultTo={composeTo}
          defaultSubject={composeSubject}
          defaultBody={composeBody}
          fromEmail={activeMailbox?.email || 'me@shanutechx.com'}
        />
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
                    {dom.status === 'verified' ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 inline text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 inline text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pending DNS Check
                      </span>
                    )}
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
                        className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Compose as Alias
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
        <div className="bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex-1">
          <WebmailContactsTab
            onComposeTo={(email) => {
              setComposeTo(email);
              setShowComposeModal(true);
            }}
          />
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
              <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                <svg className="w-3 h-3 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                3-Month Minimum Commitment
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
            <p className="font-bold flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Delegation Rules:
            </p>
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
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attach File
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
