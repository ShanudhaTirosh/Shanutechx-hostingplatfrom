'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { WebmailMessage, WebmailThread } from '@/lib/types';
import { WebmailLayout } from '@/components/webmail/WebmailLayout';
import { WebmailThreadList } from '@/components/webmail/WebmailThreadList';
import { WebmailThreadViewer } from '@/components/webmail/WebmailThreadViewer';
import { WebmailRichComposer } from '@/components/webmail/WebmailRichComposer';
import { WebmailContactsTab } from '@/components/webmail/WebmailContactsTab';
import { WebmailCalendarTab } from '@/components/webmail/WebmailCalendarTab';
import { WebmailSettingsModal } from '@/components/webmail/WebmailSettingsModal';
import { WebmailFoldersAndLabelsModal } from '@/components/webmail/WebmailFoldersAndLabelsModal';
import { WebmailRulesModal } from '@/components/webmail/WebmailRulesModal';
import { WebmailOnboardingWizard } from '@/components/webmail/WebmailOnboardingWizard';
import { WebmailAdminPanel } from '@/components/webmail/WebmailAdminPanel';
import { Mail, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export default function WebmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoToken = searchParams.get('ssoToken');
  const { toast } = useToast();

  // ── Screen state ──────────────────────────────────────────────────────────
  const [activeScreen, setActiveScreen] = useState<'login' | 'loading' | 'mail'>('login');

  // ── Auth & mailbox state ──────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('customer');

  // ── Loading screen state ──────────────────────────────────────────────────
  const [loadingProgress, setLoadingProgress] = useState(20);
  const [loadingStatus, setLoadingStatus] = useState('Authenticating session...');

  // ── Workspace state ───────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'mail' | 'calendar' | 'contacts' | 'tasks' | 'admin'>('mail');
  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [activeCategory, setActiveCategory] = useState<string>('primary');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isThreaded, setIsThreaded] = useState<boolean>(true);
  const [listDensity, setListDensity] = useState<'comfortable' | 'compact' | 'spacious'>('comfortable');

  // ── Mail data state ───────────────────────────────────────────────────────
  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [threads, setThreads] = useState<WebmailThread[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WebmailMessage | null>(null);
  const [selectedThread, setSelectedThread] = useState<WebmailThread | null>(null);
  const [threadMessages, setThreadMessages] = useState<WebmailMessage[]>([]);
  const [fetchingThread, setFetchingThread] = useState(false);

  // ── Compose state ─────────────────────────────────────────────────────────
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeReplyMsgId, setComposeReplyMsgId] = useState<string | undefined>();
  const [composeReplyThreadId, setComposeReplyThreadId] = useState<string | undefined>();

  // ── Modals state ──────────────────────────────────────────────────────────
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [foldersModalOpen, setFoldersModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  // ── Onboarding wizard ─────────────────────────────────────────────────────
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Boot / SSO
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function bootSession() {
      // SSO token takes priority
      if (ssoToken) {
        setActiveScreen('loading');
        setLoadingStatus('Exchanging SSO security ticket…');
        setLoadingProgress(40);
        try {
          const res = await fetch('/api/webmail/auth/sso-exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssoToken }),
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            localStorage.setItem('webmail_token', data.token);
            setToken(data.token);
            await loadMailboxes();
            setLoadingProgress(100);
            setTimeout(() => setActiveScreen('mail'), 300);
            return;
          }
        } catch {
          // fall through to login
        }
      }

      const activeToken = localStorage.getItem('webmail_token');
      if (activeToken) {
        setToken(activeToken);
        await loadMailboxes();
        setActiveScreen('mail');
      } else {
        setActiveScreen('login');
      }
    }
    void bootSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssoToken]);

  const loadMailboxes = async () => {
    try {
      const res = await api.email.mailboxes();
      const accounts = res.mailboxes || [];
      setMailboxes(accounts);
      if (accounts.length > 0) {
        setSelectedMailboxId(accounts[0].id);
      }
    } catch {}

    // Determine role from dashboard user context
    try {
      const me = await api.me();
      if (me?.user?.role) setUserRole(me.user.role);
    } catch {}
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch mail data
  // ──────────────────────────────────────────────────────────────────────────
  const fetchMailData = useCallback(async () => {
    try {
      if (isThreaded) {
        const res = await api.webmail.listThreads(activeFolder);
        setThreads(res.threads || []);
      } else {
        const res = await api.webmail.listMessages(activeFolder, searchQuery, selectedMailboxId || undefined);
        setMessages(res.messages || []);
      }
    } catch {}
  }, [activeFolder, searchQuery, isThreaded, selectedMailboxId]);

  useEffect(() => {
    if (activeScreen === 'mail' && mainTab === 'mail') {
      void fetchMailData();
    }
  }, [activeScreen, mainTab, activeFolder, searchQuery, isThreaded, selectedMailboxId, fetchMailData]);

  // Fetch thread messages when a thread is selected
  useEffect(() => {
    if (!selectedThread?.threadId) return;
    setFetchingThread(true);
    api.webmail.getThread(selectedThread.threadId)
      .then((res) => {
        setThreadMessages(res.messages || []);
      })
      .catch(() => {
        // Fall back to latestMessage
        setThreadMessages(selectedThread.latestMessage ? [selectedThread.latestMessage] : []);
      })
      .finally(() => setFetchingThread(false));
  }, [selectedThread?.threadId]);

  // ──────────────────────────────────────────────────────────────────────────
  // Auth handlers
  // ──────────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/webmail/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('webmail_token', data.token);
      setToken(data.token);

      setActiveScreen('loading');
      setLoadingStatus('Initializing mailbox workspace…');
      setLoadingProgress(70);

      await loadMailboxes();

      // First login: open onboarding wizard
      const isFirstLogin = !localStorage.getItem('webmail_onboarded');
      if (isFirstLogin) {
        localStorage.setItem('webmail_onboarded', '1');
      }

      setTimeout(() => {
        setLoadingProgress(100);
        setActiveScreen('mail');
        if (isFirstLogin) {
          setTimeout(() => setOnboardingOpen(true), 500);
        }
      }, 400);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Mail action handlers
  // ──────────────────────────────────────────────────────────────────────────
  const handleToggleStar = async (id: string) => {
    // Optimistic toggle: find current starred state
    const msg = messages.find((m) => m.id === id) || threadMessages.find((m) => m.id === id);
    const currentStarred = msg?.isStarred ?? false;
    try {
      await api.webmail.updateMessage(id, { isStarred: !currentStarred });
      void fetchMailData();
    } catch {
      toast('Failed to update star', 'error');
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await api.webmail.deleteMessage(id);
      toast('Moved to Trash', 'info');
      setSelectedMessage(null);
      setSelectedThread(null);
      setThreadMessages([]);
      void fetchMailData();
    } catch {
      toast('Failed to delete', 'error');
    }
  };

  const handleArchiveMessage = async (id: string) => {
    try {
      await api.webmail.updateMessage(id, { folder: 'archive' });
      toast('Archived', 'info');
      setSelectedMessage(null);
      setSelectedThread(null);
      void fetchMailData();
    } catch {
      toast('Failed to archive', 'error');
    }
  };

  const handleBulkAction = async (action: string, ids: string[]) => {
    try {
      await api.webmail.bulkAction({ messageIds: ids, action });
      toast(`Updated ${ids.length} items`, 'success');
      void fetchMailData();
    } catch {
      toast('Bulk action failed', 'error');
    }
  };

  /** Opens the rich composer pre-filled for reply/replyAll/forward */
  const handleOpenReply = (msg: WebmailMessage, mode: 'reply' | 'replyAll' | 'forward') => {
    if (mode === 'forward') {
      setComposeTo('');
      setComposeSubject(`Fwd: ${msg.subject || ''}`);
      setComposeBody(
        `\n\n---------- Forwarded message ----------\nFrom: ${msg.senderName || msg.senderEmail}\nSubject: ${msg.subject}\n\n${msg.textBody || msg.snippet || ''}`
      );
      setComposeReplyMsgId(undefined);
      setComposeReplyThreadId(undefined);
    } else {
      setComposeTo(msg.senderEmail || msg.from || '');
      setComposeSubject(`Re: ${msg.subject || ''}`);
      setComposeBody(
        `\n\n> On ${msg.createdAt || msg.timestamp}, ${msg.senderName || msg.senderEmail} wrote:\n> ${msg.snippet || ''}`
      );
      setComposeReplyMsgId(msg.id);
      setComposeReplyThreadId(msg.threadId ?? undefined);
    }
    setComposeOpen(true);
  };

  /** Legacy handler used by WebmailThreadViewer's onReply/onForward callbacks */
  const handleReplyLegacy = (msg: WebmailMessage) => handleOpenReply(msg, 'reply');
  const handleForwardLegacy = (msg: WebmailMessage) => handleOpenReply(msg, 'forward');

  // ──────────────────────────────────────────────────────────────────────────
  // Determine which messages to pass to the thread viewer
  // ──────────────────────────────────────────────────────────────────────────
  const viewerMessages: WebmailMessage[] = isThreaded
    ? threadMessages
    : selectedMessage
    ? [selectedMessage]
    : [];

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col bg-[#0f0f13] text-white webmail-root">

      {/* ─── Screen 1: Login ─────────────────────────────────────────────── */}
      {activeScreen === 'login' && (
        <div className="flex-1 flex h-full w-full overflow-hidden">

          {/* Left panel */}
          <div className="flex-1 min-w-[320px] max-w-[520px] flex flex-col p-8 sm:p-14 overflow-y-auto bg-[#13131a] justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-xs shadow-lg shadow-violet-500/30">
                STX
              </div>
              <span className="font-bold text-xl tracking-tight text-white">STX Mail</span>
            </div>

            <div className="max-w-[420px] my-auto py-8">
              <h1 className="font-bold text-3xl sm:text-4xl text-white tracking-tight mb-3">
                Sign in to Webmail
              </h1>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                Enterprise cloud webmail for ShanuTechX email accounts and custom domains.
              </p>

              {loginError && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Email Address or Alias
                  </label>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="user@yourdomain.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-violet-500 focus:bg-violet-500/5 transition-all placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-3.5 pr-12 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-violet-500 focus:bg-violet-500/5 transition-all placeholder-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-all"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-violet-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loginLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Authenticating…</>
                  ) : (
                    'Sign In to Webmail'
                  )}
                </button>
              </form>

              <div className="mt-4">
                <button
                  onClick={async () => {
                    setActiveScreen('loading');
                    setLoadingStatus('Launching workspace…');
                    setLoadingProgress(60);
                    await loadMailboxes();
                    setTimeout(() => {
                      setLoadingProgress(100);
                      setActiveScreen('mail');
                    }, 400);
                  }}
                  className="w-full py-3.5 rounded-2xl border border-white/10 bg-white/5 text-slate-300 font-semibold text-xs hover:border-violet-500/50 hover:text-white flex items-center justify-center gap-2 transition-all"
                >
                  <Mail className="h-4 w-4" />
                  Launch Workspace Without Login
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600">Powered by ShanuTechX Autonomous Cloud Platform</p>
          </div>

          {/* Right panel */}
          <div className="flex-1 hidden md:flex relative overflow-hidden bg-gradient-to-br from-[#0f0f13] via-violet-950/30 to-indigo-950/40 items-center justify-center p-12">
            <div className="absolute inset-0 overflow-hidden">
              {/* Decorative orbs */}
              <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-violet-600/10 blur-3xl" />
              <div className="absolute bottom-1/4 right-1/3 w-56 h-56 rounded-full bg-indigo-600/10 blur-3xl" />
            </div>
            <div className="relative z-10 text-center max-w-md">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-violet-500/30 border border-white/10">
                <Mail className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight text-white">Enterprise Cloud Webmail</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Encrypted SMTP delivery, AI-powered drafts, threat detection, smart filters, and zero-config DNS routing.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  'AI Email Drafting', 'Threat Detection', 'DKIM/DMARC/SPF', 'Forwarding Rules',
                  'Custom Aliases', 'Calendar Sync', 'Smart Filters', 'Canned Responses',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Screen 2: Loading ───────────────────────────────────────────── */}
      {activeScreen === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0f13] text-white p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-xl shadow-violet-500/30 mb-6 animate-pulse">
            STX
          </div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">STX Webmail</h2>
          <p className="text-xs text-slate-400 mb-8">{loadingStatus}</p>
          <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300 rounded-full"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── Screen 3: Main Workspace ────────────────────────────────────── */}
      {activeScreen === 'mail' && (
        <WebmailLayout
          mailboxes={mailboxes}
          selectedMailboxId={selectedMailboxId}
          onSelectMailbox={(id) => setSelectedMailboxId(id)}
          activeFolder={activeFolder}
          onSelectFolder={(folder) => {
            setActiveFolder(folder);
            setSelectedMessage(null);
            setSelectedThread(null);
            setThreadMessages([]);
          }}
          activeCategory={activeCategory}
          onSelectCategory={(cat) => setActiveCategory(cat)}
          activeTag={activeTag}
          onSelectTag={(tag) => setActiveTag(tag)}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          isThreaded={isThreaded}
          onToggleThreaded={() => setIsThreaded((v) => !v)}
          listDensity={listDensity}
          onChangeDensity={(d) => setListDensity(d)}
          onOpenCompose={() => {
            setComposeTo('');
            setComposeSubject('');
            setComposeBody('');
            setComposeReplyMsgId(undefined);
            setComposeReplyThreadId(undefined);
            setComposeOpen(true);
          }}
          onOpenFoldersModal={() => setFoldersModalOpen(true)}
          onOpenRulesModal={() => setRulesModalOpen(true)}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
          activeMainTab={mainTab}
          onChangeMainTab={(t) => setMainTab(t)}
          userRole={userRole}
        >
          {/* ── Mail tab ─────────────────────────────────────────────────── */}
          {mainTab === 'mail' && (
            <div className="flex h-full w-full overflow-hidden">
              {/* Thread/Message List */}
              <div className="w-[360px] shrink-0 h-full border-r border-white/5">
                <WebmailThreadList
                  isThreaded={isThreaded}
                  messages={messages}
                  threads={threads}
                  selectedMessageId={selectedMessage?.id || null}
                  selectedThreadId={selectedThread?.threadId || null}
                  onSelectMessage={(msg) => {
                    setSelectedMessage(msg);
                    setSelectedThread(null);
                    setThreadMessages([msg]);
                    // Mark as read
                    if (!msg.isRead) {
                      api.webmail.updateMessage(msg.id, { isRead: true }).catch(() => {});
                    }
                  }}
                  onSelectThread={(t) => {
                    setSelectedThread(t);
                    setSelectedMessage(t.latestMessage || null);
                    setThreadMessages(t.messages || (t.latestMessage ? [t.latestMessage] : []));
                  }}
                  onToggleStar={handleToggleStar}
                  onDeleteMessage={handleDeleteMessage}
                  onBulkAction={handleBulkAction}
                  activeFolder={activeFolder}
                  listDensity={listDensity}
                  onOpenCompose={() => setComposeOpen(true)}
                />
              </div>

              {/* Message/Thread Reader pane */}
              <div className="flex-1 h-full overflow-hidden">
                <WebmailThreadViewer
                  messages={viewerMessages}
                  selectedMessage={selectedMessage}
                  onReply={handleReplyLegacy}
                  onForward={handleForwardLegacy}
                  onDelete={handleDeleteMessage}
                  onStar={handleToggleStar}
                />
              </div>
            </div>
          )}

          {/* ── Calendar tab ─────────────────────────────────────────────── */}
          {mainTab === 'calendar' && <WebmailCalendarTab />}

          {/* ── Contacts tab ─────────────────────────────────────────────── */}
          {mainTab === 'contacts' && (
            <WebmailContactsTab
              onComposeTo={(email) => {
                setComposeTo(email);
                setMainTab('mail');
                setComposeOpen(true);
              }}
            />
          )}

          {/* ── Admin/Dev tab ─────────────────────────────────────────────── */}
          {mainTab === 'admin' && (
            <WebmailAdminPanel />
          )}
        </WebmailLayout>
      )}

      {/* ─── Rich Email Composer ──────────────────────────────────────────── */}
      <WebmailRichComposer
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => {
          setComposeOpen(false);
          toast('Email dispatched successfully!', 'success');
          void fetchMailData();
        }}
        defaultTo={composeTo}
        defaultSubject={composeSubject}
        defaultBody={composeBody}
        defaultSmtpAccountId={selectedMailboxId}
        replyToMessageId={composeReplyMsgId}
        replyToThreadId={composeReplyThreadId}
      />

      {/* ─── Onboarding Wizard ───────────────────────────────────────────── */}
      <WebmailOnboardingWizard
        isOpen={onboardingOpen}
        smtpAccountId={selectedMailboxId}
        onComplete={() => setOnboardingOpen(false)}
      />

      {/* ─── Settings Modal ──────────────────────────────────────────────── */}
      <WebmailSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* ─── Folders & Labels Modal ──────────────────────────────────────── */}
      <WebmailFoldersAndLabelsModal
        isOpen={foldersModalOpen}
        onClose={() => setFoldersModalOpen(false)}
      />

      {/* ─── Automation Rules Modal ──────────────────────────────────────── */}
      <WebmailRulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />
    </div>
  );
}
