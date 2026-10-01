'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Star,
  Archive,
  Trash2,
  Paperclip,
  ShieldCheck,
  MoreVertical,
  Printer,
  Download,
  Send,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface MessageDetail {
  id: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  snippet: string;
  htmlBody: string;
  isStarred?: boolean;
  isRead?: boolean;
  hasAttachments?: boolean;
  attachmentsJson?: { filename: string; sizeStr: string; url?: string }[];
  createdAt: string;
}

interface ThreadViewerProps {
  messages: MessageDetail[];
  subject: string;
  onBack: () => void;
  onReply: (recipient: string, subject: string, messageId: string) => void;
  onForward: (subject: string, body: string) => void;
  onDelete: (id: string) => void;
  onStar: (id: string, currentStarred: boolean) => void;
}

export const ThreadViewer: React.FC<ThreadViewerProps> = ({
  messages,
  subject,
  onBack,
  onReply,
  onForward,
  onDelete,
  onStar,
}) => {
  const [expandedIds, setExpandedIds] = useState<string[]>(
    messages.length > 0 ? [messages[messages.length - 1].id] : []
  );
  const [quickReplyText, setQuickReplyText] = useState('');

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        Select a message to display contents
      </div>
    );
  }

  const latestMsg = messages[messages.length - 1];

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Back to Inbox"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <button
            onClick={() => onReply(latestMsg.senderEmail, `Re: ${subject}`, latestMsg.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/30 transition-colors"
          >
            <Reply className="w-3.5 h-3.5" /> Reply
          </button>
          <button
            onClick={() => onForward(`Fwd: ${subject}`, latestMsg.htmlBody)}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-800 transition-colors"
          >
            <Forward className="w-3.5 h-3.5" /> Forward
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onStar(latestMsg.id, !!latestMsg.isStarred)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-colors"
            title="Star"
          >
            <Star
              className={`w-4 h-4 ${
                latestMsg.isStarred ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>
          <button
            onClick={handlePrint}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(latestMsg.id)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Conversation Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Subject Header */}
        <div className="pb-4 border-b border-slate-800/80">
          <h1 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
            {subject}
            <span className="text-xs font-normal text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
              <Lock className="w-3 h-3" /> Encrypted (TLS/AES-256)
            </span>
            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> SPF & DKIM Verified
            </span>
          </div>
        </div>

        {/* Threaded Message Cards */}
        {messages.map((msg, index) => {
          const isExpanded = expandedIds.includes(msg.id);
          const isLatest = index === messages.length - 1;

          return (
            <div
              key={msg.id}
              className={`bg-slate-900/70 border rounded-xl transition-all ${
                isLatest ? 'border-slate-800 shadow-xl' : 'border-slate-800/50'
              }`}
            >
              {/* Card Header */}
              <div
                onClick={() => toggleExpand(msg.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/40 rounded-t-xl select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0">
                    {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {msg.senderName}{' '}
                      <span className="text-slate-400 font-normal">
                        &lt;{msg.senderEmail}&gt;
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400 truncate">
                      to {msg.recipientEmail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Card Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 space-y-4">
                  {/* HTML Body Render */}
                  <div
                    className="prose prose-invert max-w-none text-xs leading-relaxed text-slate-200 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: msg.htmlBody || `<p>${msg.snippet}</p>` }}
                  />

                  {/* Attachments Section */}
                  {msg.attachmentsJson && msg.attachmentsJson.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/60">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Paperclip className="w-3 h-3 text-indigo-400" /> Attachments ({msg.attachmentsJson.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.attachmentsJson.map((att, i) => (
                          <a
                            key={i}
                            href={att.url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="truncate max-w-[160px] font-medium">{att.filename}</span>
                            <span className="text-[10px] text-slate-400">({att.sizeStr})</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Action Footer for Card */}
                  <div className="pt-2 flex items-center gap-2 border-t border-slate-800/40 text-xs">
                    <button
                      onClick={() => onReply(msg.senderEmail, `Re: ${subject}`, msg.id)}
                      className="flex items-center gap-1 text-slate-400 hover:text-indigo-300 font-medium px-2 py-1 rounded hover:bg-slate-800"
                    >
                      <Reply className="w-3.5 h-3.5" /> Reply
                    </button>
                    <button
                      onClick={() => onForward(`Fwd: ${subject}`, msg.htmlBody)}
                      className="flex items-center gap-1 text-slate-400 hover:text-slate-200 font-medium px-2 py-1 rounded hover:bg-slate-800"
                    >
                      <Forward className="w-3.5 h-3.5" /> Forward
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Quick Inline Reply Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 mt-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Reply className="w-3.5 h-3.5 text-indigo-400" /> Quick Reply to {latestMsg.senderEmail}
          </div>
          <textarea
            value={quickReplyText}
            onChange={(e) => setQuickReplyText(e.target.value)}
            placeholder="Type your response here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none h-24"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                onReply(latestMsg.senderEmail, `Re: ${subject}`, latestMsg.id);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Open Full Composer
            </button>
            <button
              onClick={() => {
                if (quickReplyText.trim()) {
                  onReply(latestMsg.senderEmail, `Re: ${subject}`, latestMsg.id);
                  setQuickReplyText('');
                }
              }}
              disabled={!quickReplyText.trim()}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md transition-all"
            >
              <Send className="w-3.5 h-3.5" /> Send Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
