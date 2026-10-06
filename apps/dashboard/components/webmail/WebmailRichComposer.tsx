'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import {
  X, Minimize2, Maximize2, Send, Bold, Italic, Underline, Link2,
  Paperclip, Smile, ChevronDown, Plus, Trash2, Clock,
  AlertCircle,
} from 'lucide-react';

interface WebmailRichComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultSmtpAccountId?: string;
  replyToMessageId?: string;
  replyToThreadId?: string;
}

export function WebmailRichComposer({
  isOpen,
  onClose,
  onSent,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  defaultSmtpAccountId,
  replyToMessageId,
  replyToThreadId,
}: WebmailRichComposerProps) {
  const { toast } = useToast();

  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [selectedSig, setSelectedSig] = useState<string>('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [toChips, setToChips] = useState<string[]>([]);
  const [toInput, setToInput] = useState(defaultTo);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setToInput(defaultTo);
      setToChips(defaultTo ? [defaultTo] : []);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setShowCc(false);
      setShowBcc(false);
      setMinimized(false);
      api.webmail.signatures.list().then((r) => setSignatures(r.signatures || [])).catch(() => {});
      api.webmail.templates.list().then((r) => setTemplates(r.templates || [])).catch(() => {});
    }
  }, [isOpen, defaultTo, defaultSubject, defaultBody]);

  const addToChip = (val: string) => {
    const email = val.trim();
    if (email && !toChips.includes(email)) {
      setToChips((prev) => [...prev, email]);
    }
    setToInput('');
  };

  const removeToChip = (email: string) => setToChips((prev) => prev.filter((e) => e !== email));

  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const [undoTimerId, setUndoTimerId] = useState<any>(null);

  const insertVariable = (varName: string) => {
    setBody((prev) => `${prev} {{${varName}}}`);
  };

  const cancelUndoSend = () => {
    if (undoTimerId) clearInterval(undoTimerId);
    setUndoCountdown(null);
    setUndoTimerId(null);
    setSending(false);
    toast('Send cancelled!', 'info');
  };

  const handleSend = async () => {
    const recipientEmail = toChips[0] || toInput.trim();
    if (!recipientEmail) {
      toast('Please enter a recipient', 'error');
      return;
    }
    if (!subject.trim()) {
      toast('Please enter a subject', 'error');
      return;
    }
    setSending(true);

    // 5-second Undo Send countdown
    let count = 5;
    setUndoCountdown(count);

    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setUndoCountdown(count);
      } else {
        clearInterval(timer);
        setUndoCountdown(null);
        executeActualSend(recipientEmail);
      }
    }, 1000);

    setUndoTimerId(timer);
  };

  const executeActualSend = async (recipientEmail: string) => {
    try {
      const htmlBody = body.replace(/\n/g, '<br/>');
      const sigContent = signatures.find((s) => s.id === selectedSig);
      const finalHtml = sigContent ? `${htmlBody}<br/><br/><hr/>${sigContent.htmlContent}` : htmlBody;

      await api.webmail.sendMessage({
        recipientEmail,
        subject,
        htmlBody: finalHtml,
        smtpAccountId: defaultSmtpAccountId,
        threadId: replyToThreadId,
        inReplyTo: replyToMessageId,
        scheduledAt: scheduledAt || undefined,
      });

      toast(scheduledAt ? 'Email scheduled!' : 'Email sent successfully!', 'success');
      onSent();
    } catch (err: any) {
      toast(err.message || 'Failed to send email', 'error');
    } finally {
      setSending(false);
    }
  };

  const applyFormat = (tag: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    const wrapped = `<${tag}>${selected}</${tag}>`;
    setBody(body.slice(0, start) + wrapped + body.slice(end));
  };

  if (!isOpen) return null;

  const panelClass = maximized
    ? 'fixed inset-4 z-50 rounded-2xl'
    : minimized
    ? 'fixed bottom-4 right-4 z-50 w-80 rounded-2xl overflow-hidden'
    : 'fixed bottom-4 right-4 z-50 w-[560px] rounded-2xl';

  return (
    <div className={`${panelClass} bg-[#1a1a26] border border-white/10 shadow-2xl shadow-black/50 flex flex-col transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1e1e2e] border-b border-white/10 rounded-t-2xl">
        <span className="text-xs font-bold text-white flex-1 truncate">
          {subject ? subject : 'New Message'}
        </span>
        <button
          onClick={() => setMinimized(!minimized)}
          aria-label={minimized ? "Expand composer" : "Minimize composer"}
          className="text-slate-400 hover:text-white transition-all p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setMaximized(!maximized)}
          aria-label={maximized ? "Restore composer size" : "Maximize composer"}
          className="text-slate-400 hover:text-white transition-all p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          aria-label="Close composer"
          className="text-slate-400 hover:text-rose-400 transition-all p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Fields */}
          <div className="border-b border-white/5">
            {/* To field with chips */}
            <div className="flex items-start gap-2 px-4 py-2.5 border-b border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-1 w-8 shrink-0">To</span>
              <div className="flex-1 flex flex-wrap gap-1 items-center">
                {toChips.map((chip) => (
                  <span key={chip} className="flex items-center gap-1 bg-violet-600/25 text-violet-200 text-[11px] px-2 py-0.5 rounded-full ring-1 ring-violet-500/30">
                    {chip}
                    <button onClick={() => removeToChip(chip)} aria-label={`Remove ${chip}`} className="text-violet-300 hover:text-white ml-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addToChip(toInput); }
                    if (e.key === 'Backspace' && !toInput && toChips.length > 0) {
                      setToChips((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => toInput.trim() && addToChip(toInput)}
                  placeholder="recipient@example.com"
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 outline-none min-w-[140px]"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pt-1">
                {!showCc && (
                  <button onClick={() => setShowCc(true)} className="text-[10px] text-slate-400 hover:text-violet-300 font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/60">Cc</button>
                )}
                {!showBcc && (
                  <button onClick={() => setShowBcc(true)} className="text-[10px] text-slate-400 hover:text-violet-300 font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/60">Bcc</button>
                )}
              </div>
            </div>

            {showCc && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8 shrink-0">Cc</span>
                <input
                  type="text" value={cc} onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 outline-none"
                />
              </div>
            )}

            {showBcc && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8 shrink-0">Bcc</span>
                <input
                  type="text" value={bcc} onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8 shrink-0">Re</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                className="flex-1 bg-transparent text-xs font-semibold text-white placeholder-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-[#1c1c28]">
            <button onClick={() => applyFormat('b')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all" title="Bold">
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => applyFormat('i')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all" title="Italic">
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => applyFormat('u')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all" title="Underline">
              <Underline className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-white/10 mx-0.5" />
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all" title="Insert Link">
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all" title="Attach File">
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all" title="Emoji">
              <Smile className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1" />
            {/* Templates picker */}
            {templates.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="text-[10px] text-slate-500 hover:text-violet-300 flex items-center gap-1 transition-all"
                >
                  Templates <ChevronDown className="h-3 w-3" />
                </button>
                {showTemplates && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#1e1e2e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          if (t.subject) setSubject(t.subject);
                          setBody(t.body);
                          setShowTemplates(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>



          {/* Body */}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here…"
            className={`flex-1 w-full bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none resize-none px-4 py-3 leading-relaxed ${maximized ? 'min-h-[400px]' : 'min-h-[200px]'}`}
          />

          {/* Signature select */}
          {signatures.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5">
              <select
                value={selectedSig}
                onChange={(e) => setSelectedSig(e.target.value)}
                className="text-[10px] bg-transparent text-slate-500 outline-none cursor-pointer"
              >
                <option value="">No signature</option>
                {signatures.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {undoCountdown !== null && (
            <div className="mx-4 mb-2 p-2.5 rounded-xl bg-indigo-900/80 border border-indigo-500/40 text-xs text-white flex items-center justify-between animate-pulse">
              <span>Sending in {undoCountdown}s…</span>
              <button
                onClick={cancelUndoSend}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Undo Send
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/5 bg-[#1e1e2e] rounded-b-2xl">
            <button
              onClick={handleSend}
              disabled={sending || undoCountdown !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 disabled:opacity-50 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? (undoCountdown !== null ? `Sending in ${undoCountdown}s` : 'Sending…') : (scheduledAt ? 'Schedule Send' : 'Send')}
            </button>

            {/* Schedule send */}
            <div className="relative">
              <button
                onClick={() => setScheduleOpen(!scheduleOpen)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all"
                title="Schedule send"
              >
                <Clock className="h-4 w-4" />
              </button>
              {scheduleOpen && (
                <div className="absolute bottom-full left-0 mb-2 bg-[#1e1e2e] border border-white/10 rounded-xl p-3 shadow-xl w-56">
                  <p className="text-[10px] font-bold text-slate-400 mb-2">Schedule for:</p>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-[#13131a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                  />
                  {scheduledAt && (
                    <button
                      onClick={() => { setScheduledAt(''); setScheduleOpen(false); }}
                      className="mt-2 text-[10px] text-rose-400 hover:text-rose-300"
                    >
                      Clear schedule
                    </button>
                  )}
                </div>
              )}
            </div>

            <button className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all" title="Attach File">
              <Paperclip className="h-4 w-4" />
            </button>

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Discard"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
