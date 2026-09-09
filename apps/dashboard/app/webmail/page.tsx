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

export default function WebmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoToken = searchParams.get('ssoToken');
  const { toast } = useToast();

  // Screen state
  const [activeScreen, setActiveScreen] = useState<'login' | 'loading' | 'dashboard' | 'mail'>('login');

  // Auth & Account state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);

  // Loading Screen state
  const [loadingProgress, setLoadingProgress] = useState(20);
  const [loadingStatus, setLoadingStatus] = useState('Authenticating session...');

  // Workspace Theme & Tabs state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mainTab, setMainTab] = useState<'mail' | 'calendar' | 'contacts'>('mail');
  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [activeCategory, setActiveCategory] = useState<string>('primary');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isThreaded, setIsThreaded] = useState<boolean>(true);
  const [listDensity, setListDensity] = useState<'comfortable' | 'compact' | 'spacious'>('comfortable');

  // Mail Data state
  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [threads, setThreads] = useState<WebmailThread[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WebmailMessage | null>(null);
  const [selectedThread, setSelectedThread] = useState<WebmailThread | null>(null);

  // Compose Modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // Modals state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [foldersModalOpen, setFoldersModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  // Theme attribute sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Boot Session / SSO Exchange
  useEffect(() => {
    async function bootSession() {
      const activeToken = localStorage.getItem('webmail_token');

      if (ssoToken) {
        setActiveScreen('loading');
        setLoadingStatus('Exchanging SSO Security Ticket...');
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
            setLoadingProgress(100);
            setTimeout(() => setActiveScreen('mail'), 300);
            return;
          }
        } catch (err) {
          console.error('SSO Exchange error:', err);
        }
      }

      // Fetch accounts / mailboxes
      try {
        const res = await api.email.mailboxes();
        const accounts = res.mailboxes || [];
        setMailboxes(accounts);
        if (accounts.length > 0) {
          setSelectedMailboxId(accounts[0].id);
        }
      } catch (err) {}

      if (activeToken) {
        setToken(activeToken);
        setActiveScreen('mail');
      } else {
        setActiveScreen('login');
      }
    }

    void bootSession();
  }, [ssoToken]);

  // Fetch Messages / Threads
  const fetchMailData = useCallback(async () => {
    try {
      if (isThreaded) {
        const res = await api.webmail.listThreads(activeFolder);
        setThreads(res.threads || []);
      } else {
        const res = await api.webmail.listMessages(activeFolder, searchQuery);
        setMessages(res.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch mail data:', err);
    }
  }, [activeFolder, searchQuery, isThreaded]);

  useEffect(() => {
    if (activeScreen === 'mail' && mainTab === 'mail') {
      void fetchMailData();
    }
  }, [activeScreen, mainTab, activeFolder, searchQuery, isThreaded, fetchMailData]);

  // Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter both email address and password.');
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
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      localStorage.setItem('webmail_token', data.token);
      setToken(data.token);

      setActiveScreen('loading');
      setLoadingStatus('Initializing webmail cryptograph & mailboxes...');
      setLoadingProgress(70);
      setTimeout(() => {
        setLoadingProgress(100);
        setActiveScreen('mail');
      }, 400);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleToggleStar = async (id: string) => {
    try {
      await api.webmail.updateMessage(id, { isStarred: true });
      toast('Starred message', 'success');
      fetchMailData();
    } catch (err) {
      toast('Failed to star message', 'error');
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await api.webmail.deleteMessage(id);
      toast('Message moved to Trash', 'info');
      setSelectedMessage(null);
      fetchMailData();
    } catch (err) {
      toast('Failed to delete message', 'error');
    }
  };

  const handleBulkAction = async (action: string, ids: string[]) => {
    try {
      await api.webmail.bulkAction({ messageIds: ids, action: action as any });
      toast(`Updated ${ids.length} items`, 'success');
      fetchMailData();
    } catch (err) {
      toast('Bulk action failed', 'error');
    }
  };

  const handleReply = (msg: WebmailMessage) => {
    setComposeTo(msg.senderEmail || msg.from || '');
    setComposeSubject(`Re: ${msg.subject || ''}`);
    setComposeBody(`\n\n> On ${msg.createdAt}, ${msg.senderName || msg.senderEmail} wrote:\n> ${msg.snippet || ''}`);
    setComposeOpen(true);
  };

  const handleForward = (msg: WebmailMessage) => {
    setComposeTo('');
    setComposeSubject(`Fwd: ${msg.subject || ''}`);
    setComposeBody(`\n\n---------- Forwarded message ---------\nFrom: ${msg.senderName || msg.senderEmail}\nSubject: ${msg.subject}\n\n${msg.htmlBody || msg.snippet || ''}`);
    setComposeOpen(true);
  };

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] webmail-root">
      {/* Screen 1: Login */}
      {activeScreen === 'login' && (
        <div className="flex-1 flex flex-col md:flex-row h-full w-full overflow-hidden bg-[var(--color-surface)]">
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
                    setActiveScreen('loading');
                    setTimeout(() => setActiveScreen('mail'), 400);
                  }}
                  className="w-full py-3.5 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] font-semibold text-xs hover:border-[var(--color-primary)] flex items-center justify-center gap-3 transition-all"
                >
                  <span>Launch Mailbox Workspace</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-[var(--color-text-muted)]">
              Powered by ShanuTechX Autonomous Cloud Platform
            </div>
          </div>

          <div className="flex-1 hidden md:flex relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 items-center justify-center p-12">
            <div className="relative z-10 text-center max-w-md text-white">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-cyan-500/30 border border-white/20">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-['Space_Grotesk'] text-2xl font-bold mb-3 tracking-tight">Enterprise Cloud Webmail</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Encrypted SMTP delivery, instant Git Webhooks, AI assistant, and zero-config DNS routing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Loading */}
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

      {/* Screen 3: Main Mail Workspace */}
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
          }}
          activeCategory={activeCategory}
          onSelectCategory={(cat) => setActiveCategory(cat)}
          activeTag={activeTag}
          onSelectTag={(tag) => setActiveTag(tag)}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          isThreaded={isThreaded}
          onToggleThreaded={() => setIsThreaded(!isThreaded)}
          listDensity={listDensity}
          onChangeDensity={(d) => setListDensity(d)}
          onOpenCompose={() => {
            setComposeTo('');
            setComposeSubject('');
            setComposeBody('');
            setComposeOpen(true);
          }}
          onOpenFoldersModal={() => setFoldersModalOpen(true)}
          onOpenRulesModal={() => setRulesModalOpen(true)}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
          activeMainTab={mainTab}
          onChangeMainTab={(t) => setMainTab(t)}
        >
          {mainTab === 'mail' && (
            <div className="flex h-full w-full overflow-hidden">
              {/* Thread / Message List Column */}
              <div className="w-96 shrink-0 h-full border-r border-slate-800">
                <WebmailThreadList
                  isThreaded={isThreaded}
                  messages={messages}
                  threads={threads}
                  selectedMessageId={selectedMessage?.id || null}
                  selectedThreadId={selectedThread?.threadId || null}
                  onSelectMessage={(msg) => {
                    setSelectedMessage(msg);
                    setSelectedThread(null);
                  }}
                  onSelectThread={(t) => {
                    setSelectedThread(t);
                    setSelectedMessage(t.latestMessage);
                  }}
                  onToggleStar={handleToggleStar}
                  onDeleteMessage={handleDeleteMessage}
                  onBulkAction={handleBulkAction}
                  activeFolder={activeFolder}
                  listDensity={listDensity}
                  onOpenCompose={() => setComposeOpen(true)}
                />
              </div>

              {/* Thread / Message Reader Pane */}
              <div className="flex-1 h-full overflow-hidden bg-slate-900/40">
                <WebmailThreadViewer
                  messages={selectedThread ? selectedThread.messages : selectedMessage ? [selectedMessage] : []}
                  selectedMessage={selectedMessage}
                  onReply={handleReply}
                  onForward={handleForward}
                  onDelete={handleDeleteMessage}
                  onStar={handleToggleStar}
                />
              </div>
            </div>
          )}

          {mainTab === 'calendar' && <WebmailCalendarTab />}

          {mainTab === 'contacts' && (
            <WebmailContactsTab
              onComposeTo={(email) => {
                setComposeTo(email);
                setMainTab('mail');
                setComposeOpen(true);
              }}
            />
          )}
        </WebmailLayout>
      )}

      {/* Rich Email Composer Modal */}
      <WebmailRichComposer
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => {
          setComposeOpen(false);
          toast('Email dispatched successfully!', 'success');
          fetchMailData();
        }}
        defaultTo={composeTo}
        defaultSubject={composeSubject}
        defaultBody={composeBody}
      />

      {/* Settings Modal */}
      <WebmailSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* Folders & Labels Modal */}
      <WebmailFoldersAndLabelsModal
        isOpen={foldersModalOpen}
        onClose={() => setFoldersModalOpen(false)}
      />

      {/* Automation Rules Modal */}
      <WebmailRulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />
    </div>
  );
}
