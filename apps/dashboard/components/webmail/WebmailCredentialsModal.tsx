'use client';

import React, { useState, useEffect } from 'react';
import { Server, Copy, Check, X, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailCredentialsModal({ isOpen, onClose }: WebmailCredentialsModalProps) {
  const [creds, setCreds] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.webmail.getCredentials().then((res) => setCreds(res.credentials)).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">IMAP / SMTP Server Settings</h3>
            <p className="text-xs text-slate-400">Configure desktop clients like Outlook, Thunderbird & Apple Mail</p>
          </div>
        </div>

        {!creds ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading connection configuration...</div>
        ) : (
          <div className="space-y-4">
            {/* Incoming IMAP */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
                <span>INCOMING SERVER (IMAP)</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400"><ShieldCheck className="w-3 h-3" /> SSL/TLS</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">Server Hostname</span>
                  <div className="flex items-center justify-between mt-1 bg-slate-950 p-2 rounded border border-slate-800 font-mono text-slate-200">
                    <span className="truncate">{creds.imapHost}</span>
                    <button onClick={() => copyToClipboard(creds.imapHost, 'imapHost')} className="text-slate-400 hover:text-indigo-400 ml-1">
                      {copiedField === 'imapHost' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Port / Encryption</span>
                  <div className="mt-1 bg-slate-950 p-2 rounded border border-slate-800 font-mono text-slate-200">
                    Port {creds.imapPort} (SSL)
                  </div>
                </div>
              </div>
            </div>

            {/* Outgoing SMTP */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
                <span>OUTGOING SERVER (SMTP)</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400"><ShieldCheck className="w-3 h-3" /> SSL/TLS</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">Server Hostname</span>
                  <div className="flex items-center justify-between mt-1 bg-slate-950 p-2 rounded border border-slate-800 font-mono text-slate-200">
                    <span className="truncate">{creds.smtpHost}</span>
                    <button onClick={() => copyToClipboard(creds.smtpHost, 'smtpHost')} className="text-slate-400 hover:text-indigo-400 ml-1">
                      {copiedField === 'smtpHost' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Port / Encryption</span>
                  <div className="mt-1 bg-slate-950 p-2 rounded border border-slate-800 font-mono text-slate-200">
                    Port {creds.smtpPort} (SSL)
                  </div>
                </div>
              </div>
            </div>

            {/* Username */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] font-medium">AUTHENTICATION USERNAME</span>
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-xs text-slate-200">
                <span>{creds.email}</span>
                <button onClick={() => copyToClipboard(creds.email, 'email')} className="text-slate-400 hover:text-indigo-400">
                  {copiedField === 'email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
