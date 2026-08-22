'use client';

import React from 'react';

interface WebmailMessageViewerProps {
  message: any;
  onBack: () => void;
  onReply: (recipient: string, subject: string) => void;
  onDelete: (id: string) => void;
}

export function WebmailMessageViewer({
  message,
  onBack,
  onReply,
  onDelete,
}: WebmailMessageViewerProps) {
  if (!message) return null;

  return (
    <div className="glass rounded-2xl p-6 border border-white/[0.08] space-y-6 animate-fade-in">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-all"
        >
          ← Back to List
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onReply(message.senderEmail, `Re: ${message.subject}`)}
            className="px-3 py-1.5 rounded-xl bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all"
          >
            ↩ Reply
          </button>
          <button
            onClick={() => onDelete(message.id)}
            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-semibold transition-all"
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {/* Subject Line */}
      <div>
        <h1 className="text-lg font-bold text-text-primary mb-2">{message.subject}</h1>
        <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-accent-violet/20 text-accent-violet-light font-bold text-sm flex items-center justify-center border border-accent-violet/30">
              {message.senderName ? message.senderName[0].toUpperCase() : 'U'}
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary">{message.senderName}</p>
              <p className="text-[11px] text-text-muted font-mono">{message.senderEmail}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-text-faint">
              {new Date(message.createdAt).toLocaleString()}
            </p>
            <p className="text-[10px] text-text-muted">
              To: <span className="font-mono">{message.recipientEmail}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Rendered HTML Email Body Container */}
      <div className="bg-white rounded-xl p-6 text-black min-h-[300px] overflow-y-auto text-xs shadow-inner">
        <div dangerouslySetInnerHTML={{ __html: message.htmlBody }} />
      </div>
    </div>
  );
}
