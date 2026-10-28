'use client';

import React, { useState, useEffect } from 'react';
import {
  Server, Copy, Check, X, ShieldCheck, Code, Key, Mail, Terminal, Sparkles
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
  const [activeTab, setActiveTab] = useState<'desktop' | 'code'>('desktop');
  const [codeLanguage, setCodeLanguage] = useState<'wordpress' | 'resend_api' | 'nextjs' | 'nodejs' | 'laravel' | 'php' | 'python'>('wordpress');
  const [creds, setCreds] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen, selectedMailboxId]);

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

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const smtpHost = creds?.smtpHost || 'mail.shanutechx.com';
  const imapHost = creds?.imapHost || 'imap.shanutechx.com';
  const userEmail = creds?.email || '';
  const apiKey = creds?.password || '';

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

  const resendApiSnippet = `// STX Email REST API
// POST https://${smtpHost}/api/v1/emails
// Header: Authorization: Bearer ${apiKey}
// Header: Content-Type: application/json

// cURL:
curl -X POST https://${smtpHost}/api/v1/emails \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${userEmail}",
    "to": "customer@example.com",
    "subject": "Order Confirmation",
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
    subject: 'Order Confirmation',
    html: '<h1>Welcome</h1><p>Your subscription is active!</p>'
  })
});
const result = await response.json();
console.log('Dispatched message ID:', result.id);`;

  const nextjsSnippet = `// Next.js App Router (app/api/send/route.ts)
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

  const nodeCodeSnippet = `// Node.js (Nodemailer) Integration
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: '${smtpHost}',
  port: 465,
  secure: true,
  auth: {
    user: '${userEmail}',
    pass: process.env.STX_MAIL_PASSWORD,
  },
});

async function sendMail() {
  const info = await transporter.sendMail({
    from: '"My App" <${userEmail}>',
    to: 'recipient@example.com',
    subject: 'Notification',
    html: '<b>Hello from STX Webmail</b>',
  });
  console.log('Message ID:', info.messageId);
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
// PHP (PHPMailer)
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
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;

    $mail->setFrom('${userEmail}', 'Website Notification');
    $mail->addAddress('recipient@example.com');
    $mail->isHTML(true);
    $mail->Subject = 'Website Notification';
    $mail->Body    = '<h3>Hello from your website</h3>';

    $mail->send();
    echo 'Sent successfully';
} catch (Exception $e) {
    echo "Mailer Error: {$mail->ErrorInfo}";
}`;

  const pythonCodeSnippet = `# Python (smtplib) Integration
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = "${smtpHost}"
SMTP_PORT = 465
USERNAME = "${userEmail}"
PASSWORD = "<YOUR_PASSWORD>"

msg = MIMEMultipart("alternative")
msg["Subject"] = "System Notification"
msg["From"] = USERNAME
msg["To"] = "recipient@example.com"
msg.attach(MIMEText("<h1>Hello from STX Webmail</h1>", "html"))

with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
    server.login(USERNAME, PASSWORD)
    server.sendmail(USERNAME, ["recipient@example.com"], msg.as_string())

print("Dispatched!")`;

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
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl max-w-2xl w-full p-6 text-neutral-100 shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Client Setup & Credentials</h3>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">{userEmail}</p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'desktop'
                ? 'bg-white text-black shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Desktop & Phone Clients (IMAP / SMTP)</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'code'
                ? 'bg-white text-black shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Website & App Code Snippets</span>
          </button>
        </div>

        {activeTab === 'desktop' ? (
          <div className="space-y-4">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-neutral-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <span>Use these connection parameters to sync your mailbox with Apple Mail, Outlook, Thunderbird, iOS Mail, or Android.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* IMAP Card */}
              <div className="p-4 bg-[#171717] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Inbound (IMAP)</span>
                  <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-0.5 rounded border border-white/20">SSL/TLS</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-neutral-400 text-[11px] block">Server Hostname</span>
                    <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono text-neutral-200 mt-1">
                      <span>{imapHost}</span>
                      <button onClick={() => copyToClipboard(imapHost, 'imapHost')} className="text-neutral-400 hover:text-white">
                        {copiedField === 'imapHost' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-[11px] block">Port</span>
                    <span className="font-mono text-white">993</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-[11px] block">Username</span>
                    <span className="font-mono text-white truncate block">{userEmail}</span>
                  </div>
                </div>
              </div>

              {/* SMTP Card */}
              <div className="p-4 bg-[#171717] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Outbound (SMTP)</span>
                  <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-0.5 rounded border border-white/20">SSL / STARTTLS</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-neutral-400 text-[11px] block">Server Hostname</span>
                    <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono text-neutral-200 mt-1">
                      <span>{smtpHost}</span>
                      <button onClick={() => copyToClipboard(smtpHost, 'smtpHost')} className="text-neutral-400 hover:text-white">
                        {copiedField === 'smtpHost' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <div>
                      <span className="text-neutral-400 text-[11px] block">SSL Port</span>
                      <span className="font-mono text-white">465</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-[11px] block">STARTTLS Port</span>
                      <span className="font-mono text-white">587</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-[11px] block">Username</span>
                    <span className="font-mono text-white truncate block">{userEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'wordpress', label: 'WordPress' },
                { id: 'resend_api', label: 'REST API' },
                { id: 'nextjs', label: 'Next.js' },
                { id: 'nodejs', label: 'Node.js' },
                { id: 'laravel', label: 'Laravel' },
                { id: 'php', label: 'PHP' },
                { id: 'python', label: 'Python' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setCodeLanguage(lang.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                    codeLanguage === lang.id
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#171717] border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <pre className="p-4 bg-black/60 border border-white/10 rounded-xl text-xs font-mono text-neutral-200 overflow-x-auto max-h-64 leading-relaxed">
                {getActiveSnippet()}
              </pre>
              <button
                onClick={() => copyToClipboard(getActiveSnippet(), 'snippet')}
                className="absolute top-3 right-3 p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md border border-white/10 transition-colors text-xs flex items-center gap-1"
              >
                {copiedField === 'snippet' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'snippet' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
