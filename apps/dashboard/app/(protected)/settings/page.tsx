'use client';

import { useState, useEffect } from 'react';
import PasswordLockGuard from '@/components/PasswordLockGuard';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  useToast,
  Modal,
  Tabs,
} from '@/components/ui';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

type NotificationEvent =
  | 'new_payment_submitted'
  | 'payment_approved'
  | 'payment_rejected'
  | 'new_order'
  | 'new_ticket'
  | 'deployment_failed'
  | 'vps_assigned';

const EVENTS: { value: NotificationEvent; label: string; description: string }[] = [
  { value: 'new_payment_submitted', label: 'New payment submitted', description: 'A customer uploaded a payment proof — needs manual review.' },
  { value: 'payment_approved', label: 'Payment approved', description: 'An admin/dev approved a payment.' },
  { value: 'payment_rejected', label: 'Payment declined', description: 'An admin/dev declined a payment (with reason).' },
  { value: 'new_order', label: 'New order', description: 'A customer placed an order (free or awaiting payment).' },
  { value: 'new_ticket', label: 'New ticket', description: 'A support ticket was opened.' },
  { value: 'deployment_failed', label: 'Deployment failed', description: 'A customer or dev deployment failed to build/start.' },
  { value: 'vps_assigned', label: 'VPS assigned / terminated', description: 'A VPS was assigned to a customer, or terminated.' },
];

interface WebhookConfig {
  id: string;
  event: NotificationEvent;
  isActive: boolean;
  createdAt: string;
}

