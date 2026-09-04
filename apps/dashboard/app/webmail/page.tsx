'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DynamicDnsSetupGuide from '@/components/email/DynamicDnsSetupGuide';

interface WebmailAccount {
  id: string;
  smtpUsername: string;
  customDomain: string;
  aliases: string[];
  planTier: string;
  storageQuotaMb: number;
  dailySendLimit: number;
  webmailUrl?: string;
  smtpHost?: string;
  user?: {
    displayName?: string;
    email?: string;
  };
}

interface WebmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash';
  isRead: boolean;
  isStarred?: boolean;
  createdAt: string;
}

export default function WebmailAppPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoToken = searchParams.get('ssoToken');

  const [account, setAccount] = useState<WebmailAccount | null>(null);
  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WebmailMessage | null>(null);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Compose State
  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // SSO Exchange or Local Token Auth
  useEffect(() => {
    async function initWebmailSession() {
      setLoading(true);
      setError(null);

      let token = localStorage.getItem('webmail_token');

      // Check if SSO token was provided in query string
      if (ssoToken) {
        try {
          const res = await fetch(`${apiBase}/api/webmail/auth/sso-exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssoToken }),
          });

          const data = await res.json();
          if (res.ok && data.ok) {
            token = data.token;
            localStorage.setItem('webmail_token', data.token);
            localStorage.setItem('webmail_account', JSON.stringify(data.account));
            // Strip ssoToken from URL
            router.replace('/webmail');
          } else {
            throw new Error(data.error || 'Failed to exchange SSO ticket');
          }
        } catch (err: any) {
          setError(`SSO Login Error: ${err.message}`);
          setLoading(false);
          return;
        }
      }

      if (!token) {
        router.push('/webmail/login');
        return;
      }

      // Load session info from API
      try {
        const meRes = await fetch(`${apiBase}/api/webmail/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const meData = await meRes.json();
        if (meRes.ok && meData.account) {
          setAccount(meData.account);
          const fullEmail = `${meData.account.smtpUsername}@${meData.account.customDomain || 'shanutechx.com'}`;
          setComposeFrom(fullEmail);
        } else {
          // Token expired
          localStorage.removeItem('webmail_token');
          router.push('/webmail/login');
          return;
        }
      } catch {
        setError('Failed to load Webmail profile session');
      } finally {
        setLoading(false);
      }
    }

    void initWebmailSession();
  }, [ssoToken, router, apiBase]);

  // Fetch Messages for current folder
  const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem('webmail_token');
    if (!token) return;

    try {
      const res = await fetch(`${apiBase}/api/webmail/messages?folder=${activeFolder}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch webmail messages:', err);
    }
  }, [activeFolder, apiBase]);

  useEffect(() => {
    if (account) {
      void fetchMessages();
    }
  }, [account, activeFolder, fetchMessages]);

  // Send Email Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) return;

    setSending(true);
    try {
      const token = localStorage.getItem('webmail_token');
      const res = await fetch(`${apiBase}/api/webmail/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from: composeFrom,
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch email');

      setShowComposeModal(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      if (activeFolder === 'sent') void fetchMessages();
    } catch (err: any) {
      alert(`Send Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('webmail_token');
    localStorage.removeItem('webmail_account');
    router.push('/webmail/login');
  };

  const fullEmail = account
    ? `${account.smtpUsername}@${account.customDomain || 'shanutechx.com'}`
    : 'user@shanutechx.com';

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.subject.toLowerCase().includes(q) ||
      m.from.toLowerCase().includes(q) ||
      m.to.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">Loading Enterprise Webmail Portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Webmail Connection Error</h2>
          <p className="text-xs text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/webmail/login')}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-xl transition-all"
          >
            Return to Webmail Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Application Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/20 text-white font-bold text-sm">
            STX
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Cloud Mail Portal</h1>
            <span className="text-[11px] text-purple-400 font-mono">{fullEmail}</span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="hidden sm:flex items-center flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject, sender, or content..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all flex items-center gap-1.5 text-xs"
            title="DNS & Mailbox Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden md:inline">DNS & Settings</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all flex items-center gap-1.5 text-xs"
            title="Log Out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Mail Viewport Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Folder Navigation Sidebar */}
        <aside className="w-56 bg-slate-900/60 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            {/* Compose Button */}
            <button
              onClick={() => setShowComposeModal(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Compose Email</span>
            </button>

            {/* Mailbox Folders */}
            <nav className="space-y-1">
              {[
                { id: 'inbox', label: 'Inbox', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
                { id: 'sent', label: 'Sent Mail', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
                { id: 'drafts', label: 'Drafts', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                { id: 'trash', label: 'Trash', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
              ].map((folder) => {
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id as any);
                      setSelectedMessage(null);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={folder.icon} />
                      </svg>
                      <span>{folder.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Storage Quota Meter */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5 text-[11px]">
              <span>Mail Storage</span>
              <span className="font-semibold text-white">0.5 / {(account?.storageQuotaMb || 5120) / 1024} GB</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full w-[10%]" />
            </div>
          </div>
        </aside>

        {/* Message List Column */}
        <section className="w-80 sm:w-96 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-white capitalize">{activeFolder} ({filteredMessages.length})</span>
            <button
              onClick={() => void fetchMessages()}
              className="p-1 hover:text-white transition-all"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No emails in {activeFolder}
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-950/40 border-l-4 border-purple-500'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-white truncate max-w-[200px]">
                        {activeFolder === 'sent' ? msg.to : msg.from}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="text-xs font-medium text-slate-200 truncate mb-1">{msg.subject || '(No Subject)'}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{msg.body}</p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Message Reading Pane */}
        <main className="flex-1 bg-slate-900/30 overflow-y-auto p-6">
          {selectedMessage ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="border-b border-slate-800 pb-5">
                <h2 className="text-xl font-bold text-white mb-4">{selectedMessage.subject}</h2>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div>
                    <span className="text-slate-500">From:</span> <strong className="text-white">{selectedMessage.from}</strong>
                    <br />
                    <span className="text-slate-500">To:</span> <span className="text-slate-300">{selectedMessage.to}</span>
                  </div>
                  <span className="text-slate-500">{new Date(selectedMessage.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Message Body Content */}
              <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedMessage.body}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Select a message to view its details</span>
            </div>
          )}
        </main>
      </div>

      {/* COMPOSE EMAIL MODAL */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">New Message</h3>
              <button onClick={() => setShowComposeModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">From Sender Address</label>
                <select
                  value={composeFrom}
                  onChange={(e) => setComposeFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value={fullEmail}>{fullEmail} (Primary)</option>
                  {account?.aliases?.map((alias) => (
                    <option key={alias} value={alias}>{alias} (Alias)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">To Recipient</label>
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@domain.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Message Body</label>
                <textarea
                  rows={6}
                  required
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email here..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-lg shadow-purple-600/25 flex items-center gap-2"
                >
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC DNS SETTINGS MODAL */}
      {showSettingsModal && account && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="my-8 max-w-4xl w-full">
            <DynamicDnsSetupGuide
              domain={account.customDomain || 'shanutechx.com'}
              planTier={account.planTier}
              aliases={account.aliases}
              smtpUsername={account.smtpUsername}
              onClose={() => setShowSettingsModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
