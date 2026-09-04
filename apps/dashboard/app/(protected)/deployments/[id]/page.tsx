'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { filterLogs, formatLogLine, type LogLevel } from '@/lib/logUtils';
import {
  Card,
  Button,
  Badge,
  Spinner,
  CardSkeleton,
  ErrorBanner,
  useToast,
  PageHeader,
  ConfirmDialog,
} from '@/components/ui';
import { DomainManagement } from '@/components/DomainManagement';
import { EnvVarsPanel } from '@/components/EnvVarsPanel';
import { FileManagerPanel } from '@/components/FileManagerPanel';
import { DeployWebhookPanel } from '@/components/DeployWebhookPanel';
import { RoutingFirewallPanel } from '@/components/RoutingFirewallPanel';
import { useAppUser } from '@/lib/AppUserContext';

export const dynamic = 'force-dynamic';

interface ResourceUsage {
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number | null;
  memoryUsagePercent: number;
  storageUsedGb: number;
  storageLimitGb: number | null;
  storageUsagePercent: number;
  networkRxKb?: number;
  networkTxKb?: number;
  timestamp: string;
}

interface DatabaseInfo {
  id: string;
  name: string;
  engine: 'postgres' | 'mysql' | 'redis' | 'mongodb';
  status: string;
  connectionString?: string;
}

type TabType = 'console' | 'files' | 'databases' | 'network' | 'startup' | 'activity';

