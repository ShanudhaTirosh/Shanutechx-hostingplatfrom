'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Settings, FileSignature, FileText, Sun, Ban, X, Trash2, Plus, Zap, HardDrive, MailCheck, ArrowUpCircle, CheckCircle2, ExternalLink } from 'lucide-react';

interface WebmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailSettingsModal({ isOpen, onClose }: WebmailSettingsModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'signatures' | 'templates' | 'autoreply' | 'blocklist' | 'upgrade'>('signatures');

  // Upgrade tab state
  const [mailboxInfo, setMailboxInfo] = useState<any | null>(null);

  const [signatures, setSignatures] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [autoReply, setAutoReply] = useState<any | null>(null);
  const [blockedSenders, setBlockedSenders] = useState<any[]>([]);

  const [sigName, setSigName] = useState('');
  const [sigHtml, setSigHtml] = useState('');

  const [tempName, setTempName] = useState('');
  const [tempSubject, setTempSubject] = useState('');
  const [tempBody, setTempBody] = useState('');

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoSubject, setAutoSubject] = useState('Out of Office');
  const [autoBody, setAutoBody] = useState('I am currently away and will reply upon return.');

  const [blockInput, setBlockInput] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchAllSettings();
      // Load mailbox info for the upgrade tab
      api.email.mailboxes().then((r) => {
        if (r.mailboxes && r.mailboxes.length > 0) setMailboxInfo(r.mailboxes[0]);
      }).catch(() => {});
    }
  }, [isOpen]);

  const fetchAllSettings = () => {
    api.webmail.signatures.list().then((r) => setSignatures(r.signatures || [])).catch(() => {});
    api.webmail.templates.list().then((r) => setTemplates(r.templates || [])).catch(() => {});
    api.webmail.autoReply.get().then((r) => {
      if (r.autoReply) {
        setAutoReply(r.autoReply);
        setAutoEnabled(r.autoReply.enabled);
        setAutoSubject(r.autoReply.subject);
        setAutoBody(r.autoReply.body);
      }
    }).catch(() => {});
    api.webmail.blockedSenders.list().then((r) => setBlockedSenders(r.blockedSenders || [])).catch(() => {});
  };

  if (!isOpen) return null;

  const handleSaveSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sigName || !sigHtml) return;
    try {
      await api.webmail.signatures.create({ name: sigName, htmlContent: sigHtml, isDefault: signatures.length === 0 });
      toast(`Signature "${sigName}" created!`, 'success');
      setSigName('');
      setSigHtml('');
      fetchAllSettings();
    } catch {
      toast('Failed to save signature', 'error');
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName || !tempBody) return;
    try {
      await api.webmail.templates.create({ name: tempName, subject: tempSubject, body: tempBody });
      toast(`Template "${tempName}" created!`, 'success');
      setTempName('');
      setTempSubject('');
      setTempBody('');
      fetchAllSettings();
    } catch {
      toast('Failed to save template', 'error');
    }
  };

  const handleSaveAutoReply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.webmail.autoReply.save({ enabled: autoEnabled, subject: autoSubject, body: autoBody });
      toast('Vacation auto-responder updated!', 'success');
      fetchAllSettings();
    } catch {
      toast('Failed to save auto-reply', 'error');
    }
  };

  const handleAddBlockedSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockInput) return;
    try {
      await api.webmail.blockedSenders.add({ emailOrDomain: blockInput });
      toast(`Blocked ${blockInput}`, 'info');
      setBlockInput('');
      fetchAllSettings();
    } catch {
      toast('Failed to block sender', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-400" />
            <span>Webmail Studio Settings & Preferences</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SUB TABS */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
          {[
            { id: 'signatures', label: 'Signatures', icon: FileSignature },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'autoreply', label: 'Vacation Reply', icon: Sun },
            { id: 'blocklist', label: 'Blocklist', icon: Ban },
            { id: 'upgrade', label: 'Upgrade', icon: Zap },
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex-1 min-w-[72px] py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                  activeSubTab === tab.id
                    ? tab.id === 'upgrade' ? 'bg-amber-500 text-white shadow' : 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <IconComp className="h-3 w-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: SIGNATURES */}
        {activeSubTab === 'signatures' && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleSaveSignature} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-indigo-400">Add New HTML Signature</h4>
              <input
                type="text"
                placeholder="Signature Label (e.g. Official Corporate)"
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <textarea
                rows={3}
                placeholder="HTML Signature (e.g. Best regards,<br/><b>Mike Robertson</b><br/>ShanuTechX Cloud)"
                value={sigHtml}
                onChange={(e) => setSigHtml(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white resize-none font-mono"
                required
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Save Signature</span>
              </button>
            </form>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {signatures.map((s) => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-start">
                  <div>
                    <span className="font-bold text-white">{s.name}</span> {s.isDefault && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded ml-2">Default</span>}
                    <div className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">{s.htmlContent}</div>
                  </div>
                  <button onClick={() => api.webmail.signatures.delete(s.id).then(fetchAllSettings)} className="text-slate-500 hover:text-rose-400 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: TEMPLATES */}
        {activeSubTab === 'templates' && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleSaveTemplate} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-indigo-400">Create Canned Response / Template</h4>
              <input
                type="text"
                placeholder="Template Title (e.g. Sales Inquiry Response)"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <input
                type="text"
                placeholder="Default Subject Line"
                value={tempSubject}
                onChange={(e) => setTempSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <textarea
                rows={3}
                placeholder="Template body..."
                value={tempBody}
                onChange={(e) => setTempBody(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white resize-none"
                required
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Save Template</span>
              </button>
            </form>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {templates.map((t) => (
                <div key={t.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-start">
                  <div>
                    <span className="font-bold text-white">{t.name}</span>
                    <p className="text-[11px] text-slate-400 truncate">{t.body}</p>
                  </div>
                  <button onClick={() => api.webmail.templates.delete(t.id).then(fetchAllSettings)} className="text-slate-500 hover:text-rose-400 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VACATION AUTO-REPLY */}
        {activeSubTab === 'autoreply' && (
          <form onSubmit={handleSaveAutoReply} className="space-y-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Enable Out of Office Auto-Reply</span>
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => setAutoEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 h-4 w-4 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Subject Line:</label>
                <input
                  type="text"
                  value={autoSubject}
                  onChange={(e) => setAutoSubject(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Auto-Reply Message Body:</label>
                <textarea
                  rows={4}
                  value={autoBody}
                  onChange={(e) => setAutoBody(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white resize-none"
                />
              </div>

              <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow">
                Save Auto-Reply Settings
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: BLOCKLIST */}
        {activeSubTab === 'blocklist' && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleAddBlockedSender} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Block email or domain (e.g. spammer@domain.com or @badspammer.com)"
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl shadow flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5" />
                <span>Block Sender</span>
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {blockedSenders.map((b) => (
                <div key={b.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono text-rose-300 font-bold">{b.emailOrDomain}</span>
                  <button onClick={() => api.webmail.blockedSenders.delete(b.id).then(fetchAllSettings)} className="text-slate-500 hover:text-white text-xs p-1">
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: MAILBOX UPGRADE */}
        {activeSubTab === 'upgrade' && (
          <div className="space-y-5 text-xs">
            {/* Current usage summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                Current Mailbox Usage
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] mb-1">Storage Quota</span>
                  <span className="font-extrabold text-white text-sm">
                    {mailboxInfo?.storageQuotaMb ? `${mailboxInfo.storageQuotaMb} MB` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] mb-1">Daily Send Limit</span>
                  <span className="font-extrabold text-white text-sm">
                    {mailboxInfo?.dailySendLimit ?? '—'} emails/day
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2">
                <MailCheck className="h-4 w-4 text-indigo-400" />
                <span className="text-slate-300">
                  <span className="font-bold text-white">{mailboxInfo?.email || '—'}</span>
                  {' '}&mdash; {mailboxInfo?.isActive ? (
                    <span className="text-emerald-400 font-bold">Active</span>
                  ) : (
                    <span className="text-rose-400 font-bold">Suspended</span>
                  )}
                </span>
              </div>
            </div>

            {/* Upgrade plan cards */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Available Upgrade Plans</h4>
              {[
                {
                  name: 'Starter',
                  storage: '2 GB',
                  sends: 500,
                  price: 'Free',
                  features: ['IMAP/SMTP Access', 'Basic Filters', '1 Alias'],
                  color: 'border-slate-700',
                  badge: 'text-slate-400 bg-slate-800',
                  current: !mailboxInfo?.storageQuotaMb || mailboxInfo.storageQuotaMb <= 2048,
                },
                {
                  name: 'Professional',
                  storage: '10 GB',
                  sends: 2000,
                  price: '$4/mo',
                  features: ['Everything in Starter', 'AI Drafts & Summarise', '5 Aliases', 'Priority Support'],
                  color: 'border-indigo-500/40',
                  badge: 'text-indigo-300 bg-indigo-500/20',
                  current: mailboxInfo?.storageQuotaMb > 2048 && mailboxInfo?.storageQuotaMb <= 10240,
                },
                {
                  name: 'Business',
                  storage: '50 GB',
                  sends: 10000,
                  price: '$12/mo',
                  features: ['Everything in Pro', 'Custom Domain', '20 Aliases', 'Delegated Admin', 'SLA 99.9%'],
                  color: 'border-amber-500/40',
                  badge: 'text-amber-300 bg-amber-500/20',
                  current: mailboxInfo?.storageQuotaMb > 10240,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`p-4 rounded-2xl border ${plan.color} bg-slate-950 flex items-start justify-between gap-3`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${plan.badge}`}>{plan.name}</span>
                      {plan.current && (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-300">
                      <span><HardDrive className="h-3 w-3 inline mr-1 text-slate-500" />{plan.storage}</span>
                      <span><MailCheck className="h-3 w-3 inline mr-1 text-slate-500" />{plan.sends.toLocaleString()} sends/day</span>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-slate-400">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-white">{plan.price}</p>
                    {!plan.current && (
                      <a
                        href="/dashboard/billing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-xl transition-all"
                      >
                        <ArrowUpCircle className="h-3 w-3" />
                        Upgrade
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-[10px] text-slate-600">
              To change your mailbox plan, visit the Billing section of your dashboard.
              Upgrades apply immediately after payment approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
