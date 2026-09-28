'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { streamAuthedEvents, logLineFromEvent, StreamHandle } from '@/lib/sse';
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
  EmptyState,
} from '@/components/ui';
import { DomainManagement } from '@/components/DomainManagement';
import { EnvVarsPanel } from '@/components/EnvVarsPanel';
import { CodeDeploymentPanel } from '@/components/CodeDeploymentPanel';
import { FileManagerPanel } from '@/components/FileManagerPanel';
import { DeployWebhookPanel } from '@/components/DeployWebhookPanel';
import { RoutingFirewallPanel } from '@/components/RoutingFirewallPanel';
import { DeploymentBackupsPanel } from '@/components/DeploymentBackupsPanel';
import { DeploymentSetupWizard } from '@/components/DeploymentSetupWizard';
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

type TabType = 'console' | 'files' | 'databases' | 'network' | 'startup' | 'backups' | 'activity';

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
  const [eventSource, setEventSource] = useState<StreamHandle | null>(null);
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
  const [downloadingZip, setDownloadingZip] = useState(false);
  const { toast } = useToast();

  async function handleDownloadZip() {
    setDownloadingZip(true);
    try {
      await api.deployments.downloadZip(deploymentId, `${deployment?.subdomain || `deployment-${deploymentId.slice(0, 8)}`}-backup.zip`);
      toast('Workspace ZIP backup download initiated!', 'success');
    } catch (err: any) {
      toast(err.message || 'ZIP download failed', 'error');
    } finally {
      setDownloadingZip(false);
    }
  }

  async function loadDeployment() {
    try {
      const data = await api.deployments.get(deploymentId);
      setDeployment(data.deployment);
      setResourceUsage(data.resourceUsage || null);
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
    // Native EventSource cannot send this app's Authorization header, so it never actually connected here (every
    // request 401'd instantly and looked like "Log stream disconnected."). streamAuthedEvents reads the same
    // endpoint with fetch instead, which can carry the token.
    let handle: StreamHandle | null = null;

    if (isStreamingLogs) {
      handle = streamAuthedEvents(
        `/api/deployments/${deploymentId}/logs/stream`,
        (raw) => {
          const { line, error } = logLineFromEvent(raw);
          if (error) {
            toast(error, 'error');
            return;
          }
          if (line !== null) setLogs((prevLogs) => (prevLogs ? `${prevLogs}\n${line}` : line));
        },
        () => {
          toast('Log stream disconnected.', 'error');
          setIsStreamingLogs(false);
        },
        { baseUrl: api.baseURL }
      );
      setEventSource(handle);
    } else if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }

    return () => {
      if (handle) handle.close();
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

  if (deployment.status === 'pending' || (!deployment.containerId && (!deployment.repoUrl || deployment.repoUrl.startsWith('pending://')))) {
    return (
      <DeploymentSetupWizard
        deploymentId={deploymentId}
        initialDeployment={deployment}
        connectedAccounts={connectedAccounts}
        onComplete={() => {
          loadDeployment();
          loadLogs();
        }}
      />
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

        {/* Tech Integration Quick Hub Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => router.push(`/deployments/${deploymentId}/waf`)} className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Firewall & Security</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => router.push(`/deployments/${deploymentId}/edge-rules`)} className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Edge Rules</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => router.push(`/deployments/${deploymentId}/nixpacks`)} className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-accent-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Build & Workspace</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => router.push(`/deployments/${deploymentId}/volumes`)} className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <span>Persistent Disks</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDownloadZip} loading={downloadingZip} className="flex items-center gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>ZIP Backup</span>
          </Button>
          {deployment.status === 'stopped' || deployment.status === 'failed' ? (
            <Button size="sm" onClick={handleStart} loading={starting} className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start Server</span>
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setShowRestartConfirm(true)} loading={restarting}>
                <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowStopConfirm(true)} loading={stopping}>
                <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
                </svg>
                Stop
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowKillConfirm(true)} loading={killing} className="text-red-400 hover:bg-red-500/10">
                <svg className="w-3.5 h-3.5 inline mr-1 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Kill
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-2">
        <TabButton
          id="console"
          active={activeTab}
          onClick={setActiveTab}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          label="Console"
        />
        <TabButton
          id="files"
          active={activeTab}
          onClick={setActiveTab}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
          label="Files & IDE"
        />
        <TabButton
          id="databases"
          active={activeTab}
          onClick={setActiveTab}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
          label="Databases"
        />
        <TabButton
          id="network"
          active={activeTab}
          onClick={setActiveTab}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
          label="Network & Subdomains"
        />
        <TabButton
          id="startup"
          active={activeTab}
          onClick={setActiveTab}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          label="Startup & Env"
        />
        <TabButton
          id="backups"
          active={activeTab}
          onClick={setActiveTab}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          }
          label="Backups"
        />
        <TabButton
          id="activity"
          active={activeTab}
          onClick={setActiveTab}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          label="Activity & Webhooks"
        />
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
              <Button size="sm" variant={isStreamingLogs ? 'secondary' : 'primary'} onClick={() => setIsStreamingLogs(!isStreamingLogs)} className="flex items-center gap-1.5">
                {isStreamingLogs ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Pause Stream</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Stream Live</span>
                  </>
                )}
              </Button>
              <Button size="sm" variant="secondary" onClick={loadLogs} loading={loadingLogs} className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
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
              <EmptyState
                message="No databases attached yet. Provision a PostgreSQL, Redis, or MongoDB instance from the App Catalog."
                action={{ label: 'Browse Catalog', onClick: () => router.push('/catalog') }}
              />
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
          <CodeDeploymentPanel deployment={deployment} onChanged={loadDeployment} />
          <EnvVarsPanel deploymentId={deploymentId} isRunning={deployment?.status === 'running'} />
        </div>
      )}

      {/* TAB: BACKUPS (GitHub) */}
      {activeTab === 'backups' && (
        // The API requires the deployment's subdomain (or its id when it has none) to confirm a restore.
        <DeploymentBackupsPanel deploymentId={deploymentId} confirmName={deployment.subdomain || deploymentId} />
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

function TabButton({ id, active, onClick, icon, label }: { id: TabType; active: TabType; onClick: (t: TabType) => void; icon: React.ReactNode; label: string }) {
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
