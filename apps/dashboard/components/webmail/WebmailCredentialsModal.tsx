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
  const [codeLanguage, setCodeLanguage] = useState<'wordpress' | 'resend_api' | 'nextjs' | 'nodejs' | 'laravel' | 'php' | 'python'>('wordpress');
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
      const res = await api.webmail.getCredentials(selectedMailboxId);
      setCreds(res.credentials || null);
    } catch {
      setCreds(null);
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

  const wpSnippet = `// WordPress (WP Mail SMTP / FluentSMTP / wp_mail) Settings
// SMTP Host: ${smtpHost}
// SMTP Port: 465 (SSL) or 587 (TLS)
// Encryption: SSL / TLS
// Auto TLS: On
// Authentication: Yes
// SMTP Username: ${userEmail}
// SMTP Password: <YOUR_MAILBOX_PASSWORD>
// From Email: ${userEmail}

// Or add directly to wp-config.php:
define('WP_MAIL_SMTP_HOST', '${smtpHost}');
define('WP_MAIL_SMTP_PORT', 465);
define('WP_MAIL_SMTP_ENCRYPTION', 'ssl');
define('WP_MAIL_SMTP_AUTH', true);
define('WP_MAIL_SMTP_USER', '${userEmail}');
define('WP_MAIL_SMTP_PASS', '<YOUR_MAILBOX_PASSWORD>');`;

  const resendApiSnippet = `// Resend-Style Automated Email REST API
// POST https://${smtpHost}/api/v1/emails (or https://api.shanutechx.com/api/v1/emails)
// Header: Authorization: Bearer ${apiKey} (or Basic Auth: ${userEmail}:<password>)
// Header: Content-Type: application/json

// cURL:
curl -X POST https://${smtpHost}/api/v1/emails \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${userEmail}",
    "to": "customer@example.com",
    "subject": "Automated Order Notification #1042",
    "html": "<h1>Welcome</h1><p>Your subscription is active!</p>"
  }'

// Node.js fetch:
const response = await fetch('https://${smtpHost}/api/v1/emails', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: '${userEmail}',
    to: 'customer@example.com',
    subject: 'Automated Order Notification #1042',
    html: '<h1>Welcome</h1><p>Your subscription is active!</p>'
  })
});
const result = await response.json();
console.log('Dispatched message ID:', result.id);`;

  const nextjsSnippet = `// Next.js 14 App Router API Route (app/api/send/route.ts)
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: '${smtpHost}',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || '${userEmail}',
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(req: Request) {
  try {
    const { to, subject, html } = await req.json();
    const info = await transporter.sendMail({
      from: '"My Website" <${userEmail}>',
      to,
      subject,
      html,
    });
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`;

  const nodeCodeSnippet = `// Node.js (Nodemailer) Integration for STX Webmail
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
    from: '"STX Service" <${userEmail}>',
    to: 'client@example.com',
    subject: 'System Alert / Notification',
    html: '<b>Hello from STX Autonomous Platform</b>',
  });
  console.log('Message dispatched:', info.messageId);
}

sendMail();`;

  const laravelSnippet = `# Laravel .env Configuration
MAIL_MAILER=smtp
MAIL_HOST=${smtpHost}
MAIL_PORT=465
MAIL_USERNAME=${userEmail}
MAIL_PASSWORD=\${STX_MAIL_PASSWORD}
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS="${userEmail}"
MAIL_FROM_NAME="\${APP_NAME}"`;

  const phpSnippet = `<?php
// PHP (PHPMailer) Integration
use PHPMailer\\PHPMailer\\PHPMailer;
use PHPMailer\\PHPMailer\\Exception;

require 'vendor/autoload.php';

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = '${smtpHost}';
    $mail->SMTPAuth   = true;
    $mail->Username   = '${userEmail}';
    $mail->Password   = getenv('STX_MAIL_PASSWORD');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // Port 465
    $mail->Port       = 465;

    $mail->setFrom('${userEmail}', 'Website Notification');
    $mail->addAddress('client@example.com');

    $mail->isHTML(true);
    $mail->Subject = 'Automated Website Notification';
    $mail->Body    = '<h3>Hello from your website</h3>';

    $mail->send();
    echo 'Message has been sent successfully';
} catch (Exception $e) {
    echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
}`;

  const pythonCodeSnippet = `# Python (smtplib & requests) Integration for STX Webmail
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

  const getActiveSnippet = () => {
    switch (codeLanguage) {
      case 'wordpress': return wpSnippet;
      case 'resend_api': return resendApiSnippet;
      case 'nextjs': return nextjsSnippet;
      case 'nodejs': return nodeCodeSnippet;
      case 'laravel': return laravelSnippet;
      case 'php': return phpSnippet;
      case 'python': return pythonCodeSnippet;
      default: return wpSnippet;
    }
  };

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
          <div className="p-2.5 rounded-xl bg-white/5 text-white border border-white/15 shadow-md">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Mail Server Credentials & Developer Studio</span>
              {isDevOrAdmin && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-500/20 text-neutral-300 border border-white/15">
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
                ? 'bg-white text-black text-white shadow-md'
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
                ? 'bg-white text-black text-white shadow-md'
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
                  ? 'bg-white text-black text-white shadow-md'
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
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
            Loading connection credentials...
          </div>
        ) : (
          <>
            {/* TAB 1: DESKTOP CLIENT SETTINGS */}
            {activeTab === 'desktop' && (
              <div className="space-y-4 text-xs">
                {/* Incoming Server (IMAP) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
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
                          className="text-slate-400 hover:text-white ml-1.5"
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
                  <div className="flex items-center justify-between text-xs font-bold text-white">
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
                          className="text-slate-400 hover:text-white ml-1.5"
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
                      className="text-slate-400 hover:text-white"
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
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Key className="w-4 h-4" /> Platform API Bearer Token
                    </span>
                    <span className="text-[10px] text-slate-500">REST API Authentication</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
                    <span className="truncate max-w-md">{apiKey}</span>
                    <button
                      onClick={() => copyToClipboard(apiKey, 'apiKey')}
                      className="text-slate-400 hover:text-white ml-2"
                    >
                      {copiedField === 'apiKey' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Snippet Language Selector */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Ready-to-copy Program Code Snippet:</span>
                  <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                    {[
                      { id: 'wordpress', label: 'WordPress' },
                      { id: 'resend_api', label: 'Resend API' },
                      { id: 'nextjs', label: 'Next.js' },
                      { id: 'nodejs', label: 'Node.js' },
                      { id: 'laravel', label: 'Laravel' },
                      { id: 'php', label: 'PHP' },
                      { id: 'python', label: 'Python' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCodeLanguage(item.id as any)}
                        className={`px-2.5 py-1 rounded font-mono transition-all text-[11px] ${
                          codeLanguage === item.id ? 'bg-white text-black text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Block Container */}
                <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-neutral-300 overflow-x-auto max-h-64">
                  <button
                    onClick={() => {
                      copyToClipboard(getActiveSnippet(), 'codeSnippet');
                    }}
                    className="absolute top-3 right-3 p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                  >
                    {copiedField === 'codeSnippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'codeSnippet' ? 'Copied' : 'Copy Code'}</span>
                  </button>
                  <pre className="whitespace-pre">
                    {getActiveSnippet()}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 3: SYSTEM MAILBOXES (DEV / ADMIN ROLE ONLY) */}
            {activeTab === 'system' && isDevOrAdmin && (
              <div className="space-y-5 text-xs">
                <form onSubmit={handleProvisionSystemMailbox} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white flex items-center gap-2">
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
                    className="w-full py-2.5 bg-gradient-to-r from-neutral-800 to-black hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
                          <div className="p-2 rounded-lg bg-white/5 text-white border border-white/15">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs">{acc.smtpUsername}@shanutechx.com</span>
                            <span className="text-[10px] text-slate-400 block">System Service Mailbox</span>
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(`${acc.smtpUsername}@shanutechx.com`, acc.id)}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-white/15 text-slate-300 text-[11px] rounded-lg flex items-center gap-1 font-mono"
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
