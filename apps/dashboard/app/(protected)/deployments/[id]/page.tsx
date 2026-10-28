'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Card,
  Button,
  Badge,
  Spinner,
  ErrorBanner,
  PageHeader,
  ProgressBar,
  Table,
  Tr,
  Td,
  useToast,
  Input,
} from '@/components/ui';
import { JobProgressBar } from '@/components/jobs/JobProgressBar';
import {
  Globe,
  ExternalLink,
  Play,
  Square,
  RotateCcw,
  Terminal,
  Cpu,
  Layers,
  Settings,
  History,
  Key,
  Download,
  Check,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const unwrappedParams = typeof (params as any).then === 'function' ? use(params as Promise<{ id: string }>) : (params as { id: string });
  const id = unwrappedParams.id;

  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'env' | 'releases' | 'logs'>('overview');

  // Logs state
  const [logs, setLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Rollback state
  const [allDeployments, setAllDeployments] = useState<any[]>([]);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  // Background job state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Env vars editor state
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [savingEnv, setSavingEnv] = useState(false);

  function loadDetails() {
    setLoading(true);
    Promise.allSettled([
      api.deployments.get(id),
      api.deployments.list(),
    ])
      .then(([detRes, listRes]) => {
        if (detRes.status === 'fulfilled') {
          setData(detRes.value);
          setEnvVars(detRes.value.envVars || {});
        } else {
          setError(detRes.reason?.message || 'Failed to load deployment');
        }

        if (listRes.status === 'fulfilled') {
          setAllDeployments(listRes.value.deployments || []);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetails();
  }, [id]);

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const res = await api.deployments.logs(id);
      setLogs(res.logs || 'No output logs yet.');
    } catch (err: any) {
      setLogs(`Error loading logs: ${err.message}`);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  async function handleStart() {
    setActionBusy(true);
    try {
      await api.deployments.start(id);
      toast('Application started', 'success');
      loadDetails();
    } catch (err: any) {
      toast(err.message || 'Failed to start', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleStop() {
    setActionBusy(true);
    try {
      await api.deployments.stop(id);
      toast('Application stopped', 'success');
      loadDetails();
    } catch (err: any) {
      toast(err.message || 'Failed to stop', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRestart() {
    setActionBusy(true);
    try {
      await api.deployments.restart(id);
      toast('Application restarted', 'success');
      loadDetails();
    } catch (err: any) {
      toast(err.message || 'Failed to restart', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleLaunchBackgroundBuild() {
    setActionBusy(true);
    try {
      const res = await api.deployments.launchJob(id);
      setActiveJobId(res.jobId);
      toast('Asynchronous build enqueued to worker queue!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch build job', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRollback(targetId: string) {
    if (!confirm('Rollback immediately to this release? Zero downtime traffic routing swap will execute.')) {
      return;
    }
    setRollingBackId(targetId);
    try {
      const res = await api.deployments.rollback(id, targetId);
      toast(`Rolled back successfully in ${res.rollbackDurationMs}ms!`, 'success');
      loadDetails();
    } catch (err: any) {
      toast(err.message || 'Rollback failed', 'error');
    } finally {
      setRollingBackId(null);
    }
  }

  async function handleSaveEnv() {
    setSavingEnv(true);
    try {
      await api.deployments.updateEnv(id, envVars);
      toast('Environment variables updated', 'success');
      loadDetails();
    } catch (err: any) {
      toast(err.message || 'Failed to update environment variables', 'error');
    } finally {
      setSavingEnv(false);
    }
  }

  function handleAddEnv() {
    if (!envKey.trim()) return;
    setEnvVars((prev) => ({ ...prev, [envKey.trim()]: envVal }));
    setEnvKey('');
    setEnvVal('');
  }

  function handleRemoveEnv(keyToRemove: string) {
    setEnvVars((prev) => {
      const copy = { ...prev };
      delete copy[keyToRemove];
      return copy;
    });
  }

  if (loading) return <Spinner label="Loading application deployment details..." />;
  if (error || !data) return <ErrorBanner message={error || 'Deployment not found'} />;

  const dep = data.deployment;
  const usage = data.resourceUsage;
  const liveUrl = dep.subdomain ? `https://${dep.subdomain}.app.shanutechx.com` : null;

  // Potential rollback targets: running instances sharing same subdomain or repo
  const rollbackCandidates = allDeployments.filter(
    (d) => d.id !== dep.id && (d.subdomain === dep.subdomain || d.repoUrl === dep.repoUrl)
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/deployments"
            className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Deployments
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-text-primary font-mono">
              {dep.subdomain || dep.preferredName || dep.id.slice(0, 8)}
            </h1>
            <Badge status={dep.status} dot />
            {dep.builder && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                {dep.builder}
              </span>
            )}
          </div>
          <p className="text-text-muted text-xs mt-1 font-mono">
            {dep.repoUrl || 'Container Instance'} {dep.branch ? `(${dep.branch})` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-neutral-200 transition-all shadow-sm"
            >
              <span>Visit Live App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {dep.status === 'running' ? (
            <Button size="sm" variant="danger" loading={actionBusy} onClick={handleStop}>
              <Square className="w-3.5 h-3.5 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" variant="success" loading={actionBusy} onClick={handleStart}>
              <Play className="w-3.5 h-3.5 mr-1" /> Start
            </Button>
          )}
          <Button size="sm" variant="secondary" loading={actionBusy} onClick={handleRestart}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restart
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={actionBusy}
            onClick={handleLaunchBackgroundBuild}
            className="border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10"
          >
            <Layers className="w-3.5 h-3.5 mr-1" /> Rebuild Job
          </Button>
        </div>
      </div>

      {/* Real-time Background Job Tracking Bar */}
      {activeJobId && (
        <JobProgressBar
          jobId={activeJobId}
          title={`Building & Deploying: ${dep.subdomain || dep.id}`}
          onComplete={() => {
            toast('Deployment succeeded and live!', 'success');
            loadDetails();
            setActiveJobId(null);
          }}
          onError={(err?: string) => {
            toast(`Build failed: ${err || 'Unknown error'}`, 'error');
            loadDetails();
          }}
        />
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-white/[0.08] gap-1 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview & Resources', icon: <Cpu className="w-4 h-4" /> },
          { id: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
          { id: 'env', label: 'Environment Variables', icon: <Key className="w-4 h-4" /> },
          { id: 'releases', label: 'Releases & Rollback', icon: <History className="w-4 h-4" /> },
          { id: 'logs', label: 'Live Logs', icon: <Terminal className="w-4 h-4" /> },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                active
                  ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.03]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & RESOURCE USAGE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border border-white/[0.06] p-5 space-y-3">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                CPU Utilization
              </span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold font-mono text-text-primary">
                  {usage ? `${usage.cpuUsagePercent.toFixed(1)}%` : '0.0%'}
                </span>
                <span className="text-xs text-text-faint">{dep.cpuLimit ? `Cap: ${dep.cpuLimit} cores` : 'Uncapped'}</span>
              </div>
              <ProgressBar value={usage ? usage.cpuUsagePercent : 0} color="accent" />
            </Card>

            <Card className="border border-white/[0.06] p-5 space-y-3">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                RAM Memory
              </span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold font-mono text-text-primary">
                  {usage ? `${Math.round(usage.memoryUsedMb)} MB` : '0 MB'}
                </span>
                <span className="text-xs text-text-faint">
                  {dep.memoryLimit ? `Limit: ${dep.memoryLimit} MB` : 'Node Shared'}
                </span>
              </div>
              <ProgressBar value={usage ? usage.memoryUsagePercent : 0} color="accent" />
            </Card>

            <Card className="border border-white/[0.06] p-5 space-y-3">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                Storage Allocation
              </span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold font-mono text-text-primary">
                  {usage ? `${usage.storageUsedGb.toFixed(1)} GB` : '0.0 GB'}
                </span>
                <span className="text-xs text-text-faint">
                  {dep.storageLimit ? `Limit: ${dep.storageLimit} GB` : 'Standard Volume'}
                </span>
              </div>
              <ProgressBar value={usage ? usage.storageUsagePercent : 0} color="accent" />
            </Card>
          </div>

          <Card className="border border-white/[0.06] p-5 space-y-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Deployment Runtime Identity
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="text-text-muted block text-[11px]">Primary Subdomain</span>
                <span className="text-text-primary font-bold">{dep.subdomain ? `${dep.subdomain}.app.shanutechx.com` : 'None'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="text-text-muted block text-[11px]">Custom Domain</span>
                <span className="text-text-primary font-bold">{dep.customDomain || 'Not configured'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="text-text-muted block text-[11px]">Hosting Node</span>
                <span className="text-text-primary font-bold">{dep.node?.label || 'Cluster Node'} ({dep.node?.ip || 'Internal'})</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="text-text-muted block text-[11px]">Docker Container ID</span>
                <span className="text-text-primary font-bold">{dep.containerId ? dep.containerId.slice(0, 16) : 'Unassigned'}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: CONFIGURATION */}
      {activeTab === 'config' && (
        <Card className="border border-white/[0.06] p-6 space-y-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Buildpack &amp; Network Configuration
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="text-text-muted block mb-1">Git Repository</label>
              <input
                disabled
                value={dep.repoUrl || 'Custom'}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-text-primary"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Git Branch</label>
              <input
                disabled
                value={dep.branch || 'main'}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-text-primary"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Builder Pipeline</label>
              <input
                disabled
                value={dep.builder || 'AUTO'}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-text-primary"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Internal Container Port</label>
              <input
                disabled
                value={dep.internalPort || 3000}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-text-primary"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Start Command</label>
              <input
                disabled
                value={dep.startCommand || 'Auto-detected'}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-text-primary"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Exposure Mode</label>
              <input
                disabled
                value={dep.exposureMode || 'ssl_with_proxy'}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-text-primary"
              />
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: ENVIRONMENT VARIABLES */}
      {activeTab === 'env' && (
        <Card className="border border-white/[0.06] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Environment Variables &amp; Secrets
              </h3>
              <p className="text-text-faint text-xs mt-0.5">
                Key-value variables injected securely into the running application container.
              </p>
            </div>
            <Button size="sm" variant="primary" loading={savingEnv} onClick={handleSaveEnv}>
              Save &amp; Apply Variables
            </Button>
          </div>

          <div className="grid md:grid-cols-5 gap-2">
            <div className="md:col-span-2">
              <Input
                placeholder="KEY (e.g. DATABASE_URL)"
                value={envKey}
                onChange={(e) => setEnvKey(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                placeholder="VALUE"
                value={envVal}
                onChange={(e) => setEnvVal(e.target.value)}
              />
            </div>
            <div>
              <Button size="md" variant="secondary" onClick={handleAddEnv} className="w-full justify-center">
                + Add Variable
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {Object.keys(envVars).length === 0 ? (
              <p className="text-text-faint text-xs italic">No custom environment variables set.</p>
            ) : (
              Object.entries(envVars).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] font-mono text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-accent-cyan font-bold">{k}</span>
                    <span className="text-text-faint">=</span>
                    <span className="text-text-muted truncate max-w-md">{v}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveEnv(k)}
                    className="text-text-muted hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 4: RELEASES & ZERO-DOWNTIME ROLLBACK */}
      {activeTab === 'releases' && (
        <Card className="border border-white/[0.06] p-6 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" /> Instant Zero-Downtime Rollback
            </h3>
            <p className="text-text-faint text-xs mt-0.5">
              Instantly re-route incoming traffic to a previous release without rebuilding.
            </p>
          </div>

          {rollbackCandidates.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-xs border border-white/[0.04] rounded-xl">
              No previous candidate releases found for this project. When you deploy new versions, previous releases will appear here for 1-click rollback.
            </div>
          ) : (
            <Table headers={['Release ID', 'Commit', 'Node', 'Status', 'Deployed At', 'Action']}>
              {rollbackCandidates.map((cand) => (
                <Tr key={cand.id}>
                  <Td className="font-mono text-xs text-text-primary">#{cand.id.slice(0, 8)}</Td>
                  <Td className="font-mono text-xs text-text-muted">
                    {cand.gitCommitHash ? cand.gitCommitHash.slice(0, 7) : 'Manual'}
                  </Td>
                  <Td className="text-xs text-text-muted">{cand.node?.label || 'Node'}</Td>
                  <Td>
                    <Badge status={cand.status} dot />
                  </Td>
                  <Td className="text-xs text-text-muted">{new Date(cand.createdAt).toLocaleString()}</Td>
                  <Td>
                    <Button
                      size="xs"
                      variant="secondary"
                      loading={rollingBackId === cand.id}
                      onClick={() => handleRollback(cand.id)}
                      className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-[11px]"
                    >
                      Instant Rollback
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* TAB 5: LIVE LOGS */}
      {activeTab === 'logs' && (
        <Card className="border border-white/[0.06] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Container Runtime &amp; Build Logs
            </h3>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="secondary" onClick={fetchLogs} loading={loadingLogs}>
                Refresh Logs
              </Button>
            </div>
          </div>

          <pre className="p-4 rounded-xl bg-black/80 border border-white/[0.06] font-mono text-xs text-emerald-400 overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {logs}
          </pre>
        </Card>
      )}
    </div>
  );
}
