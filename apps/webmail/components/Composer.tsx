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
  UploadCloud,
  Lock,
  ChevronDown,
  User,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';

export interface AttachmentItem {
  filename: string;
  sizeStr: string;
  url?: string;
  content?: string;
  contentType?: string;
}

interface ComposerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipient?: string;
  defaultCc?: string;
  defaultBcc?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultAttachments?: AttachmentItem[];
  threadId?: string;
  inReplyTo?: string;
  smtpAccountId?: string;
  availableSenders?: { email: string; label: string }[];
  onSent?: () => void;
  onRequestUndoSend?: (payload: any) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  isOpen,
  onClose,
  defaultRecipient = '',
  defaultCc = '',
  defaultBcc = '',
  defaultSubject = '',
  defaultBody = '',
  defaultAttachments = [],
  threadId,
  inReplyTo,
  smtpAccountId,
  availableSenders = [],
  onSent,
  onRequestUndoSend,
}) => {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [showCc, setShowCc] = useState(!!defaultCc || !!defaultBcc);
  const [cc, setCc] = useState(defaultCc);
  const [bcc, setBcc] = useState(defaultBcc);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [readReceipt, setReadReceipt] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Selected from identity (aliases / mailboxes)
  const [selectedFromEmail, setSelectedFromEmail] = useState<string>('');

  // Confidential mode
  const [isConfidential, setIsConfidential] = useState(false);
  const [confidentialDays, setConfidentialDays] = useState(7);

  // Draft saving state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Contact Autocomplete Suggestions
  const [contactSuggestions, setContactSuggestions] = useState<{ name: string; email: string }[]>([]);
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null);

  // Signatures & Canned templates
  const [signatures, setSignatures] = useState<any[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string>('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<AttachmentItem[]>(defaultAttachments);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipient(defaultRecipient);
      setCc(defaultCc);
      setBcc(defaultBcc);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setAttachments(defaultAttachments || []);
      setErrorMsg(null);
      setDraftStatus('');
      setDraftId(null);

      if (availableSenders.length > 0) {
        setSelectedFromEmail(availableSenders[0].email);
      }

      // Load signatures & templates
      api.webmail
        .getSignatures()
        .then((res) => {
          setSignatures(res.signatures || []);
          const def = (res.signatures || []).find((s: any) => s.isDefault);
          if (def) setSelectedSignature(def.htmlContent);
        })
        .catch(() => {});

      api.webmail
        .getTemplates()
        .then((res) => {
          setTemplates(res.templates || []);
        })
        .catch(() => {});
    }
  }, [isOpen, defaultRecipient, defaultCc, defaultBcc, defaultSubject, defaultBody, defaultAttachments, availableSenders]);

  // Debounced Auto-save draft every 3 seconds while typing
  useEffect(() => {
    if (!isOpen) return;
    if (!subject.trim() && !body.trim() && !recipient.trim()) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setDraftStatus('Saving draft...');
        const res = await api.webmail.saveDraft({
          id: draftId || undefined,
          recipientEmail: recipient.trim(),
          subject: subject.trim() || '(Draft)',
          htmlBody: body,
          smtpAccountId,
        });
        if (res?.draft?.id) {
          setDraftId(res.draft.id);
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setDraftStatus(`Saved at ${nowStr}`);
        }
      } catch (_) {
        setDraftStatus('');
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [recipient, subject, body, isOpen, draftId]);

  // Contact suggestion query debounced
  const handleQuerySuggestions = async (val: string, field: 'to' | 'cc' | 'bcc') => {
    setActiveField(field);
    const trimmed = val.trim();
    if (!trimmed || trimmed.includes(',')) {
      setContactSuggestions([]);
      return;
    }
    try {
      const res = await api.webmail.suggestContacts(trimmed);
      setContactSuggestions(res.suggestions || []);
    } catch {
      setContactSuggestions([]);
    }
  };

  const handleSelectSuggestion = (email: string) => {
    if (activeField === 'to') setRecipient(email);
    else if (activeField === 'cc') setCc(email);
    else if (activeField === 'bcc') setBcc(email);
    setContactSuggestions([]);
    setActiveField(null);
  };

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

    let finalHtml = body;
    if (isConfidential) {
      finalHtml = `
        <div style="border: 2px dashed #6366f1; padding: 12px; border-radius: 8px; margin-bottom: 16px; background-color: #f8fafc; font-size: 12px; color: #475569;">
          <strong>Confidential Email Notice:</strong> This message expires in ${confidentialDays} days. Please do not forward or copy without authorization.
        </div>
        ${finalHtml}
      `;
    }

    if (selectedSignature) {
      finalHtml += `<br/><br/>--<br/>${selectedSignature}`;
    }

    const payload = {
      recipientEmail: recipient.trim(),
      fromEmail: selectedFromEmail || undefined,
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      subject: subject.trim(),
      htmlBody: finalHtml,
      smtpAccountId,
      threadId,
      inReplyTo,
      scheduledAt: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
      readReceipt,
      attachments,
      draftId,
    };

    if (onRequestUndoSend) {
      // Delegate to layout's 5s Undo-Send buffer
      onRequestUndoSend(payload);
      onClose();
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    try {
      await api.webmail.send(payload);
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
    addFiles(Array.from(files));
  };

  const addFiles = async (files: File[]) => {
    const filePromises = files.map((f) => {
      return new Promise<AttachmentItem>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            filename: f.name,
            sizeStr: (f.size / 1024).toFixed(1) + ' KB',
            contentType: f.type || 'application/octet-stream',
            content: reader.result as string,
          });
        };
        reader.onerror = () => {
          resolve({
            filename: f.name,
            sizeStr: (f.size / 1024).toFixed(1) + ' KB',
            contentType: f.type || 'application/octet-stream',
          });
        };
        reader.readAsDataURL(f);
      });
    });
    const newAtts = await Promise.all(filePromises);
    setAttachments((prev) => [...prev, ...newAtts]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
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
    else if (tag === 'ol') formatted = `\n<ol>\n  <li>${selectedText || 'Item 1'}</li>\n</ol>\n`;

    const newText = body.substring(0, start) + formatted + body.substring(end);
    setBody(newText);
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-0 right-2 sm:right-6 z-50 w-64 sm:w-72 bg-[#171717] border border-white/20 rounded-t-xl shadow-2xl flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 text-white cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-2 truncate text-sm font-semibold">
          <FileText className="w-4 h-4 text-white" />
          <span className="truncate">{subject || 'New Message'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
              setIsMaximized(true);
            }}
            className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`fixed z-50 transition-all duration-200 shadow-2xl flex flex-col bg-[#171717] border border-white/15 overflow-hidden ${
        isMaximized
          ? 'inset-0 sm:inset-6 md:inset-10 sm:rounded-xl'
          : 'inset-0 sm:inset-auto sm:bottom-0 sm:right-6 sm:w-full sm:max-w-2xl sm:h-[620px] sm:rounded-t-xl sm:rounded-b-none sm:border-b-0'
      }`}
    >
      {/* Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 border-2 border-dashed border-white flex flex-col items-center justify-center space-y-2 pointer-events-none">
          <UploadCloud className="w-10 h-10 text-white animate-bounce" />
          <p className="text-sm font-bold text-white">Drop files to attach to email</p>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-white/10 text-white select-none">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold">
            {inReplyTo ? 'Reply to Thread' : 'New Email Message'}
          </span>
          {draftStatus && (
            <span className="text-[10px] text-neutral-500 font-normal ml-2">
              {draftStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors hidden sm:inline-flex"
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors hidden sm:inline-flex"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-xs text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Recipient & From Fields */}
      <div className="p-3 border-b border-white/10 space-y-2 text-xs bg-[#0a0a0a] relative">
        {/* From Identity Selector (if aliases exist) */}
        {availableSenders.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="w-14 text-neutral-400 font-medium">From:</span>
            <select
              value={selectedFromEmail}
              onChange={(e) => setSelectedFromEmail(e.target.value)}
              className="flex-1 bg-black border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white"
            >
              {availableSenders.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.label} ({s.email})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* To Field with Autocomplete */}
        <div className="flex items-center gap-2 relative">
          <span className="w-14 text-neutral-400 font-medium">To:</span>
          <input
            type="email"
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              handleQuerySuggestions(e.target.value, 'to');
            }}
            placeholder="recipient@example.com"
            className="flex-1 bg-transparent text-white placeholder-neutral-500 border-none focus:outline-none focus:ring-0 text-xs"
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="text-neutral-400 hover:text-white text-[11px] font-medium transition-colors"
            >
              Cc / Bcc
            </button>
          )}

          {/* Autocomplete Suggestions Menu */}
          {activeField === 'to' && contactSuggestions.length > 0 && (
            <div className="absolute left-16 top-full mt-1 w-64 bg-[#171717] border border-white/15 rounded-lg shadow-2xl z-50 py-1 text-xs">
              {contactSuggestions.map((c, i) => (
                <button
                  key={i}
                  onMouseDown={() => handleSelectSuggestion(c.email)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 text-left"
                >
                  <span className="font-semibold text-white truncate">{c.name}</span>
                  <span className="text-[10px] text-neutral-400 truncate">{c.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {showCc && (
          <>
            <div className="flex items-center gap-2 border-t border-white/5 pt-1.5 relative">
              <span className="w-14 text-neutral-400 font-medium">Cc:</span>
              <input
                type="text"
                value={cc}
                onChange={(e) => {
                  setCc(e.target.value);
                  handleQuerySuggestions(e.target.value, 'cc');
                }}
                placeholder="cc@example.com"
                className="flex-1 bg-transparent text-white placeholder-neutral-500 focus:outline-none text-xs"
              />
              {activeField === 'cc' && contactSuggestions.length > 0 && (
                <div className="absolute left-16 top-full mt-1 w-64 bg-[#171717] border border-white/15 rounded-lg shadow-2xl z-50 py-1 text-xs">
                  {contactSuggestions.map((c, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSelectSuggestion(c.email)}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 text-left"
                    >
                      <span className="font-semibold text-white truncate">{c.name}</span>
                      <span className="text-[10px] text-neutral-400 truncate">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-white/5 pt-1.5 relative">
              <span className="w-14 text-neutral-400 font-medium">Bcc:</span>
              <input
                type="text"
                value={bcc}
                onChange={(e) => {
                  setBcc(e.target.value);
                  handleQuerySuggestions(e.target.value, 'bcc');
                }}
                placeholder="bcc@example.com"
                className="flex-1 bg-transparent text-white placeholder-neutral-500 focus:outline-none text-xs"
              />
              {activeField === 'bcc' && contactSuggestions.length > 0 && (
                <div className="absolute left-16 top-full mt-1 w-64 bg-[#171717] border border-white/15 rounded-lg shadow-2xl z-50 py-1 text-xs">
                  {contactSuggestions.map((c, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSelectSuggestion(c.email)}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 text-left"
                    >
                      <span className="font-semibold text-white truncate">{c.name}</span>
                      <span className="text-[10px] text-neutral-400 truncate">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-2 border-t border-white/10 pt-2">
          <span className="w-14 text-neutral-400 font-medium">Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            className="flex-1 bg-transparent text-white placeholder-neutral-500 font-medium border-none focus:outline-none focus:ring-0 text-xs"
          />
        </div>
      </div>

      {/* Formatting & Template Toolbar */}
      <div className="px-3 py-1.5 bg-black border-b border-white/10 flex items-center justify-between text-neutral-400 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => insertFormat('b')}
            title="Bold"
            className="p-1 hover:bg-white/10 rounded hover:text-white"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormat('i')}
            title="Italic"
            className="p-1 hover:bg-white/10 rounded hover:text-white"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormat('u')}
            title="Underline"
            className="p-1 hover:bg-white/10 rounded hover:text-white"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={() => insertFormat('ul')}
            title="Bullet List"
            className="p-1 hover:bg-white/10 rounded hover:text-white"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormat('ol')}
            title="Numbered List"
            className="p-1 hover:bg-white/10 rounded hover:text-white"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Confidential Mode Toggle */}
          <button
            onClick={() => setIsConfidential(!isConfidential)}
            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors ${
              isConfidential
                ? 'bg-white text-black font-bold border border-white'
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Confidential Mode"
          >
            <Lock className="w-3 h-3" /> Confidential
          </button>

          {/* Templates dropdown */}
          {templates.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
              >
                <FileText className="w-3 h-3" /> Canned Response
              </button>
              {showTemplates && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTemplates(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-[#171717] border border-white/15 rounded-lg shadow-xl z-50 py-1">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          setBody((prev) => prev + '\n' + tpl.body);
                          if (tpl.subject && !subject) setSubject(tpl.subject);
                          setShowTemplates(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10 hover:text-white truncate"
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-3 flex flex-col min-h-0 bg-[#171717]">
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Compose your message here..."
          className="flex-1 w-full bg-transparent text-white placeholder-neutral-600 border-none resize-none focus:outline-none focus:ring-0 text-xs leading-relaxed font-sans"
        />

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-neutral-900 px-2.5 py-1 rounded-md text-[11px] text-neutral-200 border border-white/10"
              >
                <File className="w-3 h-3 text-white" />
                <span className="truncate max-w-[140px]">{att.filename}</span>
                <span className="text-neutral-500">({att.sizeStr})</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-neutral-400 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-3 bg-black border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black rounded-lg text-xs font-bold shadow transition-all"
          >
            {isSending ? (
              <>Sending...</>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Send
              </>
            )}
          </button>

          <label
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
            <input type="file" multiple onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className={`p-2 rounded-lg transition-colors ${
              scheduledDate ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
            title="Schedule Send"
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {showSchedule && (
            <div className="flex items-center gap-1.5 bg-black border border-white/15 px-2 py-1 rounded-lg">
              <span className="text-[11px] text-neutral-400">Schedule:</span>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-transparent text-white text-xs border-none focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Discard"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
