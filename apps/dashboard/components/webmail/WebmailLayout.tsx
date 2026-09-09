'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Mail, Calendar, Users, CheckSquare, Settings, Plus, Inbox, Star, Clock,
  Send, Archive, AlertTriangle, Trash2, Zap, FolderPlus, Tag, ChevronDown,
  ChevronRight, Search, Shield, HardDrive, LogOut, MoreVertical, Bell,
  Sliders, Folder, Hash, RefreshCw, Moon, Sun,
} from 'lucide-react';

interface WebmailLayoutProps {
  mailboxes: any[];
  selectedMailboxId: string;
  onSelectMailbox?: (id: string) => void;
  onSelectMailboxId?: (id: string) => void;
  activeFolder: string;
  onSelectFolder: (folder: string) => void;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewDensity?: 'comfortable' | 'cozy' | 'compact' | 'spacious';
  listDensity?: 'comfortable' | 'compact' | 'spacious';
  onChangeDensity: (density: any) => void;
  isThreaded?: boolean;
  viewMode?: 'threads' | 'flat';
  onToggleThreaded?: () => void;
  onChangeViewMode?: (mode: 'threads' | 'flat') => void;
  onOpenCompose: () => void;
  onOpenFoldersModal: () => void;
  onOpenRulesModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenShortcuts?: () => void;
  onOpenDelegation?: () => void;
  onOpenCredentials?: () => void;
  onOpenScheduled?: () => void;
  onOpenAnalytics?: () => void;
  onOpenMailMerge?: () => void;
  onOpenSecurityDrawer?: () => void;
  onOpenAuditLogs?: () => void;
  onOpenSessions?: () => void;
  activeMainTab?: 'mail' | 'calendar' | 'contacts' | 'tasks' | 'admin' | 'analytics';
  onChangeMainTab?: (tab: 'mail' | 'calendar' | 'contacts' | 'tasks' | 'admin' | 'analytics') => void;
  onOpenCalendarTab?: () => void;
  onOpenContactsTab?: () => void;
  storageUsedMb?: number;
  storageQuotaMb?: number;
  userRole?: string;
  children: React.ReactNode;
}

const SYSTEM_FOLDERS = [
  { id: 'inbox',   label: 'Inbox',   icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'snoozed', label: 'Snoozed', icon: Clock },
  { id: 'sent',    label: 'Sent',    icon: Send },
  { id: 'drafts',  label: 'Drafts',  icon: Archive },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'spam',    label: 'Spam',    icon: AlertTriangle },
  { id: 'trash',   label: 'Trash',   icon: Trash2 },
];

const NAV_TABS = [
  { id: 'mail',      icon: Mail,        label: 'Mail' },
  { id: 'calendar',  icon: Calendar,    label: 'Calendar' },
  { id: 'contacts',  icon: Users,       label: 'Contacts' },
  { id: 'tasks',     icon: CheckSquare, label: 'Tasks' },
];

