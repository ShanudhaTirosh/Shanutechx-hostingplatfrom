'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Input,
  useToast,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

function WebhookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

export default function DeveloperPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      <PageHeader
        title="Developer Tools"
        description="Script your own deployments, integrate orders, and configure real-time webhooks on your systems."
      />
      <ApiKeysSection />
      <WebhooksSection />
    </div>
  );
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<any[] | null>(null);
  const [label, setLabel] = useState('');
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  function load() {
    api.apiKeys.list().then((d) => setKeys(d.keys)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { rawKey } = await api.apiKeys.create(label);
      setNewRawKey(rawKey);
      setLabel('');
      toast('API key created successfully', 'success');
      load();
    } catch (err: any) {
      setError(err.message);
      toast('Failed to create API key', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await api.apiKeys.revoke(id);
      toast('API key revoked', 'info');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-1">API Credentials</h2>
        <p className="text-text-muted text-xs">
          Pass keys in requests headers: <code className="bg-white/[0.04] px-1 rounded font-mono text-[10px]">Authorization: Bearer shx_...</code>.
          Grants read/write scope on your resources only.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {newRawKey && (
        <Card className="border border-yellow-500/30 bg-yellow-500/[0.02]">
          <p className="text-xs font-semibold text-yellow-300 mb-2">⚠️ Copy this key now. It will not be shown again.</p>
          <code className="text-xs bg-black/40 rounded-lg p-3 block break-all select-all font-mono text-accent-teal-bright border border-white/5">
            {newRawKey}
          </code>
          <Button variant="ghost" className="mt-3" size="sm" onClick={() => setNewRawKey(null)}>
            Done / Copied
          </Button>
        </Card>
      )}

      <Card className="border border-white/[0.06] bg-white/[0.01]">
        <form onSubmit={handleCreate} className="flex gap-4 items-end">
          <div className="flex-1">
            <Input
              required
              label="Key Description"
              placeholder="e.g. CI pipeline / deploy-script"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <Button type="submit" loading={busy}>
            Create Key
          </Button>
        </form>
      </Card>

      {keys === null && <Spinner label="Loading active keys..." />}
      {keys?.length === 0 && <EmptyState message="No API keys provisioned yet." />}

      <div className="space-y-3">
        {keys?.map((k) => (
          <Card key={k.id} className="border border-white/[0.06] flex items-center justify-between hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${k.revokedAt ? 'bg-white/5 text-text-faint' : 'bg-accent-violet/10 text-accent-violet-light'}`}>
                <KeyIcon />
              </div>
              <div>
                <p className="font-semibold text-text-primary text-sm">{k.label}</p>
                <p className="text-text-muted text-[10px] font-mono mt-0.5">
                  Prefix: {k.keyPrefix}... ·{' '}
                  {k.revokedAt ? (
                    <span className="text-red-400 font-semibold uppercase">Revoked</span>
                  ) : k.lastUsedAt ? (
                    `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                  ) : (
                    'Never used'
                  )}
                </p>
              </div>
            </div>
            {!k.revokedAt && (
              <Button variant="danger" size="sm" onClick={() => handleRevoke(k.id)}>
                Revoke Key
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

const WEBHOOK_EVENTS = ['deployment_status_changed', 'payment_status_changed', 'order_paid', 'ticket_updated'];

function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<any[] | null>(null);
  const [url, setUrl] = useState('');
  const [event, setEvent] = useState(WEBHOOK_EVENTS[0]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  function load() {
    api.webhooks.list().then((d) => setWebhooks(d.webhooks)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { secret } = await api.webhooks.create(url, event);
      setNewSecret(secret);
      setUrl('');
      toast('Webhook registered successfully', 'success');
      load();
    } catch (err: any) {
      setError(err.message);
      toast('Failed to register webhook', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.webhooks.delete(id);
      toast('Webhook endpoint deleted', 'info');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-white/[0.06]">
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-1">Webhooks</h2>
        <p className="text-text-muted text-xs">
          Configure external targets to receive real-time payload pings. Signed using HMAC-SHA256 with header: <code className="bg-white/[0.04] px-1 rounded font-mono text-[10px]">X-Shanutechx-Signature</code>.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {newSecret && (
        <Card className="border border-yellow-500/30 bg-yellow-500/[0.02]">
          <p className="text-xs font-semibold text-yellow-300 mb-2">⚠️ Webhook Secret — copy this now, it won't be shown again.</p>
          <code className="text-xs bg-black/40 rounded-lg p-3 block break-all select-all font-mono text-accent-teal-bright border border-white/5">
            {newSecret}
          </code>
          <Button variant="ghost" className="mt-3" size="sm" onClick={() => setNewSecret(null)}>
            Done / Copied
          </Button>
        </Card>
      )}

      <Card className="border border-white/[0.06] bg-white/[0.01]">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            required
            type="url"
            label="Webhook Destination URL"
            placeholder="https://your-service.com/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Subscribed Event Type</label>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50 capitalize"
            >
              {WEBHOOK_EVENTS.map((ev) => (
                <option key={ev} value={ev} className="bg-[#0a0a14] capitalize">
                  {ev.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={busy} className="w-full justify-center">
              Register Webhook Endpoint
            </Button>
          </div>
        </form>
      </Card>

      {webhooks === null && <Spinner label="Loading webhook targets..." />}
      {webhooks?.length === 0 && <EmptyState message="No webhooks registered." />}

      <div className="space-y-3">
        {webhooks?.map((w) => (
          <Card key={w.id} className="border border-white/[0.06] flex items-center justify-between hover:border-white/10 transition-all">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center shrink-0">
                <WebhookIcon />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-text-primary text-sm truncate max-w-md">{w.url}</p>
                <p className="text-text-muted text-[10px] font-mono mt-0.5 capitalize">{w.event.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleDelete(w.id)}>
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
