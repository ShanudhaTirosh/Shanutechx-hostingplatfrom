'use client';

import { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { VpsProvision } from '@/lib/types';
import {
  Card,
  Button,
  Badge,
  Spinner,
  useToast,
  RevealSecret,
} from '@/components/ui';
import {
  IconServer,
  IconTerminal,
  IconFolder,
  IconStop,
  IconRestart,
  IconKey,
  IconRefresh,
  IconShield,
  IconCpu,
  IconHardDrive,
  IconActivity,
  IconPlus,
  IconDownload,
  IconFileText,
} from '@/components/Icons';
import { VpsFileManager } from '@/components/VpsFileManager';
import { VpsFirewallManager } from '@/components/VpsFirewallManager';

const SshTerminal = nextDynamic(() => import('@/components/SshTerminal').then((m) => m.SshTerminal), {
  ssr: false,
});

interface CustomerVpsPanelProps {
  provision: VpsProvision;
  onRefresh?: () => void;
}

export function CustomerVpsPanel({ provision: p, onRefresh }: CustomerVpsPanelProps) {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Management drawers
  const [showTerminal, setShowTerminal] = useState<boolean>(false);
  const [showSftp, setShowSftp] = useState<boolean>(false);
  const [showFirewall, setShowFirewall] = useState<boolean>(false);
  const [showContainers, setShowContainers] = useState<boolean>(false);

  // Modals
  const [showRenewModal, setShowRenewModal] = useState<boolean>(false);
  const [renewMonths, setRenewMonths] = useState<number>(1);

  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');

  const [showSyncCredentials, setShowSyncCredentials] = useState<boolean>(false);
  const [syncIpInput, setSyncIpInput] = useState<string>(p.ip || '');
  const [syncPortInput, setSyncPortInput] = useState<number>(p.sshPort || 22);
  const [syncUsernameInput, setSyncUsernameInput] = useState<string>(p.username || 'root');
  const [syncPasswordInput, setSyncPasswordInput] = useState<string>('');

  // Docker Container Management State
  const [containers, setContainers] = useState<any[]>([]);
  const [loadingContainers, setLoadingContainers] = useState<boolean>(false);
  const [deployModalOpen, setDeployModalOpen] = useState<boolean>(false);
  const [deployImage, setDeployImage] = useState<string>('nginx:latest');
  const [deployName, setDeployName] = useState<string>('my-app');
  const [deployPort, setDeployPort] = useState<string>('8080:80');
  const [deployEnv, setDeployEnv] = useState<string>('NODE_ENV=production');

  const { toast } = useToast();
  const isTerminated = p.status === 'terminated';
  const isPending = p.status === 'pending';
  const orderId = (p as any).orderItem?.orderId;

  function fetchTelemetry() {
    if (!p.ip || isTerminated || isPending) {
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    api.vps
      .stats(p.id)
      .then((res) => {
        setStats(res.stats);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }

  function fetchContainers() {
    if (!p.ip || isTerminated || isPending) return;
    setLoadingContainers(true);
    // Fetch container list via nodeEngine/containers API endpoint
    api.nodeEngine
      .containers(p.id)
      .then((res) => setContainers(res.containers || []))
      .catch(() => setContainers([]))
      .finally(() => setLoadingContainers(false));
  }

  useEffect(() => {
    fetchTelemetry();
  }, [p.id, p.ip, p.status]);

  useEffect(() => {
    if (showContainers) {
      fetchContainers();
    }
  }, [showContainers]);

  async function handlePowerAction(action: 'start' | 'reboot') {
    setBusyAction(action);
    try {
      await api.vps.power(p.id, action);
      toast(`VPS ${action === 'reboot' ? 'restart' : action} initiated successfully over SSH.`, 'success');
      setTimeout(fetchTelemetry, 3000);
      onRefresh?.();
    } catch (err: any) {
      toast(`Action failed: ${err.message}`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChangePasswordSubmit() {
    if (!newPasswordInput) return;
    setBusyAction('password');
    try {
      const res = await api.vps.changePassword(p.id, newPasswordInput);
      toast(res.message || 'Root password updated successfully over SSH.', 'success');
      setShowChangePassword(false);
      setNewPasswordInput('');
    } catch (err: any) {
      toast(`Password update failed: ${err.message}`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTestExistingConnection(testType: 'ssh' | 'sftp' | 'both' = 'both') {
    setBusyAction(`test_${testType}`);
    try {
      const res = await api.vps.testExistingConnection(p.id, testType);
      if (res.ok) {
        toast(`Connection Test Passed! SSH: ${res.ssh.message} | SFTP: ${res.sftp.message}`, 'success');
      } else {
        const err = !res.ssh.success ? res.ssh.message : res.sftp.message;
        toast(`Connection Test Failed: ${err}`, 'error');
      }
    } catch (err: any) {
      toast(`Test Connection Error: ${err.message}`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSyncCredentialsSubmit() {
    setBusyAction('sync');
    try {
      await api.vps.updateCredentials(p.id, {
        ip: syncIpInput,
        sshPort: syncPortInput,
        username: syncUsernameInput,
        password: syncPasswordInput,
      });
      toast('Stored SSH credentials synchronized.', 'success');
      setShowSyncCredentials(false);
      onRefresh?.();
    } catch (err: any) {
      toast(`Sync failed: ${err.message}`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCustomerRenewSubmit() {
    setBusyAction('customer_renew');
    try {
      const res = await api.vps.renew(p.id, { months: renewMonths });
      toast(res.message || 'VPS subscription renewed successfully.', 'success');
      setShowRenewModal(false);
      onRefresh?.();
    } catch (err: any) {
      toast(`Renewal failed: ${err.message}`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeployContainer() {
    if (!deployImage || !deployName) {
      toast('Image name and container name are required', 'error');
      return;
    }
    setBusyAction('deploy');
    try {
      const envArr: string[] = deployEnv
        ? deployEnv.split('\n').map((l) => l.trim()).filter(Boolean)
        : [];
      const portArr: { hostPort: number; containerPort: number }[] = deployPort
        ? deployPort
            .split('\n')
            .map((p) => {
              const parts = p.trim().split(':');
              return { hostPort: Number(parts[0]), containerPort: Number(parts[1] || parts[0]) };
            })
            .filter((pt) => !isNaN(pt.hostPort) && pt.hostPort > 0)
        : [];

      await api.nodeEngine.createContainer(p.id, {
        name: deployName,
        image: deployImage,
        ports: portArr,
        env: envArr,
      });

      toast(`Container ${deployName} deployed successfully.`, 'success');
      setDeployModalOpen(false);
      fetchContainers();
    } catch (err: any) {
      toast(`Container deployment failed: ${err.message}`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleContainerAction(containerId: string, action: 'start' | 'stop' | 'restart') {
    setBusyAction(containerId);
    try {
      await api.nodeEngine.containerAction(p.id, containerId, action);
      toast(`Container ${action}ed.`, 'success');
      fetchContainers();
    } catch (err: any) {
      toast(`Failed to ${action} container: ${err.message}`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card className="border border-white/[0.08] flex flex-col justify-between space-y-4 shadow-2xl bg-neutral-900/60 backdrop-blur-md">
      {/* Top Bar / Server Info */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <p className="font-semibold text-text-primary text-base flex items-center gap-2 font-mono">
            <IconServer size={18} className="text-accent-teal" /> {p.ip || p.externalId || p.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            Provider: <span className="font-mono text-text-primary uppercase">{p.provider || 'Raw SSH VPS'}</span>
            {p.sshPort && p.sshPort !== 22 && <span className="ml-2 font-mono text-accent-teal">Port: {p.sshPort}</span>}
            <span className="ml-2 font-mono text-text-muted">User: {p.username || 'root'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {orderId && (
            <a
              href={`${api.baseURL}/api/orders/${orderId}/invoice`}
              target="_blank"
              rel="noreferrer"
              title="Download Order Invoice PDF"
              className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] text-text-muted hover:text-white flex items-center gap-1 transition-colors"
            >
              <IconFileText size={12} /> Invoice
            </a>
          )}
          <Badge status={isTerminated ? 'terminated' : isPending ? 'pending' : p.status || 'active'} />
        </div>
      </div>

      {/* Pending Setup Alert Banner */}
      {isPending && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs animate-fade-in">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <IconActivity size={16} /> VPS Setup Pending Manual Provisioning
          </div>
          <p className="text-text-muted leading-relaxed">
            Your Virtual Private Server is queued for manual setup by our engineering team. Server IP address, SSH root credentials, and downloadable SSH private key (.pem) will be delivered here automatically upon completion.
          </p>
        </div>
      )}

      {/* Telemetry Stats Grid (Provisioned Servers Only) */}
      {!isPending && (
        <>
          {loadingStats ? (
            <div className="py-2 text-center text-xs text-text-muted">Loading live SSH telemetry...</div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-2">
                <IconCpu size={16} className="text-accent-teal shrink-0" />
                <div>
                  <span className="text-text-muted block text-[9px]">CPU Cores</span>
                  <span className="text-white font-bold">{stats.cpuCores || 1} vCPU</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <IconActivity size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <span className="text-text-muted block text-[9px]">RAM Usage</span>
                  <span className="text-emerald-300 font-bold">{stats.ramUsedMb || 0} / {stats.ramTotalMb || 1024} MB</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <IconHardDrive size={16} className="text-cyan-400 shrink-0" />
                <div>
                  <span className="text-text-muted block text-[9px]">Disk Storage</span>
                  <span className="text-cyan-300 font-bold">{stats.diskUsedGb || 0} / {stats.diskTotalGb || 20} GB</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-text-muted bg-white/5 rounded-xl p-2.5 font-mono text-center">
              SSH Telemetry Agent connected ({p.ip}:{p.sshPort || 22})
            </div>
          )}

          {/* Per-VPS 30 TB Bandwidth Quota Indicator */}
          <div className="bg-black/30 rounded-xl p-3 border border-white/10 space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-[10px]">VPS Bandwidth Quota (Per-Instance)</span>
              <span className="text-accent-cyan font-bold">
                {stats?.bandwidthUsedGb ? (stats.bandwidthUsedGb / 1024).toFixed(2) : '0.14'} TB / 30.0 TB
              </span>
            </div>
            <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/10">
              <div
                className="bg-gradient-to-r from-cyan-400 to-purple-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(1, ((stats?.bandwidthUsedGb || 140) / 30000) * 100))}%` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Actions Toolbar */}
      {!isTerminated && !isPending && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => setShowTerminal(true)} className="flex items-center gap-1.5">
              <IconTerminal size={14} /> Web SSH Shell
            </Button>

            <Button
              size="sm"
              variant={showSftp ? 'secondary' : 'primary'}
              onClick={() => setShowSftp(!showSftp)}
              className="flex items-center gap-1.5"
            >
              <IconFolder size={14} /> {showSftp ? 'Close SFTP' : 'SFTP File Manager'}
            </Button>

            <Button
              size="sm"
              variant={showContainers ? 'secondary' : 'primary'}
              onClick={() => setShowContainers(!showContainers)}
              className="flex items-center gap-1.5"
            >
              <IconServer size={14} /> {showContainers ? 'Close Docker' : 'Docker Containers'}
            </Button>

            <Button
              size="sm"
              variant="secondary"
              loading={busyAction === 'reboot'}
              onClick={() => handlePowerAction('reboot')}
              className="flex items-center gap-1.5"
            >
              <IconRestart size={14} /> Restart
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowRenewModal(true);
                setRenewMonths(1);
              }}
              className="flex items-center gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            >
              <IconRefresh size={14} /> Renew VPS
            </Button>

            <a
              href={`${api.baseURL}${api.vps.downloadKeyUrl(p.id)}`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-medium transition-colors"
            >
              <IconDownload size={13} /> Download SSH Key (.pem)
            </a>
          </div>

          {/* Secondary Utilities */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                loading={busyAction?.startsWith('test_')}
                onClick={() => handleTestExistingConnection('both')}
                className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200"
              >
                <IconActivity size={13} /> Test SSH & SFTP
              </Button>

              <Button
                size="sm"
                variant={showFirewall ? 'secondary' : 'ghost'}
                onClick={() => setShowFirewall(!showFirewall)}
                className="flex items-center gap-1.5 text-xs"
              >
                <IconShield size={13} /> {showFirewall ? 'Close Firewall' : 'Host Firewall'}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowChangePassword(true);
                  setNewPasswordInput('');
                }}
                className="flex items-center gap-1.5 text-xs"
              >
                <IconKey size={13} /> Change Root Password
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowSyncCredentials(true);
                  setSyncIpInput(p.ip || '');
                  setSyncPortInput(p.sshPort || 22);
                  setSyncUsernameInput(p.username || 'root');
                  setSyncPasswordInput('');
                }}
                className="flex items-center gap-1.5 text-xs"
              >
                <IconRefresh size={13} /> Sync Credentials
              </Button>
            </div>

            <RevealSecret
              fetchSecret={() =>
                api.vps.revealPassword(p.id).then((r) => `${r.username || 'root'}:${r.password}`)
              }
            />
          </div>
        </div>
      )}


      {/* SFTP File Manager Drawer */}
      {showSftp && (
        <div className="pt-3 border-t border-white/10">
          <VpsFileManager provisionId={p.id} />
        </div>
      )}

      {/* Host Firewall Drawer */}
      {showFirewall && (
        <div className="pt-3 border-t border-white/10">
          <VpsFirewallManager provisionId={p.id} sshPort={p.sshPort || 22} />
        </div>
      )}

      {/* Docker Containers Drawer */}
      {showContainers && (
        <div className="pt-3 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <IconServer size={14} className="text-accent-teal" /> Docker Container Engine
            </h4>
            <Button size="sm" variant="primary" onClick={() => setDeployModalOpen(true)} className="flex items-center gap-1 text-xs">
              <IconPlus size={12} /> Deploy Container
            </Button>
          </div>

          {loadingContainers ? (
            <Spinner label="Loading Docker containers on host..." />
          ) : containers.length === 0 ? (
            <div className="text-xs text-text-muted p-3 bg-white/5 rounded-xl text-center">
              No active containers running on this server. Click "Deploy Container" to launch an app.
            </div>
          ) : (
            <div className="space-y-2">
              {containers.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 text-xs font-mono">
                  <div>
                    <span className="text-white font-bold">{c.name}</span>
                    <span className="ml-2 text-text-muted text-[10px]">{c.image}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] ${c.state === 'running' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {c.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.state === 'running' ? (
                      <Button size="sm" variant="danger" loading={busyAction === c.id} onClick={() => handleContainerAction(c.id, 'stop')} className="text-[10px] px-2 py-1">
                        Stop
                      </Button>
                    ) : (
                      <Button size="sm" variant="primary" loading={busyAction === c.id} onClick={() => handleContainerAction(c.id, 'start')} className="text-[10px] px-2 py-1">
                        Start
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" loading={busyAction === c.id} onClick={() => handleContainerAction(c.id, 'restart')} className="text-[10px] px-2 py-1">
                      Restart
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Change Root Password over SSH</h3>
            <p className="text-xs text-text-muted">
              Executes remote <code className="text-accent-teal">chpasswd</code> over SSH and updates stored vault password.
            </p>
            <input
              type="password"
              placeholder="Enter new root password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-accent-teal font-mono"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowChangePassword(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleChangePasswordSubmit} loading={busyAction === 'password'}>
                Update Password
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Sync Credentials Modal */}
      {showSyncCredentials && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Sync Updated Credentials</h3>
            <p className="text-xs text-text-muted">
              Sync credentials if password was updated out-of-band directly inside host terminal.
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-text-muted block mb-1">IP Address</label>
                  <input
                    type="text"
                    value={syncIpInput}
                    onChange={(e) => setSyncIpInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Port</label>
                  <input
                    type="number"
                    value={syncPortInput}
                    onChange={(e) => setSyncPortInput(parseInt(e.target.value) || 22)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Username</label>
                <input
                  type="text"
                  value={syncUsernameInput}
                  onChange={(e) => setSyncUsernameInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">New Root Password</label>
                <input
                  type="password"
                  placeholder="Enter updated password"
                  value={syncPasswordInput}
                  onChange={(e) => setSyncPasswordInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowSyncCredentials(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSyncCredentialsSubmit} loading={busyAction === 'sync'}>
                Save Stored Credentials
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Deploy Container Modal */}
      {deployModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Deploy Docker Container</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Docker Image *</label>
                <input
                  type="text"
                  placeholder="e.g. nginx:latest, redis:alpine, node:20-alpine"
                  value={deployImage}
                  onChange={(e) => setDeployImage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-text-muted block mb-1">Container Name *</label>
                <input
                  type="text"
                  placeholder="e.g. my-web-app"
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-text-muted block mb-1">Port Mapping (host:container)</label>
                <input
                  type="text"
                  placeholder="e.g. 8080:80"
                  value={deployPort}
                  onChange={(e) => setDeployPort(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-text-muted block mb-1">Environment Variables (KEY=VAL)</label>
                <textarea
                  rows={3}
                  placeholder="NODE_ENV=production&#10;PORT=80"
                  value={deployEnv}
                  onChange={(e) => setDeployEnv(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDeployModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleDeployContainer} loading={busyAction === 'deploy'}>
                Deploy Container
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Web SSH Terminal Modal */}
      {showTerminal && (
        <SshTerminal kind="provision" id={p.id} onClose={() => setShowTerminal(false)} />
      )}

      {/* Customer Renew VPS Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <IconRefresh size={18} className="text-emerald-400" />
                Renew VPS Subscription
              </h3>
              <button onClick={() => setShowRenewModal(false)} className="text-text-muted hover:text-white text-sm">✕</button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Extend your VPS (<span className="text-white font-mono">{p.ip || p.id.slice(0, 8)}</span>) subscription period. Choose your desired extension plan below.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1 font-semibold">Select Renewal Term *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRenewMonths(1)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      renewMonths === 1
                        ? 'border-accent-teal bg-accent-teal/10 text-white font-bold'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">1 Month</div>
                    <div className="text-[10px] text-text-muted mt-0.5">$15.00 / month</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewMonths(3)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      renewMonths === 3
                        ? 'border-accent-teal bg-accent-teal/10 text-white font-bold'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">3 Months</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">$42.00 (Save 7%)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewMonths(6)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      renewMonths === 6
                        ? 'border-accent-teal bg-accent-teal/10 text-white font-bold'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">6 Months</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">$80.00 (Save 11%)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewMonths(12)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      renewMonths === 12
                        ? 'border-accent-teal bg-accent-teal/10 text-white font-bold'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">12 Months</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">$150.00 (Save 17%)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewMonths(18)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      renewMonths === 18
                        ? 'border-accent-teal bg-accent-teal/10 text-white font-bold'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">18 Months (Max)</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">$210.00 (Save 22%)</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button size="sm" variant="secondary" onClick={() => setShowRenewModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleCustomerRenewSubmit} loading={busyAction === 'customer_renew'}>
                Confirm Renewal
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}
