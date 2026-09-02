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
import { VpsFileManager } from '@/components/VpsFileManager';
import { CockpitDashboardPanel } from '@/components/CockpitDashboardPanel';

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

  // Manual Add VPS Modal
  const [addVpsModal, setAddVpsModal] = useState<boolean>(false);
  const [manualIp, setManualIp] = useState<string>('');
  const [manualPort, setManualPort] = useState<number>(22);
  const [manualUsername, setManualUsername] = useState<string>('root');
  const [manualPassword, setManualPassword] = useState<string>('');
  const [manualProvider, setManualProvider] = useState<string>('generic_vps');

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
    if (!manualIp || !manualPassword) {
      toast('IP and password are required', 'error');
      return;
    }
    setBusyId('new');
    try {
      await api.vps.create({
        userId: apiUser?.id || '',
        orderItemId: `manual-${Date.now()}`,
        provider: manualProvider,
        ip: manualIp,
        sshPort: manualPort,
        username: manualUsername,
        password: manualPassword,
      });
      toast('Manual VPS added successfully.', 'success');
      setAddVpsModal(false);
      setManualIp('');
      setManualPassword('');
      load();
    } catch (err: any) {
      toast(`Failed to add VPS: ${err.message}`, 'error');
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
          title="Your Virtual Server Fleet"
          description="Manage root credentials, interactive SSH shell, desktop-grade SFTP file manager, power reboot/stop, and live performance metrics."
        />
        <Button variant="primary" size="sm" onClick={() => setAddVpsModal(true)}>
          ➕ Add Existing / Custom VPS (IP &amp; Root SSH)
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {provisions === null && <Spinner label="Loading your VPS fleet..." />}
      {provisions?.length === 0 && (
        <EmptyState message="No VPS assigned to your account yet. Deploy one from the catalog or add your server credentials above." />
      )}

      {/* Global Warning Note */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
        <span className="text-base select-none">⚠️</span>
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
          const stats = sshStats[p.id];

          return (
            <Card key={p.id} className="border border-white/[0.08] flex flex-col justify-between space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div>
                  <p className="font-semibold text-text-primary text-base flex items-center gap-2 font-mono">
                    🖥️ {displayIp ?? p.externalId ?? p.id.slice(0, 8).toUpperCase()}
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
                    <Button size="sm" variant="primary" onClick={() => setTerminalTarget(p)}>
                      💻 Web SSH Shell
                    </Button>
                    <Button
                      size="sm"
                      variant={isSftpOpen ? 'secondary' : 'primary'}
                      onClick={() => setSftpTargetId(isSftpOpen ? null : p.id)}
                    >
                      {isSftpOpen ? 'Close SFTP' : '📁 SFTP File Manager'}
                    </Button>
                    <Button size="sm" variant="secondary" loading={busyId === p.id} onClick={() => handlePower(p, 'reboot')}>
                      🔄 Restart
                    </Button>
                    <Button size="sm" variant="danger" loading={busyId === p.id} onClick={() => handlePower(p, 'stop')}>
                      ⏹ Stop / Shutdown
                    </Button>
                  </div>

                  {/* Direct SSH Credential Utilities */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setChangePasswordTarget(p);
                          setNewPasswordInput('');
                        }}
                      >
                        🔑 Change Root Password
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
                      >
                        🔄 Sync Credentials
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

      {/* Manual VPS Creation Modal */}
      {addVpsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-base font-bold text-white">Add VPS Server (Root SSH)</h3>
            <p className="text-xs text-text-muted">
              Connect external VPS servers (Leaseweb manual, Contabo, Hetzner, Vultr) using root SSH login.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Provider Name</label>
                <input
                  type="text"
                  placeholder="Leaseweb / Contabo / Hetzner"
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

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => setAddVpsModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleAddManualVps} loading={busyId === 'new'}>
                Save Server Credentials
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
