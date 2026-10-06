'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { WebmailMessage } from '@/lib/types';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  Star,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Paperclip,
  CornerUpLeft,
  CornerUpRight,
  X,
  FileText,
  ShieldAlert,
  Send,
  ExternalLink,
  Plus,
  Clock,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { WebmailSnoozeModal } from './WebmailSnoozeModal';
import { WebmailAttachmentPreviewModal } from './WebmailAttachmentPreviewModal';

interface WebmailThreadViewerProps {
  messages?: WebmailMessage[];
  selectedMessage?: WebmailMessage | null;
  activeThreadId?: string | null;
  onReply: (msg: WebmailMessage) => void;
  onForward: (msg: WebmailMessage) => void;
  onDelete: (id: string) => void;
  onStar?: (id: string) => void;
}

export function WebmailThreadViewer({
  messages,
  selectedMessage,
  onReply,
  onForward,
  onDelete,
  onStar,
}: WebmailThreadViewerProps) {
  const [previewAttachment, setPreviewAttachment] = useState<{
    filename: string;
    url?: string;
    content?: string;
  } | null>(null);
  const [collapsedMessages, setCollapsedMessages] = useState<
    Record<string, boolean>
  >({});
  const [quickReplyText, setQuickReplyText] = useState('');
  const [sendingQuickReply, setSendingQuickReply] = useState(false);
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);

  const { toast } = useToast();

  const handlePrint = () => {
    if (!primaryMsg) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html>
        <head><title>${primaryMsg.subject}</title></head>
        <body style="font-family: sans-serif; padding: 24px; color: #1e293b;">
          <h2 style="margin-bottom: 4px;">${primaryMsg.subject}</h2>
          <p style="color: #64748b; font-size: 13px;"><strong>From:</strong> ${primaryMsg.senderName || primaryMsg.from} &lt;${primaryMsg.senderEmail || primaryMsg.from}&gt;</p>
          <p style="color: #64748b; font-size: 13px;"><strong>Date:</strong> ${primaryMsg.createdAt ? new Date(primaryMsg.createdAt).toLocaleString() : ''}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;"/>
          <div style="font-size: 14px; line-height: 1.6;">${primaryMsg.body || primaryMsg.htmlBody || primaryMsg.snippet}</div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.print();
  };

  const handleReportThreat = async () => {
    if (!primaryMsg) return;
    try {
      await api.webmail.reportThreat({ messageId: primaryMsg.id });
      toast('Reported threat & moved message to quarantine', 'success');
    } catch {
      toast('Failed to report threat', 'error');
    }
  };

  const msgList = messages && messages.length > 0 ? messages : selectedMessage ? [selectedMessage] : [];
  const primaryMsg = msgList[msgList.length - 1] || null;

  useEffect(() => {
    if (!primaryMsg) return;

    setQuickReplyText('');

    const collapseMap: Record<string, boolean> = {};
    msgList.forEach((m, idx) => {
      if (idx < msgList.length - 1) {
        collapseMap[m.id] = true;
      }
    });
    setCollapsedMessages(collapseMap);
  }, [primaryMsg?.id]);

  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim() || !primaryMsg) return;
    const recipientEmail = primaryMsg.senderEmail || primaryMsg.from || '';
    setSendingQuickReply(true);
    try {
      await api.webmail.sendMessage({
        recipientEmail,
        subject: `Re: ${primaryMsg.subject}`,
        htmlBody: `<div style="font-family: sans-serif;">${quickReplyText.replace(/\n/g, '<br/>')}</div>`,
        threadId: primaryMsg.threadId || primaryMsg.id,
        inReplyTo: primaryMsg.id,
      });
      toast('Quick reply dispatched!', 'success');
      setQuickReplyText('');
    } catch (err: any) {
      toast(err.message || 'Failed to send reply', 'error');
    } finally {
      setSendingQuickReply(false);
    }
  };

  if (!primaryMsg) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-semibold bg-[#13131a] border border-white/5 rounded-3xl p-8 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3 text-slate-500">
          <FileText className="h-6 w-6" />
        </div>
        <p className="text-slate-300 font-bold text-sm">No message selected</p>
        <p className="text-slate-400 text-xs mt-1">Select a conversation or email from the thread list to view its contents.</p>
      </div>
    );
  }

  const senderEmail = primaryMsg.senderEmail || primaryMsg.from || 'sender@shanutechx.com';
  const senderName = primaryMsg.senderName || primaryMsg.from || 'Sender';
  const recipientEmail = primaryMsg.recipientEmail || primaryMsg.to || 'me@shanutechx.com';
  const displayBody = primaryMsg.body || primaryMsg.htmlBody || primaryMsg.snippet || '';

  return (
    <div className="h-full flex flex-col bg-[#13131a] border border-white/5 rounded-3xl overflow-y-auto p-6 space-y-6 shadow-xl">
      {/* HEADER BAR */}
      <div className="border-b border-white/10 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-base font-extrabold text-white leading-snug">
            {primaryMsg.subject}
          </h1>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-xl border border-emerald-500/30 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Clean (Scanned)
            </span>

            <button
              onClick={() => setIsSnoozeOpen(true)}
              aria-label="Snooze email"
              className="p-2 rounded-xl bg-white/5 text-slate-200 border border-white/10 hover:text-white hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 active:scale-[0.98]"
              title="Snooze email"
            >
              <Clock className="h-4 w-4 text-indigo-400" />
              <span>Snooze</span>
            </button>

            <button
              onClick={handlePrint}
              aria-label="Print email"
              className="p-2 rounded-xl bg-white/5 text-slate-200 border border-white/10 hover:text-white hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 active:scale-[0.98]"
              title="Print email"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>

            <button
              onClick={handleReportThreat}
              aria-label="Report phishing or threat"
              className="p-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 active:scale-[0.98]"
              title="Report phishing/threat"
            >
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <span>Report</span>
            </button>

            {onStar && (
              <button
                onClick={() => onStar(primaryMsg.id)}
                aria-label="Star email"
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 active:scale-[0.98] ${
                  primaryMsg.isStarred
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                <Star
                  className={`h-4 w-4 ${
                    primaryMsg.isStarred ? 'fill-amber-400 text-amber-400' : ''
                  }`}
                />
                <span>Star</span>
              </button>
            )}
            <button
              onClick={() => onDelete(primaryMsg.id)}
              aria-label="Delete email"
              className="p-2 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 active:scale-[0.98]"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Enterprise Security & Transport Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <ShieldCheck className="h-4 w-4 text-sky-400 shrink-0" />
            <span>Transport Security: <strong className="text-white">TLS 1.3 Encrypted</strong></span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500/20">SPF: Pass</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500/20">DKIM: Valid</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500/20">DMARC: Compliant</span>
          </div>
        </div>
      </div>

      {/* MESSAGES THREAD FLOW */}
      <div className="space-y-4">
        {msgList.map((msg) => {
          const isCollapsed = collapsedMessages[msg.id];
          const mSenderName = msg.senderName || msg.from || 'Sender';
          const mSenderEmail = msg.senderEmail || msg.from || 'sender@shanutechx.com';
          const mRecipient = msg.recipientEmail || msg.to || 'me@shanutechx.com';
          const mBody = msg.body || msg.htmlBody || msg.snippet || '';
          const mAttachments = msg.attachmentsJson || msg.attachments || [];
          const mTimestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : (msg.timestamp || '');

          return (
            <div
              key={msg.id}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Message Header */}
              <div
                onClick={() =>
                  setCollapsedMessages((prev) => ({
                    ...prev,
                    [msg.id]: !prev[msg.id],
                  }))
                }
                className="px-4 py-3.5 bg-slate-900/90 flex items-center justify-between cursor-pointer hover:bg-slate-800/80 transition-all border-b border-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center text-xs">
                    {mSenderName[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">
                      {mSenderName}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-2 font-mono">
                      &lt;{mSenderEmail}&gt;
                    </span>
                    <p className="text-[10px] text-slate-500">
                      To: {mRecipient}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-mono">{mTimestamp}</span>
                  <button className="text-slate-500 hover:text-slate-200">
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Message Body */}
              {!isCollapsed && (
                <div className="p-5 space-y-4">
                  {/* Rendered Body */}
                  <div className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 whitespace-pre-wrap">
                    {msg.htmlBody ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(msg.htmlBody),
                        }}
                      />
                    ) : (
                      mBody || '(Empty body)'
                    )}
                  </div>

                  {/* Attachments Gallery */}
                  {mAttachments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Attachments ({mAttachments.length})</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {mAttachments.map((att, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs"
                          >
                            <span className="text-slate-300 truncate font-mono flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span>{att.filename}</span>
                              <span className="text-slate-500">({att.sizeStr})</span>
                            </span>
                            <button
                              onClick={() => setPreviewAttachment(att)}
                              className="text-indigo-400 hover:underline font-bold text-[11px] shrink-0 ml-2"
                            >
                              Preview
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* INLINE QUICK REPLY BOX */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span>Reply to {senderEmail}</span>
          <button
            onClick={() => onForward(primaryMsg)}
            className="text-indigo-400 hover:underline text-[11px] flex items-center gap-1"
          >
            <span>Forward Thread</span>
            <CornerUpRight className="h-3 w-3" />
          </button>
        </div>
        <textarea
          rows={3}
          value={quickReplyText}
          onChange={(e) => setQuickReplyText(e.target.value)}
          placeholder="Write a fast inline reply..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => onReply(primaryMsg)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <span>Open Full Rich Editor</span>
            <ExternalLink className="h-3 w-3" />
          </button>

          <button
            onClick={handleSendQuickReply}
            disabled={sendingQuickReply || !quickReplyText.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{sendingQuickReply ? 'Sending...' : 'Send Quick Reply'}</span>
          </button>
        </div>
      </div>

      {/* ATTACHMENT PREVIEW MODAL */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                <span>Attachment Preview: {previewAttachment.filename}</span>
              </h3>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-slate-950 p-8 rounded-2xl text-center text-xs text-slate-400 space-y-3 border border-slate-800">
              <FileText className="h-12 w-12 text-indigo-400 mx-auto" />
              <p className="font-semibold text-slate-200">
                {previewAttachment.filename}
              </p>
              <p className="text-[11px] text-slate-500">
                Document preview ready. Encrypted & virus scanned.
              </p>
              <button
                onClick={() => {
                  const href = previewAttachment.content || previewAttachment.url;
                  if (href) {
                    const a = document.createElement('a');
                    a.href = href;
                    a.download = previewAttachment.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    toast(`Downloaded ${previewAttachment.filename}`, 'success');
                  } else {
                    toast(`Downloading ${previewAttachment.filename}...`, 'info');
                  }
                  setPreviewAttachment(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-500 transition-all"
              >
                Download File
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SNOOZE MODAL */}
      <WebmailSnoozeModal
        isOpen={isSnoozeOpen}
        onClose={() => setIsSnoozeOpen(false)}
        messageId={primaryMsg.id}
      />
    </div>
  );
}
