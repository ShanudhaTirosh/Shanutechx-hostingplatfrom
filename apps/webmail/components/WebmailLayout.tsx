'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { MailboxSwitcher, Mailbox } from './MailboxSwitcher';
import { ThreadList, WebmailMessage } from './ThreadList';
import { ThreadViewer, MessageDetail } from './ThreadViewer';
import { Composer } from './Composer';
import { SettingsModal } from './SettingsModal';
import { api } from '../lib/api';
import { firebaseAuth } from '../lib/firebaseClient';

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
  const [showSearchHelp, setShowSearchHelp] = useState<boolean>(false);

  // Custom Folders & Labels
  const [customFolders, setCustomFolders] = useState<any[]>([]);
  const [customLabels, setCustomLabels] = useState<any[]>([]);

  useEffect(() => {
    loadMailboxes();
    loadFoldersAndLabels();
  }, []);

  useEffect(() => {
    loadMessages();
  }, [activeFolder, activeCategory, searchQuery, activeMailboxId]);

  const loadMailboxes = async () => {
    try {
      const res = await api.email.mailboxes();
      const accounts = res.smtpAccounts || [];
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
      const res = await api.webmail.listMessages(
        activeFolder,
        searchQuery,
        activeMailboxId || undefined
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

  // Bulk actions
  const handleBulkAction = async (action: string, payload?: any) => {
    if (selectedIds.length === 0) return;
    try {
      await api.webmail.bulkAction({
        messageIds: selectedIds,
        action,
        ...payload,
      });
      setSelectedIds([]);
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
    setSelectedMessageId(null);
    setSelectedThreadMessages([]);
    loadMessages();
  };

  const handleLogout = () => {
    firebaseAuth.signOut();
    window.location.href = '/login';
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

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-300">
      {/* Top Application Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800/80 px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Sparkles className="w-4 h-4 fill-white/20" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-100 hidden sm:inline">
              ShanuTechX <span className="text-indigo-400 font-medium">Webmail</span>
            </span>
          </div>

          <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Mailbox Switcher */}
          <MailboxSwitcher
            mailboxes={mailboxes}
            activeMailboxId={activeMailboxId}
            onSelectMailbox={(id) => setActiveMailboxId(id)}
          />
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-xl mx-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchHelp(true)}
              onBlur={() => setTimeout(() => setShowSearchHelp(false), 200)}
              placeholder="Search mail (e.g. from:support, is:unread, subject:invoice)..."
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={loadMessages}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh Inbox"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin text-indigo-400' : ''}`} />
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

      {/* Main App Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <aside className="w-56 bg-slate-900/80 border-r border-slate-800/80 p-3 flex flex-col justify-between shrink-0 select-none">
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
              <span>1.2 GB / 10 GB</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 w-[12%]" />
            </div>
          </div>
        </aside>

        {/* Center Thread List Pane */}
        <div className={`w-full sm:w-96 shrink-0 h-full ${selectedMessageId ? 'hidden sm:block' : 'block'}`}>
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
        <div className={`flex-1 h-full min-w-0 ${selectedMessageId ? 'block' : 'hidden sm:block'}`}>
          {selectedMessageId ? (
            <ThreadViewer
              messages={selectedThreadMessages}
              subject={selectedThreadSubject}
              onBack={() => setSelectedMessageId(null)}
              onReply={handleOpenReply}
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
                Select an email thread from the inbox list on the left to read its contents or send a quick reply.
              </p>
            </div>
          )}
        </div>
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
        onSent={loadMessages}
      />

      {/* Webmail Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mailboxes={mailboxes}
        activeMailboxId={activeMailboxId}
        onRefreshData={loadFoldersAndLabels}
      />
    </div>
  );
};
