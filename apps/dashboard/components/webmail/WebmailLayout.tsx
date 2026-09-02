'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import {
  Mail,
  Calendar,
  Users,
  Search,
  Settings,
  Plus,
  Inbox,
  Star,
  Clock,
  FileText,
  Send,
  Archive,
  AlertTriangle,
  Trash2,
  Zap,
  FolderPlus,
  Sliders,
  Tag,
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
  activeMainTab?: 'mail' | 'calendar' | 'contacts';
  onChangeMainTab?: (tab: 'mail' | 'calendar' | 'contacts') => void;
  onOpenCalendarTab?: () => void;
  onOpenContactsTab?: () => void;
  storageUsedMb?: number;
  storageQuotaMb?: number;
  children: React.ReactNode;
}

export function WebmailLayout({
  mailboxes,
  selectedMailboxId,
  onSelectMailbox,
  onSelectMailboxId,
  activeFolder,
  onSelectFolder,
  activeCategory,
  onSelectCategory,
  activeTag,
  onSelectTag,
  searchQuery,
  onSearchChange,
  viewDensity = 'comfortable',
  listDensity,
  onChangeDensity,
  isThreaded = true,
  viewMode,
  onToggleThreaded,
  onChangeViewMode,
  onOpenCompose,
  onOpenFoldersModal,
  onOpenRulesModal,
  onOpenSettingsModal,
  activeMainTab = 'mail',
  onChangeMainTab,
  onOpenCalendarTab,
  onOpenContactsTab,
  storageUsedMb = 434,
  storageQuotaMb = 1024,
  children,
}: WebmailLayoutProps) {
  const [customFolders, setCustomFolders] = useState<any[]>([]);
  const [customLabels, setCustomLabels] = useState<any[]>([]);

  useEffect(() => {
    api.webmail.folders
      .list()
      .then((res) => setCustomFolders(res.folders || []))
      .catch(() => {});
    api.webmail.labels
      .list()
      .then((res) => setCustomLabels(res.labels || []))
      .catch(() => {});
  }, []);

  const activeMailbox =
    mailboxes.find((m) => m.id === selectedMailboxId) || mailboxes[0];

  const handleMailboxChange = (id: string) => {
    if (onSelectMailbox) onSelectMailbox(id);
    if (onSelectMailboxId) onSelectMailboxId(id);
  };

  const currentViewMode = viewMode || (isThreaded ? 'threads' : 'flat');

  const systemFolders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'snoozed', label: 'Snoozed', icon: Clock },
    { id: 'drafts', label: 'Drafts', icon: FileText },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'spam', label: 'Spam', icon: AlertTriangle },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  return (
    <div className="flex flex-col h-full min-h-[780px] bg-slate-900/90 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
      {/* TOP HEADER BAR */}
      <div className="bg-slate-950/80 px-6 py-3 border-b border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white font-extrabold flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>ShanuTechX Enterprise Webmail</span>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-500/30 uppercase">
                  Production
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                WildDuck REST + Express AI Gateway
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => {
                if (onChangeMainTab) onChangeMainTab('mail');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMainTab === 'mail'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Mail</span>
            </button>
            <button
              onClick={() => {
                if (onChangeMainTab) onChangeMainTab('calendar');
                if (onOpenCalendarTab) onOpenCalendarTab();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMainTab === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => {
                if (onChangeMainTab) onChangeMainTab('contacts');
                if (onOpenContactsTab) onOpenContactsTab();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMainTab === 'contacts'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Contacts</span>
            </button>
          </div>
        </div>

        {/* Center Search Bar */}
        <div className="flex-1 max-w-xl w-full relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search mail (e.g. from:mike is:unread has:attachment)..."
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextMode = currentViewMode === 'threads' ? 'flat' : 'threads';
              if (onChangeViewMode) onChangeViewMode(nextMode);
              if (onToggleThreaded) onToggleThreaded();
            }}
            title={
              currentViewMode === 'threads'
                ? 'Switch to Flat Message List'
                : 'Switch to Threaded Conversation View'
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              currentViewMode === 'threads'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{currentViewMode === 'threads' ? 'Threaded' : 'Flat'}</span>
          </button>

          <select
            value={listDensity || viewDensity}
            onChange={(e) => onChangeDensity(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl text-xs py-1.5 px-2 text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
            <option value="spacious">Spacious</option>
          </select>

          <button
            onClick={onOpenSettingsModal}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs"
            title="Webmail Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <div className="w-64 bg-slate-950/60 border-r border-slate-800/80 p-4 flex flex-col justify-between shrink-0 space-y-6 overflow-y-auto">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                Active Account
              </label>
              <select
                value={selectedMailboxId}
                onChange={(e) => handleMailboxChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {mailboxes.length > 0 ? (
                  mailboxes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email}
                    </option>
                  ))
                ) : (
                  <option value="">me@shanutechx.com</option>
                )}
              </select>
            </div>

            <button
              onClick={onOpenCompose}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Compose New Email</span>
            </button>

            {/* System Folders */}
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-2 mb-1.5">
                Folders
              </p>
              {systemFolders.map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectFolder(item.id);
                      onSelectTag(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      activeFolder === item.id && !activeTag
                        ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <IconComp className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Folders Section */}
            {customFolders.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Custom Folders
                  </p>
                  <button
                    onClick={onOpenFoldersModal}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    <span>New</span>
                  </button>
                </div>
                {customFolders.map((cf) => (
                  <button
                    key={cf.id}
                    onClick={() => {
                      onSelectFolder(cf.name);
                      onSelectTag(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      activeFolder === cf.name
                        ? 'bg-slate-800 text-white font-bold'
                        : 'text-slate-400 hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FolderPlus className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="truncate">{cf.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Custom Labels Section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 mb-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Labels
                </p>
                <button
                  onClick={onOpenFoldersModal}
                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Tag className="h-2.5 w-2.5" />
                  <span>Manage</span>
                </button>
              </div>
              {[
                { name: 'Work', color: 'bg-indigo-500' },
                { name: 'Documents', color: 'bg-emerald-500' },
                { name: 'News', color: 'bg-amber-500' },
                { name: 'Important', color: 'bg-rose-500' },
                ...customLabels.map((l) => ({
                  name: l.name,
                  color: 'bg-purple-500',
                })),
              ].map((tag) => (
                <button
                  key={tag.name}
                  onClick={() =>
                    onSelectTag(activeTag === tag.name ? null : tag.name)
                  }
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all ${
                    activeTag === tag.name
                      ? 'bg-slate-800 font-bold text-white'
                      : 'text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${tag.color}`} />
                    <span>{tag.name}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Rules & Filters Shortcut */}
            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={onOpenRulesModal}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
              >
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Automated Filters & Rules</span>
              </button>
            </div>
          </div>

          {/* Storage Quota Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-bold text-slate-300">Mail Storage</span>
              <span className="font-mono text-slate-400">
                {(storageUsedMb / 1024).toFixed(2)} GB /{' '}
                {(storageQuotaMb / 1024).toFixed(0)} GB
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((storageUsedMb / storageQuotaMb) * 100) || 15
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* BODY AREA (CONTENT) */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900/60">
          {/* Category Tabs */}
          {activeMainTab === 'mail' && (
            <div className="flex items-center gap-2 px-6 py-2 bg-slate-950/40 border-b border-slate-800/60 overflow-x-auto">
              {[
                { id: 'primary', label: 'Primary', icon: Inbox },
                { id: 'social', label: 'Social', icon: Users },
                { id: 'promotions', label: 'Promotions', icon: Tag },
                { id: 'updates', label: 'Updates', icon: Clock },
              ].map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onSelectCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                      activeCategory === cat.id
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <CatIcon className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Children Slot */}
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
