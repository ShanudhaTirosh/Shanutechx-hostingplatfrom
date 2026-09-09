'use client';

import React, { useState, useCallback } from 'react';
import { Star, Trash2, Archive, MoreVertical, Paperclip, Clock, Check } from 'lucide-react';
import { WebmailMessage, WebmailThread } from '@/lib/types';

interface WebmailThreadListProps {
  isThreaded: boolean;
  messages: WebmailMessage[];
  threads: WebmailThread[];
  selectedMessageId: string | null;
  selectedThreadId: string | null;
  onSelectMessage: (msg: WebmailMessage) => void;
  onSelectThread: (t: WebmailThread) => void;
  onToggleStar: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onBulkAction: (action: string, ids: string[]) => void;
  activeFolder: string;
  listDensity?: 'comfortable' | 'compact' | 'spacious';
  onOpenCompose: () => void;
}

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-400',
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-blue-500',
  'from-sky-500 to-cyan-400',
  'from-yellow-500 to-orange-400',
];

function avatarGrad(email: string) {
  return AVATAR_GRADIENTS[(email || '').charCodeAt(0) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string) {
  return (name || '?').split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WebmailThreadList({
  isThreaded,
  messages,
  threads,
  selectedMessageId,
  selectedThreadId,
  onSelectMessage,
  onSelectThread,
  onToggleStar,
  onDeleteMessage,
  onBulkAction,
  activeFolder,
  listDensity = 'comfortable',
  onOpenCompose,
}: WebmailThreadListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelectedIds(new Set());

  const itemPy = listDensity === 'compact' ? 'py-2' : listDensity === 'spacious' ? 'py-4' : 'py-3';
  const showSnippet = listDensity !== 'compact';

  const items = isThreaded ? threads : messages;
  const isEmpty = items.length === 0;

  const getItemId = (item: any) => isThreaded ? item.threadId : item.id;
  const getIsSelected = (item: any) => isThreaded
    ? selectedThreadId === item.threadId
    : selectedMessageId === item.id;
  const getIsChecked = (item: any) => selectedIds.has(getItemId(item));

  const getSender = (item: any) =>
    isThreaded
      ? (item.participants?.[0] || item.latestMessage?.senderName || 'Unknown')
      : (item.senderName || item.senderEmail || 'Unknown');

  const getSenderEmail = (item: any) =>
    isThreaded ? (item.latestMessage?.senderEmail || '') : (item.senderEmail || '');

  const getSnippet = (item: any) =>
    isThreaded ? item.snippet : item.snippet;

  const getTimestamp = (item: any) =>
    isThreaded ? item.timestamp : item.createdAt;

  const getIsRead = (item: any) =>
    isThreaded ? item.isRead : item.isRead;

  const getIsStarred = (item: any) =>
    isThreaded ? item.isStarred : item.isStarred;

  const getHasAttachments = (item: any) =>
    isThreaded ? item.latestMessage?.hasAttachments : item.hasAttachments;

  const getSubject = (item: any) =>
    isThreaded ? item.subject : item.subject;

  const getCount = (item: any) =>
    isThreaded && item.messageCount > 1 ? item.messageCount : null;

  return (
    <div className="flex flex-col h-full bg-[#13131a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 shrink-0">
        {selectedIds.size > 0 ? (
          <>
            <span className="text-xs font-bold text-violet-400">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button
              onClick={() => { onBulkAction('markRead', [...selectedIds]); clearSelection(); }}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              Mark Read
            </button>
            <button
              onClick={() => { onBulkAction('archive', [...selectedIds]); clearSelection(); }}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              Archive
            </button>
            <button
              onClick={() => { onBulkAction('delete', [...selectedIds]); clearSelection(); }}
              className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
            >
              Delete
            </button>
            <button onClick={clearSelection} className="text-slate-500 hover:text-white ml-1">
              ✕
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xs font-bold text-white capitalize">
              {activeFolder === 'inbox' ? 'Inbox' : activeFolder.charAt(0).toUpperCase() + activeFolder.slice(1)}
            </h2>
            <span className="text-[10px] text-slate-500 font-medium">
              ({items.length})
            </span>
          </>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Archive className="h-6 w-6 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400">No messages here</p>
            <p className="text-xs text-slate-600 mt-1">
              {activeFolder === 'inbox' ? 'Your inbox is empty.' : `No messages in ${activeFolder}.`}
            </p>
            {activeFolder === 'inbox' && (
              <button
                onClick={onOpenCompose}
                className="mt-4 px-4 py-2 rounded-xl bg-violet-600/20 text-violet-300 text-xs font-semibold hover:bg-violet-600/30 transition-all"
              >
                Compose New Email
              </button>
            )}
          </div>
        ) : (
          items.map((item: any) => {
            const id = getItemId(item);
            const isActive = getIsSelected(item);
            const isChecked = getIsChecked(item);
            const isHovered = hoveredId === id;
            const isRead = getIsRead(item);
            const isStarred = getIsStarred(item);
            const sender = getSender(item);
            const senderEmail = getSenderEmail(item);
            const subject = getSubject(item);
            const snippet = getSnippet(item);
            const timestamp = getTimestamp(item);
            const hasAttachments = getHasAttachments(item);
            const count = getCount(item);

            return (
              <div
                key={id}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => isThreaded ? onSelectThread(item) : onSelectMessage(item)}
                className={`relative flex items-start gap-3 px-3 ${itemPy} cursor-pointer border-b border-white/[0.04] transition-all group
                  ${isActive ? 'bg-violet-600/10 border-l-2 border-l-violet-500' : 'hover:bg-white/[0.03]'}
                  ${!isRead ? 'bg-white/[0.02]' : ''}
                `}
              >
                {/* Checkbox / Avatar */}
                <div className="shrink-0 mt-0.5 relative">
                  {isChecked || isHovered ? (
                    <button
                      onClick={(e) => toggleSelect(id, e)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 ${
                        isChecked
                          ? 'bg-violet-600 border-violet-500'
                          : 'border-slate-600 bg-transparent hover:border-violet-400'
                      }`}
                    >
                      {isChecked && <Check className="h-4 w-4 text-white" />}
                    </button>
                  ) : (
                    <div
                      onClick={(e) => toggleSelect(id, e)}
                      className={`w-8 h-8 rounded-full bg-gradient-to-tr ${avatarGrad(senderEmail)} flex items-center justify-center text-white text-[11px] font-bold cursor-pointer`}
                    >
                      {getInitials(sender)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-xs truncate ${!isRead ? 'font-bold text-white' : 'font-medium text-slate-200'}`}>
                      {sender}
                    </span>
                    {count && (
                      <span className="text-[9px] font-bold text-slate-400 bg-white/10 px-1 rounded shrink-0">
                        {count}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto shrink-0 font-medium">{relativeTime(timestamp)}</span>
                  </div>

                  <p className={`text-[11px] truncate mb-0.5 ${!isRead ? 'font-semibold text-slate-100' : 'text-slate-300'}`}>
                    {subject || '(No Subject)'}
                  </p>

                  {showSnippet && (
                    <p className="text-[11px] text-slate-400 truncate leading-tight">
                      {snippet || '—'}
                    </p>
                  )}

                  {/* Tags row */}
                  <div className="flex items-center gap-1.5 mt-1">
                    {hasAttachments && (
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-400 font-medium">
                        <Paperclip className="h-2.5 w-2.5 text-slate-400" /> Attachment
                      </span>
                    )}
                    {item.labels?.slice(0, 2).map((label: string) => (
                      <span key={label} className="text-[9px] font-semibold bg-violet-600/25 text-violet-300 px-1.5 py-0.5 rounded-full ring-1 ring-violet-500/20">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hover action buttons */}
                {isHovered && (
                  <div
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-[#1a1a26] rounded-xl border border-white/10 shadow-xl px-1.5 py-1 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onToggleStar(id)}
                      className={`p-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${isStarred ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400 hover:bg-white/5'}`}
                      title="Star"
                      aria-label="Star message"
                    >
                      <Star className="h-3.5 w-3.5" fill={isStarred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => onBulkAction('archive', [id])}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                      title="Archive"
                      aria-label="Archive message"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteMessage(id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
                      title="Delete"
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onBulkAction('snooze', [id])}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      title="Snooze"
                      aria-label="Snooze message"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Unread dot */}
                {!isRead && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
