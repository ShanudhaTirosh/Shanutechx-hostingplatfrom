'use client';

import { useState, useEffect, useCallback } from 'react';

interface DynamicDnsSetupGuideProps {
  domain: string;
  planTier?: string;
  aliases?: string[];
  smtpUsername?: string;
  serverIp?: string;
  onClose?: () => void;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
  status?: 'verified' | 'pending' | 'error';
  explanation: string;
}

export default function DynamicDnsSetupGuide({
  domain,
  planTier = 'pro',
  aliases = [],
  smtpUsername = 'mailbox',
  serverIp = '127.0.0.1',
  onClose,
}: DynamicDnsSetupGuideProps) {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const planMaxAliases = planTier === 'starter' ? 3 : planTier === 'pro' ? 10 : 100;
  const rootDomain = 'shanutechx.com';

  const defaultRecords: DnsRecord[] = [
    {
      type: 'MX',
      name: '@',
      value: `mail.${rootDomain}`,
      priority: 10,
      explanation: 'Directs incoming email traffic for your domain to the ShanuTechX Cluster Relay host.',
    },
    {
      type: 'TXT (SPF)',
      name: '@',
      value: `v=spf1 include:${rootDomain} ~all`,
      explanation: 'Authorizes ShanuTechX IP addresses to send mail on behalf of your domain, preventing spam mark.',
    },
    {
      type: 'TXT (DKIM)',
      name: 'default._domainkey',
      value: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3S...`,
      explanation: 'Cryptographic signature verification record managed automatically by ShanuTechX mail servers.',
    },
    {
      type: 'TXT (DMARC)',
      name: '_dmarc',
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}`,
      explanation: 'Defines how receiving mail servers handle unauthenticated emails using SPF/DKIM policies.',
    },
    {
      type: 'CNAME',
      name: 'mail',
      value: `mail.${rootDomain}`,
      explanation: `Exposes branded webmail portal at http://mail.${domain} pointing to the cluster portal.`,
    },
  ];

  const verifyDnsRecords = useCallback(async () => {
    if (!domain || domain === 'clientdomain.com') return;
    setVerifying(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('token') || localStorage.getItem('webmail_token');

      const res = await fetch(`${apiBase}/api/smtp/verify-dns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ domain }),
      });

      const data = await res.json();
      if (res.ok) {
        setVerificationResult(data);
      }
    } catch (err) {
      console.error('DNS Verification failed:', err);
    } finally {
      setVerifying(false);
    }
  }, [domain]);

  useEffect(() => {
    void verifyDnsRecords();
  }, [verifyDnsRecords]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 max-w-4xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Dynamic DNS & Alias Guide for</span>
              <span className="text-purple-400 font-mono underline decoration-purple-500/50">{domain}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configured for <span className="text-white font-semibold capitalize">{planTier} Plan</span> • Max Aliases: <span className="text-purple-400 font-semibold">{planMaxAliases}</span>
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Live Verifier Summary Bar */}
      <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Live Domain DNS Status:</span>
            {verificationResult?.verification?.allVerified ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Fully Verified & Active
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                DNS Action Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cluster Relay Node: <span className="font-mono text-slate-300">{serverIp}</span> • Mail Host: <span className="font-mono text-slate-300">mail.{rootDomain}</span>
          </p>
        </div>

        <button
          onClick={verifyDnsRecords}
          disabled={verifying}
          className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-medium rounded-xl transition-all flex items-center gap-2"
        >
          {verifying ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              <span>Checking DNS...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Re-check DNS Records</span>
            </>
          )}
        </button>
      </div>

      {/* DNS Records Table */}
      <div className="space-y-3 mb-8">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Required DNS Records to Add in your Domain Registrar (Cloudflare, Namecheap, GoDaddy)</h3>
        <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 bg-slate-950/40">
          {defaultRecords.map((rec, i) => {
            const isMxVerified = rec.type === 'MX' && verificationResult?.verification?.mx;
            const isSpfVerified = rec.type.includes('SPF') && verificationResult?.verification?.spf;
            const isDmarcVerified = rec.type.includes('DMARC') && verificationResult?.verification?.dmarc;
            const isVerified = isMxVerified || isSpfVerified || isDmarcVerified;

            return (
              <div key={rec.type} className="p-4 hover:bg-slate-800/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                      {rec.type}
                    </span>
                    <span className="text-xs text-slate-400">Host:</span>
                    <code className="text-xs font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">{rec.name}</code>
                    {rec.priority && (
                      <span className="text-xs text-slate-400">Priority: <strong className="text-white">{rec.priority}</strong></span>
                    )}

                    {verificationResult && (
                      <span className={`ml-auto md:ml-2 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        isVerified
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {isVerified ? '✓ Verified' : 'Pending Propagation'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 break-all select-all flex-1">
                      {rec.value}
                    </code>
                    <button
                      onClick={() => copyToClipboard(rec.value, i)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded transition-all shrink-0"
                    >
                      {copiedIndex === i ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">{rec.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aliases Routing Guide Section */}
      <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Configured Mailbox Aliases for {domain}</span>
          </h3>
          <span className="text-xs text-slate-400">
            Primary Mailbox ID: <code className="text-purple-300 font-mono">{smtpUsername}@{domain}</code>
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Incoming messages sent to any of your configured aliases automatically land in your single primary Webmail inbox without requiring extra mailbox fees.
        </p>

        {aliases.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {aliases.map((alias) => (
              <div key={alias} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                <span className="font-mono text-purple-300">{alias}</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Alias</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-slate-900 border border-dashed border-slate-800 rounded-lg text-xs text-slate-400 text-center">
            No custom aliases configured yet. You can add up to {planMaxAliases} aliases in your Mailbox settings.
          </div>
        )}
      </div>
    </div>
  );
}
