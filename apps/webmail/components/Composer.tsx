'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Paperclip,
  Send,
  Clock,
  Trash2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  FileText,
  CheckCircle2,
  AlertCircle,
  File,
} from 'lucide-react';
import { api } from '../lib/api';

interface ComposerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipient?: string;
  defaultSubject?: string;
  defaultBody?: string;
  threadId?: string;
  inReplyTo?: string;
  smtpAccountId?: string;
  onSent?: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  isOpen,
  onClose,
  defaultRecipient = '',
  defaultSubject = '',
  defaultBody = '',
  threadId,
  inReplyTo,
  smtpAccountId,
  onSent,
}) => {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [readReceipt, setReadReceipt] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

  // Signatures & Canned templates
  const [signatures, setSignatures] = useState<any[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string>('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<{ filename: string; sizeStr: string; url?: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipient(defaultRecipient);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setErrorMsg(null);

      // Load signatures & templates
      api.webmail.getSignatures().then((res) => {
        setSignatures(res.signatures || []);
        const def = (res.signatures || []).find((s: any) => s.isDefault);
        if (def) setSelectedSignature(def.htmlContent);
      }).catch(() => {});

      api.webmail.getTemplates().then((res) => {
        setTemplates(res.templates || []);
      }).catch(() => {});
    }
  }, [isOpen, defaultRecipient, defaultSubject, defaultBody]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!recipient || !recipient.includes('@')) {
      setErrorMsg('Please enter a valid recipient email address.');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subject line cannot be blank.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    let finalHtml = body;
    if (selectedSignature) {
      finalHtml += `<br/><br/>--<br/>${selectedSignature}`;
    }

    try {
      await api.webmail.send({
        recipientEmail: recipient.trim(),
        subject: subject.trim(),
        htmlBody: finalHtml,
        smtpAccountId,
        threadId,
        inReplyTo,
        scheduledAt: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        readReceipt,
        attachments,
      });

      setIsSending(false);
      onClose();
      if (onSent) onSent();
    } catch (err: any) {
      setIsSending(false);
      setErrorMsg(err.message || 'Failed to send email. Check SMTP settings.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAtts = Array.from(files).map((f) => ({
      filename: f.name,
      sizeStr: (f.size / 1024).toFixed(1) + ' KB',
    }));
    setAttachments((prev) => [...prev, ...newAtts]);
  };

  const insertFormat = (tag: string) => {
    if (!bodyRef.current) return;
    const start = bodyRef.current.selectionStart;
    const end = bodyRef.current.selectionEnd;
    const selectedText = body.substring(start, end);

    let formatted = '';
    if (tag === 'b') formatted = `<b>${selectedText || 'bold text'}</b>`;
    else if (tag === 'i') formatted = `<i>${selectedText || 'italic text'}</i>`;
    else if (tag === 'u') formatted = `<u>${selectedText || 'underlined text'}</u>`;
    else if (tag === 'ul') formatted = `\n<ul>\n  <li>${selectedText || 'Item 1'}</li>\n</ul>\n`;

    const newText = body.substring(0, start) + formatted + body.substring(end);
    setBody(newText);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-6 z-50 w-72 bg-slate-900 border border-slate-700 rounded-t-xl shadow-2xl flex items-center justify-between px-4 py-3 text-slate-200 cursor-pointer" onClick={() => setIsMinimized(false)}>
        <div className="flex items-center gap-2 truncate text-sm font-semibold">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span className="truncate">{subject || 'New Message'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(false); setIsMaximized(true); }} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed z-50 transition-all duration-200 shadow-2xl flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden ${
      isMaximized
        ? 'inset-4 sm:inset-10'
        : 'bottom-0 right-4 sm:right-6 w-full max-w-2xl h-[620px] rounded-b-none border-b-0'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-slate-200 select-none">
        <span className="text-sm font-semibold flex items-center gap-2">
          <Send className="w-4 h-4 text-indigo-400" />
          {inReplyTo ? 'Reply to Thread' : 'New Email Message'}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setIsMaximized(!isMaximized)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors">
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-xs text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Recipient Fields */}
      <div className="p-3 border-b border-slate-800/80 space-y-2 text-xs bg-slate-900/50">
        <div className="flex items-center gap-2">
          <span className="w-14 text-slate-400 font-medium">To:</span>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 border-none focus:outline-none focus:ring-0 text-xs"
          />
          {!showCc && (
            <button onClick={() => setShowCc(true)} className="text-slate-400 hover:text-indigo-400 text-[11px] font-medium transition-colors">
              Cc / Bcc
            </button>
          )}
        </div>

        {showCc && (
          <>
            <div className="flex items-center gap-2 border-t border-slate-800/50 pt-1.5">
              <span className="w-14 text-slate-400 font-medium">Cc:</span>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
              />
            </div>
            <div className="flex items-center gap-2 border-t border-slate-800/50 pt-1.5">
              <span className="w-14 text-slate-400 font-medium">Bcc:</span>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 border-t border-slate-800/50 pt-2">
          <span className="w-14 text-slate-400 font-medium">Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 font-medium border-none focus:outline-none focus:ring-0 text-xs"
          />
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-slate-400 text-xs">
        <div className="flex items-center gap-1">
          <button onClick={() => insertFormat('b')} title="Bold" className="p-1 hover:bg-slate-800 rounded hover:text-slate-200">
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => insertFormat('i')} title="Italic" className="p-1 hover:bg-slate-800 rounded hover:text-slate-200">
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => insertFormat('u')} title="Underline" className="p-1 hover:bg-slate-800 rounded hover:text-slate-200">
            <Underline className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <button onClick={() => insertFormat('ul')} title="Bullet List" className="p-1 hover:bg-slate-800 rounded hover:text-slate-200">
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Templates dropdown */}
        {templates.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800"
            >
              <FileText className="w-3 h-3" /> Canned Response
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 py-1">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setBody((prev) => prev + '\n' + tpl.body);
                      if (tpl.subject && !subject) setSubject(tpl.subject);
                      setShowTemplates(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 truncate"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-3 flex flex-col min-h-0 bg-slate-900">
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Compose your message here..."
          className="flex-1 w-full bg-transparent text-slate-200 placeholder-slate-600 border-none resize-none focus:outline-none focus:ring-0 text-xs leading-relaxed font-sans"
        />

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-800 px-2.5 py-1 rounded-md text-[11px] text-slate-300 border border-slate-700">
                <File className="w-3 h-3 text-indigo-400" />
                <span className="truncate max-w-[140px]">{att.filename}</span>
                <span className="text-slate-500">({att.sizeStr})</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            {isSending ? (
              <>Sending...</>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Send
              </>
            )}
          </button>

          <label className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors" title="Attach file">
            <Paperclip className="w-4 h-4" />
            <input type="file" multiple onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className={`p-2 rounded-lg transition-colors ${scheduledDate ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            title="Schedule Send"
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {showSchedule && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-[11px] text-slate-400">Schedule:</span>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-transparent text-slate-200 text-xs border-none focus:outline-none"
              />
            </div>
          )}

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="Discard">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
