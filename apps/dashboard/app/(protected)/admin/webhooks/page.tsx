'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Card,
  Button,
  Input,
  PageHeader,
  useToast,
  EmptyState,
  Spinner,
  Badge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function AdminWebhooksPage() {
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [eventFilter, setEventFilter] = useState('payment.pending');
  const [saving, setSaving] = useState(false);
  const [webhooks, setWebhooks] = useState<any[] | null>(null);
  const { toast } = useToast();

  function loadWebhooks() {
    api.webhooks
      .list()
      .then((data) => setWebhooks(data.webhooks))
      .catch(() => setWebhooks([]));
  }

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!discordWebhookUrl.trim()) return;
    setSaving(true);
    try {
      await api.webhooks.create(discordWebhookUrl.trim(), eventFilter);
      toast('Discord Webhook notification configured successfully', 'success');
      setDiscordWebhookUrl('');
      loadWebhooks();
    } catch (err: any) {
      toast(err.message || 'Failed to configure Webhook', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      await api.webhooks.delete(id);
      toast('Webhook removed', 'success');
      loadWebhooks();
    } catch (err: any) {
      toast(err.message || 'Failed to remove webhook', 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="System & Discord Notification Webhooks"
        description="Configure Discord Webhook URLs for payment pending alerts, new support tickets, and system health events."
      />

      <Card className="border border-white/10 p-5 bg-white/[0.02]">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Add Discord / System Notification Webhook</h3>
        <form onSubmit={handleCreateWebhook} className="grid md:grid-cols-3 gap-4 items-end">
          <Input
            type="url"
            label="Discord Webhook URL"
            placeholder="https://discord.com/api/webhooks/..."
            value={discordWebhookUrl}
            onChange={(e) => setDiscordWebhookUrl(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Trigger Event Category</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50"
            >
              <option value="payment.pending" className="bg-[#0a0a14]">Payment Proof Pending Review</option>
              <option value="ticket.created" className="bg-[#0a0a14]">New Support Ticket Opened</option>
              <option value="node.offline" className="bg-[#0a0a14]">Compute Node Offline Alert</option>
              <option value="*" className="bg-[#0a0a14]">All System Events (*)</option>
            </select>
          </div>
          <Button type="submit" loading={saving}>
            Save Discord Webhook
          </Button>
        </form>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
          Configured Webhooks ({webhooks?.length ?? 0})
        </h3>

        {webhooks === null && <Spinner label="Loading configured webhooks..." />}
        {webhooks?.length === 0 && <EmptyState message="No webhooks configured yet." />}

        <div className="space-y-3">
          {webhooks?.map((wh) => (
            <Card key={wh.id} className="border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary text-sm font-mono truncate max-w-md">
                  {wh.url}
                </p>
                <p className="text-xs text-text-muted mt-1 flex items-center gap-2">
                  <span>Event: <strong className="text-accent-teal-bright">{wh.event}</strong></span>
                  <span>· Created: {new Date(wh.createdAt).toLocaleDateString()}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={wh.isActive ? 'running' : 'stopped'} />
                <Button variant="secondary" size="sm" onClick={() => handleDeleteWebhook(wh.id)}>
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