function getInitials(name: string): string {
  return (name || 'U')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(email: string): string {
  const colors = ['from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500', 'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500', 'from-rose-500 to-pink-500', 'from-indigo-500 to-blue-500'];
  const idx = (email || '').charCodeAt(0) % colors.length;
  return colors[idx];
}

export function WebmailLayout({
  mailboxes,
  selectedMailboxId,
  onSelectMailbox,
  activeFolder,
  onSelectFolder,
  activeCategory,
  onSelectCategory,
  activeTag,
  onSelectTag,
  searchQuery,
  onSearchChange,
  listDensity = 'comfortable',
  onChangeDensity,
  isThreaded = true,
  onToggleThreaded,
  onOpenCompose,
  onOpenFoldersModal,
  onOpenRulesModal,
  onOpenSettingsModal,
  onOpenShortcuts,
  onOpenDelegation,
  onOpenCredentials,
  onOpenScheduled,
  onOpenAnalytics,
  onOpenMailMerge,
  onOpenSecurityDrawer,
  onOpenAuditLogs,
  onOpenSessions,
  activeMainTab = 'mail',
  onChangeMainTab,
  storageUsedMb = 434,
  storageQuotaMb = 1024,
  userRole,
  children,
}: WebmailLayoutProps) {
  const [customFolders, setCustomFolders] = useState<any[]>([]);
  const [customLabels, setCustomLabels] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [labelsExpanded, setLabelsExpanded] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const selectedMailbox = mailboxes.find((m) => m.id === selectedMailboxId) || mailboxes[0];
  const mailboxEmail = selectedMailbox
    ? `${selectedMailbox.smtpUsername}@${selectedMailbox.customDomain || selectedMailbox.smtpHost?.replace(/^mail\./, '') || 'mail'}`
    : 'webmail@shanutechx.com';

  const storagePercent = Math.min(100, Math.round((storageUsedMb / storageQuotaMb) * 100));
  const storageColor = storagePercent > 85 ? 'bg-rose-500' : storagePercent > 65 ? 'bg-amber-500' : 'bg-violet-500';

  useEffect(() => {
    api.webmail.folders.list().then((res) => setCustomFolders(res.folders || [])).catch(() => {});
    api.webmail.labels.list().then((res) => setCustomLabels(res.labels || [])).catch(() => {});
  }, []);

  const isAdmin = userRole === 'admin' || userRole === 'dev';

  return (
    <div className={`flex h-full w-full overflow-hidden ${theme === 'dark' ? 'bg-[#0f0f13]' : 'bg-slate-100'}`}>

      {/* ─── COL 1: Icon Rail (60px) ─── */}
      <aside className="flex flex-col items-center py-3 gap-1 w-[60px] shrink-0 bg-[#13131a] border-r border-white/5 z-20">
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-xs shadow-lg shadow-violet-500/30 mb-2 shrink-0">
          STX
        </div>

        {/* Nav Tabs */}
        <div className="flex flex-col gap-1 w-full px-2">
          {NAV_TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onChangeMainTab?.(id as any)}
              title={label}
              aria-label={label}
              className={`w-full flex flex-col items-center py-2.5 px-1 rounded-xl text-[9px] font-semibold gap-1 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 active:scale-[0.97] ${
                activeMainTab === id
                  ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={activeMainTab === id ? 2.2 : 1.7} />
              <span className="leading-none">{label}</span>
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => onChangeMainTab?.('admin')}
              title="Admin Panel"
              aria-label="Admin Panel"
              className={`w-full flex flex-col items-center py-2.5 px-1 rounded-xl text-[9px] font-semibold gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 active:scale-[0.97] ${
                activeMainTab === 'admin'
                  ? 'bg-amber-600/20 text-amber-300 ring-1 ring-amber-500/30'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <Shield className="h-4.5 w-4.5" strokeWidth={1.7} />
              <span className="leading-none">Admin</span>
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Bottom actions */}
        <div className="flex flex-col gap-1 w-full px-2 pb-1">
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="Toggle Theme"
            aria-label="Toggle Theme"
            className="w-full flex items-center justify-center py-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 active:scale-[0.97]"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={onOpenSettingsModal}
            title="Settings"
            aria-label="Settings"
            className="w-full flex items-center justify-center py-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 active:scale-[0.97]"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* ─── COL 2: Folder Sidebar (240px) ─── */}
      {!sidebarCollapsed && (
        <aside className="flex flex-col w-[240px] shrink-0 bg-[#16161f] border-r border-white/5 z-10 overflow-hidden">

          {/* Account Switcher */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${getAvatarColor(mailboxEmail)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {getInitials(selectedMailbox?.smtpUsername || 'Me')}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {selectedMailbox?.smtpUsername || 'My Mailbox'}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight">{mailboxEmail}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform shrink-0 ${accountMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Account dropdown */}
            {accountMenuOpen && mailboxes.length > 1 && (
              <div className="mt-1 bg-[#1e1e2a] rounded-xl border border-white/5 overflow-hidden shadow-xl">
                {mailboxes.map((mb) => {
                  const mbEmail = `${mb.smtpUsername}@${mb.customDomain || mb.smtpHost?.replace(/^mail\./, '') || 'mail'}`;
                  return (
                    <button
                      key={mb.id}
                      onClick={() => { onSelectMailbox?.(mb.id); setAccountMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-all ${mb.id === selectedMailboxId ? 'bg-violet-600/20 text-violet-300' : 'text-slate-300 hover:bg-white/5'}`}
                    >
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${getAvatarColor(mbEmail)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {getInitials(mb.smtpUsername)}
                      </div>
                      <span className="truncate font-medium">{mbEmail}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5 focus-within:border-violet-500/50 focus-within:bg-violet-500/5 transition-all">
              <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search mail…"
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          {/* Compose Button */}
          <div className="px-3 pb-3">
            <button
              onClick={onOpenCompose}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              Compose
            </button>
          </div>

          {/* Folder Tree — scrollable */}
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

            {/* Category Tabs */}
            <div className="flex items-center gap-1 mb-2 px-1">
              {['primary', 'social', 'promos', 'updates'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`text-[9px] font-bold px-2 py-1 rounded-lg capitalize transition-all ${
                    activeCategory === cat ? 'bg-violet-600/30 text-violet-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {cat === 'primary' ? 'All' : cat.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* System Folders */}
            {SYSTEM_FOLDERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onSelectFolder(id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all group ${
                  activeFolder === id
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                <span className="flex-1 text-left">{label}</span>
                {id === 'inbox' && unreadCounts.inbox > 0 && (
                  <span className="text-[10px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unreadCounts.inbox}
                  </span>
                )}
              </button>
            ))}

            {/* Custom Folders */}
            {customFolders.length > 0 && (
              <div className="pt-1">
                <button
                  onClick={() => setFoldersExpanded(!foldersExpanded)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-all"
                >
                  {foldersExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Folder className="h-3 w-3" />
                  Folders
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenFoldersModal(); }}
                    className="ml-auto text-slate-600 hover:text-violet-400"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </button>
                {foldersExpanded && customFolders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onSelectFolder(`custom:${f.id}`)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                      activeFolder === `custom:${f.id}` ? 'bg-violet-600/20 text-violet-300' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                    }`}
                  >
                    <span style={{ color: f.color }} className="text-sm">●</span>
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Labels */}
            {customLabels.length > 0 && (
              <div className="pt-1">
                <button
                  onClick={() => setLabelsExpanded(!labelsExpanded)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-all"
                >
                  {labelsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Tag className="h-3 w-3" />
                  Labels
                </button>
                {labelsExpanded && customLabels.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectTag(l.name)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                      activeTag === l.name ? 'bg-violet-600/20 text-violet-300' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="pt-2 border-t border-white/5 mt-2 space-y-0.5">
              <button
                onClick={onOpenRulesModal}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              >
                <Zap className="h-3.5 w-3.5" />
                Filter Rules
              </button>
              <button
                onClick={onOpenFoldersModal}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Manage Folders
              </button>
              <button
                onClick={() => onChangeDensity(listDensity === 'comfortable' ? 'compact' : 'comfortable')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              >
                <Sliders className="h-3.5 w-3.5" />
                {listDensity === 'compact' ? 'Comfortable View' : 'Compact View'}
              </button>
              {onToggleThreaded && (
                <button
                  onClick={onToggleThreaded}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                >
                  <Hash className="h-3.5 w-3.5" />
                  {isThreaded ? 'Switch to Flat' : 'Switch to Threads'}
                </button>
              )}
            </div>
          </div>

          {/* Storage Bar */}
          <div className="px-3 py-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <HardDrive className="h-3 w-3" />
                <span>Storage</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {storageUsedMb < 1024 ? `${storageUsedMb} MB` : `${(storageUsedMb / 1024).toFixed(1)} GB`}
                {' / '}
                {storageQuotaMb < 1024 ? `${storageQuotaMb} MB` : `${(storageQuotaMb / 1024).toFixed(0)} GB`}
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${storageColor}`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            {storagePercent > 80 && (
              <p className="text-[10px] text-amber-400 mt-1">Storage nearing limit — consider upgrading</p>
            )}
          </div>
        </aside>
      )}

      {/* Sidebar toggle tab */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute left-[300px] top-1/2 -translate-y-1/2 z-30 w-3.5 h-8 bg-[#16161f] border border-white/5 rounded-r-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
        style={{ left: sidebarCollapsed ? '60px' : '300px' }}
      >
        {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 -rotate-90" />}
      </button>

      {/* ─── COL 3: Main Content ─── */}
      <main className="flex-1 h-full overflow-hidden flex flex-col bg-[#0f0f13]">
        {children}
      </main>
    </div>
  );
}
