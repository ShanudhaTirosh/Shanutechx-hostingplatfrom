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

export const dynamic = 'force-dynamic';

import { CockpitDashboardPanel } from '@/components/CockpitDashboardPanel';

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [terminalTarget, setTerminalTarget] = useState<VpsProvision | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<VpsProvision | null>(null);
  const [reinstallTarget, setReinstallTarget] = useState<VpsProvision | null>(null);
  const [snapshotTarget, setSnapshotTarget] = useState<VpsProvision | null>(null);
  const [osOptions, setOsOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [selectedOs, setSelectedOs] = useState<string>('UBUNTU_22_04_64BIT');
  const [newSnapshotName, setNewSnapshotName] = useState<string>('');
  const [resetPasswordResult, setResetPasswordResult] = useState<{ id: string; username: string; password: string; warning?: string } | null>(null);
  const { toast } = useToast();

  const isStaff = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  function load() {
    api.vps
      .list()
      .then((data) => {
        setProvisions(data.provisions);
        data.provisions
          .filter((p) => p.leasewebVpsId && p.status !== 'terminated')
          .forEach((p) => {
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
      await api.leaseweb.power('provision', p.id, action);
      toast(`VPS ${action === 'reboot' ? 'restart' : action} requested.`, 'success');
      setTimeout(load, 2000);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(p: VpsProvision) {
    setBusyId(p.id);
    try {
      const { credentials, warning } = await api.leaseweb.resetPassword('provision', p.id);
      setResetPasswordResult({ id: p.id, ...credentials, warning });
      if (warning) toast(warning, 'error');
      else toast('Password reset — new credentials shown below.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
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
      <PageHeader
        title="Your VPS Instance Fleet"
        description="Manage virtual servers assigned to your account — power controls, Cockpit OS dashboard, web SSH terminal, snapshots, and bandwidth telemetry."
      />

      {error && <ErrorBanner message={error} />}
      {provisions === null && <Spinner label="Loading your VPS fleet..." />}
      {provisions?.length === 0 && (
        <EmptyState message="No VPS assigned to your account yet. Browse VPS plans in the catalog to deploy one." />
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {provisions?.map((p) => {
          const instance = instances[p.id];
          const isLeaseweb = !!p.leasewebVpsId;
          const ip = instance?.ips?.[0]?.ip;
          const state = instance?.state?.toLowerCase();
          const isTerminated = p.status === 'terminated';
          const pSnapshots = snapshots[p.id] ?? [];
          const isCockpitOpen = cockpitTargetId === p.id;

          return (
            <Card key={p.id} className="border border-white/[0.08] flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div>
                  <p className="font-semibold text-text-primary text-base flex items-center gap-2">
                    🖥️ {ip ?? p.externalId ?? p.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-text-muted">Provider: <span className="font-mono text-text-primary uppercase">{p.provider}</span></p>
                </div>
                <Badge status={isTerminated ? 'terminated' : state ?? p.status} />
              </div>

              {!isLeaseweb && (
                <div className="space-y-2 text-xs text-text-muted">
                  <p>This VPS is managed through your provider's custom portal.</p>
                  {p.panelUrl && (
                    <a href={p.panelUrl} target="_blank" rel="noreferrer" className="text-accent-teal-bright hover:underline block font-medium">
                      Open Provider Control Panel →
                    </a>
                  )}
                  {p.username && <p>Username: <span className="font-mono text-text-primary">{p.username}</span></p>}
                  <RevealSecret fetchSecret={() => api.vps.revealPassword(p.id).then((r) => r.password)} />
                </div>
              )}

              {isLeaseweb && !isTerminated && (
                <div className="space-y-4">
                  {/* Telemetry Bar */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="glass rounded-xl p-3 border border-white/[0.04] space-y-1">
                      <p className="text-text-muted text-[11px] uppercase font-semibold">Data Traffic Used</p>
                      <p className="font-medium text-text-primary font-mono text-xs">
                        {traffic[p.id] ? (typeof traffic[p.id] === 'object' ? 'Active Metric Stream' : String(traffic[p.id])) : 'Normal usage'}
                      </p>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-accent-teal w-[35%] rounded-full"></div>
                      </div>
                    </div>

                    <div className="glass rounded-xl p-3 border border-white/[0.04] space-y-1">
                      <p className="text-text-muted text-[11px] uppercase font-semibold">Contract State</p>
                      <p className="font-semibold text-emerald-400 capitalize">
                        {instance?.contract?.state ?? 'Active'}
                      </p>
                      <p className="text-[10px] text-text-faint">Auto-renews monthly</p>
                    </div>
                  </div>

                  {/* Primary Power Actions */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-2">Server Power &amp; Management</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" loading={busyId === p.id} onClick={() => handlePower(p, 'start')}>
                        ▶ Start
                      </Button>
                      <Button size="sm" variant="secondary" loading={busyId === p.id} onClick={() => handlePower(p, 'reboot')}>
                        🔄 Restart
                      </Button>
                      <Button size="sm" variant="danger" loading={busyId === p.id} onClick={() => handlePower(p, 'stop')}>
                        ⏹ Stop / Shutdown
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => setTerminalTarget(p)}>
                        💻 Web SSH Terminal
                      </Button>
                      <Button size="sm" variant={isCockpitOpen ? 'secondary' : 'primary'} onClick={() => setCockpitTargetId(isCockpitOpen ? null : p.id)}>
                        {isCockpitOpen ? 'Hide Cockpit' : '🖥️ Cockpit Dashboard'}
                      </Button>
                    </div>
                  </div>

                  {/* OS & Snapshot Tools */}
                  <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setReinstallTarget(p)}>
                        💿 Reinstall OS
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSnapshotTarget(snapshotTarget?.id === p.id ? null : p)}>
                        📸 Snapshots ({pSnapshots.length})
                      </Button>
                      <Button size="sm" variant="ghost" loading={busyId === p.id} onClick={() => handleResetPassword(p)}>
                        🔑 Reset Password
                      </Button>
                    </div>

                    <button
                      className="text-xs text-accent-teal-bright hover:underline font-mono"
                      onClick={() => {
                        navigator.clipboard.writeText(ip ?? '');
                        toast('IP copied to clipboard', 'success');
                      }}
                    >
                      Copy IP ({ip ?? '—'})
                    </button>
                  </div>

                  {/* Cockpit OS Dashboard Drawer */}
                  {isCockpitOpen && (
                    <div className="pt-4 border-t border-white/10">
                      <CockpitDashboardPanel nodeId={p.id} ipAddress={ip} />
                    </div>
                  )}

                  {/* Reset Password Output */}
                  {resetPasswordResult?.id === p.id && (
                    <div className="text-xs bg-black/40 border border-white/10 rounded-xl p-3 space-y-1 font-mono">
                      <p className="text-text-muted">Username: <span className="text-white">{resetPasswordResult.username}</span></p>
                      <p className="text-text-muted">Password: <span className="text-emerald-300 select-all font-bold">{resetPasswordResult.password}</span></p>
                      {resetPasswordResult.warning && (
                        <p className="text-orange-300 text-[11px] pt-1">{resetPasswordResult.warning}</p>
                      )}
                    </div>
                  )}

                  {/* Snapshot Manager Drawer */}
                  {snapshotTarget?.id === p.id && (
                    <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Snapshot Manager</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Snapshot name (e.g. Before Upgrade)"
                          value={newSnapshotName}
                          onChange={(e) => setNewSnapshotName(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent-violet"
                        />
                        <Button size="sm" onClick={() => handleCreateSnapshot(p)} loading={busyId === p.id}>
                          + Take Snapshot
                        </Button>
                      </div>

                      {pSnapshots.length === 0 ? (
                        <p className="text-xs text-text-muted">No snapshots created yet.</p>
                      ) : (
                        <div className="space-y-1.5 pt-1">
                          {pSnapshots.map((snap) => (
                            <div key={snap.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-xs">
                              <div>
                                <span className="font-mono text-white">{snap.id.slice(0, 12)}</span>
                                <span className="text-[10px] text-text-muted ml-2">{new Date(snap.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="secondary" onClick={() => handleRestoreSnapshot(p, snap.id)}>Revert</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDeleteSnapshot(p, snap.id)}>Delete</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isStaff && (
                    <div className="pt-3 border-t border-white/[0.05]">
                      <Button size="sm" variant="danger" onClick={() => setTerminateTarget(p)}>
                        Terminate Instance (Admin / Dev Only)
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isTerminated && (
                <p className="text-xs text-text-faint italic py-2">This VPS has been terminated by an administrator.</p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Web SSH Terminal Modal */}
      {terminalTarget && (
        <SshTerminal kind="provision" id={terminalTarget.id} onClose={() => setTerminalTarget(null)} />
      )}

      {/* OS Reinstall Modal */}
      {reinstallTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white">Reinstall Operating System</h3>
            <p className="text-xs text-text-muted">
              Select an OS image to reinstall on VPS <span className="font-mono text-white">{reinstallTarget.externalId}</span>.
              <span className="text-red-400 font-semibold block mt-1">⚠️ Warning: All existing data on this VPS disk will be permanently erased.</span>
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase">Target OS Image</label>
              <select
                value={selectedOs}
                onChange={(e) => setSelectedOs(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-accent-violet"
              >
                {osOptions.map((os) => (
                  <option key={os.code} value={os.code} className="bg-bg text-white">
                    {os.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setReinstallTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleReinstall} loading={busyId === reinstallTarget.id}>
                Confirm OS Reinstall
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Terminate Confirmation Dialog */}
      <ConfirmDialog
        open={!!terminateTarget}
        onClose={() => setTerminateTarget(null)}
        onConfirm={handleTerminate}
        title="Terminate VPS"
        message="This permanently cancels the instance at the provider. This action cannot be undone."
        confirmLabel="Terminate VPS"
        danger
      />
    </div>
  );
}
