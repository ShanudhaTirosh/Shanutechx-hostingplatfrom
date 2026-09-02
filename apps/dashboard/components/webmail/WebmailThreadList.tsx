'use client';

import React, { useState, useEffect } from 'react';
import { WebmailMessage, WebmailThread } from '@/lib/types';
import {
  Star,
  Pin,
  Paperclip,
  AlertTriangle,
  Trash2,
  Archive,
  Mail,
  CheckSquare,
  Tag,
} from 'lucide-react';

interface WebmailThreadListProps {
  isThreaded?: boolean;
  messages: WebmailMessage[];
  threads?: WebmailThread[];
  selectedMessageId: string | null;
  selectedThreadId?: string | null;
  onSelectMessage: (msg: WebmailMessage) => void;
  onSelectThread?: (thread: WebmailThread) => void;
  onToggleStar: (id: string, e?: React.MouseEvent) => void;
  onTogglePin?: (id: string, e?: React.MouseEvent) => void;
  onDeleteMessage?: (id: string, e?: React.MouseEvent) => void;
  onBulkAction?: (action: string, ids: string[], extra?: any) => void;
  activeFolder?: string;
  viewMode?: 'threads' | 'flat';
  listDensity?: 'comfortable' | 'compact' | 'spacious';
  density?: 'comfortable' | 'cozy' | 'compact';
  onOpenCompose?: () => void;
}

