'use client';

import React, { useState } from 'react';
import {
  Star,
  Pin,
  Paperclip,
  CheckSquare,
  Square,
  Mail,
  MailOpen,
  Archive,
  Trash2,
  Tag,
  FolderInput,
  Inbox,
  Sparkles,
  Users,
  Bell,
  ShoppingBag,
  MessageSquare,
  Bookmark,
  RotateCcw,
  ChevronDown,
  AlertOctagon,
} from 'lucide-react';

export interface WebmailMessage {
  id: string;
  threadId?: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  snippet: string;
  category?: string;
  priority?: string;
  isRead: boolean;
  isStarred: boolean;
  isPinned: boolean;
  hasAttachments: boolean;
  labels?: string[];
  createdAt: string;
}

interface ThreadListProps {
  messages: WebmailMessage[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  activeFolder?: string;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectId: (id: string) => void;
  onSelectByCondition?: (type: 'all' | 'none' | 'read' | 'unread' | 'starred' | 'unstarred') => void;
  onBulkAction: (action: string, payload?: any) => void;
  onToggleStar: (id: string, currentStarred: boolean) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  density?: 'comfortable' | 'default' | 'compact';
  isLoading?: boolean;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  messages,
  selectedMessageId,
  onSelectMessage,
  activeFolder = 'inbox',
  activeCategory,
  onSelectCategory,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectId,
  onSelectByCondition,
  onBulkAction,
  onToggleStar,
  onTogglePin,
  density = 'default',
  isLoading = false,
}) => {
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const isAllSelected = messages.length > 0 && selectedIds.length === messages.length;

  const categories = [
    { id: 'primary', label: 'Primary', icon: Inbox },
    { id: 'social', label: 'Social', icon: Users },
    { id: 'promotions', label: 'Promotions', icon: ShoppingBag },
    { id: 'updates', label: 'Updates', icon: Bell },
    { id: 'forums', label: 'Forums', icon: MessageSquare },
  ];

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleSelectCondition = (type: 'all' | 'none' | 'read' | 'unread' | 'starred' | 'unstarred') => {
    setShowSelectDropdown(false);
    if (onSelectByCondition) {
      onSelectByCondition(type);
    } else if (type === 'all') {
      onToggleSelectAll();
    }
  };

  const showCategories = activeFolder === 'inbox';

  // Density helper styles
  const itemPadding =
    density === 'compact'
      ? 'py-1.5 px-2.5 sm:py-2 sm:px-3'
      : density === 'comfortable'
      ? 'py-3.5 px-3 sm:py-4 sm:px-4'
      : 'py-2.5 px-3 sm:py-3 sm:px-3.5';

  const avatarSize =
    density === 'compact'
      ? 'w-6 h-6 text-[10px]'
      : density === 'comfortable'
      ? 'w-8 h-8 text-xs'
      : 'w-7 h-7 text-[11px]';

  return (
    <div className="flex-1 flex flex-col h-full bg-black border-r border-white/10 overflow-hidden">
      {/* Category Tabs (Primary, Social, Promotions, Updates, Forums) */}
      {showCategories && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-[#0a0a0a] overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 select-none ${
                  isActive
                    ? 'bg-[#171717] text-white font-semibold border border-white/20 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk Action & Selection Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-[#0a0a0a] text-xs">
        <div className="flex items-center gap-2">
          {/* Checkbox with Dropdown Trigger */}
          <div className="relative flex items-center bg-[#171717] border border-white/10 rounded-lg p-0.5">
            <button
              onClick={onToggleSelectAll}
              className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
              title={isAllSelected ? 'Deselect All' : 'Select All'}
            >
              {isAllSelected ? <CheckSquare className="w-4 h-4 text-white" /> : <Square className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowSelectDropdown(!showSelectDropdown)}
              className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white"
              title="Select Options"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {showSelectDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSelectDropdown(false)} />
                <div className="absolute left-0 top-full mt-1.5 w-32 bg-[#171717] border border-white/10 rounded-xl shadow-2xl z-40 py-1.5 text-xs backdrop-blur-xl">
                  <button
                    onClick={() => handleSelectCondition('all')}
                    className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    All
                  </button>
                  <button
                    onClick={() => handleSelectCondition('none')}
                    className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    None
                  </button>
                  <button
                    onClick={() => handleSelectCondition('read')}
                    className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Read
                  </button>
                  <button
                    onClick={() => handleSelectCondition('unread')}
                    className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => handleSelectCondition('starred')}
                    className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Starred
                  </button>
                  <button
                    onClick={() => handleSelectCondition('unstarred')}
                    className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Unstarred
                  </button>
                </div>
              </>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 border-l border-white/10 pl-2 animate-in fade-in duration-150">
              <button
                onClick={() => onBulkAction('markRead')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Mark as Read"
              >
                <MailOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBulkAction('markUnread')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Mark as Unread"
              >
                <Mail className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBulkAction('star')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Star Selected"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBulkAction('markImportant')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Mark as Important"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBulkAction('archive')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Archive"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
              {activeFolder === 'trash' ? (
                <button
                  onClick={() => onBulkAction('restore')}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                  title="Restore to Inbox"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => onBulkAction('delete')}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Move to Trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[10px] text-neutral-400 font-mono font-medium ml-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {selectedIds.length} selected
              </span>
            </div>
          )}
        </div>

        <div className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-neutral-400 font-mono font-medium">
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Messages List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 flex flex-col">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-14 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto">
            <div className="max-w-[260px] w-full p-6 rounded-2xl bg-[#171717] border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center space-y-3.5 relative overflow-hidden">
              <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="w-12 h-12 rounded-2xl bg-[#0a0a0a] border border-white/10 flex items-center justify-center text-neutral-200 shadow-inner">
                <Inbox className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-white tracking-tight">
                  {activeFolder === 'inbox' ? 'Inbox is empty' : `No messages in ${activeFolder}`}
                </p>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {activeFolder === 'inbox'
                    ? 'Your inbox is clear. All caught up!'
                    : `Your ${activeFolder} folder is currently empty.`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedMessageId === msg.id;
            const isChecked = selectedIds.includes(msg.id);
            const isImportant = msg.priority === 'high' || msg.isPinned;

            return (
              <div
                key={msg.id}
                onClick={() => onSelectMessage(msg.id)}
                className={`group relative flex items-start sm:items-center gap-2.5 sm:gap-3 cursor-pointer transition-all border-b border-white/[0.04] ${itemPadding} ${
                  isSelected
                    ? 'bg-[#171717] border-l-2 border-white'
                    : !msg.isRead
                    ? 'bg-[#171717]/60 hover:bg-[#171717] border-l-2 border-neutral-400 font-medium'
                    : 'hover:bg-[#171717]/40 border-l-2 border-transparent'
                }`}
              >
                {/* Selection Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelectId(msg.id);
                  }}
                  className="mt-0.5 sm:mt-0 text-neutral-500 hover:text-white transition-colors shrink-0"
                  title={isChecked ? 'Deselect' : 'Select'}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-white" />
                  ) : (
                    <Square className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                  )}
                </button>

                {/* Star Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(msg.id, msg.isStarred);
                  }}
                  className="mt-0.5 sm:mt-0 transition-colors shrink-0"
                  title={msg.isStarred ? 'Unstar' : 'Star'}
                >
                  <Star
                    className={`w-4 h-4 ${
                      msg.isStarred
                        ? 'fill-white text-white'
                        : 'text-neutral-600 hover:text-white opacity-40 group-hover:opacity-100'
                    }`}
                  />
                </button>

                {/* Important Bookmark Indicator */}
                {isImportant && (
                  <span title="Important message" className="shrink-0 hidden sm:inline flex items-center">
                    <Bookmark className="w-3.5 h-3.5 fill-white text-white" />
                  </span>
                )}

                {/* Sender Avatar */}
                <div
                  className={`rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm ${avatarSize} ${
                    !msg.isRead
                      ? 'bg-white text-black font-bold'
                      : 'bg-neutral-800 text-neutral-300 border border-white/10'
                  }`}
                >
                  {((msg.senderName || msg.senderEmail || 'M')[0]).toUpperCase()}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs truncate ${
                        !msg.isRead ? 'font-bold text-white' : 'font-medium text-neutral-300'
                      }`}
                    >
                      {msg.senderName || msg.senderEmail}
                    </span>

                    {/* Desktop Hover Quick Actions / Default Timestamp */}
                    <div className="shrink-0 flex items-center">
                      <div className="hidden group-hover:flex items-center gap-1 sm:gap-1.5 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkAction(msg.isRead ? 'markUnread' : 'markRead', { messageIds: [msg.id] });
                          }}
                          className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title={msg.isRead ? 'Mark as Unread' : 'Mark as Read'}
                        >
                          {msg.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkAction('archive', { messageIds: [msg.id] });
                          }}
                          className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        {activeFolder === 'trash' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onBulkAction('restore', { messageIds: [msg.id] });
                            }}
                            className="p-1 text-white hover:bg-white/10 rounded transition-colors"
                            title="Restore"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onBulkAction('delete', { messageIds: [msg.id] });
                            }}
                            className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <span className="group-hover:hidden text-[10px] text-neutral-500 font-mono">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>

                  <p
                    className={`text-xs truncate ${
                      !msg.isRead ? 'font-semibold text-white' : 'text-neutral-400'
                    }`}
                  >
                    {msg.subject || '(No Subject)'}
                  </p>

                  <p className="text-[11px] text-neutral-500 truncate line-clamp-1">
                    {msg.snippet || 'No preview available'}
                  </p>

                  {/* Badges / Attachments */}
                  {(msg.hasAttachments || (msg.labels && msg.labels.length > 0) || isImportant) && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {isImportant && (
                        <span className="text-[10px] font-semibold text-white bg-white/10 border border-white/20 px-1.5 py-0.5 rounded">
                          Important
                        </span>
                      )}
                      {msg.hasAttachments && (
                        <span className="flex items-center gap-0.5 text-[10px] text-neutral-300 bg-[#171717] border border-white/10 px-1.5 py-0.5 rounded">
                          <Paperclip className="w-2.5 h-2.5 text-white" /> Attachment
                        </span>
                      )}
                      {msg.labels &&
                        msg.labels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded"
                          >
                            {lbl}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
