'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sun,
  Moon,
  Settings,
  Mail,
  Calendar,
  User,
  CheckSquare,
  Pencil,
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Trash2,
  X,
} from 'lucide-react';

// =====================================================================
// TYPES & INTERFACES
// =====================================================================
interface SmtpAccount {
  id: string;
  smtpUsername: string;
  customDomain?: string;
  aliases: string[];
  planTier: string;
  storageQuotaMb: number;
  dailySendLimit: number;
  webmailUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  user?: {
    id: string;
    displayName?: string;
    email?: string;
  };
}

interface WebmailMessage {
  id: string;
  userId?: string;
  smtpAccountId?: string;
  folder: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  snippet: string;
  htmlBody: string;
  category?: string;
  priority?: string;
  isRead: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  hasAttachments?: boolean;
  attachmentsJson?: Array<{ filename: string; sizeStr: string; url?: string }>;
  labels?: string[];
  createdAt: string;
  updatedAt?: string;
}

interface CalendarEvent {
  id: string;
  alias: string;
  title: string;
  date: string;
  time: string;
  color: string;
}

interface ContactItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  color?: string;
}

interface TaskItem {
  id: string;
  title: string;
  done: boolean;
  alias?: string;
}

// Initial Real Data State Initialization (Zero Mock Data)
const INITIAL_EVENTS: CalendarEvent[] = [];
const INITIAL_CONTACTS: ContactItem[] = [];
const INITIAL_TASKS: TaskItem[] = [];


