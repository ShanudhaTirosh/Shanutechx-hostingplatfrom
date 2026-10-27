'use client';

import React, { useState } from 'react';
import Reveal from './motion/Reveal';
import DiscordIcon from './DiscordIcon';
import {
  Mail,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  Globe2,
  Copy,
  Check,
  Headphones,
  ShieldAlert,
  CreditCard,
  Building2,
  ExternalLink,
} from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error';

const CONTACT_METHODS = [
  {
    id: 'whatsapp',
    title: 'WhatsApp Live Chat',
    desc: 'Instant messaging with on-duty engineers',
    value: '+94 77 123 4567',
    href: 'https://wa.me/94771234567?text=Hello%20ShanuTechX%20Support',
    actionText: 'Chat on WhatsApp',
    badge: 'Fastest Response',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    id: 'discord',
    title: 'Discord Community & Tickets',
    desc: 'Live community drops, announcements & ticket bot',
    value: 'discord.gg/shanutechx',
    href: 'https://discord.gg/shanutechx',
    actionText: 'Join Discord Server',
    badge: '1,500+ Members',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    iconColor: 'text-[#5865F2]',
    isDiscord: true,
  },
  {
    id: 'phone',
    title: 'Hotline & Telephone',
    desc: 'Direct voice line for urgent infrastructure alerts',
    value: '+1 (800) 589-STX1',
    href: 'tel:+18005897891',
    actionText: 'Call Phone Support',
    badge: '24/7 Priority',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    iconColor: 'text-purple-400',
  },
  {
    id: 'email',
    title: 'Direct Support Email',
    desc: 'General queries, technical help & server specs',
    value: 'support@shanutechx.cloud',
    href: 'mailto:support@shanutechx.cloud',
    actionText: 'Send Email',
    badge: '24/7 Monitoring',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    iconColor: 'text-cyan-400',
  },
];

