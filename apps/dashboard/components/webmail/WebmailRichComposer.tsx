'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import {
  Sparkles,
  Paperclip,
  Clock,
  Send,
  X,
  Bold,
  Italic,
  List,
  FileText,
  Minimize2,
  Maximize2,
  Undo2,
} from 'lucide-react';

interface WebmailRichComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  defaultRecipient?: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  fromEmail?: string;
  threadId?: string;
  inReplyTo?: string;
}

export function WebmailRichComposer({
  isOpen,
  onClose,
  onSent,
  defaultRecipient = '',
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  fromEmail,
  threadId,
  inReplyTo,
}: WebmailRichComposerProps) {
  const initialTo = defaultTo || defaultRecipient;
  const [recipient, setRecipient] = useState(initialTo);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [isPlainHtml, setIsPlainHtml] = useState(false);

  const [attachments, setAttachments] = useState<
    Array<{ filename: string; sizeStr: string; url?: string }>
  >([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('');

  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  const [showAiDraftModal, setShowAiDraftModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [generatingAi, setGeneratingAi] = useState(false);

  const [undoTimer, setUndoTimer] = useState<number | null>(null);
  const [pendingSendPayload, setPendingSendPayload] = useState<any | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setRecipient(initialTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
      api.webmail.signatures
        .list()
        .then((res) => {
          setSignatures(res.signatures || []);
          const def = res.signatures?.find((s: any) => s.isDefault);
          if (def) {
            setSelectedSignatureId(def.id);
            setBody(
              (prev) =>
                prev + `\n\n---\n${def.htmlContent.replace(/<[^>]+>/g, '')}`
            );
          }
        })
        .catch(() => {});

      api.webmail.templates
        .list()
        .then((res) => setTemplates(res.templates || []))
        .catch(() => {});
    }
  }, [isOpen, initialTo, defaultSubject, defaultBody]);

  useEffect(() => {
    if (undoTimer === null) return;
    if (undoTimer <= 0) {
      executeActualSend();
      return;
    }
    const interval = setInterval(
      () => setUndoTimer((t) => (t !== null ? t - 1 : null)),
      1000
    );
    return () => clearInterval(interval);
  }, [undoTimer]);

  if (!isOpen) return null;

  const handleApplySignature = (sigId: string) => {
    const sig = signatures.find((s) => s.id === sigId);
    if (sig) {
      setSelectedSignatureId(sigId);
      const cleanSig = sig.htmlContent.replace(/<[^>]+>/g, '');
      setBody((prev) => `${prev}\n\n---\n${cleanSig}`);
    }
  };

  const handleApplyTemplate = (tempId: string) => {
    const temp = templates.find((t) => t.id === tempId);
    if (temp) {
      if (temp.subject) setSubject(temp.subject);
      setBody(temp.body);
      toast(`Template "${temp.name}" applied!`, 'info');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAtts: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newAtts.push({
        filename: file.name,
        sizeStr: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      });
    }
    setAttachments((prev) => [...prev, ...newAtts]);
    toast(`Attached ${files.length} file(s)`, 'success');
  };

  const handleGenerateAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingAi(true);
    try {
      const res = await api.webmail.ai.draft(
        aiPrompt,
        aiTone,
        recipient.split('@')[0] || 'Team'
      );
      if (res.draft) {
        setSubject(res.draft.subject);
        setBody(res.draft.body);
        setShowAiDraftModal(false);
        setAiPrompt('');
        toast('AI draft generated successfully!', 'success');
      }
    } catch {
      toast('Failed to generate draft', 'error');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSendClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !subject || !body) {
      toast('Recipient, subject, and email body are required.', 'error');
      return;
    }

    const payload = {
      recipientEmail: recipient,
      subject,
      htmlBody: isPlainHtml
        ? body.replace(/\n/g, '<br/>')
        : `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(
            /\n/g,
            '<br/>'
          )}</div>`,
      threadId,
      inReplyTo,
      scheduledAt: scheduledDate || undefined,
      attachments,
    };

    setPendingSendPayload(payload);
    setUndoTimer(10);
  };

  const cancelUndoSend = () => {
    setUndoTimer(null);
    setPendingSendPayload(null);
    toast('Send cancelled! Returning to draft composer.', 'info');
  };

  const executeActualSend = async () => {
    if (!pendingSendPayload) return;
    setSending(true);
    setUndoTimer(null);
    try {
      await api.webmail.send(pendingSendPayload);
      toast(
        pendingSendPayload.scheduledAt
          ? 'Email scheduled successfully!'
          : 'Email dispatched successfully!',
        'success'
      );
      if (onSent) onSent();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Failed to send email', 'error');
    } finally {
      setSending(false);
      setPendingSendPayload(null);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await api.webmail.saveDraft({
        recipientEmail: recipient,
        subject,
        htmlBody: body,
      });
      toast('Draft saved to Drafts folder!', 'info');
      onClose();
    } catch {
      toast('Failed to save draft', 'error');
    }
  };

  return (
    <>
      {/* UNDO SEND TOAST BANNER */}
      {undoTimer !== null && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 border border-indigo-500/40 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
          <div className="text-xs">
            <p className="font-bold">Sending email to {recipient}...</p>
            <p className="text-[11px] text-slate-300">
              Dispatching in{' '}
              <span className="font-extrabold text-amber-400 font-mono">
                {undoTimer}s
              </span>
            </p>
          </div>
          <button
            onClick={cancelUndoSend}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow flex items-center gap-1"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>Undo Send</span>
          </button>
        </div>
      )}

      {/* COMPOSER DOCKABLE WINDOW */}
      <div
        className={`fixed bottom-0 right-6 z-40 w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-t-3xl shadow-2xl transition-all ${
          minimized ? 'h-14 overflow-hidden' : 'h-[620px]'
        }`}
      >
        {/* Composer Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800 rounded-t-3xl">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>
              {subject ? subject : 'New Message'}
              {fromEmail && (
                <span className="text-slate-400 font-normal ml-2 text-[11px]">
                  (From: {fromEmail})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <button
              onClick={() => setShowAiDraftModal(true)}
              className="text-indigo-400 hover:underline font-bold flex items-center gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Draft</span>
            </button>
            <button
              onClick={() => setMinimized(!minimized)}
              className="hover:text-white p-1"
            >
              {minimized ? (
                <Maximize2 className="h-3.5 w-3.5" />
              ) : (
                <Minimize2 className="h-3.5 w-3.5" />
              )}
            </button>
            <button onClick={onClose} className="hover:text-white p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!minimized && (
          <form
            onSubmit={handleSendClick}
            className="flex flex-col h-[calc(100%-56px)] p-5 space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <input
                  type="email"
                  placeholder="To: recipient@domain.com"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="text-[11px] text-slate-400 hover:text-indigo-400 font-bold"
                >
                  CC/BCC
                </button>
              </div>

              {showCcBcc && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="CC: recipient@domain.com"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="BCC: recipient@domain.com"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="border-b border-slate-800/80 pb-2">
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBody((b) => b + ' **bold** ')}
                  className="p-1.5 bg-slate-800 rounded text-slate-300 hover:text-white"
                  title="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setBody((b) => b + ' *italic* ')}
                  className="p-1.5 bg-slate-800 rounded text-slate-300 hover:text-white"
                  title="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setBody((b) => b + '\n- Item ')}
                  className="p-1.5 bg-slate-800 rounded text-slate-300 hover:text-white"
                  title="List"
                >
                  <List className="h-3.5 w-3.5" />
                </button>

                {templates.length > 0 && (
                  <select
                    onChange={(e) => handleApplyTemplate(e.target.value)}
                    className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-0.5 text-[11px]"
                  >
                    <option value="">Insert Template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}

                {signatures.length > 0 && (
                  <select
                    value={selectedSignatureId}
                    onChange={(e) => handleApplySignature(e.target.value)}
                    className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-0.5 text-[11px]"
                  >
                    <option value="">Select Signature...</option>
                    {signatures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPlainHtml}
                    onChange={(e) => setIsPlainHtml(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600"
                  />
                  <span>Plain Text</span>
                </label>
              </div>
            </div>

            <textarea
              rows={8}
              placeholder="Write your email here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-sans"
              required
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((att, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-900 text-indigo-300 text-[11px] px-2.5 py-1 rounded-xl border border-slate-800 flex items-center gap-1.5"
                  >
                    <FileText className="h-3 w-3" />
                    <span>
                      {att.filename} ({att.sizeStr})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {showSchedulePicker && (
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Schedule Date/Time:</span>
                </span>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="bg-slate-800 text-slate-200 border border-slate-700 rounded p-1 text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attach</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                  className="text-slate-400 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="text-slate-400 hover:text-indigo-400 text-xs font-semibold flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Save Draft</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {scheduledDate ? 'Schedule Mail' : 'Send Message'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* AI PROMPT-TO-EMAIL DRAFT MODAL */}
      {showAiDraftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>AI Draft Generator</span>
              </h3>
              <button
                onClick={() => setShowAiDraftModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="text-slate-400 block">
                Describe what you want to write (e.g. &quot;Polite decline for meeting proposal next Tuesday&quot;):
              </label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Type your prompt here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Select Tone:</span>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-3 py-1 text-xs"
                >
                  <option value="professional">Professional</option>
                  <option value="polite_decline">Polite Decline</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAiDraftModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={generatingAi || !aiPrompt.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    {generatingAi ? 'Generating...' : 'Generate Email Draft'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
