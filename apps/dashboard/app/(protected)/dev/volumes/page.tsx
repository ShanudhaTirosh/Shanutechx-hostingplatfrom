'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Node } from '@/lib/types';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  useToast,
  Modal,
  Input,
  MetricCard,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  CreatedAt?: string;
  Labels?: Record<string, string> | null;
  Scope?: string;
}

export default function DevVolumesPage() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<DockerVolume[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newVolName, setNewVolName] = useState('');
  const [newVolDriver, setNewVolDriver] = useState('local');
  const [creating, setCreating] = useState(false);

  const [inspectVolume, setInspectVolume] = useState<DockerVolume | null>(null);
  const [inspectData, setInspectData] = useState<any>(null);

  const { toast } = useToast();

  useEffect(() => {
    api.nodes
      .list()
      .then((d) => {
        setNodes(d.nodes);
        if (d.nodes.length > 0) setSelectedNodeId(d.nodes[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  function loadVolumes(nodeId: string) {
    setVolumes(null);
    api.dockerVolumes
      .list(nodeId)
      .then((d) => setVolumes(d.volumes))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (selectedNodeId) loadVolumes(selectedNodeId);
  }, [selectedNodeId]);

  const filteredVolumes = useMemo(() => {
    if (!volumes) return [];
    return volumes.filter((v) =>
      v.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.Driver.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [volumes, searchQuery]);

  async function handleCreateVolume() {
    if (!selectedNodeId || !newVolName.trim()) return;
    setCreating(true);
    try {
      await api.dockerVolumes.create(selectedNodeId, newVolName.trim(), newVolDriver);
      toast(`Volume ${newVolName} created successfully.`, 'success');
      setCreateModalOpen(false);
      setNewVolName('');
      loadVolumes(selectedNodeId);
    } catch (err: any) {
      toast(`Failed to create volume: ${err.message}`, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRemoveVolume(vol: DockerVolume) {
    if (!selectedNodeId) return;
    setBusyName(vol.Name);
    try {
      await api.dockerVolumes.remove(selectedNodeId, vol.Name);
      toast(`Volume ${vol.Name} removed.`, 'success');
      loadVolumes(selectedNodeId);
    } catch (err: any) {
      toast(`Failed to remove volume: ${err.message}`, 'error');
    } finally {
      setBusyName(null);
    }
  }

  async function handlePruneVolumes() {
    if (!selectedNodeId) return;
    try {
      const res = await api.dockerVolumes.prune(selectedNodeId);
      toast(`Pruned unused volumes. Reclaimed count: ${res.VolumesDeleted?.length || 0}`, 'success');
      loadVolumes(selectedNodeId);
    } catch (err: any) {
      toast(`Prune failed: ${err.message}`, 'error');
    }
  }

  async function handleInspect(vol: DockerVolume) {
    if (!selectedNodeId) return;
    setInspectVolume(vol);
    setInspectData(null);
    try {
      const res = await api.dockerVolumes.inspect(selectedNodeId, vol.Name);
      setInspectData(res);
    } catch (err: any) {
      toast(`Failed to inspect volume: ${err.message}`, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Docker Volumes"
        description="Persistent data storage volumes attached to compute nodes and application containers."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handlePruneVolumes}>
              Prune Unused
            </Button>
            <Button size="sm" variant="glow" onClick={() => setCreateModalOpen(true)}>
              Create Volume
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Node Selector */}
      {nodes && nodes.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center glass p-2 rounded-2xl border border-white/[0.06]">
          <span className="text-xs font-semibold text-text-muted px-2 uppercase tracking-wider">Node:</span>
          {nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedNodeId(n.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                selectedNodeId === n.id
                  ? 'bg-brand-gradient text-white shadow-glow-violet'
                  : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.08]'
              }`}
            >
              {n.label} <span className="text-[10px] opacity-70">({n.ip})</span>
            </button>
          ))}
        </div>
      )}

      {/* Metrics */}
      {volumes && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard title="Total Storage Volumes" value={volumes.length} change="Persistent mounts" />
          <MetricCard
            title="Driver Engine"
            value="Local Block Storage"
            change="POSIX-compliant volume driver"
          />
        </div>
      )}

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search volumes by name or driver..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {volumes === null && selectedNodeId && <Spinner label="Loading volumes..." />}
      {volumes?.length === 0 && <EmptyState message="No Docker volumes found on target node." />}

      {/* Volumes List */}
      <div className="space-y-3">
        {filteredVolumes.map((vol) => (
          <Card key={vol.Name} className="glass-card hover:border-white/20 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base font-mono truncate">{vol.Name}</span>
                  <span className="text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-0.5 rounded-lg">
                    {vol.Driver}
                  </span>
                </div>
                <p className="text-xs font-mono text-text-muted truncate">Mountpoint: {vol.Mountpoint}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="xs" variant="ghost" onClick={() => handleInspect(vol)}>
                  Inspect
                </Button>
                <Button
                  size="xs"
                  variant="danger"
                  loading={busyName === vol.Name}
                  onClick={() => handleRemoveVolume(vol)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Volume Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Docker Storage Volume">
        <div className="space-y-4 pt-2">
          <Input
            label="Volume Name"
            placeholder="pgdata_stx"
            value={newVolName}
            onChange={(e) => setNewVolName(e.target.value)}
          />
          <Input
            label="Driver"
            placeholder="local"
            value={newVolDriver}
            onChange={(e) => setNewVolDriver(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="glow" loading={creating} onClick={handleCreateVolume}>
              Create Volume
            </Button>
          </div>
        </div>
      </Modal>

      {/* Inspect Modal */}
      <Modal open={!!inspectVolume} onClose={() => setInspectVolume(null)} title={`Volume Details — ${inspectVolume?.Name}`} width="max-w-4xl">
        <pre className="bg-black/60 rounded-2xl p-4 text-[11px] font-mono text-amber-300 max-h-[65vh] overflow-auto whitespace-pre-wrap border border-white/10">
          {inspectData ? JSON.stringify(inspectData, null, 2) : 'Loading volume manifest...'}
        </pre>
      </Modal>
    </div>
  );
}