export function WebmailThreadList({
  isThreaded = false,
  messages,
  threads = [],
  selectedMessageId,
  selectedThreadId,
  onSelectMessage,
  onSelectThread,
  onToggleStar,
  onTogglePin,
  onDeleteMessage,
  onBulkAction,
  listDensity = 'comfortable',
  density,
  onOpenCompose,
}: WebmailThreadListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const activeDensity = density || listDensity;

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      const listLength = isThreaded ? threads.length : messages.length;
      if (listLength === 0) return;

      if (e.key === 'j') {
        setFocusedIndex((prev) => Math.min(listLength - 1, prev + 1));
      } else if (e.key === 'k') {
        setFocusedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'c' && onOpenCompose) {
        e.preventDefault();
        onOpenCompose();
      } else if (e.key === 'e' && onBulkAction) {
        if (selectedIds.length > 0) onBulkAction('archive', selectedIds);
      } else if (e.key === '#' && onBulkAction) {
        if (selectedIds.length > 0) onBulkAction('delete', selectedIds);
      } else if (e.key === 's') {
        if (!isThreaded && messages[focusedIndex]) {
          onToggleStar(messages[focusedIndex].id, e as any);
        }
      } else if (e.key === 'Enter') {
        if (isThreaded && threads[focusedIndex] && onSelectThread) {
          onSelectThread(threads[focusedIndex]);
        } else if (!isThreaded && messages[focusedIndex]) {
          onSelectMessage(messages[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isThreaded,
    threads,
    messages,
    focusedIndex,
    selectedIds,
    onOpenCompose,
    onBulkAction,
    onToggleStar,
    onSelectThread,
    onSelectMessage,
  ]);

  const toggleSelectId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const allIds = isThreaded
      ? threads.map((t) => t.threadId)
      : messages.map((m) => m.id);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const pyClass =
    activeDensity === 'comfortable'
      ? 'py-3.5 px-4'
      : activeDensity === 'spacious'
      ? 'py-4.5 px-5'
      : 'py-2 px-3';

  return (
    <div className="h-full flex flex-col bg-slate-900/90 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
      {/* BULK ACTION BAR */}
      <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={
              (isThreaded ? threads.length > 0 : messages.length > 0) &&
              selectedIds.length ===
                (isThreaded ? threads.length : messages.length)
            }
            onChange={toggleSelectAll}
            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
          />

          {selectedIds.length > 0 && onBulkAction ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-indigo-400 mr-2">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => onBulkAction('markRead', selectedIds)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1"
                title="Mark Read"
              >
                <Mail className="h-3 w-3" />
                <span>Read</span>
              </button>
              <button
                onClick={() => onBulkAction('star', selectedIds)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-bold flex items-center gap-1"
                title="Star"
              >
                <Star className="h-3 w-3 fill-amber-400" />
                <span>Star</span>
              </button>
              <button
                onClick={() => onBulkAction('archive', selectedIds)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1"
                title="Archive"
              >
                <Archive className="h-3 w-3" />
                <span>Archive</span>
              </button>
              <button
                onClick={() => onBulkAction('delete', selectedIds)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs font-bold flex items-center gap-1"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 font-semibold">
              {isThreaded
                ? `${threads.length} conversations`
                : `${messages.length} messages`}
            </span>
          )}
        </div>

        <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
          Shortcuts: <kbd className="bg-slate-800 px-1 rounded">j</kbd>/
          <kbd className="bg-slate-800 px-1 rounded">k</kbd> nav
        </div>
      </div>

      {/* LIST ITEMS CONTAINER */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {isThreaded ? (
          threads.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-medium">
              No conversations found in this folder
            </div>
          ) : (
            threads.map((thread, index) => {
              const isSelected = selectedThreadId === thread.threadId;
              const isChecked = selectedIds.includes(thread.threadId);
              const isFocused = focusedIndex === index;

              return (
                <div
                  key={thread.threadId}
                  onClick={() => {
                    setFocusedIndex(index);
                    if (onSelectThread) onSelectThread(thread);
                  }}
                  className={`${pyClass} flex items-start gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500'
                      : isFocused
                      ? 'bg-slate-800/60'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => toggleSelectId(thread.threadId, e)}
                    className="mt-1 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`text-xs ${
                            !thread.isRead
                              ? 'font-black text-white'
                              : 'font-semibold text-slate-300'
                          }`}
                        >
                          {thread.participants.join(', ')}
                        </span>
                        {thread.messageCount > 1 && (
                          <span className="bg-slate-800 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {thread.messageCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(thread.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate ${
                        !thread.isRead
                          ? 'font-bold text-slate-100'
                          : 'text-slate-300'
                      }`}
                    >
                      {thread.subject}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {thread.snippet}
                    </p>
                  </div>
                  <button
                    onClick={(e) => onToggleStar(thread.latestMessage.id, e)}
                    className={`p-1 rounded hover:bg-slate-800 ${
                      thread.isStarred
                        ? 'text-amber-400'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        thread.isStarred ? 'fill-amber-400' : ''
                      }`}
                    />
                  </button>
                </div>
              );
            })
          )
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-medium">
            No messages found
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelected = selectedMessageId === msg.id;
            const isChecked = selectedIds.includes(msg.id);
            const isFocused = focusedIndex === index;
            const displayName = msg.senderName || msg.senderEmail || msg.from || 'Unknown';
            const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.timestamp || '');

            return (
              <div
                key={msg.id}
                onClick={() => {
                  setFocusedIndex(index);
                  onSelectMessage(msg);
                }}
                className={`${pyClass} flex items-start gap-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500'
                    : isFocused
                    ? 'bg-slate-800/60'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onClick={(e) => toggleSelectId(msg.id, e)}
                  className="mt-1 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />

                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                  {displayName[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs ${
                        !msg.isRead
                          ? 'font-black text-white'
                          : 'font-semibold text-slate-300'
                      } truncate`}
                    >
                      {displayName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {timeStr}
                    </span>
                  </div>
                  <p
                    className={`text-xs truncate ${
                      !msg.isRead ? 'font-bold text-slate-100' : 'text-slate-300'
                    }`}
                  >
                    {msg.subject}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {msg.snippet}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {msg.hasAttachments && (
                      <span className="text-[10px] bg-slate-800 text-indigo-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        <span>Files</span>
                      </span>
                    )}
                    {msg.priority === 'high' && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>High</span>
                      </span>
                    )}
                    {msg.labels &&
                      msg.labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded flex items-center gap-1"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          <span>{lbl}</span>
                        </span>
                      ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={(e) => onToggleStar(msg.id, e)}
                    className={`p-1 rounded hover:bg-slate-800 ${
                      msg.isStarred
                        ? 'text-amber-400'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        msg.isStarred ? 'fill-amber-400' : ''
                      }`}
                    />
                  </button>
                  {onTogglePin && (
                    <button
                      onClick={(e) => onTogglePin(msg.id, e)}
                      className={`p-1 rounded hover:bg-slate-800 ${
                        msg.isPinned
                          ? 'text-indigo-400'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      <Pin
                        className={`h-3.5 w-3.5 ${
                          msg.isPinned ? 'fill-indigo-400' : ''
                        }`}
                      />
                    </button>
                  )}
                  {onDeleteMessage && (
                    <button
                      onClick={(e) => onDeleteMessage(msg.id, e)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
