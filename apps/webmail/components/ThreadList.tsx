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
  Clock,
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
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectId: (id: string) => void;
  onBulkAction: (action: string, payload?: any) => void;
  onToggleStar: (id: string, currentStarred: boolean) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  isLoading?: boolean;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  messages,
  selectedMessageId,
  onSelectMessage,
  activeCategory,
  onSelectCategory,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectId,
  onBulkAction,
  onToggleStar,
  onTogglePin,
  isLoading = false,
}) => {
  const isAllSelected = messages.length > 0 && selectedIds.length === messages.length;

  const categories = [
    { id: 'primary', label: 'Primary', icon: Inbox },
    { id: 'social', label: 'Social', icon: Users },
    { id: 'updates', label: 'Updates', icon: Bell },
    { id: 'promotions', label: 'Promotions', icon: ShoppingBag },
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

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800/80 overflow-hidden">
      {/* Category Tabs */}
      <div className="flex items-center border-b border-slate-800 px-3 bg-slate-900/60 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bulk Action Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/30 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSelectAll}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
            title={isAllSelected ? 'Deselect All' : 'Select All'}
          >
            {isAllSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
          </button>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 border-l border-slate-800 pl-2 animate-in fade-in duration-150">
              <button
                onClick={() => onBulkAction('markRead')}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Mark as Read"
              >
                <MailOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBulkAction('markUnread')}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Mark as Unread"
              >
                <Mail className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBulkAction('archive')}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Archive"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBulkAction('delete')}
                className="p-1.5 hover:bg-slate-800 rounded text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Move to Trash"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-500 font-medium ml-1">
                {selectedIds.length} selected
              </span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Messages List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-14 bg-slate-900/60 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">No messages found</p>
              <p className="text-xs text-slate-500 mt-0.5">Your inbox is clear or no emails match the query.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedMessageId === msg.id;
            const isChecked = selectedIds.includes(msg.id);

            return (
              <div
                key={msg.id}
                onClick={() => onSelectMessage(msg.id)}
                className={`group relative flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:py-2.5 sm:px-3 cursor-pointer transition-all border-b border-slate-800/60 ${
                  isSelected
                    ? 'bg-indigo-600/15 border-l-2 border-indigo-500'
                    : !msg.isRead
                    ? 'bg-slate-900/90 hover:bg-slate-900 border-l-2 border-indigo-400/80 font-medium'
                    : 'hover:bg-slate-900/50 border-l-2 border-transparent'
                }`}
              >
                {/* Selection Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelectId(msg.id);
                  }}
                  className="mt-0.5 sm:mt-0 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                  title={isChecked ? 'Deselect' : 'Select'}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
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
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-600 hover:text-slate-400 opacity-40 group-hover:opacity-100'
                    }`}
                  />
                </button>

                {/* Sender Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm ${
                    !msg.isRead
                      ? 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                  }`}
                >
                  {((msg.senderName || msg.senderEmail || 'M')[0]).toUpperCase()}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs truncate ${
                        !msg.isRead ? 'font-bold text-slate-100' : 'font-medium text-slate-300'
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
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                          title={msg.isRead ? 'Mark as Unread' : 'Mark as Read'}
                        >
                          {msg.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkAction('archive', { messageIds: [msg.id] });
                          }}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkAction('delete', { messageIds: [msg.id] });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="group-hover:hidden text-[10px] text-slate-400 font-mono">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>

                  <p
                    className={`text-xs truncate ${
                      !msg.isRead ? 'font-semibold text-slate-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.subject || '(No Subject)'}
                  </p>

                  <p className="text-[11px] text-slate-500 truncate line-clamp-1">
                    {msg.snippet || 'No preview available'}
                  </p>

                  {/* Badges / Attachments */}
                  {(msg.hasAttachments || (msg.labels && msg.labels.length > 0)) && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {msg.hasAttachments && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                          <Paperclip className="w-2.5 h-2.5 text-indigo-400" /> Attachment
                        </span>
                      )}
                      {msg.labels &&
                        msg.labels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded"
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
