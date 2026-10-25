'use client';

import React, { useState } from 'react';
import { Mail, Check, ChevronDown, Plus, Server, ShieldCheck } from 'lucide-react';

export interface Mailbox {
  id: string;
  email?: string;
  smtpUsername: string;
  smtpHost: string;
  customDomain?: string;
  isActive: boolean;
  isDefault?: boolean;
}

interface MailboxSwitcherProps {
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  onSelectMailbox: (mailboxId: string) => void;
  onManageMailboxes?: () => void;
}

export const MailboxSwitcher: React.FC<MailboxSwitcherProps> = ({
  mailboxes,
  activeMailboxId,
  onSelectMailbox,
  onManageMailboxes,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeMailbox = mailboxes.find((m) => m.id === activeMailboxId) || mailboxes[0];

  const getFullEmail = (m?: Mailbox) => {
    if (!m) return 'Select Mailbox';
    if (m.email) return m.email;
    if (m.smtpUsername.includes('@')) return m.smtpUsername;
    const domain = m.customDomain || m.smtpHost.replace(/^mail\./, '');
    return `${m.smtpUsername}@${domain}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all text-sm font-medium text-slate-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {activeMailbox ? activeMailbox.smtpUsername.charAt(0).toUpperCase() : 'M'}
        </div>
        <div className="flex flex-col text-left max-w-[180px] sm:max-w-[220px] truncate">
          <span className="truncate text-xs font-semibold text-slate-200">
            {getFullEmail(activeMailbox)}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400 inline" /> Enterprise Mail
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 py-2 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Active Mailbox Accounts</p>
            </div>
            <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
              {mailboxes.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400 text-center">
                  No mailboxes found. Create one in the Dashboard.
                </div>
              ) : (
                mailboxes.map((mb) => {
                  const fullEmail = getFullEmail(mb);
                  const isSelected = mb.id === activeMailboxId;
                  return (
                    <button
                      key={mb.id}
                      onClick={() => {
                        onSelectMailbox(mb.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/80 transition-colors text-xs ${
                        isSelected ? 'bg-indigo-500/10 text-indigo-300 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {mb.smtpUsername.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate flex flex-col">
                          <span className="truncate">{fullEmail}</span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Server className="w-2.5 h-2.5" /> {mb.smtpHost}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
            {onManageMailboxes && (
              <div className="pt-1 px-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onManageMailboxes();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Manage Email Accounts
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
