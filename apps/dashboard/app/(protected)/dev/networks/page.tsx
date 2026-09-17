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

interface DockerNetwork {
  Id: string;
  Name: string;
  Driver: string;
  Scope: string;
  EnableIPv6?: boolean;
  IPAM?: {
    Driver: string;
    Config?: Array<{ Subnet?: string; Gateway?: string }>;
  };
  Internal?: boolean;
  Attachable?: boolean;
  Containers?: Record<string, { Name: string; EndpointID: string; MacAddress: string; IPv4Address: string; IPv6Address: string }>;
}

export default function DevNetworksPage() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<DockerNetwork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [netName, setNetName] = useState('');
  const [netDriver, setNetDriver] = useState('bridge');
  const [creating, setCreating] = useState(false);

  const [inspectNetwork, setInspectNetwork] = useState<DockerNetwork | null>(null);
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

  function loadNetworks(nodeId: string) {
    setNetworks(null);
    api.dockerNetworks
      .list(nodeId)
      .then((d) => setNetworks(d.networks))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (selectedNodeId) loadNetworks(selectedNodeId);
  }, [selectedNodeId]);

  const filteredNetworks = useMemo(() => {
    if (!networks) return [];
    return networks.filter((n) =>
      n.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.Driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.Id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [networks, searchQuery]);

  async function handleCreateNetwork() {
    if (!selectedNodeId || !netName.trim()) return;
    setCreating(true);
    try {
      await api.dockerNetworks.create(selectedNodeId, netName.trim(), netDriver);
      toast(`Network ${netName} created successfully.`, 'success');
      setCreateModalOpen(false);
      setNetName('');
      loadNetworks(selectedNodeId);
    } catch (err: any) {
      toast(`Failed to create network: ${err.message}`, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRemoveNetwork(net: DockerNetwork) {
    if (!selectedNodeId) return;
    setBusyId(net.Id);
    try {
      await api.dockerNetworks.remove(selectedNodeId, net.Id);
      toast(`Network ${net.Name} removed.`, 'success');
      loadNetworks(selectedNodeId);
    } catch (err: any) {
      toast(`Failed to remove network: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePruneNetworks() {
    if (!selectedNodeId) return;
    try {
      const res = await api.dockerNetworks.prune(selectedNodeId);
      toast(`Pruned unused networks. Deleted: ${res.NetworksDeleted?.length || 0}`, 'success');
      loadNetworks(selectedNodeId);
    } catch (err: any) {
      toast(`Prune failed: ${err.message}`, 'error');
    }
  }

  async function handleInspect(net: DockerNetwork) {
    if (!selectedNodeId) return;
    setInspectNetwork(net);
    setInspectData(null);
    try {
      const res = await api.dockerNetworks.inspect(selectedNodeId, net.Id);
      setInspectData(res);
    } catch (err: any) {
      toast(`Failed to inspect network: ${err.message}`, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Docker Networks"
        description="Virtual bridge, overlay, and host networks isolating containers on host nodes."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handlePruneNetworks}>
              Prune Unused
            </Button>
            <Button size="sm" variant="glow" onClick={() => setCreateModalOpen(true)}>
              Create Network
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
      {networks && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Total Networks" value={networks.length} change="Isolated Subnets" />
          <MetricCard
            title="Bridge Networks"
            value={networks.filter((n) => n.Driver === 'bridge').length}
            change="Host bridge interfaces"
          />
          <MetricCard
            title="Overlay / Custom"
            value={networks.filter((n) => n.Driver !== 'bridge' && n.Driver !== 'host' && n.Driver !== 'null').length}
            change="Multi-host swarm/overlay"
          />
        </div>
      )}

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search networks by name or driver..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {networks === null && selectedNodeId && <Spinner label="Loading networks..." />}
      {networks?.length === 0 && <EmptyState message="No Docker networks found on target node." />}

      {/* Networks List */}
      <div className="space-y-3">
        {filteredNetworks.map((net) => (
          <Card key={net.Id} className="glass-card hover:border-white/20 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base font-mono truncate">{net.Name}</span>
                  <span className="text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-lg">
                    {net.Driver}
                  </span>
                  <span className="text-[11px] font-mono text-text-faint bg-white/[0.04] px-2 py-0.5 rounded">
                    {net.Id.substring(0, 12)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                  <span>Scope: {net.Scope}</span>
                  {net.IPAM?.Config?.[0]?.Subnet && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-emerald-400">Subnet: {net.IPAM.Config[0].Subnet}</span>
                    </>
                  )}
                  {net.Containers && (
                    <>
                      <span>•</span>
                      <span>Connected: {Object.keys(net.Containers).length} containers</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="xs" variant="ghost" onClick={() => handleInspect(net)}>
                  Inspect
                </Button>
                {['bridge', 'host', 'none'].includes(net.Name) ? (
                  <span className="text-[10px] text-text-faint uppercase px-2 font-bold">System Default</span>
                ) : (
                  <Button
                    size="xs"
                    variant="danger"
                    loading={busyId === net.Id}
                    onClick={() => handleRemoveNetwork(net)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Docker Network">
        <div className="space-y-4 pt-2">
          <Input
            label="Network Name"
            placeholder="stx_network"
            value={netName}
            onChange={(e) => setNetName(e.target.value)}
          />
          <Input
            label="Driver"
            placeholder="bridge"
            value={netDriver}
            onChange={(e) => setNetDriver(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="glow" loading={creating} onClick={handleCreateNetwork}>
              Create Network
            </Button>
          </div>
        </div>
      </Modal>

      {/* Inspect Modal */}
      <Modal open={!!inspectNetwork} onClose={() => setInspectNetwork(null)} title={`Network Details — ${inspectNetwork?.Name}`} width="max-w-4xl">
        <pre className="bg-black/60 rounded-2xl p-4 text-[11px] font-mono text-emerald-400 max-h-[65vh] overflow-auto whitespace-pre-wrap border border-white/10">
          {inspectData ? JSON.stringify(inspectData, null, 2) : 'Loading network topology...'}
        </pre>
      </Modal>
    </div>
  );
}
