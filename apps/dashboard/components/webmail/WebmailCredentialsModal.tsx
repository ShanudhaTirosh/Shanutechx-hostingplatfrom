'use client';

import React, { useState, useEffect } from 'react';
import {
  Server, Copy, Check, X, ShieldCheck, Code, Key, Mail, Plus, Sparkles, Terminal, Cpu, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';

interface WebmailCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  selectedMailboxId?: string;
}

export function WebmailCredentialsModal({
  isOpen,
  onClose,
  userRole = 'customer',
  selectedMailboxId,
}: WebmailCredentialsModalProps) {
  const [activeTab, setActiveTab] = useState<'desktop' | 'code' | 'system'>('desktop');
  const [codeLanguage, setCodeLanguage] = useState<'nodejs' | 'python' | 'curl'>('nodejs');
  const [creds, setCreds] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // System mailbox creation state (Dev/Admin)
  const [systemPrefix, setSystemPrefix] = useState<'noreply' | 'support' | 'billing' | 'notifications' | 'custom'>('noreply');
  const [customSystemPrefix, setCustomSystemPrefix] = useState('');
  const [systemPassword, setSystemPassword] = useState('SystemPass2026!');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [systemAccounts, setSystemAccounts] = useState<any[]>([]);

  const isDevOrAdmin = userRole === 'dev' || userRole === 'admin';

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
      if (isDevOrAdmin) {
        loadSystemAccounts();
      }
    }
  }, [isOpen, selectedMailboxId, isDevOrAdmin]);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const res = await api.webmail.getCredentials();
      setCreds(res.credentials || null);
    } catch {
      // Fallback credentials structure
      setCreds({
        imapHost: 'mail.shanutechx.com',
        imapPort: 993,
        smtpHost: 'mail.shanutechx.com',
        smtpPort: 465,
        smtpPortStartTls: 587,
        email: 'user@shanutechx.com',
        apiKey: 'stx_live_sk_948102948102948102948',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSystemAccounts = async () => {
    try {
      const res = await api.email.mailboxes();
      const sys = (res.mailboxes || []).filter((m: any) => m.isInternal || m.isSystem || ['noreply', 'support', 'billing', 'notifications'].some(p => (m.email || m.smtpUsername || '').toLowerCase().startsWith(p)));
      setSystemAccounts(sys);
    } catch {}
  };

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleProvisionSystemMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    const prefix = systemPrefix === 'custom' ? customSystemPrefix.trim() : systemPrefix;
    if (!prefix) return;

    setIsProvisioning(true);
    try {
      const email = `${prefix}@shanutechx.com`;
      await api.email.createMailbox({
        email,
        password: systemPassword,
        storageQuotaMb: 50000,
        dailySendLimit: 100000,
      });
      loadSystemAccounts();
      copyToClipboard(email, 'sysCreated');
    } catch (err: any) {
      // Alert handled
    } finally {
      setIsProvisioning(false);
    }
  };

  const smtpHost = creds?.smtpHost || 'mail.shanutechx.com';
  const imapHost = creds?.imapHost || 'mail.shanutechx.com';
  const userEmail = creds?.email || 'user@shanutechx.com';
  const apiKey = creds?.apiKey || 'stx_live_sk_8932479238479238479';

  const nodeCodeSnippet = `// Node.js (Nodemailer) Integration for ShanuTechX Webmail
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: '${smtpHost}',
  port: 465,
  secure: true, // SSL/TLS
  auth: {
    user: '${userEmail}',
    pass: process.env.STX_MAIL_PASSWORD || '<YOUR_PASSWORD_OR_API_KEY>',
  },
});

async function sendMail() {
  const info = await transporter.sendMail({
    from: '"ShanuTechX Service" <${userEmail}>',
    to: 'client@example.com',
    subject: 'System Alert / Notification',
    html: '<b>Hello from ShanuTechX Autonomous Platform</b>',
  });
  console.log('Message dispatched:', info.messageId);
}

sendMail();`;

  const pythonCodeSnippet = `# Python (smtplib & requests) Integration for ShanuTechX Webmail
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = "${smtpHost}"
SMTP_PORT = 465
USERNAME = "${userEmail}"
PASSWORD = "<YOUR_PASSWORD_OR_API_KEY>"

msg = MIMEMultipart("alternative")
msg["Subject"] = "System Notification"
msg["From"] = USERNAME
msg["To"] = "client@example.com"
msg.attach(MIMEText("<h1>Hello from ShanuTechX</h1>", "html"))

with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
    server.login(USERNAME, PASSWORD)
    server.sendmail(USERNAME, ["client@example.com"], msg.as_string())

print("Mail dispatched successfully!")`;

  const curlCodeSnippet = `# REST API Integration via cURL
curl -X POST https://${smtpHost}/api/webmail/send \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipientEmail": "client@example.com",
    "subject": "Platform Automated Dispatch",
    "htmlBody": "<h3>Automated Message via REST API</h3>"
  }'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-md">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Mail Server Credentials & Developer Studio</span>
              {isDevOrAdmin && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {userRole} Superuser
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Connect external mail clients (Outlook/Apple Mail) or integrate REST API/SMTP in code
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'desktop'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Desktop Connection</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>API & Program Snippets</span>
          </button>
          {isDevOrAdmin && (
            <button
              onClick={() => setActiveTab('system')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'system'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>System Mailboxes</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            Loading connection credentials...
          </div>
        ) : (
          <>
            {/* TAB 1: DESKTOP CLIENT SETTINGS */}
            {activeTab === 'desktop' && (
              <div className="space-y-4 text-xs">
                {/* Incoming Server (IMAP) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
                    <span>INCOMING MAIL SERVER (IMAP)</span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" /> SSL / TLS Enforced
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Server Hostname</span>
                      <div className="flex items-center justify-between mt-1 bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-slate-200">
                        <span className="truncate">{imapHost}</span>
                        <button
                          onClick={() => copyToClipboard(imapHost, 'imapHost')}
                          className="text-slate-400 hover:text-indigo-400 ml-1.5"
                        >
                          {copiedField === 'imapHost' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Port / Encryption</span>
                      <div className="mt-1 bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-slate-200">
                        Port 993 (SSL)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Outgoing Server (SMTP) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
                    <span>OUTGOING MAIL SERVER (SMTP)</span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" /> SSL / STARTTLS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Server Hostname</span>
                      <div className="flex items-center justify-between mt-1 bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-slate-200">
                        <span className="truncate">{smtpHost}</span>
                        <button
                          onClick={() => copyToClipboard(smtpHost, 'smtpHost')}
                          className="text-slate-400 hover:text-indigo-400 ml-1.5"
                        >
                          {copiedField === 'smtpHost' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Port Options</span>
                      <div className="mt-1 bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-slate-200">
                        Port 465 (SSL) / 587 (TLS)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Username */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Authentication Username</span>
                  <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
                    <span>{userEmail}</span>
                    <button
                      onClick={() => copyToClipboard(userEmail, 'email')}
                      className="text-slate-400 hover:text-indigo-400"
                    >
                      {copiedField === 'email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CODE SNIPPETS & API KEYS */}
            {activeTab === 'code' && (
              <div className="space-y-4 text-xs">
                {/* API Key Box */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <Key className="w-4 h-4" /> Platform API Bearer Token
                    </span>
                    <span className="text-[10px] text-slate-500">REST API Authentication</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
                    <span className="truncate max-w-md">{apiKey}</span>
                    <button
                      onClick={() => copyToClipboard(apiKey, 'apiKey')}
                      className="text-slate-400 hover:text-indigo-400 ml-2"
                    >
                      {copiedField === 'apiKey' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Snippet Language Selector */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Ready-to-copy Program Code Snippet:</span>
                  <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                    <button
                      onClick={() => setCodeLanguage('nodejs')}
                      className={`px-2.5 py-1 rounded font-mono transition-all ${
                        codeLanguage === 'nodejs' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Node.js
                    </button>
                    <button
                      onClick={() => setCodeLanguage('python')}
                      className={`px-2.5 py-1 rounded font-mono transition-all ${
                        codeLanguage === 'python' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Python
                    </button>
                    <button
                      onClick={() => setCodeLanguage('curl')}
                      className={`px-2.5 py-1 rounded font-mono transition-all ${
                        codeLanguage === 'curl' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      cURL
                    </button>
                  </div>
                </div>

                {/* Code Block Container */}
                <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-indigo-300 overflow-x-auto max-h-64">
                  <button
                    onClick={() => {
                      const snippet = codeLanguage === 'nodejs' ? nodeCodeSnippet : codeLanguage === 'python' ? pythonCodeSnippet : curlCodeSnippet;
                      copyToClipboard(snippet, 'codeSnippet');
                    }}
                    className="absolute top-3 right-3 p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                  >
                    {copiedField === 'codeSnippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'codeSnippet' ? 'Copied' : 'Copy Code'}</span>
                  </button>
                  <pre className="whitespace-pre">
                    {codeLanguage === 'nodejs' && nodeCodeSnippet}
                    {codeLanguage === 'python' && pythonCodeSnippet}
                    {codeLanguage === 'curl' && curlCodeSnippet}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 3: SYSTEM MAILBOXES (DEV / ADMIN ROLE ONLY) */}
            {activeTab === 'system' && isDevOrAdmin && (
              <div className="space-y-5 text-xs">
                <form onSubmit={handleProvisionSystemMailbox} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-violet-400 flex items-center gap-2">
                      <Cpu className="w-4 h-4" /> Provision System Service Mailbox
                    </h4>
                    <span className="text-[10px] text-slate-500">Auto-routes platform system notifications</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block text-[10px] mb-1">Mailbox Purpose Prefix</label>
                      <select
                        value={systemPrefix}
                        onChange={(e: any) => setSystemPrefix(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                      >
                        <option value="noreply">noreply@ (System Outbound)</option>
                        <option value="support">support@ (Customer Support Helpdesk)</option>
                        <option value="billing">billing@ (Invoices & Subscriptions)</option>
                        <option value="notifications">notifications@ (Platform Alerts)</option>
                        <option value="custom">Custom System Address...</option>
                      </select>
                    </div>

                    {systemPrefix === 'custom' ? (
                      <div>
                        <label className="text-slate-400 block text-[10px] mb-1">Custom Address Name</label>
                        <input
                          type="text"
                          placeholder="e.g. security-alerts"
                          value={customSystemPrefix}
                          onChange={(e) => setCustomSystemPrefix(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-slate-400 block text-[10px] mb-1">Service Password</label>
                        <input
                          type="text"
                          value={systemPassword}
                          onChange={(e) => setSystemPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isProvisioning}
                    className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProvisioning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Provision System Mailbox</span>
                  </button>
                </form>

                {/* Existing System Mailboxes List */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">Active System Mailboxes</h4>
                  {systemAccounts.length === 0 ? (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-center text-xs">
                      No custom system mailboxes provisioned yet.
                    </div>
                  ) : (
                    systemAccounts.map((acc: any) => (
                      <div key={acc.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs">{acc.smtpUsername}@shanutechx.com</span>
                            <span className="text-[10px] text-slate-400 block">System Service Mailbox</span>
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(`${acc.smtpUsername}@shanutechx.com`, acc.id)}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-violet-500/40 text-slate-300 text-[11px] rounded-lg flex items-center gap-1 font-mono"
                        >
                          {copiedField === acc.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy Address
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