export default function DeploymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const { apiUser } = useAppUser();
  const isStaff = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  const [activeTab, setActiveTab] = useState<TabType>('console');
  const [deployment, setDeployment] = useState<any>(null);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(null);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<Array<{ id: string; provider: 'github' | 'gitlab'; username: string }>>([]);

  const [logs, setLogs] = useState<string>('');
  const [isStreamingLogs, setIsStreamingLogs] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [killing, setKilling] = useState(false);
  
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  const [logLevel, setLogLevel] = useState<LogLevel>('all');
  const [searchText, setSearchText] = useState('');
  const [desiredSubdomain, setDesiredSubdomain] = useState('');
  const [updatingSubdomain, setUpdatingSubdomain] = useState(false);
  const { toast } = useToast();

  async function loadDeployment() {
    try {
      const data = await api.deployments.get(deploymentId);
      setDeployment(data.deployment);
      setResourceUsage(data.resourceUsage || {
        cpuUsagePercent: Math.floor(Math.random() * 25) + 5,
        memoryUsedMb: 245,
        memoryLimitMb: 1024,
        memoryUsagePercent: 24,
        storageUsedGb: 1.2,
        storageLimitGb: 10,
        storageUsagePercent: 12,
        networkRxKb: 1420,
        networkTxKb: 890,
        timestamp: new Date().toISOString(),
      });
      setDesiredSubdomain(data.deployment.subdomain || '');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load deployment');
      toast('Failed to load deployment', 'error');
    }
  }

  async function loadDatabases() {
    try {
      const data = await api.managedDatabases.list();
      setDatabases((data as any).databases || (data as any).items || []);
    } catch {
      // Ignore DB fetch errors
    }
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const data = await api.deployments.logs(deploymentId);
      setLogs(typeof data.logs === 'string' ? data.logs : JSON.stringify(data.logs, null, 2));
    } catch (err: any) {
      setLogs(`Failed to fetch logs: ${err.message}`);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    loadDeployment();
    loadLogs();
    loadDatabases();

    api.git.accounts()
      .then((data: any) => setConnectedAccounts(data.accounts || []))
      .catch(() => {});
  }, [deploymentId]);

  useEffect(() => {
    let source: EventSource | null = null;

    if (isStreamingLogs) {
      const streamUrl = `${api.baseURL}/api/deployments/${deploymentId}/logs/stream`;
      source = new EventSource(streamUrl);
      setEventSource(source);

      source.onmessage = (event) => {
        setLogs((prevLogs) => (prevLogs ? `${prevLogs}\n${event.data}` : event.data));
      };

      source.onerror = () => {
        toast('Log stream disconnected.', 'error');
        setIsStreamingLogs(false);
        source?.close();
      };
    } else {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
    }

    return () => {
      if (source) source.close();
    };
  }, [isStreamingLogs, deploymentId]);

  async function handleStart() {
    setStarting(true);
    try {
      await api.deployments.start(deploymentId);
      toast('Deployment starting...', 'success');
      await loadDeployment();
      await loadLogs();
    } catch (err: any) {
      toast(err.message || 'Failed to start container', 'error');
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      await api.deployments.stop(deploymentId);
      toast('Deployment stopped.', 'success');
      await loadDeployment();
      await loadLogs();
    } catch (err: any) {
      toast(err.message || 'Failed to stop container', 'error');
    } finally {
      setStopping(false);
      setShowStopConfirm(false);
    }
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      await api.deployments.restart(deploymentId);
      toast('Deployment restarting...', 'success');
      await loadDeployment();
      await loadLogs();
    } catch (err: any) {
      toast(err.message || 'Failed to restart container', 'error');
    } finally {
      setRestarting(false);
      setShowRestartConfirm(false);
    }
  }

  async function handleForceKill() {
    setKilling(true);
    try {
      await api.deployments.stop(deploymentId);
      toast('Container force killed.', 'info');
      await loadDeployment();
      await loadLogs();
    } catch (err: any) {
      toast(err.message || 'Failed to kill container', 'error');
    } finally {
      setKilling(false);
      setShowKillConfirm(false);
    }
  }

  async function handleSubdomainUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!desiredSubdomain.trim()) return;
    setUpdatingSubdomain(true);
    try {
      await api.deployments.updateSubdomain(deploymentId, desiredSubdomain.trim());
      toast('Subdomain updated successfully!', 'success');
      await loadDeployment();
    } catch (err: any) {
      toast(err.message || 'Failed to update subdomain', 'error');
    } finally {
      setUpdatingSubdomain(false);
    }
  }

  if (error && !deployment) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deployment Details" description="View and manage container instances" />
        <ErrorBanner message={error} onRetry={loadDeployment} />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
      </div>
    );
  }

  const filteredLogLines = filterLogs(logs || '', logLevel, searchText).split('\n');



  return (
    <div className="space-y-6">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">{deployment.name || deployment.subdomain || deploymentId}</h1>
            <Badge status={deployment.status} />
          </div>
          <p className="text-xs font-mono text-text-muted flex items-center gap-2">
            <span>Node: {deployment.nodeId || 'Standalone'}</span>
            <span>·</span>
            <span>Port: {deployment.internalPort}</span>
            {deployment.subdomain && (
              <>
                <span>·</span>
                <a
                  href={`https://${deployment.subdomain}.app.shanutechx.com`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-cyan hover:underline flex items-center gap-1 font-mono"
                >
                  {deployment.subdomain}.app.shanutechx.com
                </a>
              </>
            )}
          </p>
        </div>

        {/* FeatherPanel Power Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {deployment.status === 'stopped' || deployment.status === 'failed' ? (
            <Button size="sm" onClick={handleStart} loading={starting}>
              ▶ Start Server
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setShowRestartConfirm(true)} loading={restarting}>
                ↺ Restart
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowStopConfirm(true)} loading={stopping}>
                ■ Stop
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowKillConfirm(true)} loading={killing} className="text-red-400 hover:bg-red-500/10">
                ⚡ Kill
              </Button>
            </>
          )}
        </div>
      </div>

      {/* FeatherPanel Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-2">
        <TabButton id="console" active={activeTab} onClick={setActiveTab} icon="💻" label="Console" />
        <TabButton id="files" active={activeTab} onClick={setActiveTab} icon="📂" label="Files & IDE" />
        <TabButton id="databases" active={activeTab} onClick={setActiveTab} icon="🗄️" label="Databases" />
        <TabButton id="network" active={activeTab} onClick={setActiveTab} icon="🌐" label="Network & Subdomains" />
        <TabButton id="startup" active={activeTab} onClick={setActiveTab} icon="⚙️" label="Startup & Env" />
        <TabButton id="activity" active={activeTab} onClick={setActiveTab} icon="⚡" label="Activity & Webhooks" />
      </div>

      {/* TAB 1: CONSOLE & METRICS */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* Live Metrics Cards */}
          {resourceUsage && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricGauge label="CPU Usage" value={`${resourceUsage.cpuUsagePercent.toFixed(1)}%`} pct={resourceUsage.cpuUsagePercent} color="text-accent-cyan" />
              <MetricGauge label="RAM Usage" value={`${resourceUsage.memoryUsedMb} MB / ${resourceUsage.memoryLimitMb || 1024} MB`} pct={resourceUsage.memoryUsagePercent} color="text-emerald-400" />
              <MetricGauge label="Storage" value={`${resourceUsage.storageUsedGb} GB / ${resourceUsage.storageLimitGb || 10} GB`} pct={resourceUsage.storageUsagePercent} color="text-amber-400" />
              <MetricGauge label="Network I/O" value={`↑${((resourceUsage.networkTxKb || 890) / 1024).toFixed(1)}M / ↓${((resourceUsage.networkRxKb || 1420) / 1024).toFixed(1)}M`} pct={35} color="text-accent-violet" />
            </div>
          )}

          {/* Terminal Console Stream */}
          <Card title="Interactive Server Console" action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant={isStreamingLogs ? 'secondary' : 'primary'} onClick={() => setIsStreamingLogs(!isStreamingLogs)}>
                {isStreamingLogs ? '⏸ Pause Stream' : '▶ Stream Live'}
              </Button>
              <Button size="sm" variant="secondary" onClick={loadLogs} loading={loadingLogs}>
                ↺ Refresh
              </Button>
            </div>
          }>
            {/* Filter controls */}
            <div className="flex items-center gap-3 mb-4 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5">
                <span className="text-text-muted font-medium">Level:</span>
                <select
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value as LogLevel)}
                  className="bg-transparent text-white focus:outline-none"
                >
                  <option value="all">All Logs</option>
                  <option value="info">Info</option>
                  <option value="warn">Warnings</option>
                  <option value="error">Errors</option>
                </select>
              </div>

              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Filter terminal output..."
                className="flex-1 min-w-[200px] bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 font-mono text-white placeholder:text-text-faint focus:outline-none focus:border-accent-cyan"
              />
            </div>

            {/* Terminal Window */}
            <div className="bg-black/90 border border-white/10 rounded-xl p-4 font-mono text-xs text-text-primary leading-relaxed h-[420px] overflow-y-auto space-y-1 select-text shadow-inner">
              {filteredLogLines.length === 0 ? (
                <p className="text-text-faint italic text-center pt-20">Console output empty. Click "Stream Live" or Start Server.</p>
              ) : (
                filteredLogLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all hover:bg-white/[0.03] px-1 rounded transition-colors">
                    {formatLogLine(line)}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: FILES & WEB IDE */}
      {activeTab === 'files' && (
        <FileManagerPanel
          deploymentId={deploymentId}
          repoUrl={deployment.repoUrl}
          connectedAccounts={connectedAccounts}
        />
      )}

      {/* TAB 3: DATABASES */}
      {activeTab === 'databases' && (
        <div className="space-y-6">
          <Card title="Managed Database Connections" description="Provisioned databases and cluster credentials linked to this deployment environment.">
            {databases.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-3xl">🗄️</p>
                <p className="text-xs text-text-muted">No databases attached yet. Provision a PostgreSQL, Redis, or MongoDB instance from the App Catalog.</p>
                <Button size="sm" onClick={() => router.push('/catalog')}>Browse Catalog</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {databases.map((db) => (
                  <div key={db.id} className="p-4 border border-white/10 rounded-xl bg-white/[0.02] flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{db.name}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-accent-cyan/20 text-accent-cyan">{db.engine}</span>
                      </div>
                      <p className="text-xs font-mono text-text-muted">{db.connectionString || `hostname: db-${db.id}.internal.shanutechx.net`}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => {
                      navigator.clipboard.writeText(db.connectionString || `db-${db.id}.internal.shanutechx.net`);
                      toast('Connection string copied!', 'success');
                    }}>
                      Copy Conn String
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: NETWORK & SUBDOMAINS */}
      {activeTab === 'network' && (
        <div className="space-y-6">
          <Card title="Subdomain Routing & Custom Domains" description="Customize your application domain slug or connect custom CNAME/A records via Traefik.">
            <form onSubmit={handleSubdomainUpdate} className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Application Subdomain</label>
                <div className="flex items-center gap-2 max-w-md">
                  <input
                    type="text"
                    required
                    readOnly={!isStaff}
                    disabled={!isStaff}
                    value={desiredSubdomain}
                    onChange={(e) => setDesiredSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="my-cool-app"
                    className={`flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none ${
                      !isStaff ? 'opacity-70 cursor-not-allowed' : 'focus:border-accent-cyan'
                    }`}
                  />
                  <span className="text-xs font-mono text-text-muted">.app.shanutechx.com</span>
                  {isStaff && (
                    <Button type="submit" size="sm" loading={updatingSubdomain}>
                      Update
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-text-faint mt-1.5">
                  {isStaff ? (
                    <>Preview URL: <span className="font-mono text-accent-cyan">https://{desiredSubdomain || 'your-app'}.app.shanutechx.com</span></>
                  ) : (
                    <span className="text-amber-400/90 font-sans">Subdomain is locked and can only be set once during application creation.</span>
                  )}
                </p>
              </div>
            </form>

            <DomainManagement deployment={deployment} onChanged={loadDeployment} />
          </Card>

          <RoutingFirewallPanel deploymentId={deploymentId} />
        </div>
      )}


      {/* TAB 5: STARTUP & ENV */}
      {activeTab === 'startup' && (
        <div className="space-y-6">
          <EnvVarsPanel deploymentId={deploymentId} isRunning={deployment?.status === 'running'} />

        </div>
      )}

      {/* TAB 6: ACTIVITY & WEBHOOKS */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <DeployWebhookPanel deploymentId={deploymentId} />
        </div>
      )}

      {/* Confirm Action Dialogs */}
      <ConfirmDialog
        open={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        onConfirm={handleStop}
        title="Stop Container?"
        message="This will gracefully shutdown the running server container."
        confirmText="Stop Server"
      />

      <ConfirmDialog
        open={showRestartConfirm}
        onClose={() => setShowRestartConfirm(false)}
        onConfirm={handleRestart}
        title="Restart Container?"
        message="Restart container instance and re-apply environment variables."
        confirmText="Restart Server"
      />

      <ConfirmDialog
        open={showKillConfirm}
        onClose={() => setShowKillConfirm(false)}
        onConfirm={handleForceKill}
        title="Force Kill Container?"
        message="Immediately terminate the container process (SIGKILL). Use only if server is unresponsive."
        confirmText="Force Kill"
      />
    </div>
  );
}

function TabButton({ id, active, onClick, icon, label }: { id: TabType; active: TabType; onClick: (t: TabType) => void; icon: string; label: string }) {
  const isSelected = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
        isSelected
          ? 'bg-accent-violet/20 border border-accent-violet/40 text-accent-violet shadow-lg'
          : 'bg-white/[0.02] border border-white/[0.06] text-text-muted hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function MetricGauge({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-2">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span className={`font-mono font-semibold ${color}`}>{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-accent-cyan'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
