'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
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
} from '@/components/ui';

export const dynamic = 'force-dynamic';

type NotificationEvent =
  | 'new_payment_submitted'
  | 'payment_approved'
  | 'payment_rejected'
  | 'new_order'
  | 'new_ticket'
  | 'deployment_failed'
  | 'vps_assigned'
  | 'new_ai_subscription_request';

const EVENTS: { value: NotificationEvent; label: string; description: string }[] = [
  { value: 'new_payment_submitted', label: 'New payment submitted', description: 'A customer uploaded a payment proof — needs manual review.' },
  { value: 'payment_approved', label: 'Payment approved', description: 'An admin/dev approved a payment.' },
  { value: 'payment_rejected', label: 'Payment declined', description: 'An admin/dev declined a payment (with reason).' },
  { value: 'new_order', label: 'New order', description: 'A customer placed an order (free or awaiting payment).' },
  { value: 'new_ticket', label: 'New ticket', description: 'A support ticket was opened.' },
  { value: 'deployment_failed', label: 'Deployment failed', description: 'A customer or dev deployment failed to build/start.' },
  { value: 'vps_assigned', label: 'VPS assigned / terminated', description: 'A VPS was assigned to a customer, or terminated.' },
  { value: 'new_ai_subscription_request', label: 'New AI subscription request', description: 'A customer opened an AI subscription activation ticket.' },
];

interface WebhookConfig {
  id: string;
  event: NotificationEvent;
  isActive: boolean;
  createdAt: string;
}

/**
 * Dev-only: configure which Discord channel gets pinged for which platform
 * event. Distinct from /developer, which is a customer-facing page for
 * *their own* API keys/outbound webhooks. This page manages
 * DiscordWebhookConfig — see apps/api/src/routes/discordWebhookConfig.ts
 * and lib/discordWebhooks.ts (built in Phase 1, finally gets a UI here).
 */
export default function DevWebhooksPage() {
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
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Discord Webhooks"
        description="Configure which Discord channel gets pinged for each platform event — new payments, approvals, tickets, VPS changes, and more. Dev-only."
        action={<Button onClick={() => setAddModalOpen(true)}>+ Add Webhook</Button>}
      />

      {error && <ErrorBanner message={error} />}
      {configs === null && <Spinner label="Loading webhook configuration..." />}
      {configs?.length === 0 && (
        <EmptyState message="No Discord webhooks configured yet. Add one to start getting alerts." />
      )}

      <div className="space-y-2">
        {EVENTS.map((eventDef) => {
          const config = configs?.find((c) => c.event === eventDef.value);
          return (
            <Card key={eventDef.value} className="border border-white/[0.06] flex items-center justify-between">
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
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50 text-text-primary"
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
