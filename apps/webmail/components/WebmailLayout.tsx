'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Inbox,
  Star,
  Clock,
  Send,
  FileText,
  Archive,
  AlertOctagon,
  Trash2,
  Folder,
  Tag,
  Plus,
  RefreshCw,
  Settings,
  Search,
  PenSquare,
  LogOut,
  Sparkles,
  ShieldCheck,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  HardDrive,
  Keyboard,
  CheckCircle2,
  RotateCcw,
  X,
  Key,
  Menu,
} from 'lucide-react';
import { MailboxSwitcher, Mailbox } from './MailboxSwitcher';
import { ThreadList, WebmailMessage } from './ThreadList';
import { ThreadViewer, MessageDetail } from './ThreadViewer';
import { Composer } from './Composer';
import { SettingsModal } from './SettingsModal';
import { WebmailCredentialsModal } from '../../dashboard/components/webmail/WebmailCredentialsModal';
import { api } from '../lib/api';
import { firebaseAuth } from '../lib/firebaseClient';

export interface ToastNotification {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  undoAction?: () => void;
}

export const WebmailLayout: React.FC = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<string | null>(null);

  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [activeCategory, setActiveCategory] = useState<string>('primary');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(true);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedThreadMessages, setSelectedThreadMessages] = useState<MessageDetail[]>([]);
  const [selectedThreadSubject, setSelectedThreadSubject] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Composer
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [composerDefaultRecipient, setComposerDefaultRecipient] = useState<string>('');
  const [composerDefaultSubject, setComposerDefaultSubject] = useState<string>('');
  const [composerDefaultBody, setComposerDefaultBody] = useState<string>('');
  const [composerThreadId, setComposerThreadId] = useState<string | undefined>(undefined);
  const [composerInReplyTo, setComposerInReplyTo] = useState<string | undefined>(undefined);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('customer');
  const [showSearchHelp, setShowSearchHelp] = useState<boolean>(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);

  // Custom Folders & Labels
  const [customFolders, setCustomFolders] = useState<any[]>([]);
  const [customLabels, setCustomLabels] = useState<any[]>([]);

  // Mobile Drawer & Dynamic Storage
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [storageUsage, setStorageUsage] = useState<{ usedMb: number; limitMb: number }>({
    usedMb: 0,
    limitMb: 10240,
  });

  // Toast System
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const addToast = (message: string, type: ToastNotification['type'] = 'success', undoAction?: () => void) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, undoAction }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const loadPlanUsage = async () => {
    try {
      const res = await api.webmail.planUsage();
      if (res?.quotas?.storageMb) {
        setStorageUsage({
          usedMb: res.quotas.storageMb.used || 0,
          limitMb: res.quotas.storageMb.limit || 10240,
        });
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadMailboxes();
    loadFoldersAndLabels();
    loadPlanUsage();
    api.me().then((res) => {
      if (res?.user?.role) setUserRole(res.user.role);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadMessages();
    loadPlanUsage();
  }, [activeFolder, activeCategory, searchQuery, activeMailboxId]);

  // Update document title with unread badge count
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.title = unreadCount > 0 ? `(${unreadCount}) Inbox - ShanuTechX Webmail` : 'ShanuTechX Webmail';
    }
  }, [unreadCount]);

  // Background Auto-Polling (Every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const categoryParam = activeFolder === 'inbox' && activeCategory ? activeCategory : undefined;
      api.webmail
        .listMessages(activeFolder, searchQuery, activeMailboxId || undefined, categoryParam)
        .then((res) => {
          setMessages(res.messages || []);
          setUnreadCount(res.unreadCount || 0);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [activeFolder, activeCategory, searchQuery, activeMailboxId]);

  // Global Keyboard Shortcuts (Gmail / Fastmail style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setComposerDefaultRecipient('');
        setComposerDefaultSubject('');
        setComposerDefaultBody('');
        setComposerThreadId(undefined);
        setComposerInReplyTo(undefined);
        setIsComposerOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'r' || e.key === 'R') {
        if (selectedMessageId && selectedThreadMessages.length > 0) {
          e.preventDefault();
          const latest = selectedThreadMessages[selectedThreadMessages.length - 1];
          handleOpenReply(latest.senderEmail, `Re: ${selectedThreadSubject}`, latest.id);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (selectedMessageId && selectedThreadMessages.length > 0) {
          e.preventDefault();
          const latest = selectedThreadMessages[selectedThreadMessages.length - 1];
          handleOpenForward(`Fwd: ${selectedThreadSubject}`, latest.htmlBody);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (selectedMessageId) {
          e.preventDefault();
          handleBulkActionSingle(selectedMessageId, 'archive');
        }
      } else if (e.key === '#' || e.key === 'Delete') {
        if (selectedMessageId) {
          e.preventDefault();
          handleDeleteMessage(selectedMessageId);
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setShowKeyboardHelp((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsComposerOpen(false);
        setIsSettingsOpen(false);
        setShowKeyboardHelp(false);
        setSelectedMessageId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMessageId, selectedThreadMessages, selectedThreadSubject]);

  const loadMailboxes = async () => {
    try {
      const res = await api.email.mailboxes();
      const accounts = res.mailboxes || res.smtpAccounts || [];
      setMailboxes(accounts);
      if (accounts.length > 0 && !activeMailboxId) {
        setActiveMailboxId(accounts[0].id);
      }
    } catch {
      // Fallback
    }
  };

  const loadFoldersAndLabels = async () => {
    try {
      const [fRes, lRes] = await Promise.all([
        api.webmail.listFolders().catch(() => ({ folders: [] })),
        api.webmail.listLabels().catch(() => ({ labels: [] })),
      ]);
      setCustomFolders(fRes.folders || []);
      setCustomLabels(lRes.labels || []);
    } catch {}
  };

  const loadMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const categoryParam = activeFolder === 'inbox' && activeCategory ? activeCategory : undefined;
      const res = await api.webmail.listMessages(
        activeFolder,
        searchQuery,
        activeMailboxId || undefined,
        categoryParam
      );
      setMessages(res.messages || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectMessage = async (id: string) => {
    setSelectedMessageId(id);
    const targetMsg = messages.find((m) => m.id === id);
    if (!targetMsg) return;

    try {
      const threadRes = await api.webmail.getThread(targetMsg.threadId || id).catch(async () => {
        const single = await api.webmail.getMessage(id);
        return { messages: [single.message] };
      });

      setSelectedThreadMessages(threadRes.messages || []);
      setSelectedThreadSubject(targetMsg.subject);

      // Mark local state as read
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
      );
    } catch (err) {
      // Fallback
    }
  };

  // Bulk actions & Quick row actions
  const handleBulkAction = async (action: string, payload?: any) => {
    const ids = payload?.messageIds || selectedIds;
    if (ids.length === 0) return;
    const previousState = [...messages];
    try {
      await api.webmail.bulkAction({
        messageIds: ids,
        action,
        ...payload,
      });
      addToast(`${ids.length} message(s) updated`, 'success', () => {
        setMessages(previousState);
      });
      setSelectedIds([]);
      loadMessages();
    } catch {}
  };

  const handleBulkActionSingle = async (id: string, action: string) => {
    try {
      await api.webmail.bulkAction({
        messageIds: [id],
        action,
      });
      addToast(`Message ${action === 'archive' ? 'archived' : 'updated'}`, 'success');
      setSelectedMessageId(null);
      loadMessages();
    } catch {}
  };

  const handleToggleStar = async (id: string, currentStarred: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStarred: !currentStarred } : m))
    );
    await api.webmail.patchMessage(id, { isStarred: !currentStarred });
  };

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isPinned: !currentPinned } : m))
    );
    await api.webmail.patchMessage(id, { isPinned: !currentPinned });
  };

  const handleOpenReply = (recipient: string, replySub: string, msgId: string) => {
    setComposerDefaultRecipient(recipient);
    setComposerDefaultSubject(replySub);
    setComposerDefaultBody('');
    setComposerInReplyTo(msgId);
    setIsComposerOpen(true);
  };

  const handleOpenForward = (fwdSub: string, body: string) => {
    setComposerDefaultRecipient('');
    setComposerDefaultSubject(fwdSub);
    setComposerDefaultBody(`<br/><br/>---------- Forwarded message ---------<br/>${body}`);
    setComposerInReplyTo(undefined);
    setIsComposerOpen(true);
  };

  const handleDeleteMessage = async (id: string) => {
    await api.webmail.deleteMessage(id);
    addToast('Message moved to Trash', 'info');
    setSelectedMessageId(null);
    setSelectedThreadMessages([]);
    loadMessages();
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('webmail_token');
    } catch (_) {}
    firebaseAuth.signOut();
    window.location.href = '/login';
  };

  const handleQuickReply = async (recipient: string, replySub: string, msgId: string, text: string) => {
    try {
      await api.webmail.send({
        recipientEmail: recipient,
        subject: replySub,
        htmlBody: text.replace(/\n/g, '<br/>'),
        inReplyTo: msgId,
        smtpAccountId: activeMailboxId || undefined,
      });
      addToast('Reply sent successfully', 'success');
      if (selectedMessageId) {
        handleSelectMessage(selectedMessageId);
      }
      loadMessages();
    } catch (err: any) {
      addToast(err.message || 'Failed to send reply', 'error');
      throw err;
    }
  };

  const navFolders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'snoozed', label: 'Snoozed', icon: Clock },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'drafts', label: 'Drafts', icon: FileText },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'spam', label: 'Spam', icon: AlertOctagon },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const formatStorage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const storagePercent = Math.min(
    100,
    Math.max(1, Math.round((storageUsage.usedMb / Math.max(1, storageUsage.limitMb)) * 100))
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-300 relative">
      {/* Top Application Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800/80 px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Drawer Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 lg:hidden transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-white/10 shadow-lg shadow-indigo-600/20 backdrop-blur-sm shrink-0">
              <img
                src="/STX.png"
                alt="ShanuTechX"
                className="w-full h-full object-contain filter brightness-0 invert"
              />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-100 hidden sm:inline">
              ShanuTechX <span className="text-indigo-400 font-medium">Webmail</span>
            </span>
          </div>

          <div className="h-5 w-px bg-slate-800 mx-1 hidden md:block" />

          {/* Desktop Mailbox Switcher */}
          <div className="hidden md:block">
            <MailboxSwitcher
              mailboxes={mailboxes}
              activeMailboxId={activeMailboxId}
              onSelectMailbox={(id) => setActiveMailboxId(id)}
            />
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-xl mx-1 sm:mx-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchHelp(true)}
              onBlur={() => setTimeout(() => setShowSearchHelp(false), 200)}
              placeholder="Search mail (press / to focus)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Search Syntax Help Popover */}
          {showSearchHelp && !searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-2 animate-in fade-in duration-150">
              <p className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">Search Shortcuts</p>
              <div className="grid grid-cols-2 gap-1.5 text-slate-400 font-mono text-[11px]">
                <button onMouseDown={() => setSearchQuery('from:')} className="text-left hover:text-indigo-300 p-1 rounded hover:bg-slate-800">
                  from:email@domain
                </button>
                <button onMouseDown={() => setSearchQuery('is:unread')} className="text-left hover:text-indigo-300 p-1 rounded hover:bg-slate-800">
                  is:unread
                </button>
                <button onMouseDown={() => setSearchQuery('subject:')} className="text-left hover:text-indigo-300 p-1 rounded hover:bg-slate-800">
                  subject:keyword
                </button>
                <button onMouseDown={() => setSearchQuery('has:attachment')} className="text-left hover:text-indigo-300 p-1 rounded hover:bg-slate-800">
                  has:attachment
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowKeyboardHelp(true)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors hidden sm:flex"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            onClick={loadMessages}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh Inbox"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsCredentialsOpen(true)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors hidden sm:flex"
            title="Developer Credentials & REST API"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="space-y-4 overflow-y-auto pr-1">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/10 p-1 flex items-center justify-center border border-white/10">
                    <img src="/STX.png" alt="ShanuTechX" className="w-full h-full object-contain filter brightness-0 invert" />
                  </div>
                  <span className="font-bold text-xs tracking-tight text-slate-100">
                    ShanuTechX <span className="text-indigo-400 font-medium">Webmail</span>
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mailbox Switcher inside Drawer */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Mailbox Account</p>
                <MailboxSwitcher
                  mailboxes={mailboxes}
                  activeMailboxId={activeMailboxId}
                  onSelectMailbox={(id) => {
                    setActiveMailboxId(id);
                    setIsMobileMenuOpen(false);
                  }}
                />
              </div>

              {/* Compose Action in Drawer */}
              <button
                onClick={() => {
                  setComposerDefaultRecipient('');
                  setComposerDefaultSubject('');
                  setComposerDefaultBody('');
                  setComposerThreadId(undefined);
                  setComposerInReplyTo(undefined);
                  setIsComposerOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20"
              >
                <PenSquare className="w-4 h-4" /> Compose Mail
              </button>

              {/* System Folders Tree */}
              <nav className="space-y-0.5">
                {navFolders.map((f) => {
                  const Icon = f.icon;
                  const isActive = activeFolder === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setActiveFolder(f.id);
                        setSelectedMessageId(null);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{f.label}</span>
                      </div>
                      {f.badge !== undefined && f.badge > 0 && (
                        <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                          {f.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Custom Folders Section */}
              {customFolders.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Custom Folders
                  </p>
                  <div className="space-y-0.5">
                    {customFolders.map((cf) => (
                      <button
                        key={cf.id}
                        onClick={() => {
                          setActiveFolder(cf.name);
                          setSelectedMessageId(null);
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      >
                        <Folder className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="truncate">{cf.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Labels Section */}
              {customLabels.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Labels
                  </p>
                  <div className="space-y-0.5">
                    {customLabels.map((lbl) => (
                      <button
                        key={lbl.id}
                        onClick={() => {
                          setSearchQuery(`label:${lbl.name}`);
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lbl.color || '#6366f1' }} />
                        <span className="truncate">{lbl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Storage Quota in Drawer */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 mt-3 shrink-0">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1.5"><HardDrive className="w-3 h-3 text-indigo-400" /> Storage</span>
                <span>{formatStorage(storageUsage.usedMb)} / {formatStorage(storageUsage.limitMb)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main App Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Left Navigation Sidebar */}
        <aside className="hidden lg:flex w-60 bg-slate-900/80 border-r border-slate-800/80 p-3 flex-col justify-between shrink-0 select-none">
          <div className="space-y-4">
            {/* Primary Action Compose Button */}
            <button
              onClick={() => {
                setComposerDefaultRecipient('');
                setComposerDefaultSubject('');
                setComposerDefaultBody('');
                setComposerThreadId(undefined);
                setComposerInReplyTo(undefined);
                setIsComposerOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <PenSquare className="w-4 h-4" /> Compose Mail
            </button>

            {/* System Folders Tree */}
            <nav className="space-y-0.5">
              {navFolders.map((f) => {
                const Icon = f.icon;
                const isActive = activeFolder === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setActiveFolder(f.id);
                      setSelectedMessageId(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{f.label}</span>
                    </div>
                    {f.badge !== undefined && f.badge > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                        {f.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Custom Folders Section */}
            {customFolders.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Custom Folders
                </p>
                <div className="space-y-0.5">
                  {customFolders.map((cf) => (
                    <button
                      key={cf.id}
                      onClick={() => {
                        setActiveFolder(cf.name);
                        setSelectedMessageId(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    >
                      <Folder className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="truncate">{cf.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Labels Section */}
            {customLabels.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Labels
                </p>
                <div className="space-y-0.5">
                  {customLabels.map((lbl) => (
                    <button
                      key={lbl.id}
                      onClick={() => setSearchQuery(`label:${lbl.name}`)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lbl.color || '#6366f1' }} />
                      <span className="truncate">{lbl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Storage Quota Footer Widget */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5"><HardDrive className="w-3 h-3 text-indigo-400" /> Mail Storage</span>
              <span>{formatStorage(storageUsage.usedMb)} / {formatStorage(storageUsage.limitMb)}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        </aside>

        {/* Center Thread List Pane */}
        <div className={`w-full lg:w-96 shrink-0 h-full ${selectedMessageId ? 'hidden lg:block' : 'block'}`}>
          <ThreadList
            messages={messages}
            selectedMessageId={selectedMessageId}
            onSelectMessage={handleSelectMessage}
            activeCategory={activeCategory}
            onSelectCategory={(cat) => setActiveCategory(cat)}
            selectedIds={selectedIds}
            onToggleSelectAll={() => {
              if (selectedIds.length === messages.length) setSelectedIds([]);
              else setSelectedIds(messages.map((m) => m.id));
            }}
            onToggleSelectId={(id) => {
              setSelectedIds((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              );
            }}
            onBulkAction={handleBulkAction}
            onToggleStar={handleToggleStar}
            onTogglePin={handleTogglePin}
            isLoading={isLoadingMessages}
          />
        </div>

        {/* Right Detail Pane */}
        <div className={`flex-1 h-full min-w-0 ${selectedMessageId ? 'block' : 'hidden lg:block'}`}>
          {selectedMessageId ? (
            <ThreadViewer
              messages={selectedThreadMessages}
              subject={selectedThreadSubject}
              onBack={() => setSelectedMessageId(null)}
              onReply={handleOpenReply}
              onQuickReply={handleQuickReply}
              onForward={handleOpenForward}
              onDelete={handleDeleteMessage}
              onStar={handleToggleStar}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-500 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shadow-xl">
                <Inbox className="w-8 h-8 text-indigo-500/50" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">No message selected</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Select an email thread from the inbox list on the left to read its contents or send a quick reply. Press <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px]">?</kbd> for shortcuts.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Floating Compose Button */}
      {!selectedMessageId && (
        <button
          onClick={() => {
            setComposerDefaultRecipient('');
            setComposerDefaultSubject('');
            setComposerDefaultBody('');
            setComposerThreadId(undefined);
            setComposerInReplyTo(undefined);
            setIsComposerOpen(true);
          }}
          className="fixed bottom-6 right-6 z-30 lg:hidden shadow-2xl rounded-2xl p-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white flex items-center gap-2 text-xs font-bold border border-indigo-400/30 active:scale-95 transition-transform"
          title="Compose Email"
        >
          <PenSquare className="w-5 h-5" />
          <span>Compose</span>
        </button>
      )}

      {/* Keyboard Shortcuts Cheat-sheet Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-indigo-400" /> Webmail Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowKeyboardHelp(false)} className="p-1 text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Compose email</span>
                <kbd className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono text-xs rounded border border-slate-700">c</kbd>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Focus search</span>
                <kbd className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono text-xs rounded border border-slate-700">/</kbd>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Reply to thread</span>
                <kbd className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono text-xs rounded border border-slate-700">r</kbd>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Forward thread</span>
                <kbd className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono text-xs rounded border border-slate-700">f</kbd>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Archive thread</span>
                <kbd className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono text-xs rounded border border-slate-700">e</kbd>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Move to trash</span>
                <kbd className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono text-xs rounded border border-slate-700">#</kbd>
              </div>
            </div>
            <div className="pt-2 text-center">
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Close Shortcuts Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Toast Notifications with Undo */}
      <div className="fixed bottom-6 left-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-slate-900 border border-slate-700 text-slate-100 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction!();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline text-xs ml-2"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Floating Composer Component */}
      <Composer
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        defaultRecipient={composerDefaultRecipient}
        defaultSubject={composerDefaultSubject}
        defaultBody={composerDefaultBody}
        threadId={composerThreadId}
        inReplyTo={composerInReplyTo}
        smtpAccountId={activeMailboxId || undefined}
        onSent={() => {
          addToast('Email message dispatched successfully!', 'success');
          loadMessages();
        }}
      />

      {/* Webmail Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mailboxes={mailboxes}
        activeMailboxId={activeMailboxId}
        onRefreshData={loadFoldersAndLabels}
      />

      {/* Developer Credentials & System Provisioning Modal */}
      <WebmailCredentialsModal
        isOpen={isCredentialsOpen}
        onClose={() => setIsCredentialsOpen(false)}
        userRole={userRole}
        selectedMailboxId={activeMailboxId || undefined}
      />
    </div>
  );
};