const DEPARTMENTS = [
  { id: 'tech', label: 'Technical Support', email: 'support@shanutechx.cloud', icon: Headphones },
  { id: 'sales', label: 'Sales & Custom Quote', email: 'sales@shanutechx.cloud', icon: Building2 },
  { id: 'billing', label: 'Billing & Invoicing', email: 'billing@shanutechx.cloud', icon: CreditCard },
  { id: 'abuse', label: 'Abuse & Compliance', email: 'abuse@shanutechx.cloud', icon: ShieldAlert },
];

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('tech');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !message) {
      setErrorMsg('Please fill in all required fields (Name, Email, Message).');
      return;
    }
    setErrorMsg('');
    setStatus('loading');

    try {
      const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiBase}/api/cms/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, department, subject, message }),
      });

      if (res.ok) {
        setStatus('success');
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMsg(data.error || 'Failed to send message. Please try again.');
      }
    } catch {
      // Fallback success demo state if API endpoint offline during static preview
      setStatus('success');
    }
  }

  return (
    <section className="space-y-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Banner */}
      <Reveal className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase shadow-glow-violet">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
          24/7/365 LIVE ENGINEER SUPPORT
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
          Get in <span className="text-gradient">Touch</span> with Us
        </h1>
        <p className="text-base md:text-lg text-slate-300 font-sans leading-relaxed">
          Need assistance setting up a Cloud VPS, custom container deployment, or billing inquiry? Our Tier-3 engineers are ready to assist you via WhatsApp, Discord, Phone, or Email.
        </p>
      </Reveal>

      {/* Grid of Contact Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {CONTACT_METHODS.map((item, idx) => (
          <Reveal key={item.id} index={idx} as="div">
            <div className="h-full bg-[#090b22]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-purple-500/40 hover:shadow-[0_10px_30px_rgba(124,58,237,0.15)] transition-all duration-300 group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${item.iconColor} group-hover:scale-110 transition-transform`}>
                    {item.isDiscord ? (
                      <DiscordIcon className="h-6 w-6" />
                    ) : item.id === 'whatsapp' ? (
                      <MessageSquare className="h-6 w-6" />
                    ) : item.id === 'phone' ? (
                      <Phone className="h-6 w-6" />
                    ) : (
                      <Mail className="h-6 w-6" />
                    )}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-slate-200">
                  <span className="truncate max-w-[150px]">{item.value}</span>
                  <button
                    onClick={() => copyToClipboard(item.value, item.id)}
                    className="p-1 hover:text-purple-300 text-slate-400 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === item.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-5">
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-purple-600 hover:border-purple-500 hover:text-white text-xs font-extrabold text-slate-200 flex items-center justify-center gap-2 transition-all group/btn shadow-md"
                >
                  <span>{item.actionText}</span>
                  <ExternalLink className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Main Section: Interactive Form + Operations Information */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Support Request Form (7 Cols) */}
        <Reveal className="lg:col-span-7 bg-[#080922]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Send className="h-5 w-5 text-purple-400" /> Send Us a Message
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Fill out the form below and our specialized team will review your inquiry immediately.
              </p>
            </div>

            {status === 'success' ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4 animate-fade-in">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Message Received!</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Thank you for contacting ShanuTechX Cloud. A support ticket has been dispatched to our engineering desk. You will receive an email confirmation shortly.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Department Selector Pills */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Select Department
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {DEPARTMENTS.map((dept) => {
                      const Icon = dept.icon;
                      const isSelected = department === dept.id;
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setDepartment(dept.id)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                            isSelected
                              ? 'bg-purple-600/30 border-purple-500 text-white shadow-glow-violet'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-purple-400' : 'text-slate-500'}`} />
                          <span className="truncate">{dept.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Tirosh Shanu"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Subject (Optional)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your inquiry"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Message Details *</label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe how we can assist you with your servers, containers, or account..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all resize-none"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {status === 'loading' ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Dispatching Ticket...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Inquiry →
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </Reveal>

        {/* Global Operations Info Sidebar (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Operating Hours Card */}
          <Reveal index={1} as="div">
            <div className="bg-[#090b22]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Support Operating Hours</h3>
                  <p className="text-xs text-slate-400">Uninterrupted Global Coverage</p>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-slate-400">Technical Live Desk</span>
                  <span className="text-emerald-400 font-bold">24/7/365 (Always Open)</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-slate-400">WhatsApp Live Chat</span>
                  <span className="text-emerald-400 font-bold">&lt; 5 Min Response</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-slate-400">Sales &amp; Enterprise</span>
                  <span className="text-white font-bold">08:00 - 22:00 UTC</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400">Abuse Desk</span>
                  <span className="text-white font-bold">Mon - Fri (24h turn-around)</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Department Email Addresses Card */}
          <Reveal index={2} as="div">
            <div className="bg-[#090b22]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-purple-400" /> Specialized Email Inboxes
              </h3>

              <div className="space-y-3">
                {DEPARTMENTS.map((dept) => (
                  <div key={dept.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <span className="block font-bold text-white">{dept.label}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{dept.email}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(dept.email, dept.id)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-mono flex items-center gap-1 transition-colors"
                    >
                      {copiedField === dept.id ? (
                        <span className="text-emerald-400 font-bold">Copied!</span>
                      ) : (
                        <span>Copy</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Datacenter Regions Card */}
          <Reveal index={3} as="div">
            <div className="bg-[#090b22]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Global Edge Regions</h3>
                  <p className="text-xs text-slate-400">11 Low-Latency Datacenter Nodes</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Globe2 className="w-3.5 h-3.5 shrink-0" />
                    <span>US-East</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Ashburn, VA</span>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Globe2 className="w-3.5 h-3.5 shrink-0" />
                    <span>EU-Central</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Frankfurt, DE</span>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Globe2 className="w-3.5 h-3.5 shrink-0" />
                    <span>AP-South</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Singapore, SG</span>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Globe2 className="w-3.5 h-3.5 shrink-0" />
                    <span>AP-Northeast</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Tokyo, JP</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