interface BackupRun {
  id: string;
  triggeredBy: string;
  success: boolean;
  r2Key: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

// ── Tab 1: Discord Webhooks Component ──
function DiscordWebhooksTab() {
  const [configs, setConfigs] = useState<WebhookConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<NotificationEvent>('new_payment_submitted');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  function load() {
    api.discordWebhooks
      .list()
      .then((data) => setConfigs(data.configs as WebhookConfig[]))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleTest() {
    if (!webhookUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.discordWebhooks.test(webhookUrl.trim());
      setTestResult(result.ok ? 'Test message sent — check your Discord channel.' : `Failed (HTTP ${result.status ?? '?'})`);
    } catch (err: any) {
      setTestResult(`Failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!webhookUrl.trim()) return;
    setBusy(true);
    try {
      await api.discordWebhooks.create(selectedEvent, webhookUrl.trim());
      toast('Webhook configured', 'success');
      setAddModalOpen(false);
      setWebhookUrl('');
      setTestResult(null);
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to save webhook', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(config: WebhookConfig) {
    try {
      await api.discordWebhooks.toggle(config.id, !config.isActive);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete(config: WebhookConfig) {
    try {
      await api.discordWebhooks.delete(config.id);
      toast('Webhook removed', 'success');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  const configuredEvents = new Set(configs?.map((c) => c.event));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Discord Webhook Alerts</h3>
          <p className="text-xs text-text-muted">Configure Discord notifications for payments, tickets, VPS, and system events.</p>
        </div>
        <Button size="sm" onClick={() => setAddModalOpen(true)}>+ Add Webhook</Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {configs === null && <Spinner label="Loading webhooks..." />}
      {configs?.length === 0 && (
        <EmptyState message="No Discord webhooks configured yet." />
      )}

      <div className="space-y-2">
        {EVENTS.map((eventDef) => {
          const config = configs?.find((c) => c.event === eventDef.value);
          return (
            <Card key={eventDef.value} className="border border-white/[0.06] flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{eventDef.label}</p>
                  {config ? (
                    <Badge status={config.isActive ? 'running' : 'stopped'} />
                  ) : (
                    <span className="text-[10px] text-text-faint uppercase tracking-wide">Not configured</span>
                  )}
                </div>
                <p className="text-xs text-text-muted">{eventDef.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {config ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => handleToggle(config)}>
                      {config.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(config)}>Remove</Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedEvent(eventDef.value);
                      setAddModalOpen(true);
                    }}
                  >
                    Configure
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Configure Discord Webhook">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Event</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value as NotificationEvent)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none text-text-primary"
            >
              {EVENTS.map((e) => (
                <option key={e.value} value={e.value} className="bg-bg text-text-primary" disabled={configuredEvents.has(e.value)}>
                  {e.label}{configuredEvents.has(e.value) ? ' (already configured)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Discord Webhook URL"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => { setWebhookUrl(e.target.value); setTestResult(null); }}
          />

          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={handleTest} loading={testing} disabled={!webhookUrl.trim()}>
              Send Test
            </Button>
            {testResult && <span className="text-xs text-text-muted">{testResult}</span>}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSave} loading={busy} disabled={!webhookUrl.trim()}>
              Save Webhook
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Tab 2: Database Backups & Cloudflare R2 Component ──
function DatabaseBackupsTab() {
  const [runs, setRuns] = useState<BackupRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const { toast } = useToast();

  function load() {
    api.backups
      .history()
      .then((data) => setRuns(data.runs))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleRunNow() {
    setRunning(true);
    try {
      const result = await api.backups.run();
      toast(`Backup complete — ${formatBytes(result.sizeBytes)} uploaded to ${result.key}.`, 'success');
      load();
    } catch (err: any) {
      toast(err.message || 'Backup failed', 'error');
      load();
    } finally {
      setRunning(false);
    }
  }

  async function handleExportZip() {
    setExportingZip(true);
    try {
      await api.backups.exportZip();
      toast('Full platform backup ZIP archive exported successfully!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to export platform backup ZIP', 'error');
    } finally {
      setExportingZip(false);
    }
  }

  const successfulRuns = runs?.filter((r) => r.success) || [];
  const latestRun = runs?.[0];

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <span>Cloudflare R2 Database Backups &amp; Archive Engine</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Automated PostgreSQL database snapshots synced to Cloudflare R2 with daily rotating retention.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={handleExportZip} loading={exportingZip} size="sm">
            📦 Export Full Backup as ZIP
          </Button>
          <Button onClick={handleRunNow} loading={running} size="sm">
            ☁️ Run R2 Backup Now
          </Button>
        </div>
      </div>

      {/* Cloudflare R2 Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Storage Target</div>
          <div className="text-sm font-bold text-text-primary mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Cloudflare R2 Object Storage
          </div>
          <div className="text-[11px] font-mono text-text-muted mt-0.5 truncate">s3.r2.cloudflarestorage.com</div>
        </Card>

        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Retention Policy</div>
          <div className="text-sm font-bold text-emerald-400 mt-1">Daily Differential (Even/Odd)</div>
          <div className="text-[11px] text-text-muted mt-0.5">Zero storage bloat retention</div>
        </Card>

        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Stored Runs</div>
          <div className="text-xl font-bold text-text-primary mt-1">{runs?.length || 0}</div>
          <div className="text-[11px] text-text-muted mt-0.5">{successfulRuns.length} successful snapshots</div>
        </Card>

        <Card className="border border-white/10 p-4 bg-white/[0.02]">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Latest Status</div>
          <div className="text-sm font-bold text-text-primary mt-1">
            {latestRun ? (
              <span className={latestRun.success ? 'text-emerald-400' : 'text-rose-400'}>
                {latestRun.success ? 'Healthy' : 'Failed'} ({formatBytes(latestRun.sizeBytes)})
              </span>
            ) : (
              'No runs yet'
            )}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {latestRun ? new Date(latestRun.createdAt).toLocaleDateString() : 'Awaiting snapshot'}
          </div>
        </Card>
      </div>

      {error && <ErrorBanner message={error} />}
      {runs === null && <Spinner label="Loading Cloudflare R2 backup history..." />}
      {runs?.length === 0 && (
        <EmptyState message="No database backups have been recorded yet. Click 'Run R2 Backup Now' above to take the first snapshot." />
      )}

      {/* Backup Runs Ledger */}
      {runs && runs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Historical Snapshots ({runs.length})
          </h4>
          <div className="space-y-2">
            {runs.map((run) => (
              <Card key={run.id} className="border border-white/[0.08] flex items-center justify-between p-4 bg-[#0a0a0f]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge status={run.success ? 'running' : 'failed'} />
                    <span className="text-xs font-medium text-text-primary">
                      {run.triggeredBy.startsWith('manual') ? 'Manual Operator Trigger' : 'Automated Cron Snapshot'}
                    </span>
                    <span className="text-[11px] text-text-muted">·</span>
                    <span className="text-xs text-text-faint">{new Date(run.createdAt).toLocaleString()}</span>
                  </div>
                  {run.r2Key && (
                    <p className="text-xs font-mono text-emerald-400/90 mt-0.5 truncate">
                      R2 Key: {run.r2Key}
                    </p>
                  )}
                  {run.error && <p className="text-xs text-red-400 mt-1 font-mono">{run.error}</p>}
                </div>
                <div className="text-right text-xs text-text-muted shrink-0 ml-4 font-mono">
                  <p className="text-text-primary font-bold">{formatBytes(run.sizeBytes)}</p>
                  <p className="text-[11px] text-text-muted">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Global SMTP & API Configurations Component ──
function ApiConfigsTab() {
  const [configs, setConfigs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // SMTP Form State
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);

  const { toast } = useToast();

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.settings.getConfigs().catch(() => ({ configs: null })),
      api.settings.getSmtpConfig().catch(() => ({ config: null })),
    ])
      .then(([configsData, smtpData]) => {
        setConfigs(configsData.configs);
        if (smtpData.config) {
          setSmtpHost(smtpData.config.host || '');
          setSmtpPort(smtpData.config.port || 587);
          setSmtpUser(smtpData.config.user || '');
          setSmtpFrom(smtpData.config.fromEmail || 'support@shanutech.com');
          setSmtpFromName(smtpData.config.fromName || 'ShanuTechX Cloud');
          setSmtpSecure(Boolean(smtpData.config.secure));
          setHasExistingPassword(Boolean(smtpData.config.hasPassword));
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  async function handleTestSmtp() {
    setTestingSmtp(true);
    setTestResult(null);
    try {
      const res = await api.settings.testSmtpConnection({
        host: smtpHost.trim(),
        port: Number(smtpPort),
        user: smtpUser.trim(),
        pass: smtpPass.trim() || undefined,
        secure: smtpSecure,
      });
      setTestResult(res);
      if (res.ok) {
        toast(`SMTP Test Succeeded! Handshake completed in ${res.latencyMs}ms`, 'success');
      } else {
        toast(`SMTP Test Failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Connection failed', latencyMs: 0 });
      toast(err.message || 'SMTP test error', 'error');
    } finally {
      setTestingSmtp(false);
    }
  }

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      await api.settings.saveSmtpConfig({
        host: smtpHost.trim(),
        port: Number(smtpPort),
        user: smtpUser.trim(),
        pass: smtpPass.trim() || undefined,
        fromEmail: smtpFrom.trim(),
        fromName: smtpFromName.trim(),
        secure: smtpSecure,
      });
      toast('Global SMTP Mail Server credentials saved and encrypted!', 'success');
      setSmtpPass('');
      loadAll();
    } catch (err: any) {
      toast(err.message || 'Failed to save SMTP configuration', 'error');
    } finally {
      setSavingSmtp(false);
    }
  }

  if (loading) return <Spinner label="Checking system API integrations..." />;

  return (
    <div className="space-y-6 w-full">
      <div>
        <h3 className="text-base font-bold text-text-primary">System Integrations &amp; Global SMTP Server</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Configure production mail delivery credentials, transactional dispatching, and view cloud services status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Global SMTP Mail Server Form */}
        <div className="lg:col-span-8">
          <Card className="border border-white/10 p-6 bg-[#0a0a0f] shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                  ✉️
                </div>
                <div>
                  <h4 className="font-bold text-sm text-text-primary">Global SMTP / Mail Server Credentials</h4>
                  <p className="text-[11px] text-text-muted">
                    Required for automated password resets, transactional order receipts, and customer notifications.
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${configs?.smtpServer?.configured ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-text-muted'}`}>
                {configs?.smtpServer?.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    label="SMTP Host / Server"
                    placeholder="mail.shanutech.com or smtp.gmail.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Port"
                    type="number"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value, 10) || 587)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="SMTP Username"
                  placeholder="notifications@shanutech.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  required
                />
                <Input
                  label={hasExistingPassword ? 'Password (leave blank to keep existing)' : 'Password'}
                  type="password"
                  placeholder="••••••••••••"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Sender 'From' Email"
                  type="email"
                  placeholder="support@shanutech.com"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  required
                />
                <Input
                  label="Sender 'From' Name"
                  placeholder="ShanuTechX Cloud"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="smtpSecureCheckbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="smtpSecureCheckbox" className="text-xs text-text-primary select-none cursor-pointer">
                  Use Implicit SSL / TLS (typically Port 465). Uncheck for STARTTLS (Port 587 or 25).
                </label>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                  <span>{testResult.ok ? `Handshake Successful: ${testResult.message}` : `Test Failed: ${testResult.message}`}</span>
                  {testResult.ok && <span className="font-mono text-[11px] opacity-80">{testResult.latencyMs}ms</span>}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestSmtp}
                  loading={testingSmtp}
                  disabled={!smtpHost.trim() || !smtpUser.trim()}
                >
                  ⚡ Test SMTP Handshake
                </Button>

