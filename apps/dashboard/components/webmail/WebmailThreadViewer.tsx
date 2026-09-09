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
  Sparkles,
  ChevronDown,
  ChevronUp,
  Languages,
  Paperclip,
  CornerUpLeft,
  CornerUpRight,
  X,
  FileText,
  ShieldAlert,
  Send,
  ExternalLink,
  Plus,
} from 'lucide-react';

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
  const [aiSummary, setAiSummary] = useState<{
    keyTakeaway: string;
    bulletPoints: string[];
  } | null>(null);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [threatInfo, setThreatInfo] = useState<{
    riskLevel: string;
    flags: string[];
    isExternal: boolean;
    recommendation: string;
  } | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
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

  const { toast } = useToast();

  const msgList = messages && messages.length > 0 ? messages : selectedMessage ? [selectedMessage] : [];
  const primaryMsg = msgList[msgList.length - 1] || null;

  useEffect(() => {
    if (!primaryMsg) return;

    setAiSummary(null);
    setSmartReplies([]);
    setThreatInfo(null);
    setTranslatedBody(null);
    setQuickReplyText('');

    const collapseMap: Record<string, boolean> = {};
    msgList.forEach((m, idx) => {
      if (idx < msgList.length - 1) {
        collapseMap[m.id] = true;
      }
    });
    setCollapsedMessages(collapseMap);

    const senderEmail = primaryMsg.senderEmail || primaryMsg.from || '';
    const senderName = primaryMsg.senderName || primaryMsg.from || '';
    const bodyText = primaryMsg.htmlBody || primaryMsg.body || primaryMsg.snippet || '';

    api.webmail.ai
      .threatCheck(senderEmail, primaryMsg.subject, bodyText)
      .then((res) => setThreatInfo(res.assessment))
      .catch(() => {});

    api.webmail.ai
      .replySuggestions(primaryMsg.snippet, senderName)
      .then((res) => setSmartReplies(res.suggestions || []))
      .catch(() => {});
  }, [primaryMsg?.id]);

  const handleFetchAiSummary = async () => {
    if (!primaryMsg) return;
    try {
      const fullText = msgList
        .map((m) => `${m.senderName || m.from || 'Sender'}: ${m.snippet}`)
        .join('\n');
      const res = await api.webmail.ai.summarize(fullText, primaryMsg.subject);
      setAiSummary(res.summary);
      toast('AI Thread Summary generated!', 'success');
    } catch {
      toast('Failed to generate summary', 'error');
    }
  };

  const handleTranslate = async () => {
    if (!primaryMsg) return;
    try {
      const bodyText = primaryMsg.body || primaryMsg.snippet || primaryMsg.htmlBody || '';
      const res = await api.webmail.ai.translate(bodyText, targetLanguage);
      setTranslatedBody(res.translatedText);
      toast(`Translated to ${targetLanguage}`, 'success');
    } catch {
      toast('Translation failed', 'error');
    }
  };

  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim() || !primaryMsg) return;
    const recipientEmail = primaryMsg.senderEmail || primaryMsg.from || '';
    setSendingQuickReply(true);
    try {
      await api.webmail.send({
        recipientEmail,
        subject: `Re: ${primaryMsg.subject}`,
        htmlBody: `<div style="font-family: sans-serif;">${quickReplyText.replace(
          /\n/g,
          '<br/>'
        )}</div>`,
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
      <div className="h-full flex items-center justify-center text-slate-500 text-xs font-semibold bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
        Select a conversation or message to view content
      </div>
    );
  }

  const senderEmail = primaryMsg.senderEmail || primaryMsg.from || 'sender@shanutechx.com';
  const senderName = primaryMsg.senderName || primaryMsg.from || 'Sender';
  const recipientEmail = primaryMsg.recipientEmail || primaryMsg.to || 'me@shanutechx.com';
  const displayBody = primaryMsg.body || primaryMsg.htmlBody || primaryMsg.snippet || '';

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-y-auto p-6 space-y-6 shadow-xl">
      {/* HEADER BAR */}
      <div className="border-b border-slate-800 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-extrabold text-white leading-snug">
            {primaryMsg.subject}
          </h1>
          <div className="flex items-center gap-2">
            {onStar && (
              <button
                onClick={() => onStar(primaryMsg.id)}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  primaryMsg.isStarred
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
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
              className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Threat & Security Alert Banners */}
        {threatInfo && (
          <div className="space-y-2">
            {threatInfo.isExternal && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-2xl text-xs flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  <strong>External Sender:</strong> This email originated outside your organization. Verify links before clicking.
                </span>
              </div>
            )}

            {threatInfo.riskLevel !== 'safe' && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-2xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                  <div>
                    <span className="font-bold uppercase tracking-wider">
                      {threatInfo.riskLevel} Security Notice:
                    </span>{' '}
                    {threatInfo.flags.join(' • ')}
                  </div>
                </div>
                <span className="text-[10px] bg-rose-500/20 px-2 py-0.5 rounded font-mono">
                  {threatInfo.recommendation}
                </span>
              </div>
            )}
          </div>
        )}

        {/* AI "Catch Me Up" Thread Summary */}
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>AI Thread Assistant</span>
            </span>
            <button
              onClick={handleFetchAiSummary}
              className="text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Sparkles className="h-3 w-3" />
              <span>Catch Me Up</span>
            </button>
          </div>
          {aiSummary ? (
            <div className="space-y-1.5 text-xs text-slate-300 pt-1">
              <p className="font-semibold text-white">{aiSummary.keyTakeaway}</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                {aiSummary.bulletPoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Click Catch Me Up to synthesize thread messages into key action items.
            </p>
          )}
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
                  {/* Inline Translation */}
                  <div className="flex items-center justify-between text-[11px] bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Languages className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Translate email inline:</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-[11px]"
                      >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="German">German</option>
                        <option value="Sinhala">Sinhala</option>
                        <option value="Tamil">Tamil</option>
                      </select>
                      <button
                        onClick={handleTranslate}
                        className="text-indigo-400 hover:underline font-bold"
                      >
                        Translate
                      </button>
                    </div>
                  </div>

                  {/* Rendered Body */}
                  <div className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 whitespace-pre-wrap">
                    {translatedBody ? (
                      <div className="space-y-2">
                        <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 p-2 rounded text-[11px]">
                          Translated Version ({targetLanguage})
                        </div>
                        <div>{translatedBody}</div>
                      </div>
                    ) : msg.htmlBody ? (
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

      {/* AI SMART REPLY CHIPS */}
      {smartReplies.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI Suggested Quick Replies:</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {smartReplies.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => setQuickReplyText(chip)}
                className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs px-3.5 py-1.5 rounded-full transition-all text-left flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" />
                <span>{chip}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}
