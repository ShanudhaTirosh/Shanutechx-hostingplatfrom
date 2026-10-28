'use client';

import React, { useState } from 'react';
import { Mail, Check, ChevronDown, Plus, Server, ShieldCheck, Tag } from 'lucide-react';

export interface Mailbox {
  id: string;
  email?: string;
  smtpUsername: string;
  smtpHost: string;
  customDomain?: string;
  isActive: boolean;
  isDefault?: boolean;
  aliases?: string[];
  storageUsedMb?: number;
  storageQuotaMb?: number;
}

interface MailboxSwitcherProps {
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  activeAlias?: string | null;
  onSelectMailbox: (mailboxId: string) => void;
  onSelectAlias?: (alias: string | null) => void;
  onManageMailboxes?: () => void;
}

export const MailboxSwitcher: React.FC<MailboxSwitcherProps> = ({
  mailboxes,
  activeMailboxId,
  activeAlias = null,
  onSelectMailbox,
  onSelectAlias,
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

  const currentDisplayEmail = activeAlias || getFullEmail(activeMailbox);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 flex items-center gap-2.5 px-3 rounded-xl bg-[#171717] hover:bg-[#202020] border border-white/10 hover:border-white/20 transition-all text-xs font-medium text-neutral-200 group focus:outline-none focus:ring-1 focus:ring-white/20 shadow-sm"
      >
        <div className="w-6 h-6 rounded-lg bg-white text-black flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
          {activeMailbox ? activeMailbox.smtpUsername.charAt(0).toUpperCase() : 'M'}
        </div>
        <div className="flex flex-col text-left max-w-[170px] sm:max-w-[210px] truncate leading-tight">
          <span className="truncate text-xs font-semibold text-white tracking-tight">
            {currentDisplayEmail}
          </span>
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-neutral-300 inline shrink-0" />{' '}
            <span className="truncate">{activeAlias ? 'Alias Identity' : 'Enterprise Mailbox'}</span>
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-[#171717] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 divide-y divide-white/10 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                Active Mailbox Accounts & Aliases
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto py-1 space-y-1">
              {mailboxes.length === 0 ? (
                <div className="px-3 py-3 text-xs text-neutral-400 text-center">
                  No mailboxes found. Create one in the Dashboard.
                </div>
              ) : (
                mailboxes.map((mb) => {
                  const fullEmail = getFullEmail(mb);
                  const isSelectedMailbox = mb.id === activeMailboxId && !activeAlias;
                  const hasAliases = Array.isArray(mb.aliases) && mb.aliases.length > 0;

                  return (
                    <div key={mb.id} className="space-y-0.5">
                      {/* Primary Mailbox Row */}
                      <button
                        onClick={() => {
                          onSelectMailbox(mb.id);
                          if (onSelectAlias) onSelectAlias(null);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-xl hover:bg-white/5 transition-colors text-xs ${
                          isSelectedMailbox
                            ? 'bg-[#0a0a0a] text-white font-semibold border border-white/20 shadow-sm'
                            : 'text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSelectedMailbox ? 'bg-white text-black' : 'bg-black text-neutral-300 border border-white/10'
                            }`}
                          >
                            {mb.smtpUsername.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate flex flex-col">
                            <span className="truncate font-medium">{fullEmail}</span>
                            <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                              <Server className="w-2.5 h-2.5" /> {mb.smtpHost}
                              {mb.storageQuotaMb ? ` • ${mb.storageUsedMb || 0}/${mb.storageQuotaMb}MB` : ''}
                            </span>
                          </div>
                        </div>
                        {isSelectedMailbox && <Check className="w-4 h-4 text-white shrink-0" />}
                      </button>

                      {/* Aliases Under This Mailbox */}
                      {hasAliases && (
                        <div className="pl-9 pr-3 py-0.5 space-y-0.5">
                          {mb.aliases!.map((alias) => {
                            const isAliasSelected = activeMailboxId === mb.id && activeAlias === alias;
                            return (
                              <button
                                key={alias}
                                onClick={() => {
                                  onSelectMailbox(mb.id);
                                  if (onSelectAlias) onSelectAlias(alias);
                                  setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1 text-left rounded-lg hover:bg-white/5 transition-colors text-[11px] ${
                                  isAliasSelected
                                    ? 'bg-[#0a0a0a] text-white font-medium border border-white/20 shadow-sm'
                                    : 'text-neutral-400'
                                }`}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <Tag className="w-3 h-3 text-neutral-400" />
                                  <span className="truncate">{alias}</span>
                                </span>
                                {isAliasSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {onManageMailboxes && (
              <div className="pt-2 px-3">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onManageMailboxes();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-black bg-white hover:bg-neutral-200 rounded-xl transition-colors font-medium shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Manage Email Accounts & Aliases
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
