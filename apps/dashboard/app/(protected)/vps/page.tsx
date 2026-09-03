'use client';

import { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { VpsProvision } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  useToast,
  ConfirmDialog,
  RevealSecret,
} from '@/components/ui';
import {
  IconServer,
  IconTerminal,
  IconFolder,
  IconPlay,
  IconStop,
  IconRestart,
  IconKey,
  IconRefresh,
  IconPlus,
  IconAlert,
  IconShield,
} from '@/components/Icons';
import { VpsFileManager } from '@/components/VpsFileManager';
import { CockpitDashboardPanel } from '@/components/CockpitDashboardPanel';
import { VpsFirewallManager } from '@/components/VpsFirewallManager';

export const dynamic = 'force-dynamic';

const SshTerminal = nextDynamic(() => import('@/components/SshTerminal').then((m) => m.SshTerminal), {
  ssr: false,
});

export default function VpsPage() {
  const { apiUser } = useAppUser();
  const [provisions, setProvisions] = useState<VpsProvision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instances, setInstances] = useState<Record<string, any>>({});
  const [traffic, setTraffic] = useState<Record<string, any>>({});
  const [snapshots, setSnapshots] = useState<Record<string, any[]>>({});
  const [sshStats, setSshStats] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [terminalTarget, setTerminalTarget] = useState<VpsProvision | null>(null);
  const [sftpTargetId, setSftpTargetId] = useState<string | null>(null);
  const [firewallTargetId, setFirewallTargetId] = useState<string | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<VpsProvision | null>(null);
  const [reinstallTarget, setReinstallTarget] = useState<VpsProvision | null>(null);
  const [snapshotTarget, setSnapshotTarget] = useState<VpsProvision | null>(null);
  const [osOptions, setOsOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [selectedOs, setSelectedOs] = useState<string>('UBUNTU_22_04_64BIT');
  const [newSnapshotName, setNewSnapshotName] = useState<string>('');
  const [resetPasswordResult, setResetPasswordResult] = useState<{ id: string; username: string; password: string; warning?: string } | null>(null);

  // Password Change & Sync Modals
  const [changePasswordTarget, setChangePasswordTarget] = useState<VpsProvision | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [syncCredentialsTarget, setSyncCredentialsTarget] = useState<VpsProvision | null>(null);
  const [syncIpInput, setSyncIpInput] = useState<string>('');
  const [syncPortInput, setSyncPortInput] = useState<number>(22);
  const [syncUsernameInput, setSyncUsernameInput] = useState<string>('root');
  const [syncPasswordInput, setSyncPasswordInput] = useState<string>('');

  // Staff Add VPS Modal state
  const [addVpsModal, setAddVpsModal] = useState<boolean>(false);
  const [addMode, setAddMode] = useState<'customer' | 'node'>('customer');
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; email: string; displayName?: string | null }>>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [manualIp, setManualIp] = useState<string>('');
  const [manualPort, setManualPort] = useState<number>(22);
  const [manualUsername, setManualUsername] = useState<string>('root');
  const [manualPassword, setManualPassword] = useState<string>('');
  const [manualProvider, setManualProvider] = useState<string>('STX Enterprise');

  // Node mode fields
  const [nodeLabel, setNodeLabel] = useState<string>('vps-node-1');
  const [nodeCpu, setNodeCpu] = useState<number>(2);
  const [nodeRam, setNodeRam] = useState<number>(2048);
  const [nodeDisk, setNodeDisk] = useState<number>(40);
  const [nodeRoleTags, setNodeRoleTags] = useState<string>('web-hosting,node-hosting');

  const { toast } = useToast();
  const isStaff = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  function load() {
    api.vps
      .list()
      .then((data) => {
        setProvisions(data.provisions);
        data.provisions.forEach((p) => {
          if (p.leasewebVpsId && p.status !== 'terminated') {
            api.leaseweb
              .instance('provision', p.id)
              .then((d) => setInstances((prev) => ({ ...prev, [p.id]: d.instance })))
              .catch(() => {});
            api.leaseweb
              .dataTraffic('provision', p.id)
              .then((d) => setTraffic((prev) => ({ ...prev, [p.id]: d.traffic })))
              .catch(() => {});
            api.leaseweb
              .snapshots('provision', p.id)
              .then((d) => setSnapshots((prev) => ({ ...prev, [p.id]: d.snapshots ?? [] })))
              .catch(() => {});
          } else if (p.ip) {
            // Fetch direct SSH telemetry stats
            api.vps
              .stats(p.id)
              .then((res) => setSshStats((prev) => ({ ...prev, [p.id]: res.stats })))
              .catch(() => {});
          }
        });
      })
      .catch((err) => setError(err.message));

    api.leaseweb
      .osOptions()
      .then((res) => setOsOptions(res.osOptions))
      .catch(() => {});
  }

  useEffect(load, []);

  useEffect(() => {
    if (addVpsModal && isStaff && customerOptions.length === 0) {
      api.admin.customers(100).then((res) => {
        setCustomerOptions(res.customers || []);
        if (res.customers?.[0]?.id) setTargetUserId(res.customers[0].id);
      }).catch(() => {});
    }
  }, [addVpsModal, isStaff, customerOptions.length]);

  async function handlePower(p: VpsProvision, action: 'start' | 'stop' | 'reboot') {
    setBusyId(p.id);
    try {
      if (p.leasewebVpsId) {
        await api.leaseweb.power('provision', p.id, action);
      } else {
        await api.vps.power(p.id, action);
      }
      toast(`VPS ${action === 'reboot' ? 'restart' : action} requested.`, 'success');
      setTimeout(load, 2000);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleChangePasswordSubmit() {
    if (!changePasswordTarget || !newPasswordInput) return;
    setBusyId(changePasswordTarget.id);
    try {
      const res = await api.vps.changePassword(changePasswordTarget.id, newPasswordInput);
      toast(res.message, 'success');
      setChangePasswordTarget(null);
      setNewPasswordInput('');
    } catch (err: any) {
      toast(`Password change error: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSyncCredentialsSubmit() {
    if (!syncCredentialsTarget) return;
    setBusyId(syncCredentialsTarget.id);
    try {
      await api.vps.updateCredentials(syncCredentialsTarget.id, {
        ip: syncIpInput,
        sshPort: syncPortInput,
        username: syncUsernameInput,
        password: syncPasswordInput,
      });
      toast('Stored credentials updated successfully.', 'success');
      setSyncCredentialsTarget(null);
      load();
    } catch (err: any) {
      toast(`Update failed: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddManualVps() {
    if (!manualIp) {
      toast('IP address is required', 'error');
      return;
    }
    setBusyId('new');
    try {
      if (addMode === 'customer') {
        const finalUserId = targetUserId.trim() || apiUser?.id || '';
        if (!finalUserId) {
          toast('Please select a target customer to assign this VPS', 'error');
          setBusyId(null);
          return;
        }
        if (!manualPassword) {
          toast('Root password is required', 'error');
          setBusyId(null);
          return;
        }
        await api.vps.create({
          userId: finalUserId,
          orderItemId: `manual-${Date.now()}`,
          provider: manualProvider,
          ip: manualIp,
          sshPort: manualPort,
          username: manualUsername,
          password: manualPassword,
        });
        toast('VPS successfully provisioned and assigned to customer.', 'success');
      } else {
        await api.nodes.create({
          label: nodeLabel || `node-${manualIp.replace(/\./g, '-')}`,
          ip: manualIp,
          cpuCores: nodeCpu,
          ramMb: nodeRam,
          diskGb: nodeDisk,
          sshKeyRef: `vault:${manualIp}`,
          roleTags: nodeRoleTags.split(',').map((t) => t.trim()).filter(Boolean),
        });
        toast('Server registered as Infrastructure Compute Node.', 'success');
      }
      setAddVpsModal(false);
      setManualIp('');
      setManualPassword('');
      load();
    } catch (err: any) {
      toast(`Action failed: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReinstall() {
    if (!reinstallTarget || !selectedOs) return;
    setBusyId(reinstallTarget.id);
    try {
      await api.leaseweb.reinstall('provision', reinstallTarget.id, selectedOs);
      toast(`OS reinstallation initiated with ${selectedOs}.`, 'success');
      setReinstallTarget(null);
      setTimeout(load, 3000);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateSnapshot(p: VpsProvision) {
    if (!newSnapshotName.trim()) return;
    setBusyId(p.id);
    try {
      await api.leaseweb.createSnapshot('provision', p.id, newSnapshotName.trim());
      toast('Snapshot created successfully.', 'success');
      setNewSnapshotName('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestoreSnapshot(p: VpsProvision, snapshotId: string) {
    if (!confirm('Revert VPS to this snapshot? All current data since this snapshot will be overwritten.')) return;
    setBusyId(p.id);
    try {
      await api.leaseweb.restoreSnapshot('provision', p.id, snapshotId);
      toast('Snapshot restoration initiated.', 'success');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteSnapshot(p: VpsProvision, snapshotId: string) {
    if (!confirm('Delete this snapshot permanently?')) return;
    setBusyId(p.id);
    try {
      await api.leaseweb.deleteSnapshot('provision', p.id, snapshotId);
      toast('Snapshot deleted.', 'success');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleTerminate() {
    if (!terminateTarget) return;
    setBusyId(terminateTarget.id);
    try {
      await api.leaseweb.terminate('provision', terminateTarget.id);
      toast('VPS terminated.', 'success');
      setTerminateTarget(null);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const [cockpitTargetId, setCockpitTargetId] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Virtual Server Fleet"
          description="Manage root credentials, interactive SSH shell, desktop-grade SFTP file manager, power reboot/stop, and live performance metrics."
        />
        {isStaff && (
          <Button variant="primary" size="sm" onClick={() => setAddVpsModal(true)} className="flex items-center gap-1.5">
            <IconPlus size={14} /> Add VPS (Assign to Customer or System Node)
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {provisions === null && <Spinner label="Loading your VPS fleet..." />}
      {provisions?.length === 0 && (
        <EmptyState message="No VPS server assigned to your account yet. VPS servers purchased from STX Hosting will automatically appear here once provisioned." />
      )}

      {/* Global Warning Note */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
        <IconAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-300">IMPORTANT SECURITY NOTICE:</strong> If you change your root user password directly inside the terminal (`chpasswd`) or via your external provider dashboard, you <strong>MUST</strong> update your stored credentials here in the control panel. This ensures SFTP file transfers, live stats telemetry, and automated SSH power controls remain synchronized.
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {provisions?.map((p) => {
          const instance = instances[p.id];
          const isLeaseweb = !!p.leasewebVpsId;
          const displayIp = p.ip || instance?.ips?.[0]?.ip;
          const state = instance?.state?.toLowerCase();
          const isTerminated = p.status === 'terminated';
          const pSnapshots = snapshots[p.id] ?? [];
          const isCockpitOpen = cockpitTargetId === p.id;
          const isSftpOpen = sftpTargetId === p.id;
          const isFirewallOpen = firewallTargetId === p.id;
          const stats = sshStats[p.id];

          return (
            <Card key={p.id} className="border border-white/[0.08] flex flex-col justify-between space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div>
                  <p className="font-semibold text-text-primary text-base flex items-center gap-2 font-mono">
                    <IconServer size={18} className="text-accent-teal" /> {displayIp ?? p.externalId ?? p.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-text-muted">
                    Provider: <span className="font-mono text-text-primary uppercase">{p.provider || 'Generic VPS'}</span>
                    {p.sshPort && p.sshPort !== 22 && <span className="ml-2 font-mono text-accent-teal">Port: {p.sshPort}</span>}
                  </p>
                </div>
                <Badge status={isTerminated ? 'terminated' : state ?? p.status} />
              </div>

              {/* SSH / SFTP Telemetry */}
              {stats && (
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <div>
                    <span className="text-text-muted block text-[9px]">CPU Cores</span>
                    <span className="text-white font-bold">{stats.cpuCores} vCPU</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[9px]">RAM Usage</span>
                    <span className="text-emerald-300 font-bold">{stats.ramUsedMb} / {stats.ramTotalMb} MB</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[9px]">Disk Storage</span>
                    <span className="text-cyan-300 font-bold">{stats.diskUsedGb} / {stats.diskTotalGb} GB</span>
                  </div>
                </div>
              )}

              {/* Primary Management Actions */}
              {!isTerminated && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={() => setTerminalTarget(p)} className="flex items-center gap-1.5">
                      <IconTerminal size={14} /> Web SSH Shell
                    </Button>
                    <Button
                      size="sm"
                      variant={isSftpOpen ? 'secondary' : 'primary'}
                      onClick={() => setSftpTargetId(isSftpOpen ? null : p.id)}
                      className="flex items-center gap-1.5"
                    >
                      <IconFolder size={14} /> {isSftpOpen ? 'Close SFTP' : 'SFTP File Manager'}
                    </Button>
                    <Button size="sm" variant="secondary" loading={busyId === p.id} onClick={() => handlePower(p, 'reboot')} className="flex items-center gap-1.5">
                      <IconRestart size={14} /> Restart
                    </Button>
                    <Button size="sm" variant="danger" loading={busyId === p.id} onClick={() => handlePower(p, 'stop')} className="flex items-center gap-1.5">
                      <IconStop size={14} /> Stop / Shutdown
                    </Button>
                  </div>

                  {/* Direct SSH Credential Utilities */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isFirewallOpen ? 'secondary' : 'ghost'}
                        onClick={() => setFirewallTargetId(isFirewallOpen ? null : p.id)}
                        className="flex items-center gap-1.5"
                      >
                        <IconShield size={13} /> {isFirewallOpen ? 'Close Firewall' : 'Host Firewall'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setChangePasswordTarget(p);
                          setNewPasswordInput('');
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <IconKey size={13} /> Change Root Password
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSyncCredentialsTarget(p);
                          setSyncIpInput(p.ip || displayIp || '');
                          setSyncPortInput(p.sshPort || 22);
                          setSyncUsernameInput(p.username || 'root');
                          setSyncPasswordInput('');
                        }}
                        className="flex items-center gap-1.5"
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
              {isSftpOpen && (
                <div className="pt-3 border-t border-white/10">
                  <VpsFileManager provisionId={p.id} />
                </div>
              )}

              {/* Host Firewall Manager Drawer */}
              {isFirewallOpen && (
                <div className="pt-3 border-t border-white/10">
                  <VpsFirewallManager provisionId={p.id} sshPort={p.sshPort || 22} />
                </div>
              )}

              {/* Cockpit Drawer for Leaseweb */}
              {isCockpitOpen && (
                <div className="pt-4 border-t border-white/10">
                  <CockpitDashboardPanel nodeId={p.id} ipAddress={displayIp} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Manual VPS / Node Creation Modal (Admin / Dev Staff Only) */}
      {addVpsModal && isStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Add Server (Staff Only)</h3>
              <button onClick={() => setAddVpsModal(false)} className="text-text-muted hover:text-white text-sm">✕</button>
            </div>
            <p className="text-xs text-text-muted">
              Add a VPS server to assign to a specific customer account or register it as a cluster infrastructure compute node.
            </p>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setAddMode('customer')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                  addMode === 'customer'
                    ? 'bg-accent-violet text-white shadow-glow-violet'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                Assign to Customer
              </button>
              <button
                type="button"
                onClick={() => setAddMode('node')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                  addMode === 'node'
                    ? 'bg-accent-violet text-white shadow-glow-violet'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                Add as System Node
              </button>
            </div>

            {addMode === 'customer' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-text-muted block mb-1">Target Customer Account *</label>
                  {customerOptions.length > 0 ? (
                    <select
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-accent-teal font-mono text-xs"
                    >
                      {customerOptions.map((c) => (
                        <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                          {c.email} ({c.displayName || c.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter Customer User ID"
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  )}
                </div>

                <div>
                  <label className="text-text-muted block mb-1">Provider Name</label>
                  <input
                    type="text"
                    placeholder="STX Enterprise / Leaseweb / Contabo / Hetzner"
                    value={manualProvider}
                    onChange={(e) => setManualProvider(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-text-muted block mb-1">IP Address *</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100"
                      value={manualIp}
                      onChange={(e) => setManualIp(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted block mb-1">SSH Port</label>
                    <input
                      type="number"
                      value={manualPort}
                      onChange={(e) => setManualPort(parseInt(e.target.value) || 22)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-text-muted block mb-1">Username</label>
                    <input
                      type="text"
                      value={manualUsername}
                      onChange={(e) => setManualUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted block mb-1">Root Password *</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-text-muted block mb-1">System Node Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. node-singapore-1"
                    value={nodeLabel}
                    onChange={(e) => setNodeLabel(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-text-muted block mb-1">Node IP Address *</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100"
                      value={manualIp}
                      onChange={(e) => setManualIp(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted block mb-1">vCPU Cores</label>
                    <input
                      type="number"
                      value={nodeCpu}
                      onChange={(e) => setNodeCpu(parseInt(e.target.value) || 2)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-text-muted block mb-1">RAM (MB)</label>
                    <input
                      type="number"
                      value={nodeRam}
                      onChange={(e) => setNodeRam(parseInt(e.target.value) || 2048)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted block mb-1">Disk Storage (GB)</label>
                    <input
                      type="number"
                      value={nodeDisk}
                      onChange={(e) => setNodeDisk(parseInt(e.target.value) || 40)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-text-muted block mb-1">Role Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="web-hosting, node-hosting"
                    value={nodeRoleTags}
                    onChange={(e) => setNodeRoleTags(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button size="sm" variant="secondary" onClick={() => setAddVpsModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleAddManualVps} loading={busyId === 'new'}>
                {addMode === 'customer' ? 'Save & Assign to Customer' : 'Register System Node'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Change Password Modal */}
      {changePasswordTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-base font-bold text-white">Change Root Password over SSH</h3>
            <p className="text-xs text-text-muted">
              This executes remote <code className="text-accent-teal">chpasswd</code> on host server and automatically updates encrypted vault.
            </p>
            <input
              type="password"
              placeholder="Enter new root password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-accent-teal font-mono"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setChangePasswordTarget(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleChangePasswordSubmit} loading={busyId === changePasswordTarget.id}>
                Update Password
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Sync Credentials Modal */}
      {syncCredentialsTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-base font-bold text-white">Sync Updated Credentials</h3>
            <p className="text-xs text-text-muted">
              Use this if password was updated out-of-band directly inside host terminal or provider dashboard.
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
              <Button size="sm" variant="secondary" onClick={() => setSyncCredentialsTarget(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSyncCredentialsSubmit} loading={busyId === syncCredentialsTarget.id}>
                Save Stored Credentials
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Web SSH Terminal Modal */}
      {terminalTarget && (
        <SshTerminal kind="provision" id={terminalTarget.id} onClose={() => setTerminalTarget(null)} />
      )}
    </div>
  );
}
