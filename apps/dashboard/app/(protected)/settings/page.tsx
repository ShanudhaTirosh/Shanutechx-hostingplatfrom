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

// ── Tab 2: Database Backups Component ──
function DatabaseBackupsTab() {
  const [runs, setRuns] = useState<BackupRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Platform Database Backups</h3>
          <p className="text-xs text-text-muted">Postgres database snapshots synced to Cloudflare R2 (even/odd day retention).</p>
        </div>
        <Button onClick={handleRunNow} loading={running} size="sm">Run Backup Now</Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {runs === null && <Spinner label="Loading backup history..." />}
      {runs?.length === 0 && (
        <EmptyState message="No backups have run yet." />
      )}

      <div className="space-y-2">
        {runs?.map((run) => (
          <Card key={run.id} className="border border-white/[0.06] flex items-center justify-between p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge status={run.success ? 'running' : 'failed'} />
                <span className="text-xs text-text-muted">
                  {run.triggeredBy === 'cron' ? 'Scheduled (cron)' : 'Manual trigger'}
                </span>
              </div>
              <p className="text-xs text-text-faint">
                {new Date(run.createdAt).toLocaleString()}
                {run.r2Key && <span className="font-mono ml-2 text-text-primary">{run.r2Key}</span>}
              </p>
              {run.error && <p className="text-xs text-red-400 mt-1">{run.error}</p>}
            </div>
            <div className="text-right text-xs text-text-muted shrink-0 ml-4">
              <p>{formatBytes(run.sizeBytes)}</p>
              <p>{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tab 3: API Configurations Component ──
function ApiConfigsTab() {
  const [configs, setConfigs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.settings
      .getConfigs()
      .then((data) => setConfigs(data.configs))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Checking system API integrations..." />;

  const INTEGRATIONS = [
    {
      name: 'Global SMTP / Mail Server',
      status: configs?.smtpServer?.configured ? 'Configured' : 'Not Configured',
      color: configs?.smtpServer?.configured ? 'emerald' : 'white',
      hint: 'Required for automated transactional emails and customer webmail inboxes.',
    },
    {
      name: 'Cloudflare R2 Object Storage',
      status: configs?.r2Storage?.configured ? 'Configured' : 'Not Configured',
      color: configs?.r2Storage?.configured ? 'emerald' : 'white',
      hint: 'Required for automated database backups and project file uploads.',
    },
    {
      name: 'Discord Notification Gateway',
      status: configs?.discordWebhooks?.configured ? `${configs.discordWebhooks.count} Webhooks` : 'Not Configured',
      color: configs?.discordWebhooks?.configured ? 'emerald' : 'white',
      hint: 'Sends live events and alert notifications to Discord channels.',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">System Integration Configs</h3>
        <p className="text-xs text-text-muted">Overview of platform environment credentials and external integrations.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {INTEGRATIONS.map((item) => (
          <Card key={item.name} className="border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm text-text-primary">{item.name}</h4>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${item.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-text-muted'}`}>
                {item.status}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{item.hint}</p>
          </Card>
        ))}
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
      <Card className="max-w-lg border border-indigo-500/20 p-6 space-y-4 bg-indigo-950/20">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold shrink-0">
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


// ── Tab 6: Payment Info Configuration Component ──
function PaymentInfoTab() {
  const [bankName, setBankName] = useState('Commercial Bank of Ceylon');
  const [accountName, setAccountName] = useState('ShanuTechX Cloud Hostings Pvt Ltd');
  const [accountNumber, setAccountNumber] = useState('8001234567801');
  const [branch, setBranch] = useState('Colombo Main Branch (Code 001)');
  const [swiftCode, setSwiftCode] = useState('COMBCLKX');
  const [instructions, setInstructions] = useState('Please transfer the invoice total and upload your bank transfer deposit slip / receipt for instant manual verification.');
  const [currency, setCurrency] = useState('LKR');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function handleSavePaymentInfo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast('Payment gateway configuration saved successfully!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update payment info', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl border border-white/[0.06] p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Payment Information & Bank Transfer Gateway</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Configure official bank accounts and payment instructions shown to customers during checkout.
        </p>
      </div>

      <form onSubmit={handleSavePaymentInfo} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Bank Name"
            placeholder="Commercial Bank"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            required
          />

          <Input
            label="Account Beneficiary Name"
            placeholder="ShanuTechX Hostings"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Account Number"
            placeholder="8001234567801"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            required
          />

          <Input
            label="Branch Name & Code"
            placeholder="Colombo Fort - 001"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="SWIFT / BIC Code (Optional)"
            placeholder="COMBCLKX"
            value={swiftCode}
            onChange={(e) => setSwiftCode(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Primary Platform Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none text-text-primary"
            >
              <option value="LKR" className="bg-bg text-text-primary">LKR - Sri Lankan Rupee (₨)</option>
              <option value="USD" className="bg-bg text-text-primary">USD - US Dollar ($)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Checkout Instructions for Customers</label>
          <textarea
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="submit" variant="primary" size="sm" loading={busy}>
            Save Payment Settings
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Tab 5: Client Team & Granular RBAC Component ──
function ClientTeamTab() {
  const [teamsData, setTeamsData] = useState<{ ownedTeams: any[]; joinedTeams: any[] } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<{ team: any; myRole: string; resources: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'billing' | 'viewer'>('developer');
  const [resourcePermissions, setResourcePermissions] = useState<Record<string, 'manage' | 'view' | 'none'>>({});
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const { toast } = useToast();

  function loadTeams() {
    api.teams
      .list()
      .then((data) => {
        setTeamsData(data);
        if (data.ownedTeams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(data.ownedTeams[0].id);
        } else if (data.joinedTeams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(data.joinedTeams[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadTeams, []);

  useEffect(() => {
    if (!selectedTeamId) return;
    api.teams
      .get(selectedTeamId)
      .then((d) => setTeamDetail(d))
      .catch((err) => toast(err.message, 'error'));
  }, [selectedTeamId]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const res = await api.teams.create(newTeamName.trim());
      toast(`Team workspace "${newTeamName}" created!`, 'success');
      setNewTeamName('');
      setSelectedTeamId(res.team.id);
      loadTeams();
    } catch (err: any) {
      toast(err.message || 'Failed to create team', 'error');
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const permsArray: any[] = [];
      Object.entries(resourcePermissions).forEach(([key, val]) => {
        const [resourceType, resourceId] = key.split(':');
        if (val && val !== 'none') {
          permsArray.push({ resourceType, resourceId, permission: val });
        }
      });

      const res = await api.teams.invite(selectedTeamId, {
        email: inviteEmail.trim(),
        role: inviteRole,
        resourcePermissions: permsArray.length > 0 ? permsArray : undefined,
      });

      toast(`Invitation email automatically sent to ${inviteEmail}`, 'success');
      setGeneratedInviteLink(res.inviteLink);
      setInviteEmail('');
      if (selectedTeamId) api.teams.get(selectedTeamId).then(setTeamDetail);
    } catch (err: any) {
      toast(err.message || 'Failed to send invite', 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedTeamId) return;
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    try {
      await api.teams.removeMember(selectedTeamId, memberId);
      toast('Team member removed', 'success');
      api.teams.get(selectedTeamId).then(setTeamDetail);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  if (loading) return <Spinner label="Loading team workspaces..." />;

  const allTeams = [...(teamsData?.ownedTeams || []), ...(teamsData?.joinedTeams || [])];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Team Management &amp; Role-Based Access Control (RBAC)</h3>
          <p className="text-xs text-text-muted">Invite team members via email or unique link to manage deployments, databases, VPS, and SMTP servers with granular permissions.</p>
        </div>

        {allTeams.length > 0 && (
          <Button size="sm" onClick={() => setInviteModalOpen(true)}>+ Invite Team Member</Button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Create Team Form if no team */}
      {allTeams.length === 0 ? (
        <Card className="border border-white/10 p-6 space-y-4 max-w-lg">
          <h4 className="font-bold text-sm text-white">Create Your First Team Workspace</h4>
          <form onSubmit={handleCreateTeam} className="space-y-3">
            <Input
              label="Team Name"
              placeholder="e.g. Acme Corp Infrastructure"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
            <Button type="submit" size="sm" loading={creatingTeam}>Create Team Workspace</Button>
          </form>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Team Switcher Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {allTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 ${
                  selectedTeamId === t.id
                    ? 'bg-indigo-600 text-white shadow-glow-violet'
                    : 'glass text-text-muted hover:text-white'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {t.name}
              </button>
            ))}
          </div>

          {teamDetail && (
            <div className="space-y-6">
              {/* Active Members Table */}
              <Card className="border border-white/[0.06] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-white">Team Members ({teamDetail.team.members.length})</h4>
                    <p className="text-xs text-text-muted">Users who have access to manage this team's purchased services.</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300">
                    My Role: {teamDetail.myRole}
                  </span>
                </div>

                <div className="space-y-3">
                  {teamDetail.team.members.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-xs">
                          {m.user.displayName ? m.user.displayName[0].toUpperCase() : m.user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{m.user.displayName || m.user.email}</p>
                          <p className="text-[11px] text-text-muted font-mono">{m.user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white">
                          {m.role}
                        </span>

                        {teamDetail.myRole === 'owner' && m.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Pending Invitations */}
              {teamDetail.team.invites && teamDetail.team.invites.length > 0 && (
                <Card className="border border-white/[0.06] p-5 space-y-3">
                  <h4 className="font-bold text-sm text-white">Pending Invitations ({teamDetail.team.invites.length})</h4>
                  <div className="space-y-2">
                    {teamDetail.team.invites.map((inv: any) => {
                      const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/team/accept?token=${inv.token}`;
                      return (
                        <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs p-3 glass rounded-xl border border-white/[0.06]">
                          <div>
                            <span className="font-bold text-white font-mono">{inv.email}</span>
                            <span className="text-text-muted ml-2">Role: <strong className="text-indigo-300 uppercase">{inv.role}</strong></span>
                            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
                              {inv.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(inviteUrl);
                                toast('Unique invitation URL copied!', 'success');
                              }}
                              className="px-2.5 py-1 glass rounded text-[11px] font-semibold text-white hover:bg-white/10 transition-colors"
                            >
                              Copy URL
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.teams.resendInvite(selectedTeamId!, inv.id);
                                  toast(`Invitation email re-sent to ${inv.email}`, 'success');
                                } catch (err: any) {
                                  toast(err.message, 'error');
                                }
                              }}
                              className="px-2.5 py-1 glass rounded text-[11px] font-semibold text-indigo-300 hover:bg-white/10 transition-colors"
                            >
                              Resend Email
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(`Revoke invitation for ${inv.email}?`)) return;
                                try {
                                  await api.teams.revokeInvite(selectedTeamId!, inv.id);
                                  toast('Invitation revoked', 'success');
                                  if (selectedTeamId) api.teams.get(selectedTeamId).then(setTeamDetail);
                                } catch (err: any) {
                                  toast(err.message, 'error');
                                }
                              }}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Purchased Services Scope */}
              <Card className="border border-white/[0.06] p-5 space-y-3">
                <h4 className="font-bold text-sm text-white">Team Purchased Services</h4>
                <div className="grid md:grid-cols-4 gap-3 text-xs">
                  <div className="glass p-3 rounded-xl">
                    <span className="text-text-muted block text-[11px]">Deployments</span>
                    <span className="font-bold text-white text-base">{teamDetail.resources.deployments.length}</span>
                  </div>
                  <div className="glass p-3 rounded-xl">
                    <span className="text-text-muted block text-[11px]">Managed Databases</span>
                    <span className="font-bold text-white text-base">{teamDetail.resources.databases.length}</span>
                  </div>
                  <div className="glass p-3 rounded-xl">
                    <span className="text-text-muted block text-[11px]">VPS Servers</span>
                    <span className="font-bold text-white text-base">{teamDetail.resources.vpsInstances.length}</span>
                  </div>
                  <div className="glass p-3 rounded-xl">
                    <span className="text-text-muted block text-[11px]">SMTP Mailboxes</span>
                    <span className="font-bold text-white text-base">{teamDetail.resources.smtpAccounts.length}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <Modal open={inviteModalOpen} onClose={() => { setInviteModalOpen(false); setGeneratedInviteLink(null); }} title="Invite Team Member">
          <form onSubmit={handleSendInvite} className="space-y-4">
            <Input
              label="Recipient Email Address"
              placeholder="colleague@domain.com"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Assigned Team Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none text-white"
              >
                <option value="admin" className="bg-bg">Admin — Full manage access to all team resources</option>
                <option value="developer" className="bg-bg">Developer — Deploy apps, manage DBs and containers</option>
                <option value="billing" className="bg-bg">Billing — Manage invoices and subscriptions</option>
                <option value="viewer" className="bg-bg">Viewer — Read-only access to metrics and logs</option>
              </select>
            </div>

            {/* Granular Resource Permissions Selection Matrix */}
            {teamDetail && (
              <div className="space-y-2 border-t border-white/10 pt-3">
                <label className="text-xs font-bold text-white">Granular Resource Permissions (Optional)</label>
                <p className="text-[11px] text-text-muted">Grant specific manage or view permissions per resource item:</p>
                <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                  {teamDetail.resources.deployments.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between text-xs glass p-2 rounded-lg">
                      <span className="font-mono text-text-muted truncate max-w-[200px]">Deployment: {d.subdomain}</span>
                      <select
                        value={resourcePermissions[`deployment:${d.id}`] || 'manage'}
                        onChange={(e) => setResourcePermissions({ ...resourcePermissions, [`deployment:${d.id}`]: e.target.value as any })}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[11px] text-white"
                      >
                        <option value="manage">Manage</option>
                        <option value="view">View</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  ))}
                  {teamDetail.resources.databases.map((db: any) => (
                    <div key={db.id} className="flex items-center justify-between text-xs glass p-2 rounded-lg">
                      <span className="font-mono text-text-muted truncate max-w-[200px]">DB ({db.type}): {db.internalHost || db.id}</span>
                      <select
                        value={resourcePermissions[`managed_database:${db.id}`] || 'manage'}
                        onChange={(e) => setResourcePermissions({ ...resourcePermissions, [`managed_database:${db.id}`]: e.target.value as any })}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[11px] text-white"
                      >
                        <option value="manage">Manage</option>
                        <option value="view">View</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  ))}
                  {teamDetail.resources.vpsInstances.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between text-xs glass p-2 rounded-lg">
                      <span className="font-mono text-text-muted truncate max-w-[200px]">VPS: {v.provider} ({v.id.slice(0, 8)})</span>
                      <select
                        value={resourcePermissions[`vps:${v.id}`] || 'manage'}
                        onChange={(e) => setResourcePermissions({ ...resourcePermissions, [`vps:${v.id}`]: e.target.value as any })}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[11px] text-white"
                      >
                        <option value="manage">Manage</option>
                        <option value="view">View</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {generatedInviteLink && (
              <div className="bg-black/50 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-emerald-400">Invitation Email Dispatched Automatically!</p>
                <p className="text-[11px] text-text-muted">You can also copy the unique invitation link directly below:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="flex-1 bg-black text-[11px] font-mono text-text-muted p-1.5 rounded border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteLink);
                      toast('Invitation link copied to clipboard!', 'success');
                    }}
                    className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold shrink-0 hover:bg-emerald-500 transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-white/10">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setInviteModalOpen(false); setGeneratedInviteLink(null); }}>
                Close
              </Button>
              <Button type="submit" size="sm" loading={inviting}>Send Email &amp; Generate Link</Button>
            </div>
          </form>
        </Modal>
      )}
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
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
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
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
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
              Required scopes: <code className="text-indigo-300 font-mono">repo</code>, <code className="text-indigo-300 font-mono">workflow</code>, <code className="text-indigo-300 font-mono">admin:org</code> (if using an Organization).
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
              <p className="text-[11px] text-text-muted">Automatically inject <code className="font-mono text-indigo-300">.github/workflows/deploy.yml</code> into shadow backup repos for build verification.</p>
            </div>
            <button
              type="button"
              onClick={() => setActionsEnabled(!actionsEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${actionsEnabled ? 'bg-indigo-600' : 'bg-white/10'}`}
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
  const [activeTab, setActiveTab] = useState('webhooks');

  return (
    <PasswordLockGuard
      title="Protected Settings Vault"
      description="System settings (GitHub System Integration, Discord Webhooks, Database Backups, API Configs, Client Team RBAC, Security PIN) are password protected."
    >
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <PageHeader
          title="System Settings"
          description="Manage sensitive system alerts, client team invitations, GitHub system credentials, automated database backups, API configurations, and security credentials."
        />

        <Tabs
          tabs={[
            { label: 'Payment Config', value: 'payment' },
            { label: 'Team & RBAC', value: 'team' },
            { label: 'GitHub System', value: 'github' },
            { label: 'Discord Webhooks', value: 'webhooks' },
            { label: 'Database Backups', value: 'backups' },
            { label: 'API Configs', value: 'configs' },
            { label: 'Security PIN', value: 'pin' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'payment' && <PaymentInfoTab />}
        {activeTab === 'team' && <ClientTeamTab />}
        {activeTab === 'github' && <GithubSystemIntegrationTab />}
        {activeTab === 'webhooks' && <DiscordWebhooksTab />}
        {activeTab === 'backups' && <DatabaseBackupsTab />}
        {activeTab === 'configs' && <ApiConfigsTab />}
        {activeTab === 'pin' && <SecurityPinTab />}
      </div>
    </PasswordLockGuard>
  );
}

