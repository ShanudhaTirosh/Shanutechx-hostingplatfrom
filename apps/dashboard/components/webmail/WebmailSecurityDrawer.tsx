'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw, X, Copy, Check } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailSecurityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailSecurityDrawer({ isOpen, onClose }: WebmailSecurityDrawerProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      runCheck();
    }
  }, [isOpen]);

  const runCheck = async () => {
    setLoading(true);
    try {
      const res = await api.webmail.adminDnsCheck();
      setChecks(res.checks || {});
    } catch (_err) {
      setChecks({});
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border-l border-slate-800 max-w-md w-full h-full p-6 text-slate-100 shadow-2xl flex flex-col relative overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">DNS Security Verification</h3>
            <p className="text-xs text-slate-400">Live SPF, DKIM & DMARC records status check</p>
          </div>
        </div>

        <button
          onClick={runCheck}
          disabled={loading}
          className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 mb-6 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          {loading ? 'Verifying DNS Records...' : 'Re-Run Live Diagnostic'}
        </button>

        <div className="space-y-4 flex-1">
          {Object.entries(checks).length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
              No domains registered or DNS checks pending.
            </div>
          ) : (
            Object.entries(checks).map(([domain, isOk]) => (
              <div key={domain} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">{domain}</span>
                  {isOk ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-medium bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                      <XCircle className="w-3.5 h-3.5" /> DNS Setup Required
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  {/* SPF */}
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span>SPF Record (TXT @)</span>
                      <button onClick={() => copyText('v=spf1 include:mail.shanutechx.com ~all', 'spf')} className="text-indigo-400 hover:text-indigo-300">
                        {copied === 'spf' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <code className="text-[10px] text-slate-300 font-mono block break-all">v=spf1 include:mail.shanutechx.com ~all</code>
                  </div>

                  {/* DKIM */}
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span>DKIM Selector (mail._domainkey)</span>
                      <button onClick={() => copyText('v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...', 'dkim')} className="text-indigo-400 hover:text-indigo-300">
                        {copied === 'dkim' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <code className="text-[10px] text-slate-300 font-mono block break-all">v=DKIM1; k=rsa; p=MIGf...</code>
                  </div>

                  {/* DMARC */}
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span>DMARC Policy (_dmarc)</span>
                      <button onClick={() => copyText('v=DMARC1; p=quarantine; rua=mailto:dmarc@shanutechx.com', 'dmarc')} className="text-indigo-400 hover:text-indigo-300">
                        {copied === 'dmarc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <code className="text-[10px] text-slate-300 font-mono block break-all">v=DMARC1; p=quarantine;</code>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
