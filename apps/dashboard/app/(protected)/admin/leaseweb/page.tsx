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
  PageHeader,
  Input,
  useToast,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function CloudIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  );
}

export default function AdminLeasewebPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Leaseweb Management"
        description="Assign VPS instances purchased manually at leaseweb.com to customer orders or register them as hosting nodes."
      />
      <HealthWidget />
      <ImportSection />
      <PricingReference />
      <LogViewer />
    </div>
  );
}

function HealthWidget() {
  const [health, setHealth] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const { toast } = useToast();

  function loadHealth() {
    api.leaseweb.health().then(setHealth).catch(() => {});
  }

  useEffect(() => {
    loadHealth();
  }, []);

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      await api.leaseweb.configureKey(apiKeyInput.trim());
      toast('Leaseweb API Key updated successfully', 'success');
      setShowConfig(false);
      setApiKeyInput('');
      loadHealth();
    } catch (err: any) {
      toast(err.message || 'Failed to update Leaseweb API Key', 'error');
    } finally {
      setSavingKey(false);
    }
  }

  if (!health) return null;

  return (
    <Card className="border border-white/[0.06] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${health.apiKeyConfigured ? 'bg-teal-500/10 text-teal-300' : 'bg-red-500/10 text-red-300'}`}>
            <CloudIcon />
          </div>
          <div>
            <p className="font-semibold text-sm text-text-primary">
              API Connection {health.apiKeyConfigured ? 'Connected' : 'Not Configured'}
            </p>
            <p className="text-text-muted text-xs">
              {health.lastCallAt ? `Last verified: ${new Date(health.lastCallAt).toLocaleString()}` : 'No connection calls logged.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {health.lastCallSucceeded !== null && (
            <Badge status={health.lastCallSucceeded ? 'running' : 'failed'} />
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? 'Cancel' : 'Configure API Key'}
          </Button>
        </div>
      </div>

      {showConfig && (
        <form onSubmit={handleSaveKey} className="pt-3 border-t border-white/[0.06] flex items-end gap-3">
          <div className="flex-1">
            <Input
              type="password"
              label="Leaseweb API Key"
              placeholder="Enter your Leaseweb API Key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              required
            />
          </div>
          <Button type="submit" loading={savingKey}>
            Save Key
          </Button>
        </form>
      )}
    </Card>
  );
}

