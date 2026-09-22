'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, BackupItem, BackupPolicyUi } from '@/lib/api';
import { Button, Card, ConfirmDialog, Modal, Spinner, useToast } from '@/components/ui';

interface Props {
  deploymentId: string;
  /** What the user must type to confirm a restore. Must equal the deployment's subdomain (or id if it has none). */
  confirmName: string;
}

const TRIGGER_LABEL = { manual: 'Manual', schedule: 'Scheduled', 'pre-restore': 'Safety copy before a restore' } as const;
const INTERVALS = [1, 3, 6, 12, 24, 48, 72, 168];
const POLL_MS = 3000;

const componentKey = (c: { kind: string; name: string }) => (c.kind === 'workspace' ? 'workspace' : `volume:${c.name}`);
const componentLabel = (c: { kind: string; name: string }) => (c.kind === 'workspace' ? 'Workspace files' : `Volume "${c.name}"`);

function formatBytes(n: number | null): string {
  if (n === null || n === undefined) return '-';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '-');
const isActive = (b: BackupItem) => b.status === 'in_progress' || b.restore?.status === 'in_progress';
const messageOf = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback);

function StatusPill({ backup }: { backup: BackupItem }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-300',
    in_progress: 'bg-accent-cyan/20 text-accent-cyan',
    pending: 'bg-accent-cyan/20 text-accent-cyan',
    failed: 'bg-red-500/20 text-red-300',
  };
  const label = backup.status === 'in_progress' ? 'Running' : backup.status === 'completed' ? 'Completed' : backup.status === 'failed' ? 'Failed' : 'Queued';
  return <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${styles[backup.status] ?? ''}`}>{label}</span>;
}

export function DeploymentBackupsPanel({ deploymentId, confirmName }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<{ configured: boolean; maxComponentMb: number; policy: BackupPolicyUi; backups: BackupItem[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // schedule form
  const [enabled, setEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(24);
  const [retention, setRetention] = useState(7);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const policyTouched = useRef(false);

  // restore dialog
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skipSafety, setSkipSafety] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BackupItem | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.deploymentBackups.list(deploymentId);
      if (!mounted.current) return;
      setData(r);
      setLoadError(null);
      if (!policyTouched.current) {
        setEnabled(r.policy.enabled);
        setIntervalHours(r.policy.intervalHours);
        setRetention(r.policy.retention);
      }
    } catch (err) {
      if (mounted.current) setLoadError(messageOf(err, 'Could not load backups.'));
    }
  }, [deploymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While anything is running, refresh so progress and results appear without a page reload.
  const anyActive = data?.backups.some(isActive) ?? false;
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [anyActive, load]);

  async function backUpNow() {
    setStarting(true);
    try {
      await api.deploymentBackups.create(deploymentId);
      toast('Backup started. It runs in the background.', 'success');
      await load();
    } catch (err) {
      toast(messageOf(err, 'Could not start the backup.'), 'error');
    } finally {
      if (mounted.current) setStarting(false);
    }
  }

  async function savePolicy(e: React.FormEvent) {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      await api.deploymentBackups.setPolicy(deploymentId, { enabled, intervalHours, retention });
      policyTouched.current = false;
      toast(enabled ? `Scheduled: every ${intervalHours}h, keeping ${retention}.` : 'Scheduled backups turned off.', 'success');
      await load();
    } catch (err) {
      toast(messageOf(err, 'Could not save the schedule.'), 'error');
    } finally {
      if (mounted.current) setSavingPolicy(false);
    }
  }

  function openRestore(b: BackupItem) {
    setRestoreTarget(b);
    setSelected(new Set(b.components.map(componentKey)));
    setSkipSafety(false);
    setConfirmText('');
    setRestoreError(null);
  }

  async function submitRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const all = restoreTarget.components.map(componentKey);
      await api.deploymentBackups.restore(deploymentId, restoreTarget.id, {
        confirm: confirmText.trim(),
        components: selected.size === all.length ? undefined : [...selected],
        skipSafetyBackup: skipSafety || undefined,
      });
      setRestoreTarget(null);
      toast('Restore started. The app is stopped while files are replaced.', 'success');
      await load();
    } catch (err) {
      setRestoreError(messageOf(err, 'Could not start the restore.'));
    } finally {
      if (mounted.current) setRestoring(false);
    }
  }

  // ConfirmDialog does not catch errors thrown by onConfirm, so this handles its own.
  async function deleteBackup() {
    if (!deleteTarget) return;
    try {
      await api.deploymentBackups.remove(deploymentId, deleteTarget.id);
      toast('Backup deleted, including its copy on GitHub.', 'success');
      await load();
    } catch (err) {
      toast(messageOf(err, 'Could not delete the backup.'), 'error');
    }
  }

  const restoreBusy = data?.backups.some((b) => b.restore?.status === 'in_progress') ?? false;
  const canStart = Boolean(data?.configured) && !anyActive && !starting;
  const workspaceSelected = restoreTarget ? restoreTarget.components.some((c) => c.kind === 'workspace' && selected.has(componentKey(c))) : false;
  const confirmOk = confirmText.trim() === confirmName;
  const policy = data?.policy;

  return (
    <div className="space-y-6">
      <Card
        title="Backups"
        description="Copies of this deployment's files and volumes, stored in a private GitHub repository. Databases and environment variables are not included."
        action={
          <Button size="sm" onClick={() => void backUpNow()} loading={starting} disabled={!canStart}>
            Back up now
          </Button>
        }
      >
        {loadError && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{loadError}</p>}
        {!data && !loadError && <Spinner label="Loading backups..." />}
        {data && !data.configured && (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Backups are not set up on this platform yet (no GitHub backup token is configured). Ask an administrator.
          </p>
        )}
        {data && data.configured && anyActive && <p className="mb-4 text-xs text-text-muted">A backup or restore is running. This page updates automatically.</p>}

        {data && data.backups.length === 0 && data.configured && <p className="text-xs text-text-muted">No backups yet. Use &quot;Back up now&quot; or set a schedule below.</p>}

        {data && data.backups.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 font-mono uppercase text-text-muted">
                <tr>
                  <th className="p-2">When</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Contents</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.backups.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="p-2 whitespace-nowrap">{when(b.createdAt)}</td>
                    <td className="p-2">{TRIGGER_LABEL[b.trigger]}</td>
                    <td className="p-2">
                      <StatusPill backup={b} />
                      {b.status === 'in_progress' && b.phase && <p className="mt-1 max-w-[18rem] text-[11px] text-text-muted">{b.phase}</p>}
                      {b.status === 'completed' && b.phase && <p className="mt-1 max-w-[18rem] text-[11px] text-amber-200">{b.phase}</p>}
                      {b.status === 'failed' && b.error && <p className="mt-1 max-w-[22rem] text-[11px] text-red-300">{b.error}</p>}
                      {b.restore && (
                        <p
                          className={`mt-2 max-w-[22rem] rounded-lg border px-2 py-1 text-[11px] ${
                            b.restore.status === 'failed'
                              ? 'border-red-500/30 bg-red-500/10 text-red-300'
                              : b.restore.status === 'completed'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan'
                          }`}
                        >
                          {b.restore.status === 'in_progress' && `Restoring: ${b.restore.phase ?? 'working'}`}
                          {b.restore.status === 'completed' && `Restored ${when(b.restore.finishedAt)}. ${b.restore.phase ?? ''}`}
                          {b.restore.status === 'failed' && `Restore failed: ${b.restore.error ?? 'unknown error'}`}
                        </p>
                      )}
                    </td>
                    <td className="p-2">
                      {b.status === 'completed' ? (
                        <>
                          {formatBytes(b.sizeBytes)}
                          <div className="text-[11px] text-text-muted">{b.components.map(componentLabel).join(', ')}</div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {b.status === 'completed' && (
                        <Button size="xs" variant="secondary" onClick={() => openRestore(b)} disabled={anyActive}>
                          Restore
                        </Button>
                      )}{' '}
                      <Button size="xs" variant="danger" onClick={() => setDeleteTarget(b)} disabled={isActive(b)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Schedule" description="Back up automatically. Manual backups are never deleted automatically.">
        <form onSubmit={savePolicy} className="space-y-4">
          <label className="flex items-center gap-2 text-xs text-white">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                policyTouched.current = true;
                setEnabled(e.target.checked);
              }}
              disabled={!data?.configured}
            />
            Back up automatically
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-xs text-text-muted">
              Every
              <select
                value={intervalHours}
                onChange={(e) => {
                  policyTouched.current = true;
                  setIntervalHours(Number(e.target.value));
                }}
                disabled={!enabled}
                className="mt-1 block w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white"
              >
                {INTERVALS.map((h) => (
                  <option key={h} value={h}>
                    {h === 1 ? 'hour' : h < 24 ? `${h} hours` : h === 24 ? 'day' : h === 168 ? 'week' : `${h} hours`}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-text-muted">
              Keep the latest
              <input
                type="number"
                min={1}
                max={30}
                value={retention}
                onChange={(e) => {
                  policyTouched.current = true;
                  setRetention(Math.min(30, Math.max(1, Number(e.target.value) || 1)));
                }}
                disabled={!enabled}
                className="mt-1 block w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-white"
              />
              <span className="text-[11px]">scheduled backups (older ones are deleted)</span>
            </label>
          </div>
          {policy && (
            <div className="space-y-1 text-[11px] text-text-muted">
              {policy.enabled && policy.nextRunAt && <p>Next backup: {when(policy.nextRunAt)}</p>}
              {policy.lastRunAt && <p>Last scheduled run: {when(policy.lastRunAt)} ({policy.lastStatus ?? 'unknown'})</p>}
              {policy.consecutiveFailures > 0 && policy.enabled && (
                <p className="text-amber-200">The last {policy.consecutiveFailures} scheduled run(s) failed. It retries with increasing delay and turns itself off after 5 failures in a row.</p>
              )}
              {!policy.enabled && policy.consecutiveFailures >= 5 && (
                <p className="text-red-300">Scheduled backups were turned off after 5 failures in a row. Fix the problem shown on the failed backups, then turn them back on.</p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={savingPolicy} disabled={!data?.configured}>
              Save schedule
            </Button>
          </div>
        </form>
      </Card>

      <Modal open={restoreTarget !== null} onClose={() => (restoring ? undefined : setRestoreTarget(null))} title="Restore from this backup" width="max-w-lg">
        {restoreTarget && (
          <div className="space-y-4 text-xs">
            <p className="text-text-muted">
              Files from <span className="text-white">{when(restoreTarget.createdAt)}</span> replace what is on the node now. The app is stopped while this happens and started again afterwards.
            </p>

            <fieldset className="space-y-2">
              <legend className="mb-1 font-semibold text-white">What to restore</legend>
              {restoreTarget.components.map((c) => {
                const key = componentKey(c);
                return (
                  <label key={key} className="flex items-center gap-2 text-text-muted">
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(key);
                        else next.delete(key);
                        setSelected(next);
                      }}
                    />
                    {componentLabel(c)} ({formatBytes(c.sizeBytes)})
                  </label>
                );
              })}
            </fieldset>

            {workspaceSelected && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">Restoring workspace files does not rebuild the app. Redeploy afterwards to run the restored code.</p>}

            <label className="flex items-start gap-2 text-text-muted">
              <input type="checkbox" checked={skipSafety} onChange={(e) => setSkipSafety(e.target.checked)} className="mt-0.5" />
              <span>
                Skip the safety copy. Normally the current state is backed up first so this restore can be undone.
                {skipSafety && <span className="mt-1 block text-red-300">Without it, anything on the node that is not in this backup is lost for good.</span>}
              </span>
            </label>

            <div className="space-y-2">
              <label htmlFor="restore-confirm" className="block font-semibold text-white">
                Type <code className="font-mono text-accent-cyan">{confirmName}</code> to confirm
              </label>
              <input
                id="restore-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 font-mono text-white focus:outline-none"
              />
            </div>

            {restoreError && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300">{restoreError}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(null)} disabled={restoring}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" loading={restoring} disabled={!confirmOk || selected.size === 0 || restoreBusy} onClick={() => void submitRestore()}>
                Restore
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteBackup}
        title="Delete this backup?"
        danger
        confirmLabel="Delete backup"
        message="It is removed permanently, including its copy on GitHub. This cannot be undone."
      />
    </div>
  );
}