                <Button type="submit" size="sm" loading={savingSmtp}>
                  Save SMTP Configuration
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right Column: Cloud Services Status Cards */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border border-white/10 p-5 bg-[#0a0a0f] space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-text-primary flex items-center gap-2">
                <span>☁️ Cloudflare R2 Storage</span>
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${configs?.r2Storage?.configured ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-text-muted'}`}>
                {configs?.r2Storage?.configured ? 'Active' : 'Unconfigured'}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Provides S3-compatible cloud object storage for Postgres database backups and client attachment proofs.
            </p>
          </Card>

          <Card className="border border-white/10 p-5 bg-[#0a0a0f] space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-text-primary flex items-center gap-2">
                <span>💬 Discord Notifications</span>
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${configs?.discordWebhooks?.configured ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-text-muted'}`}>
                {configs?.discordWebhooks?.configured ? `${configs.discordWebhooks.count} Webhooks` : 'Unconfigured'}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Dispatches alerts for pending payment review, new customer tickets, and node incidents to Discord channels.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Security PIN Settings Component ──
function SecurityPinTab() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSocialProvider, setIsSocialProvider] = useState(false);
  const [providerName, setProviderName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    try {
      const cached = localStorage.getItem('stx_auth_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.provider === 'google' || parsed.provider === 'github') {
          setIsSocialProvider(true);
          setProviderName(parsed.provider === 'google' ? 'Google' : 'GitHub');
        }
      }
    } catch {}
  }, []);

