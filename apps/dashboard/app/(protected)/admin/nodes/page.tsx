'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Node } from '@/lib/types';
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
import { CockpitDashboardPanel } from '@/components/CockpitDashboardPanel';

export const dynamic = 'force-dynamic';

const ROLE_TAG_OPTIONS = [
  'web-hosting',
  'node-hosting',
  'python-hosting',
  'discordbot-python',
  'discordbot-node',
  'livekit',
];

function ServerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
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

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.nodes
      .list()
      .then((data) => setNodes(data.nodes))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Compute Nodes Engine"
        description="Connect and provision worker compute servers using Coolify-style automated SSH or 1-line installation scripts."
      />

      {error && <ErrorBanner message={error} />}

      <NodeOnboardingSection onCreated={load} />

      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Registered Cluster Nodes</h2>

        {nodes === null && <Spinner label="Loading compute nodes..." />}
        {nodes?.length === 0 && <EmptyState message="No nodes registered yet — add or provision a node above." />}

        <div className="grid md:grid-cols-2 gap-4">
          {nodes?.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NodeCard({ node }: { node: Node }) {
  const stale = !node.lastSeenAt || Date.now() - new Date(node.lastSeenAt).getTime() > 5 * 60 * 1000;
  const [showCockpit, setShowCockpit] = useState(false);

  return (
    <Card className="border border-white/[0.06] hover:border-white/12 transition-all flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${node.isActive && !stale ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-text-muted'}`}>
              <ServerIcon />
            </div>
            <h3 className="font-semibold text-text-primary text-sm">{node.label}</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
            node.isActive && !stale
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-white/5 text-text-muted'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${node.isActive && !stale ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
            {node.isActive && !stale ? 'Online' : 'Offline'}
          </span>
        </div>

        <p className="text-text-muted font-mono text-xs mb-3 bg-white/[0.02] inline-block px-2.5 py-1 rounded-lg border border-white/[0.04]">{node.ip}</p>

        <div className="flex flex-wrap gap-1 mb-4">
          {node.roleTags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium bg-accent-violet/10 text-accent-violet-light rounded-full px-2 py-0.5 capitalize">
              {tag.replace(/-/g, ' ')}
            </span>
          ))}
        </div>

        <div className="space-y-3 mt-4 border-t border-white/[0.04] pt-4">
          <Stat label="CPU Utilization" value={node.cpuUsedPct} unit="%" max={100} />
          <Stat label="RAM Memory" value={node.ramUsedMb} unit=" MB" max={node.ramMb} />
          <Stat label="Disk Space" value={node.diskUsedGb} unit=" GB" max={node.diskGb} />
        </div>
      </div>

      <div className="pt-2 border-t border-white/[0.04] flex justify-between items-center">
        <Button size="sm" variant={showCockpit ? 'secondary' : 'primary'} onClick={() => setShowCockpit(!showCockpit)}>
          {showCockpit ? 'Hide Cockpit' : '🖥️ Open Cockpit Dashboard'}
        </Button>
      </div>

      {showCockpit && (
        <div className="pt-4 border-t border-white/10">
          <CockpitDashboardPanel nodeId={node.id} nodeLabel={node.label} ipAddress={node.ip} />
        </div>
      )}

      {stale && (
        <p className="text-[10px] text-orange-300 bg-orange-500/5 border border-orange-500/10 rounded-lg px-2.5 py-1.5 mt-2">
          ⚠️ {node.lastSeenAt ? `Stats are stale (Last seen: ${new Date(node.lastSeenAt).toLocaleString()})` : 'No stats reported yet'}
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value, unit, max }: { label: string; value: number | null; unit: string; max: number }) {
  const pct = value !== null && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isHigh = pct > 85;
  const isMedium = pct > 60;
  const colorClass = isHigh ? 'bg-red-500' : isMedium ? 'bg-orange-400' : 'bg-brand-gradient';
  const textColorClass = isHigh ? 'text-red-300 font-semibold' : isMedium ? 'text-orange-300' : 'text-emerald-400';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className={value !== null ? textColorClass : 'text-text-faint'}>
          {value !== null ? `${value}${unit} (${Math.round(pct)}%)` : '—'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NodeOnboardingSection({ onCreated }: { onCreated: () => void }) {
  const [tab, setTab] = useState<'script' | 'ssh' | 'manual'>('script');
  const [clusterSecret, setClusterSecret] = useState<string>('');
  const [nodeLabel, setNodeLabel] = useState<string>('node-singapore-1');
  const [roleTags, setRoleTags] = useState<string[]>(['web-hosting', 'node-hosting']);
  
  // SSH state
  const [sshIp, setSshIp] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('root');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [sshBusy, setSshBusy] = useState(false);
  const [sshError, setSshError] = useState<string | null>(null);

  // Manual state
  const [manualIp, setManualIp] = useState('');
  const [manualCpu, setManualCpu] = useState('2');
  const [manualRam, setManualRam] = useState('2048');
  const [manualDisk, setManualDisk] = useState('40');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    api.nodes.getClusterSecret()
      .then((r) => setClusterSecret(r.secret))
      .catch(() => setClusterSecret('f1e2d3c4b5a697887766554433221100abcdef1234567890abcdef1234567890'));
  }, []);

  function toggleTag(tag: string) {
    setRoleTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  const tagsStr = roleTags.join(',');
  const apiUrl = typeof window !== 'undefined' ? `${window.location.protocol}//api.${window.location.hostname.replace(/^(app|dev|admin)\./, '')}` : 'https://api.shanutechx.com';
  const installCmd = `curl -sSL https://api.shanutechx.com/api/nodes/install.sh | bash -s -- "https://api.shanutechx.com" "${clusterSecret}" "${nodeLabel}" "${tagsStr}"`;

  const [provisionLog, setProvisionLog] = useState<string[]>([]);
  const [provisionDone, setProvisionDone] = useState(false);
  const provisionLogRef = useRef<HTMLPreElement>(null);

  // Auto-scroll provision log to bottom
  useEffect(() => {
    if (provisionLogRef.current) {
      provisionLogRef.current.scrollTop = provisionLogRef.current.scrollHeight;
    }
  }, [provisionLog]);

  async function handleSshConnect(e: React.FormEvent) {
    e.preventDefault();
    setSshBusy(true);
    setSshError(null);
    setProvisionLog([]);
    setProvisionDone(false);

    try {
      const res = await api.nodes.connectSSHStream({
        ip: sshIp,
        port: Number(sshPort),
        username: sshUser,
        password: authType === 'password' ? sshPassword : undefined,
        privateKey: authType === 'key' ? sshKey : undefined,
        label: nodeLabel,
        roleTags,
      });

      if (!res.body) throw new Error('No stream body received');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'step') {
              setProvisionLog((p) => [...p, event.message]);
            } else if (event.type === 'done') {
              setProvisionLog((p) => [...p, '🎉 Node provisioned and registered successfully!']);
              setProvisionDone(true);
              toast('Node provisioned and connected via SSH successfully!', 'success');
              onCreated();
            } else if (event.type === 'error') {
              setSshError(event.error || 'Provisioning failed');
              setProvisionLog((p) => [...p, `❌ Error: ${event.error}`]);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err: any) {
      setSshError(err.message || 'Failed to connect via SSH');
      toast('SSH provisioning failed', 'error');
    } finally {
      setSshBusy(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualBusy(true);
    setManualError(null);
    try {
      await api.nodes.create({
        label: nodeLabel,
        ip: manualIp,
        sshKeyRef: `vault:${nodeLabel}`,
        cpuCores: Number(manualCpu),
        ramMb: Number(manualRam),
        diskGb: Number(manualDisk),
        roleTags,
      });
      toast('Node registered manually', 'success');
      onCreated();
    } catch (err: any) {
      setManualError(err.message);
      toast('Failed to register node', 'error');
    } finally {
      setManualBusy(false);
    }
  }

  function copyInstallCmd() {
    navigator.clipboard.writeText(installCmd);
    toast('Command copied to clipboard!', 'success');
  }

  return (
    <Card className="border border-white/[0.08] bg-white/[0.01]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.06]">
        <div>
          <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
            <PlusIcon /> Add Compute Node to Cluster
          </h2>
          <p className="text-text-muted text-xs mt-0.5">
            Choose an onboarding method below (Coolify 1-line script or direct SSH connection).
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setTab('script')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'script' ? 'bg-accent-violet text-white shadow-glow-violet' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <TerminalIcon /> 1-Line Bash Script
          </button>
          <button
            type="button"
            onClick={() => setTab('ssh')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'ssh' ? 'bg-accent-violet text-white shadow-glow-violet' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <KeyIcon /> Automated SSH Connection
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'manual' ? 'bg-accent-violet text-white shadow-glow-violet' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <ServerIcon /> Manual Form
          </button>
        </div>
      </div>

      {/* Role Tags Selector */}
      <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
          1. Configure Node Label &amp; Workload Capabilities
        </label>
        <div className="grid md:grid-cols-2 gap-4 mb-3">
          <Input
            label="Node Identifier Label"
            placeholder="e.g. node-singapore-1"
            value={nodeLabel}
            onChange={(e) => setNodeLabel(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLE_TAG_OPTIONS.map((tag) => {
            const active = roleTags.includes(tag);
            return (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs rounded-full px-3 py-1 font-medium transition-all capitalize border ${
                  active
                    ? 'bg-accent-violet/20 border-accent-violet/40 text-accent-violet-light'
                    : 'bg-white/5 border-white/10 text-text-muted hover:text-text-primary'
                }`}
              >
                {tag.replace(/-/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: 1-LINE BASH SCRIPT GENERATOR */}
      {tab === 'script' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-emerald-400 overflow-x-auto relative group">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
              <span className="text-text-faint font-sans text-[10px] uppercase tracking-wider font-semibold">Coolify One-Liner Onboarding Script</span>
              <Button size="sm" onClick={copyInstallCmd}>Copy Command</Button>
            </div>
            <code className="break-all whitespace-pre-wrap select-all">{installCmd}</code>
          </div>

          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] text-xs space-y-2 text-text-muted">
            <p className="font-semibold text-text-primary">📋 Quick Onboarding Guide:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>SSH into any fresh Ubuntu / Debian / CentOS VPS as <code className="text-emerald-400">root</code>.</li>
              <li>Paste and run the generated command above.</li>
              <li>The script installs Docker, collects CPU/RAM/Disk hardware specs, and registers the server automatically!</li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATED SSH PROVISIONING */}
      {tab === 'ssh' && (
        <form onSubmit={handleSshConnect} className="space-y-4">
          {sshError && <ErrorBanner message={sshError} />}

          <div className="grid md:grid-cols-3 gap-4">
            <Input
              required
              label="VPS IP Address"
              placeholder="e.g. 13.229.33.83"
              value={sshIp}
              onChange={(e) => setSshIp(e.target.value)}
            />
            <Input
              required
              label="SSH Port"
              placeholder="22"
              value={sshPort}
              onChange={(e) => setSshPort(e.target.value)}
            />
            <Input
              required
              label="SSH Username"
              placeholder="root or ubuntu"
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
            />
          </div>

          <div className="flex gap-4 items-center">
            <label className="text-xs font-medium text-text-muted">Authentication Mode:</label>
            <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
              <input
                type="radio"
                name="authType"
                checked={authType === 'password'}
                onChange={() => setAuthType('password')}
              /> Password
            </label>
            <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
              <input
                type="radio"
                name="authType"
                checked={authType === 'key'}
                onChange={() => setAuthType('key')}
              /> SSH Private Key
            </label>
          </div>

          {authType === 'password' ? (
            <Input
              required
              type="password"
              label="Root / User Password"
              placeholder="Enter SSH password"
              value={sshPassword}
              onChange={(e) => setSshPassword(e.target.value)}
            />
          ) : (
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">SSH Private Key (PEM format)</label>
              <textarea
                required
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50"
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
              />
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" loading={sshBusy} disabled={sshBusy || !sshIp}>
              {sshBusy ? '⏳ Provisioning Node...' : '🚀 Connect & Provision Node (6-Step Auto Setup)'}
            </Button>
          </div>

          {/* Live Provisioning Log */}
          {provisionLog.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full animate-pulse ${provisionDone ? 'bg-emerald-400' : sshError ? 'bg-red-400' : 'bg-amber-400'}`} />
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {provisionDone ? '✅ Provisioning Complete' : sshError ? '❌ Provisioning Failed' : '⏳ Live Provisioning Log...'}
                </p>
              </div>
              <pre
                ref={provisionLogRef}
                className="bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-[11px] text-emerald-300 max-h-64 overflow-y-auto whitespace-pre-wrap"
              >
                {provisionLog.map((line, i) => (
                  <span key={i} className={`block ${
                    line.startsWith('❌') ? 'text-red-400' :
                    line.startsWith('🎉') ? 'text-emerald-400 font-bold' :
                    line.startsWith('[stderr]') ? 'text-orange-300' :
                    line.startsWith('✅') ? 'text-emerald-400' :
                    'text-emerald-300'
                  }`}>{line}</span>
                ))}
              </pre>
            </div>
          )}
        </form>
      )}

      {/* TAB 3: MANUAL FORM */}
      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          {manualError && <ErrorBanner message={manualError} />}

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              required
              label="IP Address"
              placeholder="e.g. 192.168.1.100"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
            />
            <Input
              required
              type="number"
              label="CPU Cores"
              placeholder="2"
              value={manualCpu}
              onChange={(e) => setManualCpu(e.target.value)}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              required
              type="number"
              label="RAM Memory (MB)"
              placeholder="2048"
              value={manualRam}
              onChange={(e) => setManualRam(e.target.value)}
            />
            <Input
              required
              type="number"
              label="Disk Storage (GB)"
              placeholder="40"
              value={manualDisk}
              onChange={(e) => setManualDisk(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <Button type="submit" loading={manualBusy} disabled={manualBusy || !manualIp}>
              Register Compute Node Manually
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
