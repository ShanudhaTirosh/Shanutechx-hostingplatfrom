'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SupabaseSmtpConfig } from '@/lib/supabaseAdmin';


interface SmtpCodeSnippetsProps {
  smtp: SupabaseSmtpConfig;
}

export function SmtpCodeSnippets({ smtp }: SmtpCodeSnippetsProps) {
  const [lang, setLang] = useState<'node' | 'python' | 'env' | 'php'>('node');
  const [copied, setCopied] = useState(false);

  const snippets = {
    node: `const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: '${smtp.host}',
  port: ${smtp.port},
  secure: ${smtp.port === 465},
  auth: {
    user: '${smtp.user}',
    pass: 'YOUR_SMTP_PASSWORD'
  }
});

async function sendMail() {
  const info = await transporter.sendMail({
    from: '"${smtp.senderName}" <${smtp.senderEmail}>',
    to: "client@example.com",
    subject: "Hello from ShanuTechX Platform",
    html: "<b>ShanuTechX SMTP Integration Verified!</b>"
  });
  console.log("Message sent: %s", info.messageId);
}`,

    python: `import smtplib
from email.mime.text import MIMEText

msg = MIMEText("ShanuTechX SMTP Integration Verified!", "html")
msg["Subject"] = "Hello from ShanuTechX Platform"
msg["From"] = "${smtp.senderEmail}"
msg["To"] = "client@example.com"

with smtplib.SMTP("${smtp.host}", ${smtp.port}) as server:
    server.starttls()
    server.login("${smtp.user}", "YOUR_SMTP_PASSWORD")
    server.sendmail("${smtp.senderEmail}", ["client@example.com"], msg.as_string())
print("Email sent successfully!")`,

    env: `# Supabase Self-Hosted GoTrue Mailer Environment Variables
GOTRUE_SMTP_HOST=${smtp.host}
GOTRUE_SMTP_PORT=${smtp.port}
GOTRUE_SMTP_USER=${smtp.user}
GOTRUE_SMTP_PASS=YOUR_SMTP_PASSWORD
GOTRUE_SMTP_ADMIN_EMAIL=${smtp.senderEmail}
GOTRUE_SMTP_SENDER_NAME=${smtp.senderName}
GOTRUE_MAILER_AUTOCONFIRM=${smtp.enableAutoconfirm}`,

    php: `<?php
use PHPMailer\\PHPMailer\\PHPMailer;

$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host       = '${smtp.host}';
$mail->SMTPAuth   = true;
$mail->Username   = '${smtp.user}';
$mail->Password   = 'YOUR_SMTP_PASSWORD';
$mail->Port       = ${smtp.port};

$mail->setFrom('${smtp.senderEmail}', '${smtp.senderName}');
$mail->addAddress('client@example.com');
$mail->isHTML(true);
$mail->Subject = 'Hello from ShanuTechX Platform';
$mail->Body    = '<b>ShanuTechX SMTP Integration Verified!</b>';

$mail->send();
echo 'Message sent!';
?>`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          {(['node', 'python', 'env', 'php'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setLang(key)}
              className={`px-3 py-1 rounded-lg text-xs font-mono uppercase transition-all ${
                lang === key
                  ? 'bg-accent-violet text-white font-bold shadow-glow-violet'
                  : 'text-text-muted hover:bg-white/[0.04]'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={handleCopy}
          className="px-3 py-1 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Code Snippet'}</span>
        </button>

      </div>

      <pre className="w-full h-44 rounded-lg bg-black/60 border border-white/[0.08] p-3 font-mono text-[11px] text-teal-300 overflow-y-auto">
        {snippets[lang]}
      </pre>
    </div>
  );
}