  async function handleUpdatePin(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPin || !newPin || !confirmPin) {
      setError('Please fill in all fields');
      return;
    }
    if (newPin !== confirmPin) {
      setError('New PINs do not match');
      return;
    }
    if (newPin.length < 4) {
      setError('New PIN must be at least 4 characters long');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await api.settings.changePin(currentPin, newPin);
      if (res.ok) {
        toast('Settings security PIN updated!', 'success');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update PIN');
    } finally {
      setBusy(false);
    }
  }

  if (isSocialProvider) {
    return (
      <Card className="max-w-lg border border-white/15 p-6 space-y-4 bg-indigo-950/20">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-white/10 text-neutral-300 font-bold shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Managed Identity Provider ({providerName})</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are signed in using <strong>{providerName} OAuth</strong>. Password management, 2FA, and credential security settings are managed securely by your provider. Password &amp; security PIN forms are hidden.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                OAuth Identity Active ({providerName})
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg border border-white/[0.06] p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Change Settings Security PIN</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Update the security PIN required to unlock protected system settings.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleUpdatePin} className="space-y-4">
        <Input
          type="password"
          label="Current Password or PIN"
          placeholder="Enter current PIN..."
          value={currentPin}
          onChange={(e) => { setCurrentPin(e.target.value); setError(null); }}
        />

        <Input
          type="password"
          label="New Security PIN"
          placeholder="Enter new 4+ character PIN..."
          value={newPin}
          onChange={(e) => { setNewPin(e.target.value); setError(null); }}
        />

        <Input
          type="password"
          label="Confirm New Security PIN"
          placeholder="Re-enter new PIN..."
          value={confirmPin}
          onChange={(e) => { setConfirmPin(e.target.value); setError(null); }}
        />

        <div className="pt-2">
          <Button type="submit" variant="primary" size="sm" loading={busy}>
            Update Security PIN
          </Button>
        </div>
      </form>
    </Card>
  );
}


