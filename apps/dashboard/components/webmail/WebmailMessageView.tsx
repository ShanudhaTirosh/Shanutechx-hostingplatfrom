'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  Star, Archive, Trash2, MoreVertical, Reply, ReplyAll, Forward, ChevronDown,
  ChevronUp, Shield, Wand2, Languages, ChevronRight, ExternalLink, Paperclip,
  Tag, Clock, Check, X, Copy, Printer,
} from 'lucide-react';
import { WebmailMessage, WebmailThread } from '@/lib/types';

interface WebmailMessageViewProps {
  isThreaded: boolean;
  selectedMessage: WebmailMessage | null;
  selectedThread: WebmailThread | null;
  threadMessages: WebmailMessage[];
  onOpenReply: (msg: WebmailMessage, mode: 'reply' | 'replyAll' | 'forward') => void;
  onOpenCompose: () => void;
  onToggleStar: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onArchiveMessage: (id: string) => void;
}

function getInitials(name: string) {
  return (name || '?').split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface MessageBubbleProps {
  msg: WebmailMessage;
  defaultExpanded?: boolean;
  onReply: (msg: WebmailMessage, mode: 'reply' | 'replyAll' | 'forward') => void;
  onToggleStar: (id: string) => void;
}

function MessageBubble({ msg, defaultExpanded = true, onReply, onToggleStar }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showThreatCheck, setShowThreatCheck] = useState(false);
  const [threatResult, setThreatResult] = useState<any>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const { toast } = useToast();

  const checkThreat = async () => {
    try {
      const res = await api.webmail.ai.threatCheck({
        senderEmail: msg.senderEmail,
        subject: msg.subject,
        body: msg.textBody || '',
      });
      setThreatResult(res.assessment);
      setShowThreatCheck(true);
    } catch {
      toast('Threat check failed', 'error');
    }
  };

  const translateMsg = async () => {
    setTranslating(true);
    try {
      const res = await api.webmail.ai.translate({ text: msg.textBody || msg.htmlBody || '' });
      setTranslatedBody(res.translatedText);
    } catch {
      toast('Translation failed', 'error');
    } finally {
      setTranslating(false);
    }
  };

  const summarize = async () => {
    setSummarizing(true);
    try {
      const res = await api.webmail.ai.summarize({
        threadBody: msg.textBody || msg.htmlBody || '',
        subject: msg.subject,
      });
      setAiSummary(
        typeof res.summary === 'string'
          ? res.summary
          : res.summary?.summary || JSON.stringify(res.summary)
      );
    } catch {
      toast('Summarize failed', 'error');
    } finally {
      setSummarizing(false);
    }
  };

  const AVATAR_GRADIENTS = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-400',
    'from-rose-500 to-pink-500',
  ];
  const grad = AVATAR_GRADIENTS[(msg.senderEmail || '').charCodeAt(0) % AVATAR_GRADIENTS.length];

  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#1a1a26] transition-all">
      {/* Bubble Header */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {getInitials(msg.senderName || msg.senderEmail || '')}

        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{msg.senderName || msg.senderEmail}</span>
            <span className="text-xs text-slate-500 truncate">&lt;{msg.senderEmail}&gt;</span>
            <span className="text-xs text-slate-500 ml-auto shrink-0">{relativeTime(msg.createdAt || msg.timestamp || '')}</span>

          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            To: {msg.recipientEmail}
            {!expanded && <span className="ml-3 text-slate-600 truncate">{(msg.textBody || '').slice(0, 80)}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleStar(msg.id)}
            className={`p-1.5 rounded-lg transition-all ${msg.isStarred ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}
          >
            <Star className="h-3.5 w-3.5" fill={msg.isStarred ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => onReply(msg, 'reply')} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-200 transition-all">
            <Reply className="h-3.5 w-3.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-200 transition-all"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-[#1e1e2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
                {[
                  { label: 'Reply All', icon: ReplyAll, action: () => { onReply(msg, 'replyAll'); setShowMore(false); } },
                  { label: 'Forward', icon: Forward, action: () => { onReply(msg, 'forward'); setShowMore(false); } },
                  { label: 'Summarize', icon: Wand2, action: () => { summarize(); setShowMore(false); } },
                  { label: 'Translate', icon: Languages, action: () => { translateMsg(); setShowMore(false); } },
                  { label: 'Check Threats', icon: Shield, action: () => { checkThreat(); setShowMore(false); } },
                  { label: 'Copy Email', icon: Copy, action: () => { navigator.clipboard.writeText(msg.senderEmail || ''); setShowMore(false); } },
                ].map(({ label, icon: Icon, action }) => (
                  <button key={label} onClick={action} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                    <Icon className="h-3.5 w-3.5 text-slate-500" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-6 pb-4">
          {/* AI Summary bar */}
          {(summarizing || aiSummary) && (
            <div className="flex items-start gap-2 bg-violet-600/10 border border-violet-500/20 rounded-xl px-3 py-2.5 mb-4 text-xs text-violet-300">
              <Wand2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-400" />
              {summarizing ? <span>Summarizing…</span> : <span>{aiSummary}</span>}
              {aiSummary && (
                <button onClick={() => setAiSummary(null)} className="ml-auto text-violet-500 hover:text-violet-300">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Threat Check */}
          {showThreatCheck && threatResult && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs border ${
              threatResult.riskLevel === 'low'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : threatResult.riskLevel === 'medium'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}>
              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold capitalize">{threatResult.riskLevel} Risk</span>
                {threatResult.reasons?.length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-[10px] opacity-75">
                    {threatResult.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
              <button onClick={() => setShowThreatCheck(false)} className="ml-auto opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Translated notice */}
          {translatedBody && (
            <div className="mb-3 p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-300 flex items-center gap-2">
              <Languages className="h-3.5 w-3.5" />
              Translated from original
              <button onClick={() => setTranslatedBody(null)} className="ml-auto text-sky-500 hover:text-sky-300">
                Show original
              </button>
            </div>
          )}
          {translating && <div className="text-xs text-sky-400 mb-2">Translating…</div>}

          {/* Message body */}
          {msg.htmlBody ? (
            <div
              className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed webmail-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(translatedBody || msg.htmlBody) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
              {translatedBody || msg.textBody || '(No content)'}
            </pre>
          )}

          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Paperclip className="h-3 w-3" />
                Attachments ({msg.attachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {msg.attachments.map((att: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs">
                    <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-slate-300 font-medium">{att.filename}</span>
                    <span className="text-slate-500">{att.sizeStr}</span>
                    {att.url && (
                      <a href={att.url} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reply quick actions */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => onReply(msg, 'reply')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
            <button
              onClick={() => onReply(msg, 'replyAll')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <ReplyAll className="h-3.5 w-3.5" />
              Reply All
            </button>
            <button
              onClick={() => onReply(msg, 'forward')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <Forward className="h-3.5 w-3.5" />
              Forward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function WebmailMessageView({
  isThreaded,
  selectedMessage,
  selectedThread,
  threadMessages,
  onOpenReply,
  onOpenCompose,
  onToggleStar,
  onDeleteMessage,
  onArchiveMessage,
}: WebmailMessageViewProps) {
  if (!selectedMessage && !selectedThread) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-[#0f0f13]">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-600/10 to-indigo-600/10 border border-white/5 flex items-center justify-center mb-5">
          <Reply className="h-8 w-8 text-slate-700" />
        </div>
        <h3 className="text-base font-bold text-slate-400">Nothing selected</h3>
        <p className="text-sm text-slate-600 mt-1 max-w-xs">
          Select a message or thread to read it here
        </p>
        <button
          onClick={onOpenCompose}
          className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20"
        >
          Compose New Email
        </button>
      </div>
    );
  }

  const threadTitle = isThreaded
    ? selectedThread?.subject
    : selectedMessage?.subject;

  const messages = isThreaded ? threadMessages : (selectedMessage ? [selectedMessage] : []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0f0f13]">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-[#13131a] shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white truncate">{threadTitle || '(No Subject)'}</h2>
          {isThreaded && selectedThread && (
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedThread.messageCount} message{selectedThread.messageCount > 1 ? 's' : ''} · {selectedThread.participants?.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onToggleStar(isThreaded ? selectedThread?.threadId || '' : selectedMessage?.id || '')}
            className={`p-2 rounded-xl transition-all ${
              (isThreaded ? selectedThread?.isStarred : selectedMessage?.isStarred)
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-slate-600 hover:text-amber-400 hover:bg-amber-400/10'
            }`}
          >
            <Star className="h-4 w-4" fill={(isThreaded ? selectedThread?.isStarred : selectedMessage?.isStarred) ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => onArchiveMessage(isThreaded ? selectedThread?.threadId || '' : selectedMessage?.id || '')}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDeleteMessage(isThreaded ? selectedThread?.threadId || '' : selectedMessage?.id || '')}
            className="p-2 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-xl text-slate-600 hover:text-slate-200 hover:bg-white/5 transition-all">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            defaultExpanded={i === messages.length - 1}
            onReply={onOpenReply}
            onToggleStar={onToggleStar}
          />
        ))}
      </div>
    </div>
  );
}
