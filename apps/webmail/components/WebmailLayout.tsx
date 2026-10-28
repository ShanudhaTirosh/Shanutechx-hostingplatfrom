'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Inbox,
  Star,
  Clock,
  Send,
  FileText,
  Archive,
  AlertOctagon,
  Trash2,
  Folder,
  Tag,
  Plus,
  RefreshCw,
  Settings,
  Search,
  PenSquare,
  LogOut,
  Sparkles,
  ShieldCheck,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  HardDrive,
  Keyboard,
  CheckCircle2,
  RotateCcw,
  X,
  Key,
  Menu,
  Bookmark,
  Layers,
  Columns,
  Rows,
  Sliders,
  Undo2,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { MailboxSwitcher, Mailbox } from './MailboxSwitcher';
import { ThreadList, WebmailMessage } from './ThreadList';
import { ThreadViewer, MessageDetail } from './ThreadViewer';
import { Composer, AttachmentItem } from './Composer';
import { WebmailSettingsModal as SettingsModal } from './SettingsModal';
import { WebmailCredentialsModal } from './WebmailCredentialsModal';
import { api } from '../lib/api';
import { firebaseAuth } from '../lib/firebaseClient';

export interface ToastNotification {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  undoAction?: () => void;
}

export const WebmailLayout: React.FC = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<string | null>(null);
  const [activeAlias, setActiveAlias] = useState<string | null>(null);

  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [activeCategory, setActiveCategory] = useState<string>('primary');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(true);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedThreadMessages, setSelectedThreadMessages] = useState<MessageDetail[]>([]);
  const [selectedThreadSubject, setSelectedThreadSubject] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Layout & Display Preferences
  const [readingPane, setReadingPane] = useState<'right' | 'bottom' | 'off'>('right');
  const [density, setDensity] = useState<'comfortable' | 'default' | 'compact'>('default');
  const [showViewMenu, setShowViewMenu] = useState<boolean>(false);

  // Modals & Composer
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [composerDefaultRecipient, setComposerDefaultRecipient] = useState<string>('');
  const [composerDefaultCc, setComposerDefaultCc] = useState<string>('');
  const [composerDefaultBcc, setComposerDefaultBcc] = useState<string>('');
  const [composerDefaultSubject, setComposerDefaultSubject] = useState<string>('');
  const [composerDefaultBody, setComposerDefaultBody] = useState<string>('');
  const [composerDefaultAttachments, setComposerDefaultAttachments] = useState<AttachmentItem[]>([]);
  const [composerThreadId, setComposerThreadId] = useState<string | undefined>(undefined);
  const [composerInReplyTo, setComposerInReplyTo] = useState<string | undefined>(undefined);

  // Undo Send Buffer
  const [pendingUndoSend, setPendingUndoSend] = useState<{
    id: string;
    payload: any;
    timer: any;
  } | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('customer');
  const [showSearchHelp, setShowSearchHelp] = useState<boolean>(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);

  // Custom Folders & Labels
  const [customFolders, setCustomFolders] = useState<any[]>([]);
  const [customLabels, setCustomLabels] = useState<any[]>([]);

  // Mobile Drawer & Dynamic Storage
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [storageUsage, setStorageUsage] = useState<{ usedMb: number; limitMb: number }>({
    usedMb: 0,
    limitMb: 10240,
  });

  // Desktop Sidebar Collapse State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Desktop Panel Sizing & Resizing States
  const threadListRef = useRef<HTMLDivElement>(null);
  const bottomContainerRef = useRef<HTMLDivElement>(null);
  const [threadListWidth, setThreadListWidth] = useState<number>(384);
  const [isDraggingThreadList, setIsDraggingThreadList] = useState<boolean>(false);
  const [threadListHeight, setThreadListHeight] = useState<number>(320);
  const [isDraggingThreadHeight, setIsDraggingThreadHeight] = useState<boolean>(false);

  // Load layout preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPane = localStorage.getItem('webmail_reading_pane') as any;
      if (savedPane && ['right', 'bottom', 'off'].includes(savedPane)) {
        setReadingPane(savedPane);
      }
      const savedDensity = localStorage.getItem('webmail_density') as any;
      if (savedDensity && ['comfortable', 'default', 'compact'].includes(savedDensity)) {
        setDensity(savedDensity);
      }
      const savedCollapsed = localStorage.getItem('webmail_sidebar_collapsed');
      if (savedCollapsed !== null) {
        setIsSidebarCollapsed(savedCollapsed === 'true');
      }
      const savedWidth = localStorage.getItem('webmail_thread_list_width');
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 800) {
          setThreadListWidth(parsed);
        }
      }
      const savedHeight = localStorage.getItem('webmail_thread_list_height');
      if (savedHeight) {
        const parsedH = parseInt(savedHeight, 10);
        if (!isNaN(parsedH) && parsedH >= 180 && parsedH <= 650) {
          setThreadListHeight(parsedH);
        }
      }
    }
  }, []);

  // Horizontal Resize Handlers (Right Reading Pane mode)
  useEffect(() => {
    if (!isDraggingThreadList) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!threadListRef.current) return;
      const rect = threadListRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const minWidth = 260;
      const maxWidth = Math.min(800, window.innerWidth - 380);
      const clamped = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setThreadListWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsDraggingThreadList(false);
      setThreadListWidth((curr) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('webmail_thread_list_width', String(curr));
        }
        return curr;
      });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingThreadList]);

  const startThreadListResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingThreadList(true);
  };

  const resetThreadListWidth = () => {
    const def = isSidebarCollapsed ? 420 : 384;
    setThreadListWidth(def);
    if (typeof window !== 'undefined') {
      localStorage.setItem('webmail_thread_list_width', String(def));
    }
  };

  // Vertical Resize Handlers (Bottom Reading Pane mode)
  useEffect(() => {
    if (!isDraggingThreadHeight) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!bottomContainerRef.current) return;
      const rect = bottomContainerRef.current.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      const minHeight = 180;
      const maxHeight = Math.max(250, rect.height - 200);
      const clamped = Math.max(minHeight, Math.min(newHeight, maxHeight));
      setThreadListHeight(clamped);
    };

    const handleMouseUp = () => {
      setIsDraggingThreadHeight(false);
      setThreadListHeight((curr) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('webmail_thread_list_height', String(curr));
        }
        return curr;
      });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingThreadHeight]);

  const startThreadHeightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingThreadHeight(true);
  };

  const resetThreadHeight = () => {
    setThreadListHeight(320);
    if (typeof window !== 'undefined') {
      localStorage.setItem('webmail_thread_list_height', '320');
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('webmail_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  const handleChangeReadingPane = (pane: 'right' | 'bottom' | 'off') => {
    setReadingPane(pane);
    if (typeof window !== 'undefined') {
      localStorage.setItem('webmail_reading_pane', pane);
    }
  };

  const handleChangeDensity = (d: 'comfortable' | 'default' | 'compact') => {
    setDensity(d);
    if (typeof window !== 'undefined') {
      localStorage.setItem('webmail_density', d);
    }
  };

  // Toast System
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const addToast = (message: string, type: ToastNotification['type'] = 'success', undoAction?: () => void) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, undoAction }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const loadPlanUsage = async () => {
    try {
      const res = await api.webmail.planUsage();
      if (res?.quotas?.storageMb) {
        setStorageUsage({
          usedMb: res.quotas.storageMb.used || 0,
          limitMb: res.quotas.storageMb.limit || 10240,
        });
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadMailboxes();
    loadFoldersAndLabels();
    loadPlanUsage();
    api.me().then((res) => {
      if (res?.user?.role) setUserRole(res.user.role);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadMessages();
    loadPlanUsage();
  }, [activeFolder, activeCategory, searchQuery, activeMailboxId]);

  // Update document title with unread badge count
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.title = unreadCount > 0 ? `(${unreadCount}) Inbox - STX Webmail` : 'STX Webmail';
    }
  }, [unreadCount]);

  // Background Auto-Polling (Every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const categoryParam = activeFolder === 'inbox' && activeCategory ? activeCategory : undefined;
      api.webmail
        .listMessages(activeFolder, searchQuery, activeMailboxId || undefined, categoryParam)
        .then((res) => {
          setMessages(res.messages || []);
          setUnreadCount(res.unreadCount || 0);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [activeFolder, activeCategory, searchQuery, activeMailboxId]);

  // Global Keyboard Shortcuts (Gmail / Fastmail style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setComposerDefaultRecipient('');
        setComposerDefaultSubject('');
        setComposerDefaultBody('');
        setComposerThreadId(undefined);
        setComposerInReplyTo(undefined);
        setIsComposerOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'r' || e.key === 'R') {
        if (selectedMessageId && selectedThreadMessages.length > 0) {
          e.preventDefault();
          const latest = selectedThreadMessages[selectedThreadMessages.length - 1];
          handleOpenReply(latest.senderEmail, `Re: ${selectedThreadSubject}`, latest.id);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (selectedMessageId && selectedThreadMessages.length > 0) {
          e.preventDefault();
          const latest = selectedThreadMessages[selectedThreadMessages.length - 1];
          handleOpenForward(`Fwd: ${selectedThreadSubject}`, latest.htmlBody);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (selectedMessageId) {
          e.preventDefault();
          handleBulkActionSingle(selectedMessageId, 'archive');
        }
      } else if (e.key === '#' || e.key === 'Delete') {
        if (selectedMessageId) {
          e.preventDefault();
          handleDeleteMessage(selectedMessageId);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowKeyboardHelp((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsComposerOpen(false);
        setIsSettingsOpen(false);
        setShowKeyboardHelp(false);
        setSelectedMessageId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMessageId, selectedThreadMessages, selectedThreadSubject]);

  const loadMailboxes = async () => {
    try {
      const res = await api.email.mailboxes();
      const accounts = res.mailboxes || res.smtpAccounts || [];
      setMailboxes(accounts);
      if (accounts.length > 0 && !activeMailboxId) {
        setActiveMailboxId(accounts[0].id);
      }
    } catch {
      // Fallback
    }
  };

  const loadFoldersAndLabels = async () => {
    try {
      const [fRes, lRes] = await Promise.all([
        api.webmail.listFolders().catch(() => ({ folders: [] })),
        api.webmail.listLabels().catch(() => ({ labels: [] })),
      ]);
      setCustomFolders(fRes.folders || []);
      setCustomLabels(lRes.labels || []);
    } catch {}
  };

  const loadMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const categoryParam = activeFolder === 'inbox' && activeCategory ? activeCategory : undefined;
      const res = await api.webmail.listMessages(
        activeFolder,
        searchQuery,
        activeMailboxId || undefined,
        categoryParam
      );
      setMessages(res.messages || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectMessage = async (id: string) => {
    setSelectedMessageId(id);
    const targetMsg = messages.find((m) => m.id === id);
    if (!targetMsg) return;

    try {
      const threadRes = await api.webmail.getThread(targetMsg.threadId || id).catch(async () => {
        const single = await api.webmail.getMessage(id);
        return { messages: [single.message] };
      });

      setSelectedThreadMessages(threadRes.messages || []);
      setSelectedThreadSubject(targetMsg.subject);

      // Mark local state and backend as read if unread
      if (!targetMsg.isRead) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        api.webmail.patchMessage(id, { isRead: true }).catch(() => {});
      }
    } catch (err) {
      // Fallback
    }
  };

  // Bulk actions & Quick row actions
  const handleBulkAction = async (action: string, payload?: any) => {
    const ids = payload?.messageIds || selectedIds;
    if (ids.length === 0) return;
    const previousState = [...messages];
    try {
      await api.webmail.bulkAction({
        messageIds: ids,
        action,
        ...payload,
      });
      addToast(`${ids.length} message(s) updated`, 'success', () => {
        setMessages(previousState);
      });
      setSelectedIds([]);
      loadMessages();
    } catch {}
  };

  const handleBulkActionSingle = async (id: string, action: string) => {
    try {
      await api.webmail.bulkAction({
        messageIds: [id],
        action,
      });
      addToast(`Message ${action === 'archive' ? 'archived' : 'updated'}`, 'success');
      setSelectedMessageId(null);
      loadMessages();
    } catch {}
  };

  const handleToggleStar = async (id: string, currentStarred: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStarred: !currentStarred } : m))
    );
    await api.webmail.patchMessage(id, { isStarred: !currentStarred });
  };

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isPinned: !currentPinned } : m))
    );
    await api.webmail.patchMessage(id, { isPinned: !currentPinned });
  };

  const handleOpenReply = (recipient: string, replySub: string, msgId: string) => {
    setComposerDefaultRecipient(recipient);
    setComposerDefaultSubject(replySub);
    setComposerDefaultBody('');
    setComposerInReplyTo(msgId);
    setIsComposerOpen(true);
  };

  const handleOpenForward = (fwdSub: string, body: string) => {
    setComposerDefaultRecipient('');
    setComposerDefaultSubject(fwdSub);
    setComposerDefaultBody(`<br/><br/>---------- Forwarded message ---------<br/>${body}`);
    setComposerInReplyTo(undefined);
    setIsComposerOpen(true);
  };

  const handleDeleteMessage = async (id: string) => {
    await api.webmail.deleteMessage(id);
    addToast('Message moved to Trash', 'info');
    setSelectedMessageId(null);
    setSelectedThreadMessages([]);
    loadMessages();
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('webmail_token');
    } catch (_) {}
    firebaseAuth.signOut();
    window.location.href = '/login';
  };

  const handleQuickReply = async (recipient: string, replySub: string, msgId: string, text: string) => {
    try {
      await api.webmail.send({
        recipientEmail: recipient,
        subject: replySub,
        htmlBody: text.replace(/\n/g, '<br/>'),
        inReplyTo: msgId,
        smtpAccountId: activeMailboxId || undefined,
      });
      addToast('Reply sent successfully', 'success');
      if (selectedMessageId) {
        handleSelectMessage(selectedMessageId);
      }
      loadMessages();
    } catch (err: any) {
      addToast(err.message || 'Failed to send reply', 'error');
      throw err;
    }
  };

  const navFolders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'snoozed', label: 'Snoozed', icon: Clock },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'drafts', label: 'Drafts', icon: FileText },
    { id: 'important', label: 'Important', icon: Bookmark },
    { id: 'all_mail', label: 'All Mail', icon: Layers },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'spam', label: 'Spam', icon: AlertOctagon },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const activeMb = mailboxes.find((m) => m.id === activeMailboxId);
  const primaryEmail = activeMb?.email || activeMb?.smtpUsername || '';
  const currentDisplayEmail = activeAlias || primaryEmail || 'Enterprise Mailbox';
  const availableSenders: { email: string; label: string }[] = activeMb && primaryEmail
    ? [
        { email: primaryEmail, label: `${primaryEmail} (Primary)` },
        ...(activeMb.aliases || []).map((alias: string) => ({ email: alias, label: `${alias} (Alias)` })),
      ]
    : [];

  const handleRequestUndoSend = (payload: any) => {
    const id = Date.now().toString();
    const timer = setTimeout(async () => {
      try {
        await api.webmail.send(payload);
        addToast('Email message dispatched successfully!', 'success');
        loadMessages();
      } catch (err: any) {
        addToast(err.message || 'Failed to dispatch email', 'error');
      } finally {
        setPendingUndoSend(null);
      }
    }, 5000);

    setPendingUndoSend({
      id,
      payload,
      timer,
    });
  };

  const handleExecuteUndo = () => {
    if (!pendingUndoSend) return;
    clearTimeout(pendingUndoSend.timer);
    const saved = pendingUndoSend.payload;
    setPendingUndoSend(null);

    setComposerDefaultRecipient(saved.recipientEmail || '');
    setComposerDefaultCc(saved.cc || '');
    setComposerDefaultBcc(saved.bcc || '');
    setComposerDefaultSubject(saved.subject || '');
    setComposerDefaultBody(saved.htmlBody || '');
    setComposerDefaultAttachments(saved.attachments || []);
    setComposerThreadId(saved.threadId);
    setComposerInReplyTo(saved.inReplyTo);
    setIsComposerOpen(true);

    addToast('Sending undone. Message reopened in composer.', 'info');
  };

  const formatStorage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const storagePercent = Math.min(
    100,
    Math.max(1, Math.round((storageUsage.usedMb / Math.max(1, storageUsage.limitMb)) * 100))
  );

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans selection:bg-white selection:text-black relative">
      {/* Top Application Header */}
      <header className="h-14 bg-[#0a0a0a] border-b border-white/10 px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 gap-2 sm:gap-3 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Mobile Drawer Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex lg:hidden items-center justify-center text-neutral-400 hover:text-white transition-all shadow-sm"
            title="Open Menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Desktop Sidebar Collapse Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 rounded-xl bg-[#171717] hover:bg-white/10 border border-white/10 hidden lg:flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm"
            title={isSidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Platform Site Logo & Branding */}
          <div
            onClick={() => {
              setActiveFolder('inbox');
              setSelectedMessageId(null);
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title="STX Webmail - Go to Inbox"
          >
            <div className="w-8 h-8 rounded-xl bg-[#171717] p-1.5 flex items-center justify-center border border-white/15 shadow-sm group-hover:border-white/30 group-hover:bg-white/15 transition-all shrink-0">
              <img
                src="/STX.png"
                alt="STX Webmail"
                className="w-full h-full object-contain filter brightness-0 invert"
              />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[13px] tracking-tight text-white">
                  STX
                </span>
                <span className="font-semibold text-[13px] tracking-tight text-neutral-300">
                  Webmail
                </span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 border border-white/10 font-bold leading-none">
                  PRO
                </span>
              </div>
              <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">
                Enterprise Mailbox
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-white/10 mx-0.5 hidden md:block" />

          {/* Desktop Mailbox Switcher with Aliases */}
          <div className="hidden md:block">
            <MailboxSwitcher
              mailboxes={mailboxes}
              activeMailboxId={activeMailboxId}
              onSelectMailbox={(id) => {
                setActiveMailboxId(id);
                setActiveAlias(null);
              }}
              activeAlias={activeAlias}
              onSelectAlias={(alias) => {
                setActiveAlias(alias);
                if (alias) addToast(`Active identity: ${alias}`, 'info');
              }}
            />
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-lg mx-1 sm:mx-4">
          <div className="relative group">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-white transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchHelp(true)}
              onBlur={() => setTimeout(() => setShowSearchHelp(false), 200)}
              placeholder="Search mail..."
              className="w-full bg-[#171717] hover:bg-[#202020] focus:bg-[#202020] border border-white/10 hover:border-white/20 focus:border-white/30 rounded-xl pl-9 pr-12 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all shadow-inner"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                ×
              </button>
            ) : (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-neutral-400">
                  /
                </kbd>
              </div>
            )}
          </div>

          {/* Search Syntax Help Popover */}
          {showSearchHelp && !searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#171717] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-2 animate-in fade-in duration-150 backdrop-blur-xl">
              <p className="font-semibold text-neutral-300 text-[10px] uppercase tracking-wider">Search Operators</p>
              <div className="grid grid-cols-2 gap-1.5 text-neutral-400 font-mono text-[11px]">
                <button onMouseDown={() => setSearchQuery('from:')} className="text-left hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                  from:user@domain.com
                </button>
                <button onMouseDown={() => setSearchQuery('is:unread')} className="text-left hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                  is:unread
                </button>
                <button onMouseDown={() => setSearchQuery('is:starred')} className="text-left hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                  is:starred
                </button>
                <button onMouseDown={() => setSearchQuery('is:important')} className="text-left hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                  is:important
                </button>
                <button onMouseDown={() => setSearchQuery('subject:')} className="text-left hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                  subject:invoice
                </button>
                <button onMouseDown={() => setSearchQuery('has:attachment')} className="text-left hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                  has:attachment
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Display & Productivity Capsule */}
          <div className="flex items-center bg-[#171717] border border-white/10 rounded-xl p-0.5 shadow-sm">
            {/* Quick View Options Menu */}
            <div className="relative">
              <button
                onClick={() => setShowViewMenu((prev) => !prev)}
                className={`p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors hidden sm:flex items-center ${
                  showViewMenu ? 'bg-white/10 text-white' : ''
                }`}
                title="Display Density & Reading Pane"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              {showViewMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#171717] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-3 animate-in fade-in duration-150 backdrop-blur-xl">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">Reading Pane</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'right', label: 'Right', icon: Columns },
                        { id: 'bottom', label: 'Bottom', icon: Rows },
                        { id: 'off', label: 'Off', icon: Layers },
                      ].map((item) => {
                        const IconC = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              handleChangeReadingPane(item.id as any);
                              setShowViewMenu(false);
                            }}
                            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition-all ${
                              readingPane === item.id
                                ? 'bg-white text-black font-bold border-white shadow-sm'
                                : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
                            }`}
                          >
                            <IconC className="w-3.5 h-3.5 mb-0.5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">Display Density</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'compact', label: 'Compact' },
                        { id: 'default', label: 'Default' },
                        { id: 'comfortable', label: 'Comfortable' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            handleChangeDensity(item.id as any);
                            setShowViewMenu(false);
                          }}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-semibold border text-center truncate transition-all ${
                            density === item.id
                              ? 'bg-white text-black font-bold border-white shadow-sm'
                              : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors hidden sm:flex"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={loadMessages}
              className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
              title="Refresh Inbox"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin text-white' : ''}`} />
            </button>
          </div>

          {/* System & Account Capsule */}
          <div className="flex items-center bg-[#171717] border border-white/10 rounded-xl p-0.5 shadow-sm">
            <button
              onClick={() => setIsCredentialsOpen(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors hidden sm:flex"
              title="Developer Credentials & REST API"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-white/10 mx-0.5" />
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-rose-500/15 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0a0a0a] border-r border-white/10 p-4 flex flex-col justify-between h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="space-y-4 overflow-y-auto pr-1">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/10 p-1.5 flex items-center justify-center border border-white/10">
                    <img src="/STX.png" alt="STX Webmail" className="w-full h-full object-contain filter brightness-0 invert" />
                  </div>
                  <div>
                    <span className="font-bold text-xs tracking-tight text-white block">
                      STX <span className="text-neutral-400 font-medium">Webmail</span>
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-neutral-400">
                      Enterprise Portal
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mailbox Switcher inside Drawer */}
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Mailbox Account</p>
                <MailboxSwitcher
                  mailboxes={mailboxes}
                  activeMailboxId={activeMailboxId}
                  onSelectMailbox={(id) => {
                    setActiveMailboxId(id);
                    setActiveAlias(null);
                    setIsMobileMenuOpen(false);
                  }}
                  activeAlias={activeAlias}
                  onSelectAlias={(alias) => {
                    setActiveAlias(alias);
                    if (alias) addToast(`Active identity: ${alias}`, 'info');
                    setIsMobileMenuOpen(false);
                  }}
                />
              </div>

              {/* Compose Action in Drawer */}
              <button
                onClick={() => {
                  setComposerDefaultRecipient('');
                  setComposerDefaultSubject('');
                  setComposerDefaultBody('');
                  setComposerThreadId(undefined);
                  setComposerInReplyTo(undefined);
                  setIsComposerOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98]"
              >
                <PenSquare className="w-4 h-4" /> Compose Mail
              </button>

              {/* Grouped Folders Tree in Drawer */}
              <div className="space-y-3">
                <div>
                  <p className="px-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Mail
                  </p>
                  <nav className="space-y-0.5">
                    {navFolders.slice(0, 5).map((f) => {
                      const Icon = f.icon;
                      const isActive = activeFolder === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFolder(f.id);
                            setSelectedMessageId(null);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-[#171717] text-white font-semibold border border-white/20 shadow-sm'
                              : 'text-neutral-400 hover:text-white hover:bg-[#171717]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                            <span>{f.label}</span>
                          </div>
                          {f.badge !== undefined && f.badge > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono shadow-sm ${
                              isActive ? 'bg-white text-black' : 'bg-white/10 text-white border border-white/15'
                            }`}>
                              {f.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                <div>
                  <p className="px-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Organization
                  </p>
                  <nav className="space-y-0.5">
                    {navFolders.slice(5).map((f) => {
                      const Icon = f.icon;
                      const isActive = activeFolder === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFolder(f.id);
                            setSelectedMessageId(null);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-[#171717] text-white font-semibold border border-white/20 shadow-sm'
                              : 'text-neutral-400 hover:text-white hover:bg-[#171717]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                            <span>{f.label}</span>
                          </div>
                          {f.badge !== undefined && f.badge > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono shadow-sm ${
                              isActive ? 'bg-white text-black' : 'bg-white/10 text-white border border-white/15'
                            }`}>
                              {f.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Custom Folders Section */}
                {customFolders.length > 0 && (
                  <div>
                    <p className="px-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Custom Folders
                    </p>
                    <div className="space-y-0.5">
                      {customFolders.map((cf) => (
                        <button
                          key={cf.id}
                          onClick={() => {
                            setActiveFolder(cf.name);
                            setSelectedMessageId(null);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                            activeFolder === cf.name
                              ? 'bg-[#171717] text-white font-semibold border border-white/20 shadow-sm'
                              : 'text-neutral-400 hover:text-white hover:bg-[#171717]/60'
                          }`}
                        >
                          <Folder className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="truncate">{cf.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Storage Quota in Drawer */}
            <div className="p-3 bg-[#171717] border border-white/10 rounded-2xl space-y-2 mt-3 shrink-0 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-amber-400" /> Mail Storage</span>
                <span className="text-amber-400 font-mono font-bold text-[11px]">{storagePercent}%</span>
              </div>
              <div className="flex items-baseline justify-between text-xs font-bold text-white">
                <span>{formatStorage(storageUsage.usedMb)}</span>
                <span className="text-[10px] font-normal text-neutral-400">of {formatStorage(storageUsage.limitMb)}</span>
              </div>
              <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(2, storagePercent)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main App Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Left Navigation Sidebar */}
        <aside
          className={`hidden lg:flex bg-[#0a0a0a] border-r border-white/10 flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? 'w-16 p-2.5' : 'w-64 p-3'
          }`}
        >
          <div className="space-y-3 overflow-y-auto no-scrollbar">

            {/* Quick Storage Card (Inspired by WALLET card in Reference Image) */}
            {!isSidebarCollapsed && (
              <div className="p-3 bg-[#171717] border border-white/10 rounded-2xl space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mail Storage</span>
                  </span>
                  <span className="text-amber-400 font-mono font-bold text-[11px]">{storagePercent}%</span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-bold text-white">
                  <span>{formatStorage(storageUsage.usedMb)}</span>
                  <span className="text-[10px] font-normal text-neutral-400">of {formatStorage(storageUsage.limitMb)}</span>
                </div>
                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.max(2, storagePercent)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Primary Action Compose Button */}
            {!isSidebarCollapsed ? (
              <button
                onClick={() => {
                  setComposerDefaultRecipient('');
                  setComposerDefaultSubject('');
                  setComposerDefaultBody('');
                  setComposerThreadId(undefined);
                  setComposerInReplyTo(undefined);
                  setIsComposerOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98]"
              >
                <PenSquare className="w-4 h-4" /> <span>Compose Mail</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setComposerDefaultRecipient('');
                  setComposerDefaultSubject('');
                  setComposerDefaultBody('');
                  setComposerThreadId(undefined);
                  setComposerInReplyTo(undefined);
                  setIsComposerOpen(true);
                }}
                className="w-10 h-10 mx-auto flex items-center justify-center bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 group relative shrink-0"
                title="Compose Mail (c)"
              >
                <PenSquare className="w-4 h-4" />
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#171717] text-white text-[11px] font-semibold rounded-lg border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
                  Compose Mail (c)
                </span>
              </button>
            )}

            {isSidebarCollapsed && (
              <div className="w-8 h-px bg-white/10 mx-auto my-1.5 shrink-0" />
            )}

            {/* Grouped Folders Navigation (Matching Reference Sections: HOME, etc.) */}
            {!isSidebarCollapsed ? (
              <div className="space-y-3">
                {/* Mail Section */}
                <div>
                  <p className="px-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Mail
                  </p>
                  <nav className="space-y-0.5">
                    {navFolders.slice(0, 5).map((f) => {
                      const Icon = f.icon;
                      const isActive = activeFolder === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFolder(f.id);
                            setSelectedMessageId(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-[#171717] text-white font-semibold border border-white/20 shadow-sm'
                              : 'text-neutral-400 hover:text-white hover:bg-[#171717]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                            <span>{f.label}</span>
                          </div>
                          {f.badge !== undefined && f.badge > 0 && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm font-mono ${
                                isActive ? 'bg-white text-black' : 'bg-white/10 text-white border border-white/15'
                              }`}
                            >
                              {f.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Organization Section */}
                <div>
                  <p className="px-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Organization
                  </p>
                  <nav className="space-y-0.5">
                    {navFolders.slice(5).map((f) => {
                      const Icon = f.icon;
                      const isActive = activeFolder === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFolder(f.id);
                            setSelectedMessageId(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-[#171717] text-white font-semibold border border-white/20 shadow-sm'
                              : 'text-neutral-400 hover:text-white hover:bg-[#171717]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                            <span>{f.label}</span>
                          </div>
                          {f.badge !== undefined && f.badge > 0 && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm font-mono ${
                                isActive ? 'bg-white text-black' : 'bg-white/10 text-white border border-white/15'
                              }`}
                            >
                              {f.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Custom Folders Section */}
                {customFolders.length > 0 && (
                  <div>
                    <p className="px-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Custom Folders
                    </p>
                    <div className="space-y-0.5">
                      {customFolders.map((cf) => (
                        <button
                          key={cf.id}
                          onClick={() => {
                            setActiveFolder(cf.name);
                            setSelectedMessageId(null);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                            activeFolder === cf.name
                              ? 'bg-[#171717] text-white font-semibold border border-white/20 shadow-sm'
                              : 'text-neutral-400 hover:text-white hover:bg-[#171717]/60'
                          }`}
                        >
                          <Folder className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="truncate">{cf.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Collapsed Folders Navigation */
              <nav className="space-y-0.5">
                {navFolders.map((f) => {
                  const Icon = f.icon;
                  const isActive = activeFolder === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setActiveFolder(f.id);
                        setSelectedMessageId(null);
                      }}
                      className={`w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all relative group shrink-0 ${
                        isActive
                          ? 'bg-[#171717] border border-white/20 text-white font-bold shadow-inner'
                          : 'text-neutral-400 hover:text-white hover:bg-[#171717]/60'
                      }`}
                      title={f.label}
                    >
                      {isActive && (
                        <div className="absolute -left-2 w-1 h-5 bg-white rounded-r-full shadow-sm" />
                      )}
                      <Icon className="w-4 h-4 shrink-0" />
                      {f.badge !== undefined && f.badge > 0 && (
                        <span
                          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                            isActive ? 'bg-white ring-2 ring-[#0a0a0a]' : 'bg-neutral-300 ring-2 ring-[#0a0a0a]'
                          }`}
                        />
                      )}
                      {/* Floating Tooltip */}
                      <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#171717] text-white text-[11px] font-semibold rounded-lg border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl flex items-center gap-1.5">
                        <span>{f.label}</span>
                        {f.badge !== undefined && f.badge > 0 && (
                          <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            {f.badge}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Bottom Footer (Matching User Profile in Reference Image) */}
          {!isSidebarCollapsed ? (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-[#171717] hover:bg-[#202020] border border-white/10 rounded-xl flex items-center justify-between gap-2 shadow-sm cursor-pointer transition-colors group"
                title="Account Settings"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center text-xs font-bold shrink-0 border border-white/10 group-hover:border-white/20">
                    {activeMb ? (activeMb.smtpUsername || activeMb.email || 'M').charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div className="min-w-0 flex flex-col leading-tight">
                    <span className="text-xs font-semibold text-white truncate group-hover:text-neutral-100">
                      {currentDisplayEmail.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="truncate">Active Mailbox</span>
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition-colors shrink-0" />
              </div>

            </div>
          ) : (
            <div className="pt-2 border-t border-white/10 flex flex-col items-center">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-10 h-10 rounded-xl bg-[#171717] hover:bg-[#202020] border border-white/10 flex items-center justify-center text-white text-xs font-bold transition-all shadow-sm relative group"
                title={`Active Mailbox: ${currentDisplayEmail} (Click for Settings)`}
              >
                {activeMb ? (activeMb.smtpUsername || activeMb.email || 'M').charAt(0).toUpperCase() : 'M'}
                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border border-black" />
              </button>
            </div>
          )}
        </aside>

        {/* Center & Detail Panels with Configurable Reading Pane */}
        {readingPane === 'right' && (
          <>
            {/* Center Thread List Pane */}
            <div
              ref={threadListRef}
              style={{
                width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${threadListWidth}px` : undefined,
              }}
              className={`w-full lg:w-auto shrink-0 h-full border-r border-white/10 ${selectedMessageId ? 'hidden lg:block' : 'block'} relative`}
            >
              <ThreadList
                messages={messages}
                selectedMessageId={selectedMessageId}
                onSelectMessage={handleSelectMessage}
                activeFolder={activeFolder}
                activeCategory={activeCategory}
                onSelectCategory={(cat) => setActiveCategory(cat)}
                selectedIds={selectedIds}
                onToggleSelectAll={() => {
                  if (selectedIds.length === messages.length) setSelectedIds([]);
                  else setSelectedIds(messages.map((m) => m.id));
                }}
                onToggleSelectId={(id) => {
                  setSelectedIds((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  );
                }}
                onSelectByCondition={(type) => {
                  switch (type) {
                    case 'all':
                      setSelectedIds(messages.map((m) => m.id));
                      break;
                    case 'none':
                      setSelectedIds([]);
                      break;
                    case 'read':
                      setSelectedIds(messages.filter((m) => m.isRead).map((m) => m.id));
                      break;
                    case 'unread':
                      setSelectedIds(messages.filter((m) => !m.isRead).map((m) => m.id));
                      break;
                    case 'starred':
                      setSelectedIds(messages.filter((m) => m.isStarred).map((m) => m.id));
                      break;
                    case 'unstarred':
                      setSelectedIds(messages.filter((m) => !m.isStarred).map((m) => m.id));
                      break;
                  }
                }}
                onBulkAction={handleBulkAction}
                onToggleStar={handleToggleStar}
                onTogglePin={handleTogglePin}
                density={density}
                isLoading={isLoadingMessages}
              />
            </div>

            {/* Draggable Resizer Handle between ThreadList and Reading Pane */}
            <div
              onMouseDown={startThreadListResize}
              onDoubleClick={resetThreadListWidth}
              className={`hidden lg:flex items-center justify-center w-2 -ml-1 -mr-1 z-30 cursor-col-resize group select-none relative transition-colors ${
                isDraggingThreadList ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              title="Drag to resize pane width (Double-click to reset)"
            >
              {/* Subtle visual grip indicator */}
              <div
                className={`w-1 rounded-full transition-all ${
                  isDraggingThreadList
                    ? 'bg-white h-14 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                    : 'bg-white/25 group-hover:bg-white/80 h-8 group-hover:h-12'
                }`}
              />
            </div>

            {/* Right Detail Pane */}
            <div className={`flex-1 h-full min-w-0 ${selectedMessageId ? 'block' : 'hidden lg:block'}`}>
              {selectedMessageId ? (
                <ThreadViewer
                  messages={selectedThreadMessages}
                  subject={selectedThreadSubject}
                  onBack={() => setSelectedMessageId(null)}
                  onReply={handleOpenReply}
                  onReplyAll={(recipient, cc, replySub, msgId) => {
                    setComposerDefaultRecipient(recipient);
                    setComposerDefaultCc(cc);
                    setComposerDefaultSubject(replySub);
                    setComposerDefaultBody('');
                    setComposerInReplyTo(msgId);
                    setIsComposerOpen(true);
                  }}
                  onQuickReply={handleQuickReply}
                  onForward={handleOpenForward}
                  onForwardAsAttachment={(fwdSub, message) => {
                    setComposerDefaultRecipient('');
                    setComposerDefaultSubject(fwdSub);
                    setComposerDefaultBody(`<p>Attached is the original message for your reference.</p>`);
                    setComposerDefaultAttachments([
                      {
                        filename: `${message.subject || 'message'}.eml`,
                        sizeStr: '12 KB',
                        content: `From: ${message.senderName} <${message.senderEmail}>\nTo: ${message.recipientEmail}\nSubject: ${message.subject}\nDate: ${message.createdAt}\n\n${message.snippet}`,
                        contentType: 'message/rfc822',
                      },
                    ]);
                    setIsComposerOpen(true);
                  }}
                  onDelete={handleDeleteMessage}
                  onRestore={async (id) => {
                    await api.webmail.restoreMessage(id);
                    addToast('Message restored to Inbox', 'success');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  onStar={handleToggleStar}
                  onToggleImportant={async (id, currentImportant) => {
                    await api.webmail.setImportance(id, !currentImportant);
                    setMessages((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, priority: !currentImportant ? 'high' : 'normal' } : m))
                    );
                    setSelectedThreadMessages((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, priority: !currentImportant ? 'high' : 'normal' } : m))
                    );
                    addToast(!currentImportant ? 'Marked as Important' : 'Removed importance', 'info');
                  }}
                  onMarkUnread={async (id) => {
                    await api.webmail.patchMessage(id, { isRead: false });
                    setMessages((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, isRead: false } : m))
                    );
                    setSelectedMessageId(null);
                    addToast('Marked as unread', 'info');
                  }}
                  onMuteThread={async (threadId) => {
                    await api.webmail.muteThread(threadId);
                    addToast('Conversation muted and archived', 'info');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  onBlockSender={async (email) => {
                    await api.webmail.blockedSenders.add({ emailOrDomain: email });
                    addToast(`Blocked sender: ${email}`, 'info');
                  }}
                  onReportThreat={async (id, type) => {
                    await api.webmail.reportThreat(id, type);
                    addToast(`Reported as ${type} and moved to Spam`, 'info');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  onMoveFolder={async (id, targetFolder) => {
                    await api.webmail.moveMessage(id, targetFolder);
                    addToast(`Moved message to ${targetFolder}`, 'success');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  availableFolders={[
                    { id: 'inbox', name: 'Inbox' },
                    { id: 'archive', name: 'Archive' },
                    { id: 'spam', name: 'Spam' },
                    { id: 'trash', name: 'Trash' },
                    ...customFolders.map((f) => ({ id: f.name, name: f.name })),
                  ]}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 sm:p-10 bg-black text-center">
                  <div className="max-w-md w-full p-8 sm:p-10 rounded-2xl bg-[#171717] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
                    {/* Top ambient highlight */}
                    <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                    <div className="w-14 h-14 rounded-2xl bg-[#0a0a0a] border border-white/15 flex items-center justify-center text-white shadow-inner">
                      <Inbox className="w-7 h-7 text-neutral-300" />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-white tracking-tight">No message selected</h3>
                      <p className="text-xs text-neutral-400 max-w-xs sm:max-w-sm leading-relaxed">
                        Select an email thread from the inbox to read its contents or use quick keyboard actions.
                      </p>
                    </div>

                    {/* Quick Keyboard Actions */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full pt-1 text-[11px]">
                      <div className="px-2.5 py-2 rounded-xl bg-[#0a0a0a] border border-white/10 text-neutral-300 flex items-center gap-2 justify-center shadow-sm">
                        <kbd className="px-1.5 py-0.5 bg-black border border-white/20 rounded text-[10px] font-mono font-bold text-white">c</kbd>
                        <span>Compose</span>
                      </div>
                      <div className="px-2.5 py-2 rounded-xl bg-[#0a0a0a] border border-white/10 text-neutral-300 flex items-center gap-2 justify-center shadow-sm">
                        <kbd className="px-1.5 py-0.5 bg-black border border-white/20 rounded text-[10px] font-mono font-bold text-white">/</kbd>
                        <span>Search</span>
                      </div>
                      <div className="px-2.5 py-2 rounded-xl bg-[#0a0a0a] border border-white/10 text-neutral-300 flex items-center gap-2 justify-center shadow-sm">
                        <kbd className="px-1.5 py-0.5 bg-black border border-white/20 rounded text-[10px] font-mono font-bold text-white">j / k</kbd>
                        <span>Navigate</span>
                      </div>
                      <div className="px-2.5 py-2 rounded-xl bg-[#0a0a0a] border border-white/10 text-neutral-300 flex items-center gap-2 justify-center shadow-sm">
                        <kbd className="px-1.5 py-0.5 bg-black border border-white/20 rounded text-[10px] font-mono font-bold text-white">?</kbd>
                        <span>Help</span>
                      </div>
                    </div>

                    <div className="w-full pt-1">
                      <p className="text-[11px] text-neutral-500 font-medium">
                        Press <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-neutral-300">c</kbd> to compose or select a message from the list
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {readingPane === 'bottom' && (
          <div ref={bottomContainerRef} className="flex-1 flex flex-col h-full overflow-hidden">
            <div
              style={{
                height: selectedMessageId ? `${threadListHeight}px` : '100%',
              }}
              className={`w-full overflow-hidden shrink-0 border-b border-white/10`}
            >
              <ThreadList
                messages={messages}
                selectedMessageId={selectedMessageId}
                onSelectMessage={handleSelectMessage}
                activeFolder={activeFolder}
                activeCategory={activeCategory}
                onSelectCategory={(cat) => setActiveCategory(cat)}
                selectedIds={selectedIds}
                onToggleSelectAll={() => {
                  if (selectedIds.length === messages.length) setSelectedIds([]);
                  else setSelectedIds(messages.map((m) => m.id));
                }}
                onToggleSelectId={(id) => {
                  setSelectedIds((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  );
                }}
                onSelectByCondition={(type) => {
                  switch (type) {
                    case 'all':
                      setSelectedIds(messages.map((m) => m.id));
                      break;
                    case 'none':
                      setSelectedIds([]);
                      break;
                    case 'read':
                      setSelectedIds(messages.filter((m) => m.isRead).map((m) => m.id));
                      break;
                    case 'unread':
                      setSelectedIds(messages.filter((m) => !m.isRead).map((m) => m.id));
                      break;
                    case 'starred':
                      setSelectedIds(messages.filter((m) => m.isStarred).map((m) => m.id));
                      break;
                    case 'unstarred':
                      setSelectedIds(messages.filter((m) => !m.isStarred).map((m) => m.id));
                      break;
                  }
                }}
                onBulkAction={handleBulkAction}
                onToggleStar={handleToggleStar}
                onTogglePin={handleTogglePin}
                density={density}
                isLoading={isLoadingMessages}
              />
            </div>
            {selectedMessageId && (
              <>
                {/* Draggable Horizontal Resizer Handle */}
                <div
                  onMouseDown={startThreadHeightResize}
                  onDoubleClick={resetThreadHeight}
                  className={`flex items-center justify-center h-2 -mt-1 -mb-1 z-30 cursor-row-resize group select-none relative transition-colors ${
                    isDraggingThreadHeight ? 'bg-white/20' : 'hover:bg-white/10'
                  }`}
                  title="Drag to resize pane height (Double-click to reset)"
                >
                  <div
                    className={`h-1 rounded-full transition-all ${
                      isDraggingThreadHeight
                        ? 'bg-white w-14 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                        : 'bg-white/25 group-hover:bg-white/80 w-8 group-hover:w-12'
                    }`}
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ThreadViewer
                  messages={selectedThreadMessages}
                  subject={selectedThreadSubject}
                  onBack={() => setSelectedMessageId(null)}
                  onReply={handleOpenReply}
                  onReplyAll={(recipient, cc, replySub, msgId) => {
                    setComposerDefaultRecipient(recipient);
                    setComposerDefaultCc(cc);
                    setComposerDefaultSubject(replySub);
                    setComposerDefaultBody('');
                    setComposerInReplyTo(msgId);
                    setIsComposerOpen(true);
                  }}
                  onQuickReply={handleQuickReply}
                  onForward={handleOpenForward}
                  onForwardAsAttachment={(fwdSub, message) => {
                    setComposerDefaultRecipient('');
                    setComposerDefaultSubject(fwdSub);
                    setComposerDefaultBody(`<p>Attached is the original message for your reference.</p>`);
                    setComposerDefaultAttachments([
                      {
                        filename: `${message.subject || 'message'}.eml`,
                        sizeStr: '12 KB',
                        content: `From: ${message.senderName} <${message.senderEmail}>\nTo: ${message.recipientEmail}\nSubject: ${message.subject}\nDate: ${message.createdAt}\n\n${message.snippet}`,
                        contentType: 'message/rfc822',
                      },
                    ]);
                    setIsComposerOpen(true);
                  }}
                  onDelete={handleDeleteMessage}
                  onRestore={async (id) => {
                    await api.webmail.restoreMessage(id);
                    addToast('Message restored to Inbox', 'success');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  onStar={handleToggleStar}
                  onToggleImportant={async (id, currentImportant) => {
                    await api.webmail.setImportance(id, !currentImportant);
                    setMessages((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, priority: !currentImportant ? 'high' : 'normal' } : m))
                    );
                    setSelectedThreadMessages((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, priority: !currentImportant ? 'high' : 'normal' } : m))
                    );
                    addToast(!currentImportant ? 'Marked as Important' : 'Removed importance', 'info');
                  }}
                  onMarkUnread={async (id) => {
                    await api.webmail.patchMessage(id, { isRead: false });
                    setMessages((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, isRead: false } : m))
                    );
                    setSelectedMessageId(null);
                    addToast('Marked as unread', 'info');
                  }}
                  onMuteThread={async (threadId) => {
                    await api.webmail.muteThread(threadId);
                    addToast('Conversation muted and archived', 'info');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  onBlockSender={async (email) => {
                    await api.webmail.blockedSenders.add({ emailOrDomain: email });
                    addToast(`Blocked sender: ${email}`, 'info');
                  }}
                  onReportThreat={async (id, type) => {
                    await api.webmail.reportThreat(id, type);
                    addToast(`Reported as ${type} and moved to Spam`, 'info');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  onMoveFolder={async (id, targetFolder) => {
                    await api.webmail.moveMessage(id, targetFolder);
                    addToast(`Moved message to ${targetFolder}`, 'success');
                    setSelectedMessageId(null);
                    loadMessages();
                  }}
                  availableFolders={[
                    { id: 'inbox', name: 'Inbox' },
                    { id: 'archive', name: 'Archive' },
                    { id: 'spam', name: 'Spam' },
                    { id: 'trash', name: 'Trash' },
                    ...customFolders.map((f) => ({ id: f.name, name: f.name })),
                  ]}
                />
                </div>
              </>
            )}
          </div>
        )}

        {readingPane === 'off' && (
          <div className="flex-1 h-full overflow-hidden">
            {!selectedMessageId ? (
              <ThreadList
                messages={messages}
                selectedMessageId={selectedMessageId}
                onSelectMessage={handleSelectMessage}
                activeFolder={activeFolder}
                activeCategory={activeCategory}
                onSelectCategory={(cat) => setActiveCategory(cat)}
                selectedIds={selectedIds}
                onToggleSelectAll={() => {
                  if (selectedIds.length === messages.length) setSelectedIds([]);
                  else setSelectedIds(messages.map((m) => m.id));
                }}
                onToggleSelectId={(id) => {
                  setSelectedIds((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  );
                }}
                onSelectByCondition={(type) => {
                  switch (type) {
                    case 'all':
                      setSelectedIds(messages.map((m) => m.id));
                      break;
                    case 'none':
                      setSelectedIds([]);
                      break;
                    case 'read':
                      setSelectedIds(messages.filter((m) => m.isRead).map((m) => m.id));
                      break;
                    case 'unread':
                      setSelectedIds(messages.filter((m) => !m.isRead).map((m) => m.id));
                      break;
                    case 'starred':
                      setSelectedIds(messages.filter((m) => m.isStarred).map((m) => m.id));
                      break;
                    case 'unstarred':
                      setSelectedIds(messages.filter((m) => !m.isStarred).map((m) => m.id));
                      break;
                  }
                }}
                onBulkAction={handleBulkAction}
                onToggleStar={handleToggleStar}
                onTogglePin={handleTogglePin}
                density={density}
                isLoading={isLoadingMessages}
              />
            ) : (
              <ThreadViewer
                messages={selectedThreadMessages}
                subject={selectedThreadSubject}
                onBack={() => setSelectedMessageId(null)}
                onReply={handleOpenReply}
                onReplyAll={(recipient, cc, replySub, msgId) => {
                  setComposerDefaultRecipient(recipient);
                  setComposerDefaultCc(cc);
                  setComposerDefaultSubject(replySub);
                  setComposerDefaultBody('');
                  setComposerInReplyTo(msgId);
                  setIsComposerOpen(true);
                }}
                onQuickReply={handleQuickReply}
                onForward={handleOpenForward}
                onForwardAsAttachment={(fwdSub, message) => {
                  setComposerDefaultRecipient('');
                  setComposerDefaultSubject(fwdSub);
                  setComposerDefaultBody(`<p>Attached is the original message for your reference.</p>`);
                  setComposerDefaultAttachments([
                    {
                      filename: `${message.subject || 'message'}.eml`,
                      sizeStr: '12 KB',
                      content: `From: ${message.senderName} <${message.senderEmail}>\nTo: ${message.recipientEmail}\nSubject: ${message.subject}\nDate: ${message.createdAt}\n\n${message.snippet}`,
                      contentType: 'message/rfc822',
                    },
                  ]);
                  setIsComposerOpen(true);
                }}
                onDelete={handleDeleteMessage}
                onRestore={async (id) => {
                  await api.webmail.restoreMessage(id);
                  addToast('Message restored to Inbox', 'success');
                  setSelectedMessageId(null);
                  loadMessages();
                }}
                onStar={handleToggleStar}
                onToggleImportant={async (id, currentImportant) => {
                  await api.webmail.setImportance(id, !currentImportant);
                  setMessages((prev) =>
                    prev.map((m) => (m.id === id ? { ...m, priority: !currentImportant ? 'high' : 'normal' } : m))
                  );
                  setSelectedThreadMessages((prev) =>
                    prev.map((m) => (m.id === id ? { ...m, priority: !currentImportant ? 'high' : 'normal' } : m))
                  );
                  addToast(!currentImportant ? 'Marked as Important' : 'Removed importance', 'info');
                }}
                onMarkUnread={async (id) => {
                  await api.webmail.patchMessage(id, { isRead: false });
                  setMessages((prev) =>
                    prev.map((m) => (m.id === id ? { ...m, isRead: false } : m))
                  );
                  setSelectedMessageId(null);
                  addToast('Marked as unread', 'info');
                }}
                onMuteThread={async (threadId) => {
                  await api.webmail.muteThread(threadId);
                  addToast('Conversation muted and archived', 'info');
                  setSelectedMessageId(null);
                  loadMessages();
                }}
                onBlockSender={async (email) => {
                  await api.webmail.blockedSenders.add({ emailOrDomain: email });
                  addToast(`Blocked sender: ${email}`, 'info');
                }}
                onReportThreat={async (id, type) => {
                  await api.webmail.reportThreat(id, type);
                  addToast(`Reported as ${type} and moved to Spam`, 'info');
                  setSelectedMessageId(null);
                  loadMessages();
                }}
                onMoveFolder={async (id, targetFolder) => {
                  await api.webmail.moveMessage(id, targetFolder);
                  addToast(`Moved message to ${targetFolder}`, 'success');
                  setSelectedMessageId(null);
                  loadMessages();
                }}
                availableFolders={[
                  { id: 'inbox', name: 'Inbox' },
                  { id: 'archive', name: 'Archive' },
                  { id: 'spam', name: 'Spam' },
                  { id: 'trash', name: 'Trash' },
                  ...customFolders.map((f) => ({ id: f.name, name: f.name })),
                ]}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile Floating Compose Button */}
      {!selectedMessageId && (
        <button
          onClick={() => {
            setComposerDefaultRecipient('');
            setComposerDefaultCc('');
            setComposerDefaultBcc('');
            setComposerDefaultSubject('');
            setComposerDefaultBody('');
            setComposerDefaultAttachments([]);
            setComposerThreadId(undefined);
            setComposerInReplyTo(undefined);
            setIsComposerOpen(true);
          }}
          className="fixed bottom-6 right-6 z-30 lg:hidden shadow-2xl rounded-2xl p-3.5 bg-white text-black hover:bg-neutral-200 flex items-center gap-2 text-xs font-bold border border-white/20 active:scale-95 transition-all"
          title="Compose Email"
        >
          <PenSquare className="w-5 h-5" />
          <span>Compose</span>
        </button>
      )}

      {/* Keyboard Shortcuts Cheat-sheet Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#171717] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-white" /> Webmail Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowKeyboardHelp(false)} className="p-1 text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between items-center bg-black p-2 rounded-lg border border-white/10">
                <span className="text-neutral-400">Compose email</span>
                <kbd className="px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-xs rounded border border-white/20">c</kbd>
              </div>
              <div className="flex justify-between items-center bg-black p-2 rounded-lg border border-white/10">
                <span className="text-neutral-400">Focus search</span>
                <kbd className="px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-xs rounded border border-white/20">/</kbd>
              </div>
              <div className="flex justify-between items-center bg-black p-2 rounded-lg border border-white/10">
                <span className="text-neutral-400">Reply to thread</span>
                <kbd className="px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-xs rounded border border-white/20">r</kbd>
              </div>
              <div className="flex justify-between items-center bg-black p-2 rounded-lg border border-white/10">
                <span className="text-neutral-400">Forward thread</span>
                <kbd className="px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-xs rounded border border-white/20">f</kbd>
              </div>
              <div className="flex justify-between items-center bg-black p-2 rounded-lg border border-white/10">
                <span className="text-neutral-400">Archive thread</span>
                <kbd className="px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-xs rounded border border-white/20">e</kbd>
              </div>
              <div className="flex justify-between items-center bg-black p-2 rounded-lg border border-white/10">
                <span className="text-neutral-400">Move to trash</span>
                <kbd className="px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-xs rounded border border-white/20">#</kbd>
              </div>
            </div>
            <div className="pt-2 text-center">
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="w-full py-2 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-bold transition-all"
              >
                Close Shortcuts Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo-Send Notification Banner */}
      {pendingUndoSend && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#171717] border border-white/20 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="text-xs font-semibold text-white">
              Sending email... (5s window)
            </span>
          </div>
          <button
            onClick={handleExecuteUndo}
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-bold shadow-lg transition-all"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo Send
          </button>
        </div>
      )}

      {/* Action Toast Notifications with Undo */}
      <div className="fixed bottom-6 left-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[#171717] border border-white/15 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200"
          >
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{toast.message}</span>
            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction!();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="flex items-center gap-1 text-neutral-300 hover:text-white font-semibold underline text-xs ml-2"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Floating Composer Component */}
      <Composer
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        defaultRecipient={composerDefaultRecipient}
        defaultCc={composerDefaultCc}
        defaultBcc={composerDefaultBcc}
        defaultSubject={composerDefaultSubject}
        defaultBody={composerDefaultBody}
        defaultAttachments={composerDefaultAttachments}
        threadId={composerThreadId}
        inReplyTo={composerInReplyTo}
        smtpAccountId={activeMailboxId || undefined}
        availableSenders={availableSenders}
        onRequestUndoSend={handleRequestUndoSend}
        onSent={() => {
          addToast('Email message dispatched successfully!', 'success');
          loadMessages();
        }}
      />

      {/* Webmail Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mailboxes={mailboxes}
        activeMailboxId={activeMailboxId}
        onRefreshData={loadFoldersAndLabels}
        density={density}
        onDensityChange={handleChangeDensity}
        readingPane={readingPane}
        onReadingPaneChange={handleChangeReadingPane}
        userRole={userRole}
      />

      {/* Developer Credentials & System Provisioning Modal */}
      <WebmailCredentialsModal
        isOpen={isCredentialsOpen}
        onClose={() => setIsCredentialsOpen(false)}
        userRole={userRole}
        selectedMailboxId={activeMailboxId || undefined}
      />
    </div>
  );
};