// ── Tab 6: Payment Info & Multi-Channel Gateways Configuration Component ──
interface AdminPaymentChannel {
  id: string;
  name: string;
  category: 'bank' | 'mobile_wallet' | 'crypto';
  enabled: boolean;
  badge?: string;
  details: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    branch?: string;
    swiftCode?: string;
    mobileNumber?: string;
    helaPayId?: string;
    currency?: string;
    network?: string;
    walletAddress?: string;
    bybitUid?: string;
    memo?: string;
    note?: string;
    qrCodeUrl?: string;
  };
}

function PaymentInfoTab() {
  const [channels, setChannels] = useState<AdminPaymentChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadChannels();
  }, []);

  async function loadChannels() {
    setLoading(true);
    try {
      const data = await api.payments.adminGetChannels();
      if (data?.channels && Array.isArray(data.channels) && data.channels.length > 0) {
        setChannels(data.channels);
      } else {
        // Fallback default structure
        setChannels([
          {
            id: 'bank_transfer',
            name: 'Commercial Bank of Ceylon (Direct Deposit / Transfer)',
            category: 'bank',
            enabled: true,
            badge: 'Popular',
            details: {
              bankName: 'Commercial Bank of Ceylon',
              branch: 'Negombo Branch (Code 001)',
              accountName: 'STX Enterprises (Shanudha Tirosh)',
              accountNumber: '100012345678',
              swiftCode: 'CCEYLKJA',
              note: 'Transfer the invoice amount and upload your deposit slip or transaction screenshot for instant verification.',
            },
          },
          {
            id: 'helapay',
            name: 'Helakuru HelaPay',
            category: 'mobile_wallet',
            enabled: true,
            badge: 'Instant QR / Mobile',
            details: {
              mobileNumber: '0712345678',
              helaPayId: 'shanudha@helapay',
              accountName: 'STX Enterprises / Shanudha Tirosh',
              note: 'Pay via Helakuru app using HelaPay QR or mobile number transfer. Upload the success receipt screenshot.',
            },
          },
          {
            id: 'ezcash',
            name: 'Dialog eZ Cash',
            category: 'mobile_wallet',
            enabled: true,
            badge: 'Fast Mobile Wallet',
            details: {
              mobileNumber: '0771234567',
              accountName: 'STX Enterprises',
              note: 'Send payment to Dialog eZ Cash wallet (Dial #111# or use eZ Cash app). Upload a screenshot of the confirmation SMS or receipt.',
            },
          },
          {
            id: 'bybit_crypto',
            name: 'Bybit Crypto USDT Transfer',
            category: 'crypto',
            enabled: true,
            badge: 'Global / Crypto',
            details: {
              currency: 'USDT',
              network: 'TRC20 (Tron Network) / Internal UID Transfer',
              walletAddress: 'TYxShanuTechXUSDTDepositWalletAddress9988',
              bybitUid: '88291041',
              memo: 'STX-ORDER',
              note: 'Zero-fee instant transfer via Bybit Internal UID Transfer (UID: 88291041) or TRC20 USDT transfer. Upload your Bybit withdrawal or tx screenshot.',
            },
          },
        ]);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to load payment channels', 'error');
    } finally {
      setLoading(false);
    }
  }

  function updateChannelField(index: number, key: keyof AdminPaymentChannel['details'], val: string) {
    setChannels((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        details: {
          ...copy[index].details,
          [key]: val,
        },
      };
      return copy;
    });
  }

  function toggleChannelEnabled(index: number, enabled: boolean) {
    setChannels((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], enabled };
      return copy;
    });
  }

  async function handleSaveChannels(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.payments.adminSaveChannels(channels);
      toast('Payment gateways and channels saved successfully!', 'success');
      loadChannels();
    } catch (err: any) {
      toast(err.message || 'Failed to save payment methods', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner label="Loading payment gateways..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <span>Payment Methods &amp; Gateways Engine</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Live Checkout Channels
            </span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Configure official Commercial Bank, Helakuru HelaPay, Dialog eZ Cash, and Bybit Crypto channels shown to customers.
          </p>
        </div>
        <Button
          onClick={handleSaveChannels}
          loading={saving}
          variant="primary"
          size="sm"
        >
          💾 Save All Payment Methods
        </Button>
      </div>

      <form onSubmit={handleSaveChannels} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {channels.map((channel, idx) => {
            const isHelaPay = channel.id === 'helapay';
            const isEzCash = channel.id === 'ezcash';
            const isBank = channel.id === 'bank_transfer';
            const isCrypto = channel.id === 'bybit_crypto';
            const requiresPhone = isHelaPay || isEzCash;
            const phoneMissing = requiresPhone && (!channel.details.mobileNumber || channel.details.mobileNumber.trim().length < 7);

            return (
              <Card
                key={channel.id}
                className={`border p-5 space-y-4 transition-all w-full ${
                  channel.enabled
                    ? 'border-white/10 bg-white/[0.02]'
                    : 'border-white/[0.05] bg-black/40 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold">
                      {isBank && '🏦'}
                      {isHelaPay && '🇱🇰'}
                      {isEzCash && '📱'}
                      {isCrypto && '🪙'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{channel.name}</span>
                        {channel.badge && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                            {channel.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-text-muted capitalize">
                        Channel ID: {channel.id}
                      </span>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-text-muted">
                      {channel.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <input
                      type="checkbox"
                      checked={channel.enabled}
                      onChange={(e) => toggleChannelEnabled(idx, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 relative" />
                  </label>
                </div>

                {requiresPhone && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      phoneMissing
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {phoneMissing ? '⚠️ Phone Number Required' : '✅ Phone Number Configured'}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {phoneMissing
                        ? 'This channel requires a valid Sri Lankan mobile number. If empty or missing, it will automatically be hidden from customers at checkout.'
                        : 'Customers can send payments directly to this mobile wallet during checkout.'}
                    </p>
                  </div>
                )}

                {/* Specific Fields per Channel */}
                {isBank && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Bank Name"
                        value={channel.details.bankName || ''}
                        onChange={(e) => updateChannelField(idx, 'bankName', e.target.value)}
                        placeholder="e.g. Commercial Bank of Ceylon"
                      />
                      <Input
                        label="Account Beneficiary Name"
                        value={channel.details.accountName || ''}
                        onChange={(e) => updateChannelField(idx, 'accountName', e.target.value)}
                        placeholder="e.g. STX Enterprises (Pvt) Ltd"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Account Number"
                        value={channel.details.accountNumber || ''}
                        onChange={(e) => updateChannelField(idx, 'accountNumber', e.target.value)}
                        placeholder="e.g. 100012345678"
                      />
                      <Input
                        label="Branch Name &amp; Code"
                        value={channel.details.branch || ''}
                        onChange={(e) => updateChannelField(idx, 'branch', e.target.value)}
                        placeholder="e.g. Negombo Branch (001)"
                      />
                    </div>
                    <Input
                      label="SWIFT / BIC Code (Optional)"
                      value={channel.details.swiftCode || ''}
                      onChange={(e) => updateChannelField(idx, 'swiftCode', e.target.value)}
                      placeholder="e.g. CCEYLKJA"
                    />
                  </div>
                )}

                {isHelaPay && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="HelaPay Mobile Phone Number *"
                        value={channel.details.mobileNumber || ''}
                        onChange={(e) => updateChannelField(idx, 'mobileNumber', e.target.value)}
                        placeholder="e.g. 071-234-5678"
                        required
                      />
                      <Input
                        label="HelaPay ID (Optional)"
                        value={channel.details.helaPayId || ''}
                        onChange={(e) => updateChannelField(idx, 'helaPayId', e.target.value)}
                        placeholder="e.g. shanutechx@helapay"
                      />
                    </div>
                    <Input
                      label="Registered Beneficiary Name"
                      value={channel.details.accountName || ''}
                      onChange={(e) => updateChannelField(idx, 'accountName', e.target.value)}
                      placeholder="e.g. Shanudha Tirosh"
                    />
                  </div>
                )}

                {isEzCash && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Dialog eZ Cash Mobile Number *"
                        value={channel.details.mobileNumber || ''}
                        onChange={(e) => updateChannelField(idx, 'mobileNumber', e.target.value)}
                        placeholder="e.g. 077-123-4567"
                        required
                      />
                      <Input
                        label="eZ Cash Account Holder Name"
                        value={channel.details.accountName || ''}
                        onChange={(e) => updateChannelField(idx, 'accountName', e.target.value)}
                        placeholder="e.g. STX Enterprises"
                      />
                    </div>
                  </div>
                )}

                {isCrypto && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Bybit Internal UID (Zero Fees)"
                        value={channel.details.bybitUid || ''}
                        onChange={(e) => updateChannelField(idx, 'bybitUid', e.target.value)}
                        placeholder="e.g. 88291041"
                      />
                      <Input
                        label="Currency &amp; Network"
                        value={channel.details.network || ''}
                        onChange={(e) => updateChannelField(idx, 'network', e.target.value)}
                        placeholder="e.g. USDT - TRC20"
                      />
                    </div>
                    <Input
                      label="Deposit Wallet Address (TRC20)"
                      value={channel.details.walletAddress || ''}
                      onChange={(e) => updateChannelField(idx, 'walletAddress', e.target.value)}
                      placeholder="e.g. TYxShanuTechXUSDTDepositWalletAddress9988"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-xs font-medium text-text-muted">
                    Customer Payment Instructions &amp; Notes
                  </label>
                  <textarea
                    rows={2}
                    value={channel.details.note || ''}
                    onChange={(e) => updateChannelField(idx, 'note', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber-500 font-sans"
                    placeholder="Provide step-by-step transfer instructions shown to the customer..."
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" loading={saving} size="sm">
            💾 Save All Payment Methods
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Tab 7: GitHub System Integration & Automated Backups Component ──
function GithubSystemIntegrationTab() {
  const [token, setToken] = useState('');
  const [maskedToken, setMaskedToken] = useState('');
  const [org, setOrg] = useState('');
  const [configured, setConfigured] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [actionsEnabled, setActionsEnabled] = useState(true);
  const { toast } = useToast();

  function loadConfig() {
    api.settings
      .getGithubBackup()
      .then((data) => {
        setConfigured(data.configured);
        setOrg(data.org || '');
        setMaskedToken(data.maskedToken || '');
      })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(loadConfig, []);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.settings.testGithubBackup(token.trim() || undefined, org.trim() || undefined);
      setTestResult(res);
      if (res.ok) {
        toast(`Connected to GitHub as @${res.user.login}`, 'success');
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || 'Failed to connect to GitHub API' });
      toast(err.message || 'GitHub API test failed', 'error');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() && !maskedToken) {
      toast('Please enter a valid GitHub API Key or Personal Access Token', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.settings.saveGithubBackup(token.trim(), org.trim());
      if (res.ok) {
        toast('GitHub System credentials updated!', 'success');
        setConfigured(true);
        setMaskedToken(token.trim() ? `${token.trim().slice(0, 4)}...${token.trim().slice(-4)}` : maskedToken);
        setToken('');
        loadConfig();
      }
    } catch (err: any) {
      toast(err.message || 'Failed to save GitHub credentials', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading GitHub system settings..." />;

  return (
    <div className="space-y-6">
      <Card className="border border-white/[0.06] p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/15 text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Platform GitHub System Account &amp; Automation
                {configured ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active &amp; Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Not Configured
                  </span>
                )}
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Configure your platform's dedicated GitHub API key/PAT to create private shadow backup repos, run GitHub Actions CI/CD workflows, and automate deployment backups.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-primary flex items-center justify-between">
              <span>GitHub Personal Access Token (PAT) / API Key</span>
              {maskedToken && (
                <span className="text-[11px] font-mono text-emerald-400">Current: {maskedToken}</span>
              )}
            </label>
            <div className="relative flex items-center">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder={maskedToken ? 'Enter new token to update...' : 'ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_xxxx'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 text-text-muted hover:text-white transition-colors"
              >
                {showToken ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <p className="text-[11px] text-text-muted">
              Required scopes: <code className="text-neutral-300 font-mono">repo</code>, <code className="text-neutral-300 font-mono">workflow</code>, <code className="text-neutral-300 font-mono">admin:org</code> (if using an Organization).
            </p>
          </div>

          <Input
            label="Target GitHub Organization or Username (Optional)"
            placeholder="e.g. shanutechx-deploy-backups or your-username"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          />

          <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/[0.06]">
            <div>
              <p className="text-xs font-semibold text-white">Enable GitHub Actions Automated CI/CD</p>
              <p className="text-[11px] text-text-muted">Automatically inject <code className="font-mono text-neutral-300">.github/workflows/deploy.yml</code> into shadow backup repos for build verification.</p>
            </div>
            <button
              type="button"
              onClick={() => setActionsEnabled(!actionsEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${actionsEnabled ? 'bg-white text-black' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${actionsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTest}
              loading={testing}
            >
              Test GitHub Connection
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!token.trim() && !configured}
            >
              Save System Token
            </Button>
          </div>
        </form>

        {testResult && (
          <div className={`p-4 rounded-xl border ${testResult.ok ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-red-950/20 border-red-500/30'} space-y-3`}>
            <div className="flex items-center gap-2">
              {testResult.ok ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
              <span className={`text-xs font-bold ${testResult.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                {testResult.message || testResult.error}
              </span>
            </div>

            {testResult.ok && testResult.user && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div className="glass p-2.5 rounded-lg">
                  <span className="text-[10px] text-text-muted block">Authenticated User</span>
                  <span className="font-bold text-white font-mono">@{testResult.user.login}</span>
                </div>
                <div className="glass p-2.5 rounded-lg">
                  <span className="text-[10px] text-text-muted block">Private Repositories</span>
                  <span className="font-bold text-white font-mono">{testResult.user.totalPrivateRepos}</span>
                </div>
                <div className="glass p-2.5 rounded-lg">
                  <span className="text-[10px] text-text-muted block">Target Org</span>
                  <span className="font-bold text-white font-mono">{testResult.org ? `@${testResult.org.login}` : 'Personal Account'}</span>
                </div>
                <div className="glass p-2.5 rounded-lg">
                  <span className="text-[10px] text-text-muted block">Token Scopes</span>
                  <span className="font-bold text-emerald-300 font-mono text-[10px]">{testResult.scopes}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Main Page Component ──
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('payment');

  return (
    <PasswordLockGuard
      title="Protected Settings Vault"
      description="System settings (Payment Gateways, Database Backups, Global SMTP & APIs, Discord Webhooks, GitHub System, and Security PIN) are password protected."
    >
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
        <PageHeader
          title="System Settings"
          description="Manage payment gateways, Cloudflare R2 automated database backups, global SMTP mail servers, Discord notification alerts, GitHub backups, and vault security."
        />

        <Tabs
          tabs={[
            { label: 'Payment Gateways & Methods', value: 'payment' },
            { label: 'Database Backups & R2 Archive', value: 'backups' },
            { label: 'Global SMTP & APIs', value: 'configs' },
            { label: 'Discord Webhooks', value: 'webhooks' },
            { label: 'GitHub System Backup', value: 'github' },
            { label: 'Security PIN', value: 'pin' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'payment' && <PaymentInfoTab />}
        {activeTab === 'backups' && <DatabaseBackupsTab />}
        {activeTab === 'configs' && <ApiConfigsTab />}
        {activeTab === 'webhooks' && <DiscordWebhooksTab />}
        {activeTab === 'github' && <GithubSystemIntegrationTab />}
        {activeTab === 'pin' && <SecurityPinTab />}
      </div>
    </PasswordLockGuard>
  );
}