function ImportSection() {
  const [vpss, setVpss] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  function load() {
    api.leaseweb.listVps().then((d) => setVpss(d.vpss)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  return (
    <div>
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Leaseweb VPS Instances</h2>
      <p className="text-text-muted text-xs mb-4">
        Buy a VPS at leaseweb.com first. Once purchased, assign it to a customer order or compute node here.
      </p>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {vpss === null && <Spinner label="Loading Leaseweb VPS list..." />}
      {vpss?.length === 0 && <EmptyState message="No VPS found on this Leaseweb account." />}

      <div className="space-y-3">
        {vpss?.map((vps) => (
          <div key={vps.id} className="space-y-2">
            <Card className="border border-white/[0.06] hover:border-white/10 transition-all flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary text-sm flex items-center gap-2">
                  <span className="font-mono text-xs">{vps.id}</span>
                </p>
                <p className="text-text-muted text-xs mt-1">
                  {vps.ips?.[0]?.ip ?? 'No IP assigned'} · {vps.reference ? `Ref: ${vps.reference}` : 'Unassigned'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={vps.state?.toLowerCase() ?? 'unknown'} />
                <Button variant="secondary" size="sm" onClick={() => setSelected(selected === vps.id ? null : vps.id)}>
                  {selected === vps.id ? 'Cancel' : 'Assign VPS'}
                </Button>
              </div>
            </Card>
            {selected === vps.id && (
              <div className="ml-4 pl-4 border-l border-white/10">
                <AssignForm leasewebVpsId={vps.id} onDone={() => { setSelected(null); load(); }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignForm({ leasewebVpsId, onDone }: { leasewebVpsId: string; onDone: () => void }) {
  const [assignTo, setAssignTo] = useState<'customer_order' | 'node'>('customer_order');
  const [userId, setUserId] = useState('');
  const [orderItemId, setOrderItemId] = useState('');
  const [label, setLabel] = useState('');
  const [roleTags, setRoleTags] = useState('node-hosting');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.leaseweb.import(
        leasewebVpsId,
        assignTo === 'customer_order'
          ? { assignTo, userId, orderItemId }
          : { assignTo, label, roleTags: roleTags.split(',').map((t) => t.trim()) }
      );
      if (result.warning) {
        setWarning(result.warning);
      } else {
        toast('VPS assigned successfully', 'success');
        onDone();
      }
    } catch (err: any) {
      setError(err.message);
      toast('Failed to assign VPS', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border border-white/[0.06] bg-white/[0.02]">
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
      {warning && <p className="text-xs text-orange-300 mb-3">{warning}</p>}

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setAssignTo('customer_order')}
          className={`text-xs rounded-full px-3 py-1.5 font-medium transition-all ${
            assignTo === 'customer_order'
              ? 'bg-accent-violet text-white shadow-glow-violet'
              : 'glass text-text-muted hover:text-text-primary'
          }`}
        >
          Assign to Customer
        </button>
        <button
          type="button"
          onClick={() => setAssignTo('node')}
          className={`text-xs rounded-full px-3 py-1.5 font-medium transition-all ${
            assignTo === 'node'
              ? 'bg-accent-violet text-white shadow-glow-violet'
              : 'glass text-text-muted hover:text-text-primary'
          }`}
        >
          Register as Hosting Node
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {assignTo === 'customer_order' ? (
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              required
              label="Customer User ID"
              placeholder="e.g. 123456"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <Input
              required
              label="Paid Order Item ID"
              placeholder="e.g. order-item-id"
              value={orderItemId}
              onChange={(e) => setOrderItemId(e.target.value)}
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              required
              label="Node Label"
              placeholder="e.g. sgp-1-leaseweb"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Input
              required
              label="Role Tags (comma-separated)"
              placeholder="node-hosting, web-hosting"
              value={roleTags}
              onChange={(e) => setRoleTags(e.target.value)}
            />
          </div>
        )}
        <div className="pt-2">
          <Button type="submit" loading={busy}>
            Confirm Assignment
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PricingReference() {
  const [products, setProducts] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.leaseweb.products().then((d) => setProducts(d.products)).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Pricing Reference</h2>
      <p className="text-text-muted text-xs mb-4">
        Reference pricing for suggestions (converted to LKR plus a flat 500 LKR margin).
      </p>

      {error && <ErrorBanner message={error} />}
      {products === null && <Spinner label="Loading pricing reference..." />}

      <div className="grid md:grid-cols-2 gap-4">
        {products?.map((p) => (
          <Card key={p.id} className="border border-white/[0.06] flex flex-col justify-between">
            <div>
              <p className="font-semibold text-text-primary text-sm mb-1">{p.name}</p>
              <p className="text-text-muted text-xs">
                {p.vCpu} vCPU · {p.vRam} RAM · {p.nvmeStorage}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs">
              <span className="text-text-muted">
                Cost: {p.price.currency} {p.price.total}
              </span>
              <span className="font-semibold text-accent-teal-bright">
                Suggested: LKR {p.suggestedCustomerPriceLkr}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LogViewer() {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.leaseweb.logs(50).then((d) => setLogs(d.logs)).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Raw API Log</h2>
      <p className="text-text-muted text-xs mb-4">
        Platform requests history. Secrets and credentials redacted automatically.
      </p>

      {error && <ErrorBanner message={error} />}
      {logs === null && <Spinner label="Loading log logs..." />}
      {logs?.length === 0 && <EmptyState message="No API calls logged yet." />}

      <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
        {logs?.map((log) => (
          <Card key={log.id} className="border border-white/[0.04] p-4 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <p className="text-xs font-mono text-text-primary">
                <span className="text-accent-teal-bright">{log.method}</span> {log.path}
              </p>
              <Badge status={log.statusCode && log.statusCode < 400 ? 'running' : 'failed'} />
            </div>
            <p className="text-text-faint text-[10px]">
              {new Date(log.createdAt).toLocaleString()}
              {log.errorMessage && <span className="text-red-300 ml-2">· {log.errorMessage}</span>}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
