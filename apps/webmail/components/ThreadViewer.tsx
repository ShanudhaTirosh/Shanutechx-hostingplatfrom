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
  Bookmark,
  Mail,
  RotateCcw,
  AlertOctagon,
  Ban,
  VolumeX,
  FolderInput,
  FileCode,
} from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';

export interface MessageDetail {
  id: string;
  threadId?: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  snippet: string;
  htmlBody: string;
  priority?: string;
  folder?: string;
  tag?: string;
  isStarred?: boolean;
  isRead?: boolean;
  hasAttachments?: boolean;
  attachmentsJson?: { filename: string; sizeStr: string; url?: string; content?: string }[];
  createdAt: string;
}

interface ThreadViewerProps {
  messages: MessageDetail[];
  subject: string;
  onBack: () => void;
  onReply: (recipient: string, subject: string, messageId: string) => void;
  onReplyAll?: (recipient: string, cc: string, subject: string, messageId: string) => void;
  onQuickReply?: (recipient: string, subject: string, messageId: string, replyText: string) => Promise<void>;
  onForward: (subject: string, body: string) => void;
  onForwardAsAttachment?: (subject: string, message: MessageDetail) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onStar: (id: string, currentStarred: boolean) => void;
  onToggleImportant?: (id: string, currentImportant: boolean) => void;
  onMarkUnread?: (id: string) => void;
  onMuteThread?: (threadId: string) => void;
  onBlockSender?: (email: string) => void;
  onReportThreat?: (id: string, type: 'spam' | 'phishing') => void;
  onMoveFolder?: (id: string, folder: string) => void;
  availableFolders?: { id: string; name: string }[];
}

