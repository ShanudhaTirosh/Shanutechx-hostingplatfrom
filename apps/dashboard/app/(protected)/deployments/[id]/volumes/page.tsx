'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, Button, useToast, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Volume {
  id: string;
  name: string;
  hostPath: string;
  containerPath: string;
  sizeGb: number;
  createdAt: string;
}

export default function PersistentVolumesPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const { toast } = useToast();

  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);

  // New Volume inputs
  const [name, setName] = useState('');
  const [containerPath, setContainerPath] = useState('/data');
  const [sizeGb, setSizeGb] = useState(5);
  const [attaching, setAttaching] = useState(false);

  async function loadVolumes() {
    setLoading(true);
    try {
      const res = await api.get(`/deployments/${deploymentId}/volumes`);
      setVolumes(res.volumes || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load persistent volumes', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVolumes();
  }, [deploymentId]);

  async function handleAttachVolume(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !containerPath.trim()) return;
    setAttaching(true);
    try {
      await api.post(`/deployments/${deploymentId}/volumes`, {
        name: name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        containerPath: containerPath.trim(),
        sizeGb: Number(sizeGb) || 5,
      });
      toast('Persistent disk volume attached successfully!', 'success');
      setName('');
      setContainerPath('/data');
      await loadVolumes();
    } catch (err: any) {
      toast(err.message || 'Failed to attach persistent volume', 'error');
    } finally {
      setAttaching(false);
    }
  }

  async function handleDetachVolume(volumeId: string) {
    try {
      await api.delete(`/deployments/${deploymentId}/volumes/${volumeId}`);
      toast('Persistent volume detached.', 'info');
      await loadVolumes();
    } catch (err: any) {
      toast(err.message || 'Failed to detach volume', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Persistent Storage & Disks"
          description="Attach persistent disk volumes (`hostPath` ↔ `containerPath`) that survive redeployments and container restarts."
        />
        <Button variant="secondary" size="sm" onClick={() => router.push(`/deployments/${deploymentId}`)} className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Deployment</span>
        </Button>
      </div>

      <Card title="Attach Persistent Disk Volume" description="Specify a mount path inside the container for permanent file storage (e.g., SQLite databases, uploads).">
        <form onSubmit={handleAttachVolume} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Volume Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. data-volume"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Container Mount Path</label>
            <input
              type="text"
              required
              value={containerPath}
              onChange={(e) => setContainerPath(e.target.value)}
              placeholder="e.g. /data or /var/lib/uploads"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Disk Size (GB)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={sizeGb}
              onChange={(e) => setSizeGb(Number(e.target.value))}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" size="sm" loading={attaching} className="w-full flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Attach Disk Volume</span>
            </Button>
          </div>
        </form>

        {volumes.length === 0 ? (
          <p className="text-xs text-text-faint italic py-4 text-center">No persistent disk volumes attached.</p>
        ) : (
          <div className="space-y-3">
            {volumes.map((vol) => (
              <div key={vol.id} className="p-4 border border-white/10 rounded-xl bg-black/40 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{vol.name}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-accent-cyan/20 text-accent-cyan">{vol.sizeGb} GB</span>
                  </div>
                  <p className="text-xs font-mono text-text-muted">Mounted at: <span className="text-white">{vol.containerPath}</span> (Host: {vol.hostPath})</p>
                </div>
                <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDetachVolume(vol.id)}>
                  Detach Disk
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
