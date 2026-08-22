'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Button, Spinner, ErrorBanner, Badge } from '@/components/ui';
import { supabaseAdmin, SupabaseSmtpConfig } from '@/lib/supabaseAdmin';
import { EmailTemplateEditor } from '@/components/supabase/EmailTemplateEditor';
import { SmtpDeliveryLogs } from '@/components/supabase/SmtpDeliveryLogs';
import { SmtpCodeSnippets } from '@/components/supabase/SmtpCodeSnippets';

export default function SupabaseSettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [smtp, setSmtp] = useState<SupabaseSmtpConfig>({
    host: 'mail.shanutechx.com',
    port: 587,
    user: 'smtp_auth_user',
    senderEmail: 'noreply@shanutechx.com',
    senderName: 'ShanuTechX Platform Mailer',
    enableEmailSignup: true,
    enableAutoconfirm: true,
  });
  const [smtpPass, setSmtpPass] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [verifyingSmtp, setVerifyingSmtp] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // Test Email State
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'config' | 'templates' | 'logs' | 'code'>('config');

  useEffect(() => {
    Promise.allSettled([supabaseAdmin.config(), supabaseAdmin.smtp.getConfig()])
      .then(([configRes, smtpRes]) => {
        if (configRes.status === 'fulfilled') setConfig(configRes.value);
        if (smtpRes.status === 'fulfilled') setSmtp(smtpRes.value.smtpConfig);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleVerifySmtp = () => {
    setVerifyingSmtp(true);
    setSmtpStatus(null);
    supabaseAdmin.smtp
      .verifyConnection()
      .then((res) => setSmtpStatus(res))
      .catch((err) => setSmtpStatus({ ok: false, message: err.message, latencyMs: 0 }))
      .finally(() => setVerifyingSmtp(false));
  };

  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    supabaseAdmin.smtp
      .saveConfig({ ...smtp, pass: smtpPass || undefined })
      .then((res) => {
        setSmtp(res.smtpConfig);
        setSmtpPass('');
        alert('SMTP Mailer configuration saved successfully!');
        handleVerifySmtp();
      })
      .catch((err) => alert(err.message))
      .finally(() => setSavingSmtp(false));
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setTestResult(null);
    supabaseAdmin.smtp
      .sendTestEmail(testRecipient || undefined, 'confirmation')
      .then((res) => setTestResult(res))
      .catch((err) => alert(err.message))
      .finally(() => setSendingTest(false));
  };

  if (loading) return <Spinner label="Loading Supabase settings..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="SMTP Mailer Engine &amp; Supabase Settings"
        description="Configure SMTP server, verify TLS handshake, customize auth templates, track outbound logs, and generate code snippets."
      />

      {error && <ErrorBanner message={error} />}

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 overflow-x-auto">
        {[
          { id: 'config', label: '⚙️ SMTP Server Config' },
          { id: 'templates', label: '✉️ Auth Email Templates' },
          { id: 'logs', label: '📜 Delivery Logs' },
          { id: 'code', label: '💻 Connection Code Snippets' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === tab.id
                ? 'bg-accent-violet text-white shadow-glow-violet'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: SMTP Server Config & Gateway Endpoints */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* SMTP Server Configuration Card */}
          <Card className="border border-white/[0.06] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">SMTP Email Server Integration</h3>
                <p className="text-xs text-text-muted">
                  Used for account verification, password resets, invitations, and transactional mail
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleVerifySmtp} disabled={verifyingSmtp}>
                  {verifyingSmtp ? 'Testing TLS...' : '🔍 Verify SMTP Handshake'}
                </Button>
              </div>
            </div>

            {/* Connection Test Result Alert */}
            {smtpStatus && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                  smtpStatus.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                <span>{smtpStatus.ok ? '✓' : '✕'} {smtpStatus.message}</span>
                <span className="text-[11px] opacity-75">{smtpStatus.latencyMs}ms latency</span>
              </div>
            )}

            <form onSubmit={handleSaveSmtp} className="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[10px] text-text-faint uppercase block mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={smtp.host}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-text-faint uppercase block mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-text-faint uppercase block mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={smtp.user}
                  onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-text-faint uppercase block mb-1">SMTP Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                />
              </div>

              <div>
                <label className="text-[10px] text-text-faint uppercase block mb-1">Sender Email</label>
                <input
                  type="email"
                  value={smtp.senderEmail}
                  onChange={(e) => setSmtp({ ...smtp, senderEmail: e.target.value })}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-text-faint uppercase block mb-1">Sender Name</label>
                <input
                  type="text"
                  value={smtp.senderName}
                  onChange={(e) => setSmtp({ ...smtp, senderName: e.target.value })}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtp.enableAutoconfirm}
                    onChange={(e) => setSmtp({ ...smtp, enableAutoconfirm: e.target.checked })}
                    className="rounded bg-black/40 border-white/[0.1] text-accent-violet focus:ring-0"
                  />
                  Auto-confirm email signups (skip email verification in dev)
                </label>

                <Button type="submit" size="sm" disabled={savingSmtp}>
                  {savingSmtp ? 'Saving...' : 'Save SMTP Settings'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Real Test Email Dispatcher Panel */}
          <Card className="border border-white/[0.06] space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Dispatch Real Test Email over SMTP
            </h3>

            <form onSubmit={handleSendTestEmail} className="flex flex-wrap items-center gap-3">
              <input
                type="email"
                placeholder="Recipient Email (e.g. client@example.com)"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="flex-1 min-w-[240px] rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                required
              />
              <Button type="submit" size="sm" disabled={sendingTest}>
                {sendingTest ? 'Sending Email...' : '✉️ Send Test Email'}
              </Button>
            </form>

            {testResult && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono space-y-1">
                <p className="text-emerald-300 font-semibold">✓ Test Email Dispatched Successfully via SMTP Transport</p>
                <p className="text-text-muted text-[11px]">Recipient: {testResult.recipient}</p>
                <p className="text-text-muted text-[11px]">Message ID: {testResult.messageId}</p>
                <p className="text-text-muted text-[11px]">Server Response: {testResult.response}</p>
              </div>
            )}
          </Card>

          {/* Gateway Endpoints & API Keys */}
          <Card className="border border-white/[0.06] space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              API Keys (JWT Tokens)
            </h3>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-text-primary">anon (public key)</span>
                <button
                  onClick={() => setRevealedKey(revealedKey === 'anon' ? null : 'anon')}
                  className="text-xs text-accent-violet-light hover:underline"
                >
                  {revealedKey === 'anon' ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <p className="font-mono text-xs text-text-muted break-all bg-black/40 p-2.5 rounded-lg border border-white/[0.04]">
                {revealedKey === 'anon' ? config?.anonKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-red-400">service_role (secret admin key)</span>
                <button
                  onClick={() => setRevealedKey(revealedKey === 'service' ? null : 'service')}
                  className="text-xs text-accent-violet-light hover:underline"
                >
                  {revealedKey === 'service' ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <p className="font-mono text-xs text-text-muted break-all bg-black/40 p-2.5 rounded-lg border border-white/[0.04]">
                {revealedKey === 'service'
                  ? config?.serviceRoleKey
                  : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Email Template Editor */}
      {activeTab === 'templates' && <EmailTemplateEditor />}

      {/* TAB 3: Delivery Logs */}
      {activeTab === 'logs' && <SmtpDeliveryLogs />}

      {/* TAB 4: Code Snippets */}
      {activeTab === 'code' && <SmtpCodeSnippets smtp={smtp} />}
    </div>
  );
}
