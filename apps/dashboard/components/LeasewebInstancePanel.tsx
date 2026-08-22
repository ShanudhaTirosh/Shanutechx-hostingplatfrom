'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Badge } from '@/components/ui';

interface Props {
  kind: 'provision' | 'node';
  id: string;
}

/**
 * Real Leaseweb-API-backed management for a VPS the admin/dev has already
 * purchased and linked (imported) — as opposed to the older pure
 * manual-handoff fields (panelUrl/username/credentialRef) still shown by
 * the VPS page for any non-Leaseweb provider.
 */
export default function LeasewebInstancePanel({ kind, id }: Props) {
  const [instance, setInstance] = useState<any>(null);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [snapshots, setSnapshots] = useState<any[] | null>(null);
  const [snapshotName, setSnapshotName] = useState('');

  function load() {
    api.leaseweb
      .instance(kind, id)
      .then((d) => {
        setInstance(d.instance);
        setMonitoring(d.monitoring);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, [kind, id]);

  async function handlePower(action: 'start' | 'stop' | 'reboot') {
    if (action === 'stop' && !confirm('Stop this VPS? Anything running on it will go offline.')) return;
    if (action === 'reboot' && !confirm('Reboot this VPS now?')) return;

    setBusyAction(action);
    setError(null);
    try {
      await api.leaseweb.power(kind, id, action);
      setTimeout(load, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConsole() {
    try {
      const { url } = await api.leaseweb.console(kind, id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRevealCredentials() {
    try {
      const result = await api.leaseweb.credentials(kind, id);
      setCreds(result);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleLoadSnapshots() {
    try {
      const { snapshots } = await api.leaseweb.snapshots(kind, id);
      setSnapshots(snapshots);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateSnapshot(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.leaseweb.createSnapshot(kind, id, snapshotName);
      setSnapshotName('');
      handleLoadSnapshots();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (error) return <p className="text-xs text-red-400">{error}</p>;
  if (!instance) return <p className="text-text-muted text-xs">Loading Leaseweb status...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{instance.ips?.[0]?.ip ?? 'No IP yet'}</p>
          {monitoring && <p className="text-text-muted text-xs">Monitoring: {monitoring.status}</p>}
        </div>
        <Badge status={instance.state?.toLowerCase() ?? 'unknown'} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" disabled={busyAction === 'start'} onClick={() => handlePower('start')}>
          {busyAction === 'start' ? 'Starting...' : 'Start'}
        </Button>
        <Button variant="danger" disabled={busyAction === 'stop'} onClick={() => handlePower('stop')}>
          {busyAction === 'stop' ? 'Stopping...' : 'Stop'}
        </Button>
        <Button variant="secondary" disabled={busyAction === 'reboot'} onClick={() => handlePower('reboot')}>
          {busyAction === 'reboot' ? 'Rebooting...' : 'Reboot'}
        </Button>
        <Button variant="ghost" onClick={handleConsole}>
          Open console
        </Button>
      </div>

      <div>
        {creds ? (
          <div className="text-xs bg-black/30 rounded-lg p-3 space-y-1">
            <p>Username: {creds.username}</p>
            <p className="select-all">Password: {creds.password}</p>
          </div>
        ) : (
          <Button variant="ghost" onClick={handleRevealCredentials}>
            Reveal OS credentials
          </Button>
        )}
      </div>

      <div>
        {snapshots === null ? (
          <Button variant="ghost" onClick={handleLoadSnapshots}>
            Show snapshots
          </Button>
        ) : (
          <div className="space-y-2">
            {snapshots.length === 0 && <p className="text-text-muted text-xs">No snapshots yet.</p>}
            {snapshots.map((s) => (
              <p key={s.id} className="text-xs text-text-muted">
                {s.id} · {new Date(s.createdAt).toLocaleString()}
              </p>
            ))}
            <form onSubmit={handleCreateSnapshot} className="flex gap-2">
              <input
                required
                placeholder="Snapshot name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs placeholder:text-text-muted focus:outline-none focus:border-accent-violet/50"
              />
              <Button type="submit">Create snapshot</Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
