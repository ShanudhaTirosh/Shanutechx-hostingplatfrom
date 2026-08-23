'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';

interface Mailbox {
  id: string;
  email: string;
  username: string;
  smtpHost: string;
  smtpPort: number;
  sslPort: number;
  storageUsedMb: number;
  storageQuotaMb: number;
  dailySendCount: number;
  dailySendLimit: number;
  status: string;
  planName: string;
  webmailUrl: string;
  createdAt: string;
}

interface Domain {
  id: string;
  domain: string;
  status: 'verified' | 'pending_dns';
  mxRecord: string;
  spfRecord: string;
  dkimRecord: string;
  dmarcRecord: string;
}

interface EmailMessage {
  id: string;
  from: string;
  fromAvatar?: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  folder: 'inbox' | 'starred' | 'delayed' | 'sent';
  tag?: 'Documents' | 'Work' | 'News' | 'Important';
  isRead: boolean;
  isStarred: boolean;
  timestamp: string;
}

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

interface UpcomingEvent {
  id: string;
  title: string;
  dateStr: string;
  timeStr: string;
  participants: string[];
}

const DEMO_MESSAGES: EmailMessage[] = [
  {
    id: 'msg-1',
    from: 'Mike Robertson',
    fromAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    to: 'me@shanutechx.com',
    subject: 'Landing page design system update',
    snippet: 'Hey team, I updated the typography hierarchy and color variables for the new landing page...',
    body: 'Hey team,\n\nI updated the typography hierarchy and color variables for the new landing page components. Please take a look at the attached preview and share feedback before end of day.\n\nBest regards,\nMike',
    folder: 'inbox',
    tag: 'Work',
    isRead: false,
    isStarred: true,
    timestamp: '10:42 AM',
  },
  {
    id: 'msg-2',
    from: 'TechCrunch Newsletter',
    to: 'me@shanutechx.com',
    subject: 'Weekly AI Roundup & Cloud Infrastructure Trends',
    snippet: 'This week in AI: Next-generation agentic assistants, serverless scale-to-zero databases...',
    body: 'Welcome to this week\'s edition of TechCrunch Cloud & AI Insights. In today\'s issue:\n- Autonomous Agentic Coding\n- Edge compute optimization\n- Multi-cloud PaaS deployment tools',
    folder: 'inbox',
    tag: 'News',
    isRead: false,
    isStarred: false,
    timestamp: 'Yesterday',
  },
  {
    id: 'msg-3',
    from: 'Finance Department',
    to: 'me@shanutechx.com',
    subject: 'Invoice #STX-2026-8890 Paid Successfully',
    snippet: 'Your monthly payment for ShanuTechX Enterprise Hosting has been processed successfully...',
    body: 'Dear Customer,\n\nYour invoice #STX-2026-8890 has been paid successfully via Stripe. Thank you for choosing ShanuTechX PaaS Cloud platform.',
    folder: 'inbox',
    tag: 'Documents',
    isRead: true,
    isStarred: false,
    timestamp: '18 May',
  },
  {
    id: 'msg-4',
    from: 'Security Operations',
    to: 'me@shanutechx.com',
    subject: 'SSL Certificate Auto-Renewal Notice for Domain',
    snippet: 'Let\'s Encrypt SSL certificate for custom domain webmail.shanutechx.com renewed...',
    body: 'Automated notification: Let\'s Encrypt SSL certificate auto-renewed successfully for webmail.shanutechx.com.',
    folder: 'inbox',
    tag: 'Important',
    isRead: true,
    isStarred: true,
    timestamp: '15 May',
  },
];

const INITIAL_TODOS: TodoItem[] = [
  { id: 't1', title: 'Design landing page for Oylers', completed: true },
  { id: 't2', title: 'AI research & study', completed: true },
  { id: 't3', title: 'Setup Claude Code for Mike', completed: false },
  { id: 't4', title: 'Publish 3 designs on Dribbble', completed: false },
  { id: 't5', title: 'Buy more coffee filters', completed: false },
];

const INITIAL_EVENTS: UpcomingEvent[] = [
  {
    id: 'e1',
    title: 'Brainstorm UI Redesign',
    dateStr: '16 May',
    timeStr: '10:30 AM',
    participants: ['M', 'S', 'A'],
  },
  {
    id: 'e2',
    title: 'Team Sync & Standup',
    dateStr: '18 May',
    timeStr: '12:00 PM',
    participants: ['D', 'K'],
  },
];

