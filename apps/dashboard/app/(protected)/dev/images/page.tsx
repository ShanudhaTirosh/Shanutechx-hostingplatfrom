'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Node } from '@/lib/types';
import {
  Card,
  Button,
  Badge,
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

interface DockerImage {
  id: string;
  parentId: string;
  repoTags: string[];
  repoDigests: string[];
  created: number;
  size: number;
  virtualSize: number;
  labels: Record<string, string> | null;
}

export default function DevImagesPage() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [images, setImages] = useState<DockerImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [pullModalOpen, setPullModalOpen] = useState(false);
  const [pullImageName, setPullImageName] = useState('');
  const [pullTag, setPullTag] = useState('latest');
  const [pulling, setPulling] = useState(false);

  const [inspectImage, setInspectImage] = useState<DockerImage | null>(null);
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

  function loadImages(nodeId: string) {
    setImages(null);
    api.dockerImages
      .list(nodeId)
      .then((d) => setImages(d.images))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (selectedNodeId) loadImages(selectedNodeId);
  }, [selectedNodeId]);

  const stats = useMemo(() => {
    if (!images) return { total: 0, totalSizeMb: 0, dangling: 0 };
    const size = images.reduce((acc, img) => acc + (img.size || 0), 0) / (1024 * 1024);
    const dangling = images.filter((img) => !img.repoTags || img.repoTags.includes('<none>:<none>')).length;
    return {
      total: images.length,
      totalSizeMb: Math.round(size),
      dangling,
    };
  }, [images]);

  const filteredImages = useMemo(() => {
    if (!images) return [];
    return images.filter((img) => {
      const tags = (img.repoTags || []).join(' ');
      return tags.toLowerCase().includes(searchQuery.toLowerCase()) || img.id.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [images, searchQuery]);

  async function handlePullImage() {
    if (!selectedNodeId || !pullImageName.trim()) return;
    setPulling(true);
    try {
      await api.dockerImages.pull(selectedNodeId, pullImageName.trim(), pullTag.trim() || 'latest');
      toast(`Successfully pulled image ${pullImageName}:${pullTag}`, 'success');
      setPullModalOpen(false);
      setPullImageName('');
      loadImages(selectedNodeId);
    } catch (err: any) {
      toast(`Failed to pull image: ${err.message}`, 'error');
    } finally {
      setPulling(false);
    }
  }

  async function handleRemoveImage(img: DockerImage, force = false) {
    if (!selectedNodeId) return;
    setBusyId(img.id);
    try {
      await api.dockerImages.remove(selectedNodeId, img.id, force);
      toast('Image removed successfully.', 'success');
      loadImages(selectedNodeId);
    } catch (err: any) {
      toast(`Failed to remove image: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePruneImages() {
    if (!selectedNodeId) return;
    try {
      const res = await api.dockerImages.prune(selectedNodeId);
      toast(`Pruned unused images. Space reclaimed: ${Math.round((res.SpaceReclaimed || 0) / (1024 * 1024))} MB`, 'success');
      loadImages(selectedNodeId);
    } catch (err: any) {
      toast(`Prune failed: ${err.message}`, 'error');
    }
  }

  async function handleInspect(img: DockerImage) {
    if (!selectedNodeId) return;
    setInspectImage(img);
    setInspectData(null);
    try {
      const res = await api.dockerImages.inspect(selectedNodeId, img.id);
      setInspectData(res);
    } catch (err: any) {
      toast(`Failed to inspect image: ${err.message}`, 'error');
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Docker Images"
        description="View, pull, prune and manage container image repository tags on target compute nodes."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handlePruneImages}>
              Prune Unused
            </Button>
            <Button size="sm" variant="glow" onClick={() => setPullModalOpen(true)}>
              Pull Image
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Node selector tabs */}
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
      {images && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Total Images" value={stats.total} change="Stored on disk" />
          <MetricCard title="Storage Consumed" value={`${stats.totalSizeMb} MB`} change="Total virtual size" />
          <MetricCard
            title="Dangling / Untagged"
            value={stats.dangling}
            change={stats.dangling > 0 ? 'Safe to prune' : 'Clean engine'}
            changeType={stats.dangling > 0 ? 'negative' : 'positive'}
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="max-w-md">
        <Input
          placeholder="Search by repository name or image ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {images === null && selectedNodeId && <Spinner label="Loading Docker images..." />}
      {images?.length === 0 && <EmptyState message="No Docker images found on target node." />}

      {/* Images List */}
      <div className="space-y-3">
        {filteredImages.map((img) => (
          <Card key={img.id} className="glass-card hover:border-white/20 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {(img.repoTags && img.repoTags.length > 0 ? img.repoTags : ['<none>:<none>']).map((tag, idx) => (
                    <span
                      key={idx}
                      className="font-bold text-white text-sm font-mono bg-white/[0.06] px-2.5 py-1 rounded-xl border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-[11px] font-mono text-text-faint bg-white/[0.04] px-2 py-0.5 rounded">
                    {img.id.substring(7, 19)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>Size: {formatBytes(img.size)}</span>
                  <span>•</span>
                  <span>Created: {new Date(img.created * 1000).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="xs" variant="ghost" onClick={() => handleInspect(img)}>
                  Inspect
                </Button>
                <Button
                  size="xs"
                  variant="danger"
                  loading={busyId === img.id}
                  onClick={() => handleRemoveImage(img)}
                >
                  Delete
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-red-400"
                  onClick={() => handleRemoveImage(img, true)}
                >
                  Force Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pull Image Modal */}
      <Modal open={pullModalOpen} onClose={() => setPullModalOpen(false)} title="Pull Docker Image from Registry">
        <div className="space-y-4 pt-2">
          <Input
            label="Image Name (e.g. nginx, redis, postgres, ghcr.io/org/repo)"
            placeholder="nginx"
            value={pullImageName}
            onChange={(e) => setPullImageName(e.target.value)}
          />
          <Input
            label="Tag"
            placeholder="latest"
            value={pullTag}
            onChange={(e) => setPullTag(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setPullModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="glow" loading={pulling} onClick={handlePullImage}>
              Pull Image
            </Button>
          </div>
        </div>
      </Modal>

      {/* Inspect Modal */}
      <Modal open={!!inspectImage} onClose={() => setInspectImage(null)} title={`Image Metadata — ${inspectImage?.id.substring(7, 19)}`} width="max-w-4xl">
        <pre className="bg-black/60 rounded-2xl p-4 text-[11px] font-mono text-cyan-300 max-h-[65vh] overflow-auto whitespace-pre-wrap border border-white/10">
          {inspectData ? JSON.stringify(inspectData, null, 2) : 'Fetching image manifest...'}
        </pre>
      </Modal>
    </div>
  );
}
