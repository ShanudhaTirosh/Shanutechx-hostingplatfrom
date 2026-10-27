'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { IconSend } from '@/components/Icons';

interface WebmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
  defaultRecipient?: string;
  defaultSubject?: string;
}

export function WebmailComposer({
  isOpen,
  onClose,
  onSent,
  defaultRecipient = '',
  defaultSubject = '',
}: WebmailComposerProps) {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !subject || !body) return;

    setSending(true);
    api.webmail
      .sendMessage({
        recipientEmail: recipient,
        subject,
        htmlBody: body.includes('<') ? body : `<div style="font-family: sans-serif; line-height: 1.5;">${body.replace(/\n/g, '<br/>')}</div>`,
      })
      .then(() => {
        setRecipient('');
        setSubject('');
        setBody('');
        onSent();
        onClose();
      })
      .catch((err: any) => alert(`Failed to send email: ${err.message}`))
      .finally(() => setSending(false));
  };

  return (
    <div
      className={`fixed bottom-0 right-6 z-50 w-full max-w-lg bg-[#0e101a] border border-white/[0.12] rounded-t-2xl shadow-2xl transition-all ${
        minimized ? 'h-12 overflow-hidden' : 'h-[500px]'
      }`}
    >
      {/* Compose Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#141726] border-b border-white/[0.08] cursor-pointer rounded-t-2xl">
        <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-violet animate-pulse" />
          New Message
        </span>
        <div className="flex items-center gap-2 text-text-muted hover:text-text-primary">
          <button
            onClick={() => setMinimized(!minimized)}
            className="text-xs p-1 hover:bg-white/[0.08] rounded"
          >
            {minimized ? '▢' : '—'}
          </button>
          <button onClick={onClose} className="text-xs p-1 hover:bg-white/[0.08] rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {!minimized && (
        <form onSubmit={handleSend} className="flex flex-col h-[calc(100%-48px)] p-4 space-y-3">
          <div>
            <input
              type="email"
              placeholder="To: recipient@domain.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-transparent border-b border-white/[0.08] pb-2 text-xs text-text-primary focus:outline-none focus:border-accent-violet"
              required
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-transparent border-b border-white/[0.08] pb-2 text-xs text-text-primary focus:outline-none focus:border-accent-violet"
              required
            />
          </div>

          <textarea
            rows={12}
            placeholder="Write your email here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full flex-1 bg-black/40 border border-white/[0.06] rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50 resize-none"
            required
          />

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 text-text-muted text-xs">
              <span className="text-[10px] uppercase tracking-wider text-text-faint">
                Self-Hosted SMTP Active
              </span>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 rounded-xl bg-accent-violet hover:bg-accent-violet-light text-white text-xs font-semibold shadow-glow-violet transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <IconSend size={14} /> {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