// =====================================================================
// MAIN WEBMAIL COMPONENT
// =====================================================================
export default function WebmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoToken = searchParams.get('ssoToken');
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Navigation Screen State: 'login' | 'loading' | 'dashboard' | 'config' | 'mail'
  const [activeScreen, setActiveScreen] = useState<'login' | 'loading' | 'dashboard' | 'config' | 'mail'>('login');
  const [activeModule, setActiveModule] = useState<'mail' | 'calendar' | 'contacts' | 'tasks'>('mail');

  // Authentication State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [account, setAccount] = useState<SmtpAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Loading Screen State
  const [loadingProgress, setLoadingProgress] = useState(20);
  const [loadingStatus, setLoadingStatus] = useState('Authenticating session...');

  // Theme & Appearance State
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [primaryColor, setPrimaryColor] = useState('#2E6BF0');
  const [configTab, setConfigTab] = useState<'profile' | 'appearance' | 'security' | 'server'>('profile');

  // Mail Workspace State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WebmailMessage | null>(null);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Compose Modal State
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeExpanded, setComposeExpanded] = useState(false);
  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Profile / Settings State
  const [profileName, setProfileName] = useState('Shanu Tirosh');
  const [profileEmail, setProfileEmail] = useState('shanu@shanutechx.cloud');
  const [signatureHtml, setSignatureHtml] = useState('<b>Shanu Tirosh</b><br/><span style="color:#64748B">CEO & Founder, ShanuTechX Cloud</span>');

  // Calendar Module State
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [calViewMode, setCalViewMode] = useState<'month' | 'week'>('month');
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('10:00 AM');

  // Contacts Module State
  const [contacts, setContacts] = useState<ContactItem[]>(INITIAL_CONTACTS);
  const [contactSearch, setContactSearch] = useState('');

  // Tasks Module State
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Dropdowns & Toast
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // File Input Ref for Compose Attachments
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Switch Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load Active Session or Handle SSO Exchange
  useEffect(() => {
    async function bootSession() {
      let activeToken = localStorage.getItem('webmail_token');

      // SSO Exchange logic if launched from main dashboard
      if (ssoToken) {
        setActiveScreen('loading');
        setLoadingStatus('Exchanging SSO Security Ticket...');
        setLoadingProgress(40);
        try {
          const res = await fetch(`${apiBase}/api/webmail/auth/sso-exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssoToken }),
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            activeToken = data.token;
            setToken(data.token);
            setAccount(data.account);
            localStorage.setItem('webmail_token', data.token);
            localStorage.setItem('webmail_account', JSON.stringify(data.account));
            setLoadingProgress(100);
            setLoadingStatus('Mailbox ready!');
            setTimeout(() => setActiveScreen('mail'), 400);
            return;
          }
        } catch (err: any) {
          console.error('SSO Exchange error:', err);
        }
      }

      if (activeToken) {
        setToken(activeToken);
        // Verify token with backend
        try {
          const res = await fetch(`${apiBase}/api/webmail/auth/me`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          });
          const data = await res.json();
          if (res.ok && data.account) {
            setAccount(data.account);
            const fullEmail = `${data.account.smtpUsername}@${data.account.customDomain || 'shanutechx.cloud'}`;
            setProfileEmail(fullEmail);
            if (data.account.user?.displayName) setProfileName(data.account.user.displayName);
            setActiveScreen('mail');
            return;
          }
        } catch (err) {
          console.warn('Session expired or offline fallback active');
        }
      }

      // Default to Login Screen if no active session
      setActiveScreen('login');
    }

    void bootSession();
  }, [ssoToken, apiBase]);

  // Fetch Messages for Active Folder & Search Query
  const fetchMessages = useCallback(async () => {
    if (!token) return;
    setMessagesLoading(true);
    try {
      const q = encodeURIComponent(searchQuery);
      const res = await fetch(`${apiBase}/api/webmail/messages?folder=${activeFolder}&search=${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, [activeFolder, searchQuery, token, apiBase]);

  useEffect(() => {
    if (activeScreen === 'mail') {
      void fetchMessages();
    }
  }, [activeScreen, activeFolder, searchQuery, fetchMessages]);

  // Login Form Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter both email address and password.');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch(`${apiBase}/api/webmail/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Authentication failed. Invalid email or password.');
      }

      setToken(data.token);
      setAccount(data.account);
      localStorage.setItem('webmail_token', data.token);
      localStorage.setItem('webmail_account', JSON.stringify(data.account));

      setActiveScreen('loading');
      setLoadingStatus('Loading mailboxes & cryptographic vault...');
      setLoadingProgress(60);
      setTimeout(() => {
        setLoadingProgress(100);
        setActiveScreen('mail');
      }, 500);
    } catch (err: any) {
      setLoginError(err.message || 'Unable to connect to Webmail authentication server');
    } finally {
      setLoginLoading(false);
    }
  };

  // Send Email Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo) {
      showToast('Please specify a recipient email address');
      return;
    }
    setSending(true);

    try {
      const res = await fetch(`${apiBase}/api/webmail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientEmail: composeTo.trim(),
          subject: composeSubject.trim() || '(No Subject)',
          htmlBody: composeBody + (signatureHtml ? `<br/><br/>--<br/>${signatureHtml}` : ''),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch email');

      showToast('Message sent successfully!');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setAttachments([]);
      if (activeFolder === 'sent') void fetchMessages();
    } catch (err: any) {
      showToast(`Send Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // Bulk Message Actions
  const handleBulkAction = async (action: 'archive' | 'delete' | 'markRead' | 'markUnread' | 'star') => {
    if (selectedMsgIds.size === 0) return;
    const msgIds = Array.from(selectedMsgIds);

    try {
      await fetch(`${apiBase}/api/webmail/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageIds: msgIds, action }),
      });
      showToast(`Updated ${msgIds.length} messages`);
      setSelectedMsgIds(new Set());
      void fetchMessages();
    } catch (err) {
      showToast('Failed to perform bulk action');
    }
  };

  // Toggle Checkbox for Message Selection
  const toggleSelectMsg = (id: string) => {
    const next = new Set(selectedMsgIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMsgIds(next);
  };

  const toggleSelectAllMsgs = () => {
    if (selectedMsgIds.size === messages.length) {
      setSelectedMsgIds(new Set());
    } else {
      setSelectedMsgIds(new Set(messages.map((m) => m.id)));
    }
  };

  const fullEmail = account
    ? `${account.smtpUsername}@${account.customDomain || 'shanutechx.cloud'}`
    : profileEmail;

  // Filtered Contacts for Contact Module
  const filteredContacts = contacts.filter(
    (c) => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.email.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] bg-slate-900 text-white border border-slate-700 px-5 py-3 rounded-2xl shadow-2xl text-xs font-semibold animate-bounce flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =====================================================================
          SCREEN 1: LOGIN & SSO SCREEN
          ===================================================================== */}
      {activeScreen === 'login' && (
        <div className="flex-1 flex flex-col md:flex-row h-full w-full overflow-hidden bg-[var(--color-surface)]">
          {/* Left Form Panel */}
          <div className="flex-1 min-w-[320px] flex flex-col p-8 sm:p-14 overflow-y-auto justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--color-primary)] to-cyan-400 flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                STX
              </div>
              <span className="font-['Space_Grotesk'] font-bold text-xl tracking-tight text-[var(--color-text)]">STX Mail</span>
            </div>

            <div className="max-w-[420px] my-auto py-8">
              <h1 className="font-['Space_Grotesk'] font-bold text-3xl sm:text-4xl text-[var(--color-text)] tracking-tight mb-3">
                Sign in to Webmail
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mb-8">
                Autonomous enterprise cloud webmail for ShanuTechX email accounts and custom domains.
              </p>

              {loginError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                    Email Address or Alias
                  </label>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="user@yourdomain.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3.5 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-blue-600 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {loginLoading ? 'Authenticating...' : 'Sign In to Webmail'}
                </button>
              </form>

              <div className="mt-6">
                <button
                  onClick={() => {
                    setLoginEmail('shanu@shanutechx.cloud');
                    setLoginPassword('demo123456');
                    setActiveScreen('loading');
                    setTimeout(() => setActiveScreen('mail'), 600);
                  }}
                  className="w-full py-3.5 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] font-semibold text-xs hover:border-[var(--color-primary)] flex items-center justify-center gap-3 transition-all"
                >
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <span>Demo Mode Instant Access</span>
                </button>
              </div>

              <p className="mt-8 text-xs text-[var(--color-text-muted)] leading-relaxed">
                By continuing, you agree to ShanuTechX Webmail&apos;s Terms of Service and Privacy Policy.
              </p>
            </div>

            <div className="text-xs text-[var(--color-text-muted)]">
              Powered by ShanuTechX Autonomous Cloud Platform
            </div>
          </div>

          {/* Right Brand Panel */}
          <div className="flex-1 hidden md:flex relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 items-center justify-center p-12">
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

            <div className="relative z-10 text-center max-w-md text-white">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-cyan-500/30 border border-white/20 animate-pulse">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold mb-4 tracking-tight">
                Enterprise Email Suite
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Encrypted SMTP delivery, instant Git Webhooks auto-responder, WildDuck mailbox engine, and zero-config DNS routing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: LOADING SPLASH SCREEN
          ===================================================================== */}
      {activeScreen === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 to-blue-950 text-white p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xl shadow-xl shadow-blue-500/30 mb-6 animate-pulse">
            STX
          </div>
          <h2 className="font-['Space_Grotesk'] text-2xl font-bold mb-2 tracking-tight">STX Webmail</h2>
          <p className="text-xs text-slate-400 mb-8">{loadingStatus}</p>
          <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 rounded-full"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: DASHBOARD / ACCOUNT SWITCHER
          ===================================================================== */}
      {activeScreen === 'dashboard' && (
        <div className="flex-1 flex flex-col h-full w-full bg-[var(--color-bg)]">
          <header className="h-[64px] bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)] text-white font-bold flex items-center justify-center text-xs">
                STX
              </div>
              <span className="font-['Space_Grotesk'] font-bold text-lg">Mailbox Hub</span>
            </div>
            <button
              onClick={() => setActiveScreen('mail')}
              className="stx-btn-primary"
            >
              Open Active Workspace
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-5xl mx-auto w-full">
            <div className="mb-8">
              <h1 className="font-['Space_Grotesk'] font-bold text-2xl sm:text-3xl text-[var(--color-text)] mb-2">
                Mailboxes & Aliases Overview
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Manage your active cloud email addresses, storage allocations, and security settings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                <div className="text-xs text-[var(--color-text-muted)] font-semibold uppercase mb-1">Primary Email</div>
                <div className="text-lg font-bold text-[var(--color-text)] font-mono">{fullEmail}</div>
              </div>
              <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                <div className="text-xs text-[var(--color-text-muted)] font-semibold uppercase mb-1">Storage Used</div>
                <div className="text-lg font-bold text-[var(--color-text)]">0.5 GB / {(account?.storageQuotaMb || 5120) / 1024} GB</div>
              </div>
              <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                <div className="text-xs text-[var(--color-text-muted)] font-semibold uppercase mb-1">Daily Send Quota</div>
                <div className="text-lg font-bold text-[var(--color-text)]">{account?.dailySendLimit || 1000} msgs/day</div>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-['Space_Grotesk'] text-xl font-bold text-[var(--color-text)]">Connected Mailbox Aliases</h2>
              <button onClick={() => setActiveScreen('config')} className="stx-btn-ghost">
                Configure Aliases
              </button>
            </div>

            <div className="space-y-4">
              {(account?.aliases && account.aliases.length > 0 ? account.aliases : [fullEmail]).map((alias, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveScreen('mail')}
                  className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-[var(--color-primary)]">
                      {alias.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-base text-[var(--color-text)]">{alias}</div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono">{idx === 0 ? 'Primary Address' : 'Alias'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="px-5 py-2.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold text-xs hover:bg-[var(--color-primary-light-strong)] transition-all">
                      Launch Mail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: PROFILE & SETTINGS CONFIG HUB
          ===================================================================== */}
      {activeScreen === 'config' && (
        <div className="flex-1 flex flex-col h-full w-full bg-[var(--color-bg)] overflow-hidden">
          {/* Header */}
          <header className="h-[64px] bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveScreen('mail')}
                className="p-2 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="font-['Space_Grotesk'] font-bold text-lg">Mailbox Settings Hub</h1>
            </div>
            <button onClick={() => setActiveScreen('mail')} className="stx-btn-primary">
              Done & Return
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-4xl mx-auto w-full">
            {/* Config Tabs */}
            <div className="flex gap-2 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full mb-8">
              {[
                { id: 'profile', label: 'Profile & Signature' },
                { id: 'appearance', label: 'Appearance & Themes' },
                { id: 'security', label: 'Security & Sessions' },
                { id: 'server', label: 'IMAP / SMTP Server' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setConfigTab(tab.id as any)}
                  className={`flex-1 py-3 px-4 rounded-full text-xs font-bold transition-all text-center ${
                    configTab === tab.id
                      ? 'bg-[var(--color-primary)] text-white shadow-md'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Pane 1: Profile */}
            {configTab === 'profile' && (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
                  <h3 className="font-['Space_Grotesk'] font-bold text-lg">Display Metadata</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Display Name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Sender Address</label>
                      <input
                        type="text"
                        readOnly
                        value={fullEmail}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-muted)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
                  <h3 className="font-['Space_Grotesk'] font-bold text-lg">HTML Email Signature</h3>
                  <textarea
                    rows={4}
                    value={signatureHtml}
                    onChange={(e) => setSignatureHtml(e.target.value)}
                    className="w-full p-4 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] font-mono text-xs outline-none"
                  />
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-2">Live Live Preview</label>
                    <div
                      className="p-4 rounded-xl bg-[var(--color-surface-alt)] border border-dashed border-[var(--color-border-strong)] text-sm"
                      dangerouslySetInnerHTML={{ __html: signatureHtml }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab Pane 2: Appearance */}
            {configTab === 'appearance' && (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
                  <h3 className="font-['Space_Grotesk'] font-bold text-lg">Workspace Theme</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setTheme('light')}
                      className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                        theme === 'light' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)]'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">Light Theme</div>
                      <div className="text-xs text-[var(--color-text-muted)]">Clean high-contrast light workspace UI</div>
                    </div>
                    <div
                      onClick={() => setTheme('dark')}
                      className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                        theme === 'dark' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)]'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">Dark Mode</div>
                      <div className="text-xs text-[var(--color-text-muted)]">Deep slate background for low-light environments</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Pane 3: Security */}
            {configTab === 'security' && (
              <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
                <h3 className="font-['Space_Grotesk'] font-bold text-lg">Active Sessions & Security</h3>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Security Health Status: 100%</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">TLS 1.3 Encrypted JWT session active</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Pane 4: Server */}
            {configTab === 'server' && (
              <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
                <h3 className="font-['Space_Grotesk'] font-bold text-lg">IMAP & SMTP Credentials</h3>
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-between">
                    <span>SMTP Host: <b>mail.shanutechx.cloud</b></span>
                    <span>Port: <b>587 (TLS)</b></span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-between">
                    <span>IMAP Host: <b>mail.shanutechx.cloud</b></span>
                    <span>Port: <b>993 (SSL)</b></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 5: MAIL WORKSPACE (MAIN APP)
          ===================================================================== */}
      {activeScreen === 'mail' && (
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          {/* Top Application Bar */}
          <header className="h-[64px] bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div
                onClick={() => setActiveScreen('dashboard')}
                className="flex items-center gap-2 cursor-pointer user-select-none"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--color-primary)] to-cyan-400 text-white font-bold flex items-center justify-center text-xs shadow-md">
                  STX
                </div>
                <span className="font-['Space_Grotesk'] font-bold text-lg hidden sm:inline tracking-tight">STX Mail</span>
              </div>
            </div>

            {/* Global Search Bar */}
            <div className="flex-1 max-w-xl mx-4 sm:mx-8">
              <div className="relative flex items-center bg-[var(--color-surface-alt)] border border-[var(--color-border-strong)] rounded-full px-4 h-11 focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-light)] transition-all">
                <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subject, sender, or content... (Press '/' to focus)"
                  className="w-full bg-transparent border-none outline-none text-xs px-3 text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
                />
              </div>
            </div>

            {/* Top Right User Bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                title="Toggle Light/Dark Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setActiveScreen('config')}
                className="p-2.5 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                title="Settings Hub"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* User Dropdown */}
              <div className="relative">
                <div
                  onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
                  className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-[var(--color-surface-hover)]"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                    {profileName.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                {avatarDropdownOpen && (
                  <div className="absolute right-0 top-12 w-64 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl z-50 space-y-2">
                    <div className="p-2 border-b border-[var(--color-border)]">
                      <div className="font-bold text-sm">{profileName}</div>
                      <div className="text-xs text-[var(--color-text-muted)] truncate">{fullEmail}</div>
                    </div>
                    <button
                      onClick={() => { setAvatarDropdownOpen(false); setActiveScreen('config'); }}
                      className="w-full text-left p-2.5 text-xs font-semibold rounded-xl hover:bg-[var(--color-surface-hover)]"
                    >
                      Account Settings
                    </button>
                    <button
                      onClick={() => { setAvatarDropdownOpen(false); setActiveScreen('dashboard'); }}
                      className="w-full text-left p-2.5 text-xs font-semibold rounded-xl hover:bg-[var(--color-surface-hover)]"
                    >
                      Mailbox Overview
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem('webmail_token');
                        setActiveScreen('login');
                      }}
                      className="w-full text-left p-2.5 text-xs font-semibold text-red-500 rounded-xl hover:bg-red-500/10"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Body Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Icon Rail (Module Switcher) */}
            <nav className="w-16 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col items-center py-4 gap-3 shrink-0">
              <button
                onClick={() => setActiveModule('mail')}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  activeModule === 'mail' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
                title="Mail"
              >
                <Mail className="w-5 h-5" />
              </button>
              <button
                onClick={() => setActiveModule('calendar')}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  activeModule === 'calendar' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
                title="Calendar"
              >
                <Calendar className="w-5 h-5" />
              </button>
              <button
                onClick={() => setActiveModule('contacts')}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  activeModule === 'contacts' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
                title="Contacts"
              >
                <User className="w-5 h-5" />
              </button>
              <button
                onClick={() => setActiveModule('tasks')}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  activeModule === 'tasks' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
                title="Tasks"
              >
                <CheckSquare className="w-5 h-5" />
              </button>
            </nav>

            {/* MODULE 1: MAIL WORKSPACE */}
            {activeModule === 'mail' && (
              <div className="flex-1 flex overflow-hidden w-full">
                {/* Collapsible Sidebar */}
                <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} bg-[var(--color-surface)] border-r border-[var(--color-border)] p-4 flex flex-col justify-between shrink-0 transition-all`}>
                  <div>
                    {/* Compose Button */}
                    <button
                      onClick={() => setComposeOpen(true)}
                      className={`w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-blue-600 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 mb-6 ${
                        sidebarCollapsed ? 'px-0' : ''
                      }`}
                    >
                      <Pencil className="w-4 h-4" />
                      {!sidebarCollapsed && <span>Compose</span>}
                    </button>

                    {/* Folders List */}
                    <nav className="space-y-1">
                      {[
                        { id: 'inbox', label: 'Inbox', Icon: Inbox },
                        { id: 'starred', label: 'Starred', Icon: Star },
                        { id: 'sent', label: 'Sent Mail', Icon: Send },
                        { id: 'drafts', label: 'Drafts', Icon: FileText },
                        { id: 'archive', label: 'Archive', Icon: Archive },
                        { id: 'trash', label: 'Trash', Icon: Trash2 },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => { setActiveFolder(f.id); setSelectedMessage(null); }}
                          className={`w-full px-3 py-2.5 rounded-full text-xs font-semibold flex items-center justify-between transition-all ${
                            activeFolder === f.id
                              ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <f.Icon className="w-4 h-4" />
                            {!sidebarCollapsed && <span>{f.label}</span>}
                          </div>
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Storage Quota Widget */}
                  {!sidebarCollapsed && (
                    <div className="p-3 bg-[var(--color-surface-alt)] rounded-2xl border border-[var(--color-border)] text-xs">
                      <div className="flex justify-between text-[var(--color-text-muted)] mb-1">
                        <span>Mail Storage</span>
                        <span>0.5 / {(account?.storageQuotaMb || 5120) / 1024} GB</span>
                      </div>
                      <div className="w-full bg-[var(--color-border)] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[var(--color-primary)] h-full w-[10%]" />
                      </div>
                    </div>
                  )}
                </aside>

                {/* Email List Column */}
                <section className="w-80 sm:w-96 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0">
                  {/* List Actions Topbar */}
                  <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedMsgIds.size > 0 && selectedMsgIds.size === messages.length}
                        onChange={toggleSelectAllMsgs}
                        className="rounded cursor-pointer"
                      />
                      <span className="font-bold text-[var(--color-text)] capitalize">{activeFolder} ({messages.length})</span>
                    </div>

                    {selectedMsgIds.size > 0 && (
                      <div className="flex gap-2">
                        <button onClick={() => handleBulkAction('archive')} className="hover:text-[var(--color-primary)]">Archive</button>
                        <button onClick={() => handleBulkAction('delete')} className="hover:text-red-500">Delete</button>
                      </div>
                    )}
                  </div>

                  {/* Message List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
                    {messagesLoading ? (
                      <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">Loading messages...</div>
                    ) : messages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">No emails in {activeFolder}</div>
                    ) : (
                      messages.map((m) => {
                        const isSelected = selectedMessage?.id === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMessage(m)}
                            className={`p-4 cursor-pointer transition-all ${
                              isSelected ? 'bg-[var(--color-primary-light)] border-l-4 border-[var(--color-primary)]' : 'hover:bg-[var(--color-surface-hover)]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-bold text-[var(--color-text)] truncate">{m.senderName || m.senderEmail}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)]">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-[var(--color-text)] truncate mb-1">{m.subject || '(No Subject)'}</div>
                            <div className="text-[11px] text-[var(--color-text-muted)] line-clamp-2">{m.snippet || m.htmlBody}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Message Reading Pane */}
                <main className="flex-1 bg-[var(--color-bg)] overflow-y-auto p-6 sm:p-10">
                  {selectedMessage ? (
                    <div className="max-w-3xl mx-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                      <div className="border-b border-[var(--color-border)] pb-6">
                        <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-[var(--color-text)] mb-4">{selectedMessage.subject}</h2>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[var(--color-text-muted)]">From: </span>
                            <strong className="text-[var(--color-text)]">{selectedMessage.senderName} &lt;{selectedMessage.senderEmail}&gt;</strong>
                            <br />
                            <span className="text-[var(--color-text-muted)]">To: </span>
                            <span className="text-[var(--color-text-secondary)]">{selectedMessage.recipientEmail}</span>
                          </div>
                          <span className="text-[var(--color-text-muted)]">{new Date(selectedMessage.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      <div
                        className="prose text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: selectedMessage.htmlBody || selectedMessage.snippet }}
                      />

                      <div className="pt-6 border-t border-[var(--color-border)] flex gap-3">
                        <button
                          onClick={() => {
                            setComposeTo(selectedMessage.senderEmail);
                            setComposeSubject(`Re: ${selectedMessage.subject}`);
                            setComposeOpen(true);
                          }}
                          className="stx-btn-primary"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] text-xs">
                      <div className="w-16 h-16 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-2xl mb-3 border border-[var(--color-border)]">
                        ✉️
                      </div>
                      <span>Select an email from the list to view details</span>
                    </div>
                  )}
                </main>
              </div>
            )}

            {/* MODULE 2: CALENDAR */}
            {activeModule === 'calendar' && (
              <div className="flex-1 flex flex-col bg-[var(--color-surface)] p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-['Space_Grotesk'] text-2xl font-bold">Calendar Schedule</h2>
                  <button
                    onClick={() => setShowEventModal(true)}
                    className="stx-btn-primary"
                  >
                    + Add Event
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[var(--color-text-muted)] mb-4">
                  <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
                </div>

                <div className="grid grid-cols-7 gap-2 flex-1">
                  {Array.from({ length: 35 }).map((_, i) => {
                    const dayNum = (i % 31) + 1;
                    const dateStr = `2026-09-${dayNum.toString().padStart(2, '0')}`;
                    const dayEvents = calendarEvents.filter((e) => e.date === dateStr);
                    return (
                      <div
                        key={i}
                        className="p-3 min-h-[100px] border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-alt)] flex flex-col justify-between"
                      >
                        <span className="text-xs font-bold text-[var(--color-text-muted)]">{dayNum}</span>
                        <div className="space-y-1">
                          {dayEvents.map((ev) => (
                            <div key={ev.id} className="p-1.5 rounded-lg text-[10px] font-bold text-white truncate" style={{ background: ev.color }}>
                              {ev.time} {ev.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODULE 3: CONTACTS */}
            {activeModule === 'contacts' && (
              <div className="flex-1 flex flex-col bg-[var(--color-surface)] p-6 sm:p-10 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-['Space_Grotesk'] text-2xl font-bold">Address Book Contacts ({filteredContacts.length})</h2>
                  <button
                    onClick={() => {
                      const name = prompt('Contact Full Name:'); if (!name) return;
                      const email = prompt('Contact Email Address:'); if (!email) return;
                      setContacts([...contacts, { id: 'c' + Date.now(), name, email, color: '#2E6BF0' }]);
                      showToast('Contact saved');
                    }}
                    className="stx-btn-primary"
                  >
                    + Add Contact
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredContacts.map((c) => (
                    <div key={c.id} className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: c.color || '#2E6BF0' }}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[var(--color-text)]">{c.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)] font-mono">{c.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => { setComposeTo(c.email); setActiveModule('mail'); setComposeOpen(true); }}
                        className="stx-btn-ghost"
                      >
                        Email
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MODULE 4: TASKS */}
            {activeModule === 'tasks' && (
              <div className="flex-1 flex flex-col bg-[var(--color-surface)] p-6 sm:p-10 overflow-y-auto">
                <h2 className="font-['Space_Grotesk'] text-2xl font-bold mb-6">Action Tasks Checklist</h2>

                <div className="flex gap-3 mb-6 max-w-xl">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskTitle.trim()) {
                        setTasks([...tasks, { id: 't' + Date.now(), title: newTaskTitle.trim(), done: false }]);
                        setNewTaskTitle('');
                      }
                    }}
                    placeholder="Add a new task and press Enter..."
                    className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-alt)] text-xs outline-none"
                  />
                </div>

                <div className="space-y-3 max-w-xl">
                  {tasks.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className={`text-xs font-semibold ${t.done ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
                          {t.title}
                        </span>
                      </div>
                      <button
                        onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          FLOATING COMPOSE EMAIL MODAL
          ===================================================================== */}
      {composeOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="h-12 bg-slate-900 text-white px-5 flex items-center justify-between shrink-0">
            <span className="font-bold text-xs">New Message</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setComposeOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">To Recipient</label>
              <input
                type="email"
                required
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@domain.com"
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs text-[var(--color-text)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Subject</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject..."
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs text-[var(--color-text)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Message Body</label>
              <textarea
                rows={6}
                required
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your email here..."
                className="w-full p-3 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs text-[var(--color-text)] outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setComposeOpen(false)} className="stx-btn-ghost">Discard</button>
              <button type="submit" disabled={sending} className="stx-btn-primary">
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          EVENT CREATION MODAL
          ===================================================================== */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-['Space_Grotesk'] font-bold text-lg">Add New Calendar Event</h3>
            <div>
              <label className="block text-xs font-bold mb-1">Event Title</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Meeting name..."
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] text-xs"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold mb-1">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold mb-1">Time</label>
                <input
                  type="text"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowEventModal(false)} className="stx-btn-ghost">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  if (eventTitle) {
                    setCalendarEvents([...calendarEvents, { id: 'ev' + Date.now(), alias: 'al-primary', title: eventTitle, date: eventDate, time: eventTime, color: '#2E6BF0' }]);
                    setShowEventModal(false);
                    setEventTitle('');
                    showToast('Event created!');
                  }
                }}
                className="stx-btn-primary"
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