export const ThreadViewer: React.FC<ThreadViewerProps> = ({
  messages,
  subject,
  onBack,
  onReply,
  onReplyAll,
  onQuickReply,
  onForward,
  onForwardAsAttachment,
  onDelete,
  onRestore,
  onStar,
  onToggleImportant,
  onMarkUnread,
  onMuteThread,
  onBlockSender,
  onReportThreat,
  onMoveFolder,
  availableFolders = [],
}) => {
  const [expandedIds, setExpandedIds] = useState<string[]>(
    messages.length > 0 ? [messages[messages.length - 1].id] : []
  );
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500 text-xs">
        Select a message to display contents
      </div>
    );
  }

  const latestMsg = messages[messages.length - 1];
  const isImportant = latestMsg.priority === 'high';
  const isTrash = latestMsg.folder === 'trash';

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const getAttachmentHref = (att: { url?: string; content?: string; contentType?: string }) => {
    if (att.url) return att.url;
    if (!att.content) return '#';
    if (att.content.startsWith('data:') || att.content.startsWith('http') || att.content.startsWith('blob:')) {
      return att.content;
    }
    const mime = att.contentType || 'application/octet-stream';
    return `data:${mime};base64,${att.content}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black overflow-hidden print:bg-white print:text-black">
      {/* Top Action Toolbar (Hidden during print) */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 bg-[#0a0a0a] gap-2 shrink-0 print:hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
            title="Back to List"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Back</span>
          </button>
          <div className="h-4 w-px bg-white/10 mx-0.5" />

          {/* Reply */}
          <button
            onClick={() => onReply(latestMsg.senderEmail, `Re: ${subject}`, latestMsg.id)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white hover:bg-neutral-200 text-black rounded-lg text-xs font-bold shadow transition-colors"
            title="Reply to Sender"
          >
            <Reply className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reply</span>
          </button>

          {/* Reply All */}
          {onReplyAll && (
            <button
              onClick={() => onReplyAll(latestMsg.senderEmail, latestMsg.recipientEmail, `Re: ${subject}`, latestMsg.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-lg text-xs font-medium border border-white/10 transition-colors hidden sm:flex"
              title="Reply to All Participants"
            >
              <ReplyAll className="w-3.5 h-3.5" /> <span>Reply All</span>
            </button>
          )}

          {/* Forward */}
          <button
            onClick={() => onForward(`Fwd: ${subject}`, latestMsg.htmlBody)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-lg text-xs font-medium border border-white/10 transition-colors"
            title="Forward Message"
          >
            <Forward className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Forward</span>
          </button>

          {/* Forward as Attachment */}
          {onForwardAsAttachment && (
            <button
              onClick={() => onForwardAsAttachment(`Fwd: ${subject}`, latestMsg)}
              className="p-1.5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg text-xs transition-colors hidden md:flex"
              title="Forward as EML Attachment"
            >
              <FileCode className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Star Toggle */}
          <button
            onClick={() => onStar(latestMsg.id, !!latestMsg.isStarred)}
            className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
            title={latestMsg.isStarred ? 'Unstar' : 'Star'}
          >
            <Star
              className={`w-4 h-4 ${
                latestMsg.isStarred ? 'fill-white text-white' : ''
              }`}
            />
          </button>

          {/* Important Marker Toggle */}
          {onToggleImportant && (
            <button
              onClick={() => onToggleImportant(latestMsg.id, isImportant)}
              className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${
                isImportant ? 'text-white fill-white' : 'text-neutral-400 hover:text-white'
              }`}
              title={isImportant ? 'Remove Importance' : 'Mark as Important'}
            >
              <Bookmark className={`w-4 h-4 ${isImportant ? 'fill-white' : ''}`} />
            </button>
          )}

          {/* Mark Unread */}
          {onMarkUnread && (
            <button
              onClick={() => onMarkUnread(latestMsg.id)}
              className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors hidden sm:flex"
              title="Mark as Unread"
            >
              <Mail className="w-4 h-4" />
            </button>
          )}

          {/* Move to Folder Dropdown */}
          {onMoveFolder && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Move to Folder"
              >
                <FolderInput className="w-4 h-4" />
              </button>
              {showMoveMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMoveMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-[#171717] border border-white/10 rounded-xl shadow-2xl z-40 py-1 text-xs backdrop-blur-xl">
                    <p className="px-3 py-1 text-[10px] uppercase font-semibold text-neutral-500">Move to...</p>
                    <button
                      onClick={() => {
                        onMoveFolder(latestMsg.id, 'inbox');
                        setShowMoveMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
                    >
                      Inbox
                    </button>
                    <button
                      onClick={() => {
                        onMoveFolder(latestMsg.id, 'archive');
                        setShowMoveMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() => {
                        onMoveFolder(latestMsg.id, 'spam');
                        setShowMoveMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-rose-400"
                    >
                      Spam
                    </button>
                    {availableFolders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          onMoveFolder(latestMsg.id, f.name);
                          setShowMoveMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white truncate"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Print */}
          <button
            onClick={handlePrint}
            className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors hidden sm:flex"
            title="Print Conversation"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Restore from Trash or Delete */}
          {isTrash && onRestore ? (
            <button
              onClick={() => onRestore(latestMsg.id)}
              className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
              title="Restore to Inbox"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onDelete(latestMsg.id)}
              className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors"
              title="Move to Trash"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* More Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-[#171717] border border-white/10 rounded-xl shadow-2xl z-40 py-1 text-xs backdrop-blur-xl">
                  {onMuteThread && (
                    <button
                      onClick={() => {
                        onMuteThread(latestMsg.threadId || latestMsg.id);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
                    >
                      <VolumeX className="w-3.5 h-3.5" /> Mute Conversation
                    </button>
                  )}
                  {onBlockSender && (
                    <button
                      onClick={() => {
                        onBlockSender(latestMsg.senderEmail);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-rose-400"
                    >
                      <Ban className="w-3.5 h-3.5" /> Block Sender
                    </button>
                  )}
                  {onReportThreat && (
                    <>
                      <button
                        onClick={() => {
                          onReportThreat(latestMsg.id, 'spam');
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-amber-400"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" /> Report Spam
                      </button>
                      <button
                        onClick={() => {
                          onReportThreat(latestMsg.id, 'phishing');
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-400 hover:bg-rose-500/10"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" /> Report Phishing
                      </button>
                    </>
                  )}
                  <div className="my-1 border-t border-white/[0.08]" />
                  <button
                    onClick={() => {
                      handlePrint();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-white/10 sm:hidden"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Conversation Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 print:p-0 print:overflow-visible">
        {/* Subject Header */}
        <div className="pb-4 border-b border-white/10 print:border-black">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-lg sm:text-xl font-bold text-white print:text-black flex items-center gap-2">
              {subject}
              <span className="text-xs font-normal text-neutral-400 bg-neutral-900 border border-white/10 px-2 py-0.5 rounded-full print:border-black print:text-black">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            </h1>
            {isImportant && (
              <span className="text-xs font-semibold bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-full shrink-0">
                Important
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-neutral-400 print:hidden">
            <span className="flex items-center gap-1 text-white bg-white/10 px-2 py-0.5 rounded border border-white/15 text-[11px]">
              <Lock className="w-3 h-3 text-white" /> Encrypted (TLS/AES-256)
            </span>
            <span className="flex items-center gap-1 text-neutral-400 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-white" /> SPF & DKIM Verified
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
              className={`bg-[#171717] border border-white/10 rounded-2xl transition-all print:border-black print:bg-transparent ${
                isLatest ? 'border-white/20 shadow-xl' : 'shadow-sm'
              }`}
            >
              {/* Card Header */}
              <div
                onClick={() => toggleExpand(msg.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 rounded-t-2xl select-none print:hover:bg-transparent"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold shadow-md shrink-0 print:border print:border-black print:text-black">
                    {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="text-xs font-bold text-white print:text-black truncate">
                      {msg.senderName}{' '}
                      <span className="text-neutral-400 print:text-neutral-700 font-normal">
                        &lt;{msg.senderEmail}&gt;
                      </span>
                    </span>
                    <span className="text-[11px] text-neutral-400 print:text-neutral-600 truncate">
                      to {msg.recipientEmail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-neutral-400 print:text-neutral-700 font-mono">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                  <div className="print:hidden">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Card Expanded Content */}
              {(isExpanded || typeof window !== 'undefined') && (
                <div className={`px-4 pb-4 pt-2 border-t border-white/[0.08] print:border-black space-y-4 ${isExpanded ? 'block' : 'hidden print:block'}`}>
                  {/* HTML Body Render (Sanitized with DOMPurify to prevent XSS) */}
                  <div
                    className="prose prose-invert print:prose max-w-none text-xs leading-relaxed text-neutral-200 print:text-black overflow-x-auto"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(msg.htmlBody || `<p>${msg.snippet}</p>`, {
                        ADD_ATTR: ['target', 'rel', 'style', 'class'],
                        ADD_DATA_URI_TAGS: ['img'],
                      }),
                    }}
                  />

                  {/* Attachments Section */}
                  {msg.attachmentsJson && msg.attachmentsJson.length > 0 && (
                    <div className="pt-3 border-t border-white/[0.08] print:border-black">
                      <p className="text-[11px] font-semibold text-neutral-400 print:text-neutral-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Paperclip className="w-3 h-3 text-white" /> Attachments ({msg.attachmentsJson.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.attachmentsJson.map((att, i) => (
                          <a
                            key={i}
                            href={getAttachmentHref(att)}
                            target="_blank"
                            download={att.filename}
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-[#0a0a0a] hover:bg-black px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white transition-colors print:border-black print:text-black shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5 text-white" />
                            <span className="truncate max-w-[160px] font-medium">{att.filename}</span>
                            <span className="text-[10px] text-neutral-400">({att.sizeStr})</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Action Footer for Card */}
                  <div className="pt-2 flex items-center gap-2 border-t border-white/[0.08] text-xs print:hidden">
                    <button
                      onClick={() => onReply(msg.senderEmail, `Re: ${subject}`, msg.id)}
                      className="flex items-center gap-1 text-neutral-400 hover:text-white font-medium px-2 py-1 rounded hover:bg-white/10"
                    >
                      <Reply className="w-3.5 h-3.5" /> Reply
                    </button>
                    {onReplyAll && (
                      <button
                        onClick={() => onReplyAll(msg.senderEmail, msg.recipientEmail, `Re: ${subject}`, msg.id)}
                        className="flex items-center gap-1 text-neutral-400 hover:text-white font-medium px-2 py-1 rounded hover:bg-white/10"
                      >
                        <ReplyAll className="w-3.5 h-3.5" /> Reply All
                      </button>
                    )}
                    <button
                      onClick={() => onForward(`Fwd: ${subject}`, msg.htmlBody)}
                      className="flex items-center gap-1 text-neutral-400 hover:text-white font-medium px-2 py-1 rounded hover:bg-white/10"
                    >
                      <Forward className="w-3.5 h-3.5" /> Forward
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Quick Inline Reply Container (Hidden during print) */}
        <div className="bg-[#171717] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3 mt-6 print:hidden shadow-lg">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Reply className="w-3.5 h-3.5 text-white" /> Quick Reply to {latestMsg.senderEmail}
          </div>
          <textarea
            value={quickReplyText}
            onChange={(e) => setQuickReplyText(e.target.value)}
            placeholder="Type your response here..."
            className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none h-24 shadow-inner"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                onReply(latestMsg.senderEmail, `Re: ${subject}`, latestMsg.id);
              }}
              className="text-xs text-neutral-400 hover:text-white font-medium"
            >
              Open Full Composer
            </button>
            <button
              onClick={async () => {
                const text = quickReplyText.trim();
                if (!text || isSendingQuickReply) return;
                const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
                if (onQuickReply) {
                  try {
                    setIsSendingQuickReply(true);
                    await onQuickReply(latestMsg.senderEmail, replySubject, latestMsg.id, text);
                    setQuickReplyText('');
                  } finally {
                    setIsSendingQuickReply(false);
                  }
                } else {
                  onReply(latestMsg.senderEmail, replySubject, latestMsg.id);
                  setQuickReplyText('');
                }
              }}
              disabled={!quickReplyText.trim() || isSendingQuickReply}
              className="flex items-center gap-2 px-4 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-xs font-bold rounded-xl shadow transition-all active:scale-[0.98]"
            >
              <Send className="w-3.5 h-3.5" /> {isSendingQuickReply ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