export default function RedesignedMailboxPage() {
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'delayed' | 'sent'>('inbox');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<EmailMessage[]>(DEMO_MESSAGES);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(DEMO_MESSAGES[0]);

  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
  const [newTodoText, setNewTodoText] = useState('');
  const [events, setEvents] = useState<UpcomingEvent[]>(INITIAL_EVENTS);

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    api.email.mailboxes().then((res) => setMailboxes(res.mailboxes || [])).catch(() => {});
    api.email.domains().then((res) => setDomains(res.domains || [])).catch(() => {});
    api.email.messages(activeFolder).then((res) => {
      if (res.messages && res.messages.length > 0) {
        setMessages(res.messages);
        setSelectedMessage(res.messages[0]);
      }
    }).catch(() => {});

    // Fetch live Todos & Events from API
    fetch('/api/email/todos').then((r) => r.json()).then((d) => {
      if (d.todos) setTodos(d.todos);
    }).catch(() => {});
    fetch('/api/email/events').then((r) => r.json()).then((d) => {
      if (d.events) setEvents(d.events);
    }).catch(() => {});
  }, [activeFolder]);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStarred: !m.isStarred } : m))
    );
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    setTodos((prev) => [...prev, { id: `t-${Date.now()}`, title: newTodoText.trim(), completed: false }]);
    setNewTodoText('');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.email.send({
        from: mailboxes[0]?.email || 'me@shanutechx.com',
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
      toast(`Email sent to ${composeTo}!`, 'success');
      setShowComposeModal(false);
      const newMsg: EmailMessage = {
        id: `msg-${Date.now()}`,
        from: 'Me',
        to: composeTo,
        subject: composeSubject,
        snippet: composeBody.slice(0, 80),
        body: composeBody,
        folder: 'sent',
        isRead: true,
        isStarred: false,
        timestamp: 'Just now',
      };
      setMessages((prev) => [newMsg, ...prev]);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (err: any) {
      toast(err.message || 'Failed to send email', 'error');
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (activeFolder === 'starred' && !m.isStarred) return false;
    if (activeFolder !== 'starred' && m.folder !== activeFolder) return false;
    if (activeTag && m.tag !== activeTag) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.subject.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadMessages = filteredMessages.filter((m) => !m.isRead);
  const readMessages = filteredMessages.filter((m) => m.isRead);

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-[#1c1d22] font-sans p-4 md:p-6 flex flex-col gap-6 animate-fade-in">
      {/* Top Header Bar */}
      <div className="bg-white rounded-3xl p-4 px-6 shadow-sm border border-slate-200/80 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-indigo-500/20">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">ShanuTechX Mailbox Studio</h1>
            <p className="text-xs text-slate-500">Production-grade business webmail & SMTP infrastructure</p>
          </div>
        </div>

        {/* Global Search & Action CTA */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail..."
              className="w-full bg-slate-100 border border-slate-200 rounded-full py-2 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>

          <button
            onClick={() => setShowComposeModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-5 rounded-full flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-sm">+</span>
            <span>New email</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* COLUMN 1: LEFT NAVIGATION SIDEBAR (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            {/* Account Profile Selector */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs">
                  ST
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate">ShanutechX</p>
                  <p className="text-[11px] text-slate-500 truncate">{mailboxes[0]?.email || 'me@shanutechx.com'}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">▼</span>
            </div>

            {/* Folder Links */}
            <div className="space-y-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 mb-2">Mailbox</p>
              {[
                { id: 'inbox', label: 'Inbox', badge: 4, icon: '📥' },
                { id: 'starred', label: 'Starred', badge: 380, icon: '★' },
                { id: 'delayed', label: 'Delayed', badge: 16, icon: '⏰' },
                { id: 'sent', label: 'Sent', badge: 40839, icon: '📤' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveFolder(item.id as any); setActiveTag(null); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    activeFolder === item.id && !activeTag
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeFolder === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {item.badge.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>

            {/* Tags Section */}
            <div className="space-y-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 mb-2">Tags</p>
              {[
                { name: 'Documents', color: 'bg-emerald-500', count: 205 },
                { name: 'Work', color: 'bg-indigo-500', count: 1038 },
                { name: 'News', color: 'bg-amber-500', count: 23604 },
                { name: 'Important', color: 'bg-rose-500', count: 89 },
              ].map((tag) => (
                <button
                  key={tag.name}
                  onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs font-medium transition-all ${
                    activeTag === tag.name ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${tag.color}`} />
                    <span>{tag.name}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{tag.count.toLocaleString()}</span>
                </button>
              ))}
            </div>

            {/* Files Section */}
            <div className="space-y-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 mb-2">Files</p>
              <div className="flex items-center justify-between px-3.5 py-1.5 text-xs text-slate-600">
                <span>📁 All Files</span>
                <span className="text-[10px] text-slate-400 font-mono">5,903</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-1.5 text-xs text-slate-600">
                <span>⭐ Starred Files</span>
                <span className="text-[10px] text-slate-400 font-mono">120</span>
              </div>
            </div>
          </div>

          {/* Bottom Storage Meter Bar (Reference Mockup matching) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800">Storage usage</span>
              <span className="text-[11px] font-mono text-slate-500">
                {((mailboxes[0]?.storageUsedMb || 434.68) / 1024).toFixed(2)} GB / {((mailboxes[0]?.storageQuotaMb || 51200) / 1024).toFixed(0)} GB
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((mailboxes[0]?.storageUsedMb || 434.68) / (mailboxes[0]?.storageQuotaMb || 51200)) * 100
                    ) || 12
                  )}%`,
                }}
              />
            </div>
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-sm">
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* COLUMN 2: CENTER EMAIL LIST (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 capitalize flex items-center gap-2">
              <span>{activeFolder}</span>
              {activeTag && <span className="text-xs font-normal text-slate-500">/ {activeTag}</span>}
            </h2>
            <span className="text-xs text-slate-400 font-mono">{filteredMessages.length} messages</span>
          </div>

          <div className="space-y-6 overflow-y-auto max-h-[720px] pr-1">
            {/* UNREAD SECTION */}
            {unreadMessages.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">Unread ({unreadMessages.length})</p>
                <div className="space-y-2">
                  {unreadMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                        selectedMessage?.id === msg.id
                          ? 'bg-indigo-50/60 border-indigo-200 shadow-sm'
                          : 'bg-slate-50/60 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <input type="checkbox" className="mt-1 rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                      <div className="h-9 w-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                        {msg.from[0]}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 truncate">{msg.from}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 truncate">{msg.subject}</p>
                        <p className="text-[11px] text-slate-500 truncate">{msg.snippet}</p>
                        {msg.tag && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">
                            {msg.tag}
                          </span>
                        )}
                      </div>
                      <button onClick={(e) => toggleStar(msg.id, e)} className="text-slate-300 hover:text-amber-400 text-sm">
                        {msg.isStarred ? '★' : '☆'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MARKED AS READ SECTION */}
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Marked as read</p>
              <div className="space-y-2">
                {readMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMessage?.id === msg.id
                        ? 'bg-slate-100 border-slate-300 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <input type="checkbox" className="mt-1 rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                    <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                      {msg.from[0]}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-800 truncate">{msg.from}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 truncate">{msg.subject}</p>
                      <p className="text-[11px] text-slate-400 truncate">{msg.snippet}</p>
                    </div>
                    <button onClick={(e) => toggleStar(msg.id, e)} className="text-slate-300 hover:text-amber-400 text-sm">
                      {msg.isStarred ? '★' : '☆'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: RIGHT ACTION WIDGETS & TO-DO / EVENTS (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Widget 1: This Week To-do Checklist */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">This Week To-do</h3>
              <span className="text-[11px] text-indigo-600 font-bold cursor-pointer hover:underline">View all</span>
            </div>

            <div className="space-y-2.5">
              {todos.map((todo) => (
                <label
                  key={todo.id}
                  onClick={() => toggleTodo(todo.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    todo.completed ? 'bg-slate-50 border-slate-100 text-slate-400 line-through' : 'bg-white border-slate-200/80 text-slate-800 font-medium'
                  }`}
                >
                  <input type="checkbox" checked={todo.completed} onChange={() => {}} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs">{todo.title}</span>
                </label>
              ))}
            </div>

            <form onSubmit={handleAddTodo} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add to-do item..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button type="submit" className="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs">Add</button>
            </form>
          </div>

          {/* Widget 2: Upcoming Events Calendar Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">Upcoming Events</h3>
              <span className="text-[11px] text-indigo-600 font-bold cursor-pointer hover:underline">Calendar</span>
            </div>

            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">{ev.title}</p>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {ev.dateStr}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">🕒 {ev.timeStr}</p>
                  <div className="flex items-center -space-x-1.5 pt-1">
                    {ev.participants.map((p, idx) => (
                      <div key={idx} className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] border-2 border-white">
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compose Email Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">New Email Message</h3>
              <button onClick={() => setShowComposeModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">To</label>
                <input
                  type="email" required value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@domain.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Subject</label>
                <input
                  type="text" required value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Message</label>
                <textarea
                  rows={6} required value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write message..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowComposeModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={sending} className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md">
                  {sending ? 'Sending...' : 'Send Email →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
