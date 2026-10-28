'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Node } from '@/lib/types';
import { streamAuthedEvents, logLineFromEvent, StreamHandle } from '@/lib/sse';
import dynamic from 'next/dynamic';
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
  ProgressBar,
  ConfirmDialog,
} from '@/components/ui';
import { NodeEngineControlPanel } from '@/components/NodeEngineControlPanel';
import { JobProgressBar } from '@/components/jobs/JobProgressBar';

const SshTerminal = dynamic(
  () => import('@/components/SshTerminal').then((m) => m.SshTerminal),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-text-muted text-sm animate-pulse">Loading Web SSH terminal...</div> }
);

export type ConnectorTab = 'nodes' | 'containers' | 'images' | 'volumes' | 'networks' | 'ports' | 'system' | 'terminal';

interface NodeContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  createdAt: number;
  ports: Array<{ privatePort: number; publicPort?: number; type: string }>;
}

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

interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  CreatedAt?: string;
  Labels?: Record<string, string> | null;
  Scope?: string;
}

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

const ROLE_TAG_OPTIONS = [
  'web-hosting',
  'node-hosting',
  'python-hosting',
  'discordbot-python',
  'discordbot-node',
  'livekit',
];

// Icons
function ServerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  );
}

function ContainerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12H2"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      <line x1="6" y1="16" x2="6.01" y2="16"/>
      <line x1="10" y1="16" x2="10.01" y2="16"/>
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="6" height="6" rx="1"/>
      <rect x="14" y="14" width="6" height="6" rx="1"/>
      <path d="M7 10v4a3 3 0 0 0 3 3h4m0-10h-4a3 3 0 0 0-3 3"/>
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      <path d="M3 12h18"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

interface UnifiedConnectorsHubProps {
  defaultTab?: ConnectorTab;
}

function UnifiedConnectorsHubContent({ defaultTab = 'containers' }: UnifiedConnectorsHubProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get('tab') as ConnectorTab | null;
  const activeTab: ConnectorTab = tabParam || defaultTab;

  function setActiveTab(newTab: ConnectorTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Common Node Data
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodesError, setNodesError] = useState<string | null>(null);

  const { toast } = useToast();

  function loadNodes() {
    api.nodes
      .list()
      .then((data) => {
        setNodes(data.nodes);
        if (data.nodes.length > 0 && !selectedNodeId) {
          setSelectedNodeId(data.nodes[0].id);
        }
      })
      .catch((err) => setNodesError(err.message));
  }

  useEffect(() => {
    loadNodes();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Connector & Docker Engine Hub"
        description="Unified management hub for VPS compute nodes, SSH 1-line onboarding, Docker containers, images, volumes, networks, and disk telemetry."
      />

      {nodesError && <ErrorBanner message={nodesError} />}

      {/* Top Tab Switcher */}
      <div className="flex gap-1.5 flex-wrap items-center glass p-2 rounded-2xl border border-white/[0.08] shadow-lg">
        {[
          { id: 'nodes', label: 'Compute Nodes & Onboarding', icon: ServerIcon },
          { id: 'containers', label: 'Containers & Stacks', icon: ContainerIcon },
          { id: 'images', label: 'Docker Images', icon: ImageIcon },
          { id: 'volumes', label: 'Docker Volumes', icon: VolumeIcon },
          { id: 'networks', label: 'Docker Networks', icon: NetworkIcon },
          { id: 'ports', label: 'VPS Ports & Firewall', icon: ShieldIcon },
          { id: 'system', label: 'System & Diagnostics', icon: SystemIcon },
          { id: 'terminal', label: 'Web SSH Terminal', icon: TerminalIcon },
        ].map((t) => {
          const IconComp = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as ConnectorTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-sm scale-[1.02]'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
              }`}
            >
              <IconComp />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Node Selector (For container, image, volume, network, ports, system, terminal tabs) */}
      {activeTab !== 'nodes' && nodes && nodes.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center glass p-2.5 rounded-2xl border border-white/[0.06]">
          <span className="text-xs font-semibold text-text-muted px-2 uppercase tracking-wider flex items-center gap-1.5">
            <ServerIcon /> Selected Compute Node:
          </span>
          {nodes.map((n) => {
            const isSel = selectedNodeId === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setSelectedNodeId(n.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                  isSel
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.08]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {n.label} <span className="text-[10px] opacity-70">({n.ip})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content Views */}
      {activeTab === 'nodes' && (
        <NodesTabView
          nodes={nodes}
          loadNodes={loadNodes}
          onSelectTab={(nId, tab) => {
            setSelectedNodeId(nId);
            setActiveTab(tab);
          }}
        />
      )}
      {activeTab === 'containers' && <ContainersTabView nodeId={selectedNodeId} />}
      {activeTab === 'images' && <ImagesTabView nodeId={selectedNodeId} />}
      {activeTab === 'volumes' && <VolumesTabView nodeId={selectedNodeId} />}
      {activeTab === 'networks' && <NetworksTabView nodeId={selectedNodeId} />}
      {activeTab === 'ports' && <PortsTabView nodeId={selectedNodeId} />}
      {activeTab === 'system' && <SystemTabView nodeId={selectedNodeId} />}
      {activeTab === 'terminal' && (
        <TerminalTabView
          nodeId={selectedNodeId}
          nodeLabel={nodes?.find((n) => n.id === selectedNodeId)?.label}
        />
      )}
    </div>
  );
}

export function UnifiedConnectorsHub(props: UnifiedConnectorsHubProps) {
  return (
    <Suspense fallback={<Spinner label="Loading Connector & Docker Hub..." />}>
      <UnifiedConnectorsHubContent {...props} />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: COMPUTE NODES & SSH ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
function NodesTabView({
  nodes,
  loadNodes,
  onSelectTab,
}: {
  nodes: Node[] | null;
  loadNodes: () => void;
  onSelectTab: (nodeId: string, tab: ConnectorTab) => void;
}) {
  return (
    <div className="space-y-6">
      <NodeOnboardingSection onCreated={loadNodes} />

      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
          Registered Cluster Compute Nodes ({nodes?.length || 0})
        </h2>

        {nodes === null && <Spinner label="Loading compute nodes..." />}
        {nodes?.length === 0 && <EmptyState message="No nodes registered yet — add or provision a node above." />}

        <div className="grid md:grid-cols-2 gap-4">
          {nodes?.map((node) => (
            <NodeCard key={node.id} node={node} onSelectTab={onSelectTab} onRefresh={loadNodes} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  onSelectTab,
  onRefresh,
}: {
  node: Node;
  onSelectTab: (nodeId: string, tab: ConnectorTab) => void;
  onRefresh?: () => void;
}) {
  const stale = !node.lastSeenAt || Date.now() - new Date(node.lastSeenAt).getTime() > 5 * 60 * 1000;
  const [showNodeEngine, setShowNodeEngine] = useState(false);
  const [failoverBusy, setFailoverBusy] = useState(false);
  const [cordonBusy, setCordonBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { toast } = useToast();

  const isCordoned = node.status === 'maintenance' || node.isSchedulable === false;

  async function handleFailover() {
    if (!confirm(`Are you sure you want to evacuate node "${node.label}"? All containers and databases will be migrated to healthy target nodes in real-time.`)) {
      return;
    }

    setFailoverBusy(true);
    try {
      const res = await api.nodes.triggerFailover(node.id);
      toast(res.message || 'Node evacuation & failover completed!', 'success');
    } catch (err: any) {
      toast(err.message || 'Node failover failed', 'error');
    } finally {
      setFailoverBusy(false);
    }
  }

  async function handleToggleCordon() {
    setCordonBusy(true);
    try {
      if (isCordoned) {
        await api.nodes.uncordon(node.id);
        toast(`Node "${node.label}" uncordoned and ready for scheduling`, 'success');
      } else {
        await api.nodes.cordon(node.id, 'Manual administrative cordon');
        toast(`Node "${node.label}" cordoned (maintenance mode)`, 'success');
      }
      onRefresh?.();
    } catch (err: any) {
      toast(err.message || 'Failed to toggle cordon status', 'error');
    } finally {
      setCordonBusy(false);
    }
  }

  async function handleDeleteNode() {
    if (!confirm(`Are you sure you want to remove node "${node.label}" from cluster? Deletion will be blocked if active customer workloads exist on this node.`)) {
      return;
    }
    setDeleteBusy(true);
    try {
      await api.nodes.deleteNode(node.id);
      toast(`Node "${node.label}" deleted successfully`, 'success');
      onRefresh?.();
    } catch (err: any) {
      toast(err.message || 'Cannot delete node: active customer workloads exist', 'error');
    } finally {
      setDeleteBusy(false);
    }
  }

  const getNodeStatusBadge = () => {
    const status = node.status || (node.isActive && !stale ? 'online' : 'offline');
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        );
      case 'installing':
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            {status}
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Cordoned
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Degraded
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/5 text-text-muted border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
            Offline
          </span>
        );
    }
  };

  return (
    <Card className="border border-white/[0.06] hover:border-white/12 transition-all flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${node.isActive && !stale ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-text-muted'}`}>
              <ServerIcon />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2">
                {node.label}
                {isCordoned && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20">
                    MAINTENANCE
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                <span>{node.provider || 'VPS Node'}</span>
                <span>•</span>
                <span>{node.region || 'Default Region'}</span>
                <span>•</span>
                <span>{node.os || 'Linux'}</span>
              </div>
            </div>
          </div>
          {getNodeStatusBadge()}
        </div>

        <p className="text-text-muted font-mono text-xs mb-3 bg-white/[0.02] inline-block px-2.5 py-1 rounded-lg border border-white/[0.04]">{node.ip}</p>

        <div className="flex flex-wrap gap-1 mb-4">
          {node.roleTags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium bg-accent-violet/10 text-accent-violet-light rounded-full px-2 py-0.5 capitalize">
              {tag.replace(/-/g, ' ')}
            </span>
          ))}
        </div>

        <div className="space-y-3 mt-4 border-t border-white/[0.04] pt-4">
          <Stat label="CPU Utilization" value={node.cpuUsedPct} unit="%" max={100} />
          <Stat label="RAM Memory" value={node.ramUsedMb} unit=" MB" max={node.ramMb} />
          <Stat label="Disk Space" value={node.diskUsedGb} unit=" GB" max={node.diskGb} />
        </div>
      </div>

      {/* Quick Access Action Bar to Unified Hub */}
      <div className="space-y-2 pt-2 border-t border-white/[0.04]">
        <div className="flex flex-wrap gap-1.5 items-center">
          <Button size="xs" variant="secondary" onClick={() => onSelectTab(node.id, 'containers')}>
            <span className="flex items-center gap-1 text-[11px]">
              <ContainerIcon /> Containers
            </span>
          </Button>
          <Button size="xs" variant="secondary" onClick={() => onSelectTab(node.id, 'images')}>
            <span className="flex items-center gap-1 text-[11px]">
              <ImageIcon /> Images
            </span>
          </Button>
          <Button size="xs" variant="secondary" onClick={() => onSelectTab(node.id, 'ports')}>
            <span className="flex items-center gap-1 text-[11px]">
              <ShieldIcon /> Ports &amp; UFW
            </span>
          </Button>
          <Button size="xs" variant="secondary" onClick={() => onSelectTab(node.id, 'terminal')}>
            <span className="flex items-center gap-1 text-[11px]">
              <TerminalIcon /> Web SSH
            </span>
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setShowNodeEngine(!showNodeEngine)} className="text-cyan-400 text-[11px]">
            {showNodeEngine ? 'Hide Cockpit' : 'Host Cockpit'}
          </Button>
        </div>

        <div className="flex justify-between items-center pt-1">
          <span className="text-[10px] text-text-faint font-mono">ID: {node.id.slice(0, 8)}...</span>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant={isCordoned ? 'primary' : 'secondary'}
              loading={cordonBusy}
              onClick={handleToggleCordon}
              className="text-[11px]"
            >
              {isCordoned ? 'Uncordon' : 'Cordon'}
            </Button>
            <Button
              size="xs"
              variant="secondary"
              loading={failoverBusy}
              onClick={handleFailover}
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-[11px]"
            >
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Evacuate
              </span>
            </Button>
            <Button
              size="xs"
              variant="ghost"
              loading={deleteBusy}
              onClick={handleDeleteNode}
              className="text-red-400 hover:text-red-300 text-[11px]"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {showNodeEngine && (
        <div className="pt-4 border-t border-white/10">
          <NodeEngineControlPanel nodeId={node.id} nodeLabel={node.label} ipAddress={node.ip} />
        </div>
      )}

      {stale && (
        <p className="text-[10px] text-amber-300 bg-amber-500/5 border border-amber-500/10 rounded-lg px-2.5 py-1.5 mt-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {node.lastSeenAt ? `Stats are stale (Last seen: ${new Date(node.lastSeenAt).toLocaleString()})` : 'No stats reported yet'}
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value, unit, max }: { label: string; value: number | null; unit: string; max: number }) {
  const pct = value !== null && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isHigh = pct > 85;
  const isMedium = pct > 60;
  const colorClass = isHigh ? 'bg-red-500' : isMedium ? 'bg-orange-400' : 'bg-white';
  const textColorClass = isHigh ? 'text-red-300 font-semibold' : isMedium ? 'text-orange-300' : 'text-emerald-400';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className={value !== null ? textColorClass : 'text-text-faint'}>
          {value !== null ? `${value}${unit} (${Math.round(pct)}%)` : '—'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NodeOnboardingSection({ onCreated }: { onCreated: () => void }) {
  const [tab, setTab] = useState<'combined' | 'manual'>('combined');
  const [clusterSecret, setClusterSecret] = useState<string>('');
  const [nodeLabel, setNodeLabel] = useState<string>('node-singapore-1');
  const [roleTags, setRoleTags] = useState<string[]>(['web-hosting', 'node-hosting']);
  
  // Cloud Provider & Node Metadata
  const [nodeProvider, setNodeProvider] = useState('Hetzner');
  const [nodeRegion, setNodeRegion] = useState('eu-central-1 (Nuremberg)');
  const [nodeOs, setNodeOs] = useState('Ubuntu 24.04 LTS');
  const [activeEnrollJobId, setActiveEnrollJobId] = useState<string | null>(null);

  // SSH state
  const [sshIp, setSshIp] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('root');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [sshBusy, setSshBusy] = useState(false);
  const [sshError, setSshError] = useState<string | null>(null);

  // Manual state
  const [manualIp, setManualIp] = useState('');
  const [manualCpu, setManualCpu] = useState('2');
  const [manualRam, setManualRam] = useState('2048');
  const [manualDisk, setManualDisk] = useState('40');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    api.nodes.getClusterSecret()
      .then((r) => setClusterSecret(r.secret))
      .catch(() => setClusterSecret('f1e2d3c4b5a697887766554433221100abcdef1234567890abcdef1234567890'));
  }, []);

  function toggleTag(tag: string) {
    setRoleTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  const tagsStr = roleTags.join(',');
  const installCmd = `curl -sSL https://api.shanutechx.com/api/nodes/install.sh | bash -s -- "https://api.shanutechx.com" "${clusterSecret}" "${nodeLabel}" "${tagsStr}"`;

  const [provisionLog, setProvisionLog] = useState<string[]>([]);
  const [provisionDone, setProvisionDone] = useState(false);
  const provisionLogRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (provisionLogRef.current) {
      provisionLogRef.current.scrollTop = provisionLogRef.current.scrollHeight;
    }
  }, [provisionLog]);

  async function handleAsyncEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!sshIp) {
      setSshError('Please enter the target VPS IP Address');
      return;
    }
    setSshBusy(true);
    setSshError(null);
    try {
      const res = await api.nodes.enrollJob({
        label: nodeLabel,
        ip: sshIp,
        sshPort: Number(sshPort),
        username: sshUser,
        password: authType === 'password' ? sshPassword : undefined,
        privateKey: authType === 'key' ? sshKey : undefined,
        provider: nodeProvider,
        region: nodeRegion,
        os: nodeOs,
        roleTags,
      });
      setActiveEnrollJobId(res.jobId);
      toast('Node enrollment job dispatched to worker queue!', 'success');
    } catch (err: any) {
      setSshError(err.message || 'Failed to dispatch node enrollment job');
      toast('Failed to dispatch enrollment job', 'error');
    } finally {
      setSshBusy(false);
    }
  }

  async function handleSshConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!sshIp) {
      setSshError('Please enter the target VPS IP Address');
      return;
    }
    setSshBusy(true);
    setSshError(null);
    setProvisionLog([]);
    setProvisionDone(false);

    try {
      const res = await api.nodes.connectSSHStream({
        ip: sshIp,
        port: Number(sshPort),
        username: sshUser,
        password: authType === 'password' ? sshPassword : undefined,
        privateKey: authType === 'key' ? sshKey : undefined,
        label: nodeLabel,
        roleTags,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errData.error || errData.message || `SSH Connection failed: ${res.status}`);
      }

      if (!res.body) throw new Error('No stream body received');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'step') {
              setProvisionLog((p) => [...p, event.message]);
            } else if (event.type === 'done') {
              setProvisionLog((p) => [...p, '[SUCCESS] Node provisioned and registered successfully!']);
              setProvisionDone(true);
              toast('Node provisioned and connected via SSH successfully!', 'success');
              onCreated();
            } else if (event.type === 'error') {
              setSshError(event.error || 'Provisioning failed');
              setProvisionLog((p) => [...p, `[ERROR] Error: ${event.error}`]);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      setSshError(err.message || 'Failed to connect via SSH');
      toast('SSH provisioning failed', 'error');
    } finally {
      setSshBusy(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualBusy(true);
    setManualError(null);
    try {
      await api.nodes.create({
        label: nodeLabel,
        ip: manualIp,
        sshKeyRef: `vault:${nodeLabel}`,
        cpuCores: Number(manualCpu),
        ramMb: Number(manualRam),
        diskGb: Number(manualDisk),
        roleTags,
      });
      toast('Node registered manually', 'success');
      onCreated();
    } catch (err: any) {
      setManualError(err.message);
      toast('Failed to register node', 'error');
    } finally {
      setManualBusy(false);
    }
  }

  function copyInstallCmd() {
    navigator.clipboard.writeText(installCmd);
    toast('1-Line Bash Script copied to clipboard!', 'success');
  }

  return (
    <Card className="border border-white/[0.08] bg-white/[0.01]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.06]">
        <div>
          <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
            <PlusIcon /> Add Compute Node to Cluster
          </h2>
          <p className="text-text-muted text-xs mt-0.5">
            Connect your target VPS via SSH or copy the automated 1-line installation script below.
          </p>
        </div>

        <div className="flex gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setTab('combined')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'combined' ? 'bg-white text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <KeyIcon /> Automated SSH &amp; 1-Line Script
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'manual' ? 'bg-white text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <ServerIcon /> Manual Form
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
          1. Node Label &amp; Workload Capability Tags
        </label>
        <div className="grid md:grid-cols-3 gap-4 mb-3">
          <Input
            label="Node Identifier Label"
            placeholder="e.g. node-singapore-1"
            value={nodeLabel}
            onChange={(e) => setNodeLabel(e.target.value)}
          />
          <div>
            <label className="text-xs font-semibold text-text-muted block mb-1">VPS Provider</label>
            <select
              value={nodeProvider}
              onChange={(e) => setNodeProvider(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-violet"
            >
              <option value="Hetzner">Hetzner Cloud</option>
              <option value="OVH">OVHcloud</option>
              <option value="DigitalOcean">DigitalOcean</option>
              <option value="Linode">Linode / Akamai</option>
              <option value="AWS">Amazon Lightsail / EC2</option>
              <option value="Contabo">Contabo</option>
              <option value="Vultr">Vultr</option>
              <option value="Custom">Other / Bare-Metal</option>
            </select>
          </div>
          <Input
            label="Datacenter / Region"
            placeholder="e.g. fsn1, eu-central-1, sgp1"
            value={nodeRegion}
            onChange={(e) => setNodeRegion(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLE_TAG_OPTIONS.map((tag) => {
            const active = roleTags.includes(tag);
            return (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs rounded-full px-3 py-1 font-medium transition-all capitalize border ${
                  active
                    ? 'bg-white/20 border-white/40 text-white'
                    : 'bg-white/5 border-white/10 text-text-muted hover:text-text-primary'
                }`}
              >
                {tag.replace(/-/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'combined' && (
        <div className="space-y-6">
          <form onSubmit={handleSshConnect} className="space-y-4">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-4">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                2. Target VPS Credentials &amp; Connection Details
              </label>

              {sshError && <ErrorBanner message={sshError} />}

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  required
                  label="Target VPS IP Address"
                  placeholder="e.g. 13.229.33.83"
                  value={sshIp}
                  onChange={(e) => setSshIp(e.target.value)}
                />
                <Input
                  required
                  label="SSH Port"
                  placeholder="22"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                />
                <Input
                  required
                  label="SSH Username"
                  placeholder="root or ubuntu"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                />
              </div>

              <div className="flex gap-4 items-center pt-1">
                <label className="text-xs font-medium text-text-muted">Authentication Method:</label>
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="authType"
                    checked={authType === 'password'}
                    onChange={() => setAuthType('password')}
                    className="accent-violet-500"
                  /> Password
                </label>
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="authType"
                    checked={authType === 'key'}
                    onChange={() => setAuthType('key')}
                    className="accent-violet-500"
                  /> SSH Private Key (PEM)
                </label>
              </div>

              {authType === 'password' ? (
                <Input
                  required
                  type="password"
                  label="Root / User SSH Password"
                  placeholder="Enter SSH password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                />
              ) : (
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">SSH Private Key (PEM format)</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50"
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    value={sshKey}
                    onChange={(e) => setSshKey(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-sans text-xs font-semibold flex items-center gap-1.5">
                  <TerminalIcon /> 1-Line Onboarding Command Preview
                </span>
                <Button type="button" size="sm" variant="secondary" onClick={copyInstallCmd}>
                  Copy 1-Line Script
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-black/60 border border-white/5 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all select-all">
                {installCmd}
              </pre>
            </div>

            <div className="pt-2 grid md:grid-cols-2 gap-3">
              <Button type="submit" size="lg" loading={sshBusy} disabled={sshBusy || !sshIp} className="justify-center">
                {sshBusy ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Provisioning Server via SSH...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyIcon /> Connect SSH &amp; Run Direct
                  </span>
                )}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                loading={sshBusy}
                disabled={sshBusy || !sshIp}
                onClick={handleAsyncEnroll}
                className="justify-center border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10"
              >
                <span className="flex items-center gap-2">
                  <ServerIcon /> Enroll via Background Job
                </span>
              </Button>
            </div>

            {activeEnrollJobId && (
              <div className="mt-4">
                <JobProgressBar
                  jobId={activeEnrollJobId}
                  title={`Enrolling ${nodeLabel} (${sshIp})`}
                  onComplete={() => {
                    toast('Node enrolled successfully and online!', 'success');
                    onCreated();
                    setActiveEnrollJobId(null);
                  }}
                  onError={(err?: string) => {
                    toast(`Enrollment failed: ${err || 'Unknown error'}`, 'error');
                  }}
                />
              </div>
            )}

            {provisionLog.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${provisionDone ? 'bg-emerald-400' : sshError ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {provisionDone ? 'Provisioning Complete' : sshError ? 'Provisioning Failed' : 'Live Setup Progress Log...'}
                  </p>
                </div>
                <pre
                  ref={provisionLogRef}
                  className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-[11px] text-emerald-300 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner"
                >
                  {provisionLog.map((line, i) => (
                    <span key={i} className={`block ${
                      line.startsWith('[ERROR]') || line.startsWith('❌') ? 'text-red-400 font-semibold' :
                      line.startsWith('[SUCCESS]') || line.startsWith('🎉') ? 'text-emerald-400 font-bold' :
                      line.startsWith('[stderr]') ? 'text-amber-300' :
                      'text-emerald-300'
                    }`}>{line}</span>
                  ))}
                </pre>
              </div>
            )}
          </form>
        </div>
      )}

      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          {manualError && <ErrorBanner message={manualError} />}

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              required
              label="IP Address"
              placeholder="e.g. 192.168.1.100"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
            />
            <Input
              required
              type="number"
              label="CPU Cores"
              placeholder="2"
              value={manualCpu}
              onChange={(e) => setManualCpu(e.target.value)}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              required
              type="number"
              label="RAM Memory (MB)"
              placeholder="2048"
              value={manualRam}
              onChange={(e) => setManualRam(e.target.value)}
            />
            <Input
              required
              type="number"
              label="Disk Storage (GB)"
              placeholder="40"
              value={manualDisk}
              onChange={(e) => setManualDisk(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <Button type="submit" loading={manualBusy} disabled={manualBusy || !manualIp}>
              Register Compute Node Manually
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: DOCKER CONTAINERS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function ContainerUsage({ stats }: { stats: { cpuPercent: number; memUsedMb: number; memLimitMb: number | null } | 'error' | undefined }) {
  if (stats === undefined) return <span>CPU / RAM: <span className="text-text-muted">loading...</span></span>;
  if (stats === 'error') return <span>CPU / RAM: <span className="text-text-muted">unavailable</span></span>;
  const mem = stats.memLimitMb ? `${Math.round(stats.memUsedMb)} / ${Math.round(stats.memLimitMb)} MB` : `${Math.round(stats.memUsedMb)} MB`;
  return (
    <span>
      CPU: <span className="text-text-primary">{stats.cpuPercent.toFixed(1)}%</span> RAM: <span className="text-text-primary">{mem}</span>
    </span>
  );
}

function ContainersTabView({ nodeId }: { nodeId: string | null }) {
  const [containers, setContainers] = useState<NodeContainer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'paused' | 'stopped'>('all');

  // Modals state
  const [logsTarget, setLogsTarget] = useState<NodeContainer | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [topTarget, setTopTarget] = useState<NodeContainer | null>(null);
  const [topData, setTopData] = useState<any>(null);
  const [changesTarget, setChangesTarget] = useState<NodeContainer | null>(null);
  const [changesData, setChangesData] = useState<any[] | null>(null);
  const [inspectTarget, setInspectTarget] = useState<NodeContainer | null>(null);
  const [removeTarget, setRemoveTarget] = useState<NodeContainer | null>(null);
  const [containerStats, setContainerStats] = useState<Record<string, { cpuPercent: number; memUsedMb: number; memLimitMb: number | null } | 'error'>>({});
  const logsStreamRef = useRef<StreamHandle | null>(null);
  const [logsLive, setLogsLive] = useState(false);

  const { toast } = useToast();

  function loadContainers(nId: string) {
    setContainers(null);
    api.containers
      .list(nId)
      .then((d) => setContainers(d.containers))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (nodeId) loadContainers(nodeId);
  }, [nodeId]);

  // Leaving the page must not leave a live log connection open against the node.
  useEffect(() => () => logsStreamRef.current?.close(), []);

  // CPU/RAM for running containers only, refreshed periodically. Docker's own stats call is relatively expensive
  // (it reads cgroup counters), so this polls rather than streams, and only for containers actually visible and
  // running -- a stopped container has nothing to report.
  useEffect(() => {
    if (!nodeId || !containers) return;
    const runningIds = containers.filter((c) => c.state === 'running').map((c) => c.id);
    if (runningIds.length === 0) return;

    let cancelled = false;
    const fetchAll = () => {
      runningIds.forEach((id) => {
        api.containers
          .stats(nodeId, id)
          .then((s: any) => {
            if (cancelled) return;
            setContainerStats((prev) => ({ ...prev, [id]: { cpuPercent: s.cpuUsagePercent ?? 0, memUsedMb: s.memoryUsedMb ?? 0, memLimitMb: s.memoryLimitMb ?? null } }));
          })
          .catch(() => {
            if (!cancelled) setContainerStats((prev) => ({ ...prev, [id]: 'error' }));
          });
      });
    };
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [nodeId, containers]);

  const stats = useMemo(() => {
    if (!containers) return { total: 0, running: 0, paused: 0, stopped: 0 };
    return {
      total: containers.length,
      running: containers.filter((c) => c.state === 'running').length,
      paused: containers.filter((c) => c.state === 'paused').length,
      stopped: containers.filter((c) => c.state === 'exited' || c.state === 'stopped').length,
    };
  }, [containers]);

  const filteredContainers = useMemo(() => {
    if (!containers) return [];
    return containers.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === 'running') return c.state === 'running';
      if (statusFilter === 'paused') return c.state === 'paused';
      if (statusFilter === 'stopped') return c.state === 'exited' || c.state === 'stopped';

      return true;
    });
  }, [containers, searchQuery, statusFilter]);

  async function handleAction(container: NodeContainer, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove') {
    if (!nodeId) return;
    setBusyId(container.id);
    try {
      if (action === 'pause') {
        await api.containers.pause(nodeId, container.id);
        toast(`Container ${container.name} paused.`, 'success');
      } else if (action === 'unpause') {
        await api.containers.unpause(nodeId, container.id);
        toast(`Container ${container.name} unpaused.`, 'success');
      } else if (action === 'remove') {
        await api.containers.remove(nodeId, container.id);
        toast(`Container ${container.name} removed.`, 'success');
      } else {
        await api.containers.action(nodeId, container.id, action);
        toast(`Container ${container.name} ${action === 'restart' ? 'restarted' : action + 'ped'}.`, 'success');
      }
      loadContainers(nodeId);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  function stopLogsStream() {
    logsStreamRef.current?.close();
    logsStreamRef.current = null;
    setLogsLive(false);
  }

  function closeLogs() {
    stopLogsStream();
    setLogsTarget(null);
  }

  async function handleViewLogs(container: NodeContainer) {
    if (!nodeId) return;
    stopLogsStream();
    setLogsTarget(container);
    setLogs('Loading logs...');
    try {
      const res = await api.containers.logs(nodeId, container.id);
      setLogs(res.logs || '(no log output)');
    } catch (err: any) {
      setLogs(`Failed to load logs: ${err.message}`);
      return;
    }
    // A stopped container will not produce more output, so only a running one is followed live.
    if (container.state !== 'running') return;
    // Following from now on would repeat the tail already shown, so the live stream only appends what comes next:
    // the agent's stream starts at "now", not at the beginning of the log.
    logsStreamRef.current = streamAuthedEvents(
      api.containers.logsStreamPath(nodeId, container.id),
      (raw) => {
        const { line, error } = logLineFromEvent(raw);
        if (error) {
          toast(error, 'error');
          return;
        }
        if (line !== null) setLogs((prev) => `${prev}\n${line}`);
      },
      () => {
        setLogsLive(false);
        toast('Live log stream ended.', 'info');
      },
      { baseUrl: api.baseURL }
    );
    setLogsLive(true);
  }

  async function handleViewTop(container: NodeContainer) {
    if (!nodeId) return;
    setTopTarget(container);
    setTopData(null);
    try {
      const res = await api.containers.top(nodeId, container.id);
      setTopData(res);
    } catch (err: any) {
      toast(`Failed to fetch processes: ${err.message}`, 'error');
    }
  }

  async function handleViewChanges(container: NodeContainer) {
    if (!nodeId) return;
    setChangesTarget(container);
    setChangesData(null);
    try {
      const res = await api.containers.changes(nodeId, container.id);
      setChangesData(res.changes || []);
    } catch (err: any) {
      toast(`Failed to fetch filesystem changes: ${err.message}`, 'error');
    }
  }

  if (!nodeId) return <EmptyState message="Select a compute node above to manage Docker containers." />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {/* Metrics */}
      {containers && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Containers"
            value={stats.total}
            change="Active Node Engine"
            icon={<ContainerIcon />}
          />
          <MetricCard
            title="Running"
            value={stats.running}
            change={`${stats.total ? Math.round((stats.running / stats.total) * 100) : 0}% Operational`}
            changeType="positive"
            icon={
              <span className="h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              </span>
            }
          />
          <MetricCard
            title="Paused"
            value={stats.paused}
            change="Suspended"
            icon={<ContainerIcon />}
          />
          <MetricCard
            title="Stopped"
            value={stats.stopped}
            change="Exited Containers"
            changeType="negative"
            icon={<ContainerIcon />}
          />
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search containers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
            {(['all', 'running', 'paused', 'stopped'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  statusFilter === st ? 'bg-white text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={() => loadContainers(nodeId)}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Containers List */}
      {containers === null && <Spinner label="Loading containers from Docker daemon..." />}
      {containers && filteredContainers.length === 0 && (
        <EmptyState message={searchQuery ? 'No containers match your search filter.' : 'No Docker containers found on this compute node.'} />
      )}

      <div className="grid gap-4">
        {filteredContainers.map((c) => {
          const isBusy = busyId === c.id;
          const isRunning = c.state === 'running';
          const isPaused = c.state === 'paused';

          return (
            <Card key={c.id} className="border border-white/[0.06] hover:border-white/12 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : isPaused ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <h3 className="font-semibold text-text-primary text-base font-mono">{c.name}</h3>
                    <Badge status={isRunning ? 'running' : isPaused ? 'paused' : 'stopped'} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted font-mono">
                    <span>ID: <span className="text-text-primary">{c.id.slice(0, 12)}</span></span>
                    <span>Image: <span className="text-accent-violet-light">{c.image}</span></span>
                    <span>Status: <span className="text-text-primary">{c.status}</span></span>
                    {isRunning && <ContainerUsage stats={containerStats[c.id]} />}
                  </div>
                  {c.ports && c.ports.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {c.ports.map((p, i) => (
                        <span key={i} className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-0.5 text-cyan-300">
                          {p.publicPort ? `${p.publicPort}:` : ''}{p.privatePort}/{p.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 items-center justify-end">
                  <Button size="xs" variant="secondary" onClick={() => handleViewLogs(c)}>
                    Logs
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => handleViewTop(c)}>
                    Top
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => handleViewChanges(c)}>
                    Changes
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => setInspectTarget(c)}>
                    Inspect
                  </Button>

                  {isRunning ? (
                    <>
                      <Button size="xs" variant="secondary" loading={isBusy} onClick={() => handleAction(c, 'pause')}>
                        Pause
                      </Button>
                      <Button size="xs" variant="secondary" loading={isBusy} onClick={() => handleAction(c, 'restart')}>
                        Restart
                      </Button>
                      <Button size="xs" variant="danger" loading={isBusy} onClick={() => handleAction(c, 'stop')}>
                        Stop
                      </Button>
                    </>
                  ) : isPaused ? (
                    <Button size="xs" variant="success" loading={isBusy} onClick={() => handleAction(c, 'unpause')}>
                      Unpause
                    </Button>
                  ) : (
                    <Button size="xs" variant="success" loading={isBusy} onClick={() => handleAction(c, 'start')}>
                      Start
                    </Button>
                  )}

                  <Button size="xs" variant="danger" loading={isBusy} onClick={() => setRemoveTarget(c)}>
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Logs Modal */}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (removeTarget) await handleAction(removeTarget, 'remove');
        }}
        title="Remove this container?"
        danger
        confirmLabel="Remove container"
        message={
          removeTarget
            ? `"${removeTarget.name}" will be permanently deleted${removeTarget.state === 'running' ? ' (it is running right now and will be force-stopped first)' : ''}. Data stored inside the container that is not on a volume is lost. This cannot be undone.`
            : ''
        }
      />

      {logsTarget && (
        <Modal open title={`Logs: ${logsTarget.name}${logsLive ? ' (live)' : ''}`} onClose={closeLogs}>
          <pre className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-emerald-400 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
            {logs}
          </pre>
        </Modal>
      )}

      {/* Top Modal */}
      {topTarget && (
        <Modal open title={`Running Processes (top): ${topTarget.name}`} onClose={() => setTopTarget(null)}>
          {topData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted">
                    {topData.Titles?.map((t: string, i: number) => (
                      <th key={i} className="p-2">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {topData.Processes?.map((p: string[], i: number) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      {p.map((val, j) => (
                        <td key={j} className="p-2 text-text-primary whitespace-nowrap">{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Spinner label="Fetching container top data..." />
          )}
        </Modal>
      )}

      {/* Changes Modal */}
      {changesTarget && (
        <Modal open title={`Filesystem Changes: ${changesTarget.name}`} onClose={() => setChangesTarget(null)}>
          {changesData ? (
            changesData.length === 0 ? (
              <p className="text-xs text-text-muted">No filesystem changes recorded.</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
                {changesData.map((ch, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02]">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      ch.Kind === 0 ? 'bg-amber-500/20 text-amber-300' :
                      ch.Kind === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {ch.Kind === 0 ? 'MODIFIED' : ch.Kind === 1 ? 'ADDED' : 'DELETED'}
                    </span>
                    <span className="text-text-primary">{ch.Path}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <Spinner label="Fetching container filesystem changes..." />
          )}
        </Modal>
      )}

      {/* Inspect Modal */}
      {inspectTarget && (
        <Modal open title={`Inspect Container: ${inspectTarget.name}`} onClose={() => setInspectTarget(null)}>
          <pre className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-cyan-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
            {JSON.stringify(inspectTarget, null, 2)}
          </pre>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: DOCKER IMAGES VIEW
// ─────────────────────────────────────────────────────────────────────────────
function ImagesTabView({ nodeId }: { nodeId: string | null }) {
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

  function loadImages(nId: string) {
    setImages(null);
    api.dockerImages
      .list(nId)
      .then((d) => setImages(d.images))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (nodeId) loadImages(nodeId);
  }, [nodeId]);

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
    if (!nodeId || !pullImageName.trim()) return;
    setPulling(true);
    try {
      await api.dockerImages.pull(nodeId, pullImageName.trim(), pullTag.trim() || 'latest');
      toast(`Successfully pulled image ${pullImageName}:${pullTag}`, 'success');
      setPullModalOpen(false);
      setPullImageName('');
      loadImages(nodeId);
    } catch (err: any) {
      toast(`Failed to pull image: ${err.message}`, 'error');
    } finally {
      setPulling(false);
    }
  }

  async function handleRemoveImage(img: DockerImage, force = false) {
    if (!nodeId) return;
    setBusyId(img.id);
    try {
      await api.dockerImages.remove(nodeId, img.id, force);
      toast('Image removed successfully.', 'success');
      loadImages(nodeId);
    } catch (err: any) {
      toast(`Failed to remove image: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePruneImages() {
    if (!nodeId) return;
    try {
      const res = await api.dockerImages.prune(nodeId);
      toast(`Pruned unused images. Space reclaimed: ${Math.round((res.SpaceReclaimed || 0) / (1024 * 1024))} MB`, 'success');
      loadImages(nodeId);
    } catch (err: any) {
      toast(`Prune failed: ${err.message}`, 'error');
    }
  }

  async function handleInspect(img: DockerImage) {
    if (!nodeId) return;
    setInspectImage(img);
    setInspectData(null);
    try {
      const res = await api.dockerImages.inspect(nodeId, img.id);
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

  if (!nodeId) return <EmptyState message="Select a compute node above to manage Docker images." />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {/* Metrics */}
      {images && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Images"
            value={stats.total}
            change="Cached Docker Images"
            icon={<ImageIcon />}
          />
          <MetricCard
            title="Total Disk Footprint"
            value={`${stats.totalSizeMb} MB`}
            change="Image Storage"
            icon={<ImageIcon />}
          />
          <MetricCard
            title="Dangling Images"
            value={stats.dangling}
            change="Unused Untagged Layers"
            changeType={stats.dangling > 0 ? 'negative' : 'positive'}
            icon={<ImageIcon />}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Input
          placeholder="Search image tags or IDs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-64"
        />

        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={() => setPullModalOpen(true)}>
            <PlusIcon /> Pull New Image
          </Button>
          <Button size="sm" variant="secondary" onClick={handlePruneImages}>
            Prune Unused Images
          </Button>
          <Button size="sm" variant="secondary" onClick={() => loadImages(nodeId)}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Images List */}
      {images === null && <Spinner label="Loading Docker images..." />}
      {images && filteredImages.length === 0 && (
        <EmptyState message={searchQuery ? 'No images match search query.' : 'No Docker images found on this compute node.'} />
      )}

      <div className="grid gap-3">
        {filteredImages.map((img) => {
          const tags = img.repoTags && img.repoTags.length > 0 ? img.repoTags : ['<none>:<none>'];
          const isBusy = busyId === img.id;

          return (
            <Card key={img.id} className="border border-white/[0.06] hover:border-white/12 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 font-mono">
                  <div className="flex items-center gap-2 flex-wrap">
                    {tags.map((t, idx) => (
                      <span key={idx} className="font-semibold text-text-primary text-sm bg-accent-violet/10 border border-accent-violet/20 px-2.5 py-0.5 rounded-lg">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted pt-1">
                    <span>ID: <span className="text-text-primary">{img.id.slice(7, 19)}</span></span>
                    <span>Size: <span className="text-cyan-300 font-bold">{formatBytes(img.size)}</span></span>
                    <span>Created: <span className="text-text-primary">{new Date(img.created * 1000).toLocaleString()}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <Button size="xs" variant="secondary" onClick={() => handleInspect(img)}>
                    Inspect
                  </Button>
                  <Button size="xs" variant="danger" loading={isBusy} onClick={() => handleRemoveImage(img, false)}>
                    Remove
                  </Button>
                  <Button size="xs" variant="danger" loading={isBusy} onClick={() => handleRemoveImage(img, true)}>
                    Force Remove
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pull Image Modal */}
      {pullModalOpen && (
        <Modal open title="Pull Image from Registry" onClose={() => setPullModalOpen(false)}>
          <div className="space-y-4">
            <Input
              required
              label="Image Name (e.g. nginx, redis, postgres)"
              placeholder="e.g. nginx"
              value={pullImageName}
              onChange={(e) => setPullImageName(e.target.value)}
            />
            <Input
              label="Image Tag"
              placeholder="latest"
              value={pullTag}
              onChange={(e) => setPullTag(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPullModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={pulling} onClick={handlePullImage}>
                Pull Image
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect Image Modal */}
      {inspectImage && (
        <Modal open title={`Inspect Image: ${(inspectImage.repoTags || [])[0] || inspectImage.id}`} onClose={() => setInspectImage(null)}>
          {inspectData ? (
            <pre className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-cyan-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {JSON.stringify(inspectData, null, 2)}
            </pre>
          ) : (
            <Spinner label="Inspecting image layers..." />
          )}
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: DOCKER VOLUMES VIEW
// ─────────────────────────────────────────────────────────────────────────────
function VolumesTabView({ nodeId }: { nodeId: string | null }) {
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

  function loadVolumes(nId: string) {
    setVolumes(null);
    api.dockerVolumes
      .list(nId)
      .then((d) => setVolumes(d.volumes))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (nodeId) loadVolumes(nodeId);
  }, [nodeId]);

  const filteredVolumes = useMemo(() => {
    if (!volumes) return [];
    return volumes.filter((v) =>
      v.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.Driver.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [volumes, searchQuery]);

  async function handleCreateVolume() {
    if (!nodeId || !newVolName.trim()) return;
    setCreating(true);
    try {
      await api.dockerVolumes.create(nodeId, newVolName.trim(), newVolDriver);
      toast(`Volume ${newVolName} created successfully.`, 'success');
      setCreateModalOpen(false);
      setNewVolName('');
      loadVolumes(nodeId);
    } catch (err: any) {
      toast(`Failed to create volume: ${err.message}`, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRemoveVolume(vol: DockerVolume) {
    if (!nodeId) return;
    setBusyName(vol.Name);
    try {
      await api.dockerVolumes.remove(nodeId, vol.Name);
      toast(`Volume ${vol.Name} removed.`, 'success');
      loadVolumes(nodeId);
    } catch (err: any) {
      toast(`Failed to remove volume: ${err.message}`, 'error');
    } finally {
      setBusyName(null);
    }
  }

  async function handleInspectVolume(vol: DockerVolume) {
    if (!nodeId) return;
    setInspectVolume(vol);
    setInspectData(null);
    try {
      const res = await api.dockerVolumes.inspect(nodeId, vol.Name);
      setInspectData(res);
    } catch (err: any) {
      toast(`Failed to inspect volume: ${err.message}`, 'error');
    }
  }

  if (!nodeId) return <EmptyState message="Select a compute node above to manage Docker volumes." />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Input
          placeholder="Search volumes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-64"
        />

        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={() => setCreateModalOpen(true)}>
            <PlusIcon /> Create Volume
          </Button>
          <Button size="sm" variant="secondary" onClick={() => loadVolumes(nodeId)}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Volumes List */}
      {volumes === null && <Spinner label="Loading Docker volumes..." />}
      {volumes && filteredVolumes.length === 0 && (
        <EmptyState message={searchQuery ? 'No volumes match search query.' : 'No Docker volumes found on this node.'} />
      )}

      <div className="grid gap-3">
        {filteredVolumes.map((v) => {
          const isBusy = busyName === v.Name;

          return (
            <Card key={v.Name} className="border border-white/[0.06] hover:border-white/12 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary text-sm font-mono">{v.Name}</h3>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">
                      {v.Driver}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate max-w-xl">Mountpoint: <span className="text-text-primary">{v.Mountpoint}</span></p>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <Button size="xs" variant="secondary" onClick={() => handleInspectVolume(v)}>
                    Inspect
                  </Button>
                  <Button size="xs" variant="danger" loading={isBusy} onClick={() => handleRemoveVolume(v)}>
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Volume Modal */}
      {createModalOpen && (
        <Modal open title="Create New Docker Volume" onClose={() => setCreateModalOpen(false)}>
          <div className="space-y-4">
            <Input
              required
              label="Volume Name"
              placeholder="e.g. pgdata_vol"
              value={newVolName}
              onChange={(e) => setNewVolName(e.target.value)}
            />
            <Input
              label="Driver"
              placeholder="local"
              value={newVolDriver}
              onChange={(e) => setNewVolDriver(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={handleCreateVolume}>
                Create Volume
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect Volume Modal */}
      {inspectVolume && (
        <Modal open title={`Inspect Volume: ${inspectVolume.Name}`} onClose={() => setInspectVolume(null)}>
          {inspectData ? (
            <pre className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-cyan-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {JSON.stringify(inspectData, null, 2)}
            </pre>
          ) : (
            <Spinner label="Inspecting volume..." />
          )}
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5: DOCKER NETWORKS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function NetworksTabView({ nodeId }: { nodeId: string | null }) {
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

  function loadNetworks(nId: string) {
    setNetworks(null);
    api.dockerNetworks
      .list(nId)
      .then((d) => setNetworks(d.networks))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (nodeId) loadNetworks(nodeId);
  }, [nodeId]);

  const filteredNetworks = useMemo(() => {
    if (!networks) return [];
    return networks.filter((n) =>
      n.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.Driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.Id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [networks, searchQuery]);

  async function handleCreateNetwork() {
    if (!nodeId || !netName.trim()) return;
    setCreating(true);
    try {
      await api.dockerNetworks.create(nodeId, netName.trim(), netDriver);
      toast(`Network ${netName} created successfully.`, 'success');
      setCreateModalOpen(false);
      setNetName('');
      loadNetworks(nodeId);
    } catch (err: any) {
      toast(`Failed to create network: ${err.message}`, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRemoveNetwork(net: DockerNetwork) {
    if (!nodeId) return;
    setBusyId(net.Id);
    try {
      await api.dockerNetworks.remove(nodeId, net.Id);
      toast(`Network ${net.Name} removed.`, 'success');
      loadNetworks(nodeId);
    } catch (err: any) {
      toast(`Failed to remove network: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleInspectNetwork(net: DockerNetwork) {
    if (!nodeId) return;
    setInspectNetwork(net);
    setInspectData(null);
    try {
      const res = await api.dockerNetworks.inspect(nodeId, net.Id);
      setInspectData(res);
    } catch (err: any) {
      toast(`Failed to inspect network: ${err.message}`, 'error');
    }
  }

  if (!nodeId) return <EmptyState message="Select a compute node above to manage Docker networks." />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Input
          placeholder="Search networks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-64"
        />

        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={() => setCreateModalOpen(true)}>
            <PlusIcon /> Create Network
          </Button>
          <Button size="sm" variant="secondary" onClick={() => loadNetworks(nodeId)}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Networks List */}
      {networks === null && <Spinner label="Loading Docker networks..." />}
      {networks && filteredNetworks.length === 0 && (
        <EmptyState message={searchQuery ? 'No networks match search query.' : 'No Docker networks found on this node.'} />
      )}

      <div className="grid gap-3">
        {filteredNetworks.map((n) => {
          const isBusy = busyId === n.Id;
          const containerCount = n.Containers ? Object.keys(n.Containers).length : 0;

          return (
            <Card key={n.Id} className="border border-white/[0.06] hover:border-white/12 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary text-sm">{n.Name}</h3>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold uppercase">
                      {n.Driver}
                    </span>
                    <span className="text-[10px] bg-white/5 text-text-muted px-2 py-0.5 rounded-full uppercase">
                      Scope: {n.Scope}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted pt-0.5">
                    <span>ID: <span className="text-text-primary">{n.Id.slice(0, 12)}</span></span>
                    <span>Attached Containers: <span className="text-emerald-400 font-bold">{containerCount}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <Button size="xs" variant="secondary" onClick={() => handleInspectNetwork(n)}>
                    Inspect
                  </Button>
                  <Button size="xs" variant="danger" loading={isBusy} onClick={() => handleRemoveNetwork(n)}>
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Network Modal */}
      {createModalOpen && (
        <Modal open title="Create New Docker Network" onClose={() => setCreateModalOpen(false)}>
          <div className="space-y-4">
            <Input
              required
              label="Network Name"
              placeholder="e.g. custom_app_net"
              value={netName}
              onChange={(e) => setNetName(e.target.value)}
            />
            <Input
              label="Driver (bridge, overlay, macvlan)"
              placeholder="bridge"
              value={netDriver}
              onChange={(e) => setNetDriver(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={handleCreateNetwork}>
                Create Network
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect Network Modal */}
      {inspectNetwork && (
        <Modal open title={`Inspect Network: ${inspectNetwork.Name}`} onClose={() => setInspectNetwork(null)}>
          {inspectData ? (
            <pre className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-cyan-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {JSON.stringify(inspectData, null, 2)}
            </pre>
          ) : (
            <Spinner label="Inspecting network..." />
          )}
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6: SYSTEM & DISK USAGE VIEW
// ─────────────────────────────────────────────────────────────────────────────
function SystemTabView({ nodeId }: { nodeId: string | null }) {
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [dfData, setDfData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  function loadSystemData(nId: string) {
    setLoading(true);
    setSystemInfo(null);
    setDfData(null);
    Promise.all([
      api.dockerSystem.info(nId).catch(() => null),
      api.dockerSystem.df(nId).catch(() => null),
    ])
      .then(([info, df]) => {
        setSystemInfo(info);
        setDfData(df);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (nodeId) loadSystemData(nodeId);
  }, [nodeId]);

  function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function handleSystemPrune() {
    if (!nodeId) return;
    if (!confirm('Are you sure you want to run Docker System Prune? This will remove all stopped containers, unused networks, and dangling images.')) {
      return;
    }
    try {
      const res = await api.dockerSystem.prune(nodeId);
      toast(`System Prune Complete! Space reclaimed: ${formatBytes(res.SpaceReclaimed || 0)}`, 'success');
      loadSystemData(nodeId);
    } catch (err: any) {
      toast(`Prune failed: ${err.message}`, 'error');
    }
  }

  if (!nodeId) return <EmptyState message="Select a compute node above to view Docker system telemetry & disk usage." />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      <div className="flex justify-between items-center">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Docker Daemon Telemetry &amp; Resource Footprint
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={handleSystemPrune}>
            System Prune All
          </Button>
          <Button size="sm" variant="secondary" onClick={() => loadSystemData(nodeId)}>
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {loading && <Spinner label="Loading Docker engine info & df disk space..." />}

      {/* Daemon System Info */}
      {systemInfo && (
        <Card className="border border-white/[0.06] space-y-4">
          <h3 className="font-bold text-sm text-text-primary">Docker Daemon Hardware &amp; Driver Info</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-text-muted block">Docker Server Version</span>
              <span className="text-emerald-400 font-bold">{systemInfo.ServerVersion || 'N/A'}</span>
            </div>
            <div>
              <span className="text-text-muted block">Operating System</span>
              <span className="text-text-primary">{systemInfo.OperatingSystem || 'Linux'}</span>
            </div>
            <div>
              <span className="text-text-muted block">Storage Driver</span>
              <span className="text-cyan-300">{systemInfo.Driver || 'overlay2'}</span>
            </div>
            <div>
              <span className="text-text-muted block">Cgroup Driver</span>
              <span className="text-accent-violet-light">{systemInfo.CgroupDriver || 'systemd'}</span>
            </div>
            <div>
              <span className="text-text-muted block">Total Memory</span>
              <span className="text-text-primary">{formatBytes(systemInfo.MemTotal)}</span>
            </div>
            <div>
              <span className="text-text-muted block">CPUs / Cores</span>
              <span className="text-text-primary">{systemInfo.NCPU || 0}</span>
            </div>
            <div>
              <span className="text-text-muted block">Total Containers</span>
              <span className="text-text-primary">{systemInfo.Containers || 0}</span>
            </div>
            <div>
              <span className="text-text-muted block">Running / Stopped</span>
              <span className="text-text-primary">{systemInfo.ContainersRunning || 0} / {systemInfo.ContainersStopped || 0}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Disk Space Usage (docker df) */}
      {dfData && (
        <div className="space-y-4">
          {/* Images Disk Usage */}
          {dfData.Images && (
            <Card title={`Docker Images Disk Usage (${dfData.Images.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-text-muted">
                      <th className="p-2">Repository:Tag</th>
                      <th className="p-2">Size</th>
                      <th className="p-2">Shared Size</th>
                      <th className="p-2">Containers Using</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {dfData.Images.map((img: any) => (
                      <tr key={img.Id} className="hover:bg-white/[0.02]">
                        <td className="p-2 text-text-primary">{(img.RepoTags || [])[0] || img.Id.slice(0, 12)}</td>
                        <td className="p-2 text-cyan-300 font-bold">{formatBytes(img.Size)}</td>
                        <td className="p-2 text-text-muted">{formatBytes(img.SharedSize)}</td>
                        <td className="p-2 text-emerald-400">{img.Containers || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Containers Disk Usage */}
          {dfData.Containers && (
            <Card title={`Docker Containers Disk Usage (${dfData.Containers.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-text-muted">
                      <th className="p-2">Names</th>
                      <th className="p-2">Image</th>
                      <th className="p-2">Rw Size</th>
                      <th className="p-2">RootFs Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {dfData.Containers.map((c: any) => (
                      <tr key={c.Id} className="hover:bg-white/[0.02]">
                        <td className="p-2 text-text-primary">{(c.Names || []).join(', ')}</td>
                        <td className="p-2 text-accent-violet-light">{c.Image}</td>
                        <td className="p-2 text-amber-300 font-bold">{formatBytes(c.SizeRw)}</td>
                        <td className="p-2 text-text-muted">{formatBytes(c.SizeRootFs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Volumes Disk Usage */}
          {dfData.Volumes && (
            <Card title={`Docker Volumes Disk Usage (${dfData.Volumes.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-text-muted">
                      <th className="p-2">Volume Name</th>
                      <th className="p-2">Size</th>
                      <th className="p-2">Ref Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {dfData.Volumes.map((v: any) => (
                      <tr key={v.Name} className="hover:bg-white/[0.02]">
                        <td className="p-2 text-text-primary">{v.Name}</td>
                        <td className="p-2 text-cyan-300 font-bold">{formatBytes(v.UsageData?.Size || 0)}</td>
                        <td className="p-2 text-emerald-400">{v.UsageData?.RefCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6: VPS PORTS & FIREWALL (UFW ORCHESTRATION)
// ─────────────────────────────────────────────────────────────────────────────

const PORT_PRESETS = [
  { label: 'HTTP', port: '80', protocol: 'tcp', desc: 'Standard Web' },
  { label: 'HTTPS', port: '443', protocol: 'tcp', desc: 'Secure Web' },
  { label: 'SSH', port: '22', protocol: 'tcp', desc: 'Remote Access' },
  { label: 'Dev Web', port: '3000', protocol: 'tcp', desc: 'Node / Next.js' },
  { label: 'Vite / React', port: '5173', protocol: 'tcp', desc: 'Vite Server' },
  { label: 'Backend API', port: '4000', protocol: 'tcp', desc: 'Express API' },
  { label: 'Alt Web', port: '8080', protocol: 'tcp', desc: 'Alt HTTP / Proxy' },
  { label: 'MySQL', port: '3306', protocol: 'tcp', desc: 'MySQL DB' },
  { label: 'PostgreSQL', port: '5432', protocol: 'tcp', desc: 'Postgres DB' },
  { label: 'Redis', port: '6379', protocol: 'tcp', desc: 'Key-Value Cache' },
  { label: 'MongoDB', port: '27017', protocol: 'tcp', desc: 'Doc Database' },
];

function PortsTabView({ nodeId }: { nodeId: string | null }) {
  const [status, setStatus] = useState<{ enabled: boolean; status: string; rules: any[] } | null>(null);
  const [listening, setListening] = useState<Array<{ protocol: string; port: number; address: string; process: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [newPort, setNewPort] = useState('');
  const [newProtocol, setNewProtocol] = useState<'tcp' | 'udp' | 'any'>('tcp');
  const [newAction, setNewAction] = useState<'allow' | 'deny'>('allow');
  const [newSourceIp, setNewSourceIp] = useState('');
  const [ruleToDelete, setRuleToDelete] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'enable' | 'disable' | 'reset'; title: string; message: string } | null>(null);

  const { toast } = useToast();

  async function loadData() {
    if (!nodeId) return;
    setLoading(true);
    setError(null);
    try {
      const [fwRes, portsRes] = await Promise.allSettled([
        api.nodeEngine.firewallStatus(nodeId),
        api.nodeEngine.listeningPorts(nodeId),
      ]);
      if (fwRes.status === 'fulfilled') {
        setStatus(fwRes.value);
      } else {
        setError(fwRes.reason?.message || 'Failed to load firewall status');
      }
      if (portsRes.status === 'fulfilled') {
        setListening(portsRes.value?.ports || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with node agent');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [nodeId]);

  async function handleOpenPort() {
    if (!nodeId || !newPort.trim()) return;
    setActionLoading(true);
    try {
      await api.nodeEngine.addFirewallRule(nodeId, {
        port: newPort.trim(),
        protocol: newProtocol,
        action: newAction,
        sourceIp: newSourceIp.trim() || undefined,
      });
      toast(`Port ${newPort} (${newProtocol.toUpperCase()}) ${newAction.toUpperCase()} rule applied`, 'success');
      setOpenModalOpen(false);
      setNewPort('');
      setNewSourceIp('');
      loadData();
    } catch (err: any) {
      toast(err.message || 'Failed to add firewall rule', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleQuickOpen(preset: { port: string; protocol: string; label: string }) {
    if (!nodeId) return;
    setActionLoading(true);
    try {
      await api.nodeEngine.addFirewallRule(nodeId, {
        port: preset.port,
        protocol: preset.protocol,
        action: 'allow',
      });
      toast(`Allowed ${preset.label} (${preset.port}/${preset.protocol}) in UFW`, 'success');
      loadData();
    } catch (err: any) {
      toast(err.message || `Failed to open ${preset.label}`, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDeleteRule() {
    if (!nodeId || !ruleToDelete) return;
    setActionLoading(true);
    try {
      await api.nodeEngine.deleteFirewallRule(nodeId, {
        ruleIndex: ruleToDelete.index,
        port: ruleToDelete.port,
        protocol: ruleToDelete.protocol,
      });
      toast('Firewall rule deleted successfully', 'success');
      setRuleToDelete(null);
      loadData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete firewall rule', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function executeConfirmAction() {
    if (!nodeId || !confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'enable') {
        await api.nodeEngine.enableFirewall(nodeId);
        toast('UFW Firewall enabled successfully', 'success');
      } else if (confirmAction.type === 'disable') {
        await api.nodeEngine.disableFirewall(nodeId);
        toast('UFW Firewall disabled', 'warning');
      } else if (confirmAction.type === 'reset') {
        await api.nodeEngine.resetFirewall(nodeId);
        toast('UFW Firewall rules reset to defaults', 'info');
      }
      setConfirmAction(null);
      loadData();
    } catch (err: any) {
      toast(err.message || `Failed to ${confirmAction.type} firewall`, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (!nodeId) {
    return (
      <EmptyState
        title="No Compute Node Selected"
        message="Select a compute node from the top selector or Onboarding tab to view and orchestrate its ports and UFW firewall."
      />
    );
  }

  const isFwActive = status?.enabled || status?.status?.toLowerCase().includes('active');

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {/* Top Firewall Control Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isFwActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              <ShieldIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">UFW Host Firewall</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${isFwActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  {isFwActive ? 'ACTIVE / SHIELD ON' : 'INACTIVE'}
                </span>
                {loading && <Spinner label="Loading..." />}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Linux kernel Netfilter / UFW firewall engine on this VPS compute node. Dev role privileged.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              disabled={loading || actionLoading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setOpenModalOpen(true)}
              disabled={actionLoading}
            >
              + Open Port / Range
            </Button>
            {isFwActive ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  setConfirmAction({
                    type: 'disable',
                    title: 'Disable UFW Firewall?',
                    message: 'Disabling UFW will turn off packet filtering on this compute node. All listening ports will become exposed to the public internet.',
                  })
                }
                disabled={actionLoading}
              >
                Disable Firewall
              </Button>
            ) : (
              <Button
                variant="success"
                size="sm"
                onClick={() =>
                  setConfirmAction({
                    type: 'enable',
                    title: 'Enable UFW Firewall?',
                    message: 'Enabling UFW will actively filter network packets according to active rules. Ensure port 22/tcp (SSH) is allowed to avoid getting locked out.',
                  })
                }
                disabled={actionLoading}
              >
                Enable Firewall
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setConfirmAction({
                  type: 'reset',
                  title: 'Reset All UFW Rules?',
                  message: 'This will reset UFW rules to default policy (deny incoming, allow outgoing). You will need to re-open SSH and service ports.',
                })
              }
              disabled={actionLoading}
            >
              Reset Rules
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Presets Section */}
      <Card title="Quick Allow Presets">
        <p className="text-xs text-text-muted mb-3">
          1-click open common developer, web server, and database ports in UFW:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {PORT_PRESETS.map((p) => {
            const isAlreadyOpen = status?.rules?.some((r: any) => {
              const rulePort = String(r.port || r.to || '');
              return rulePort.includes(p.port) && (r.action || '').toUpperCase().includes('ALLOW');
            });

            return (
              <div
                key={p.port + p.protocol}
                className="glass p-3 rounded-xl border border-white/[0.06] hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-text-primary">{p.label}</span>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{p.port}/{p.protocol}</span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-1 truncate">{p.desc}</p>
                </div>
                <div className="mt-3">
                  {isAlreadyOpen ? (
                    <span className="w-full text-center py-1 block text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg">
                      Open
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-[11px] py-1"
                      onClick={() => handleQuickOpen(p)}
                      disabled={actionLoading}
                    >
                      Allow Port
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Active Firewall Rules Table */}
      <Card
        title={`Active UFW Rules (${status?.rules?.length || 0})`}
        action={
          <span className="text-xs text-text-muted font-mono">
            {status?.status || 'Active numbered rules'}
          </span>
        }
      >
        {status?.rules && status.rules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="p-3">#</th>
                  <th className="p-3">To / Port</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">From / Source</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {status.rules.map((rule: any, idx: number) => {
                  const ruleIndex = rule.index || idx + 1;
                  const isAllow = (rule.action || '').toUpperCase().includes('ALLOW');
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="p-3 text-text-muted">[{ruleIndex}]</td>
                      <td className="p-3 font-bold text-text-primary">{rule.to || `${rule.port}/${rule.protocol}`}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${isAllow ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {rule.action}
                        </span>
                      </td>
                      <td className="p-3 text-text-muted">{rule.from || 'Anywhere'}</td>
                      <td className="p-3 text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRuleToDelete(rule)}
                          disabled={actionLoading}
                          className="text-[11px] py-1 px-2.5"
                        >
                          Close Port
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-text-muted text-xs">
            {loading ? <Spinner label="Fetching UFW rules..." /> : 'No custom rules found. Default policy is active.'}
          </div>
        )}
      </Card>

      {/* Active Listening Ports on VPS (from ss -tuln) */}
      <Card
        title={`VPS Host Listening Ports (${listening?.length || 0})`}
        action={
          <span className="text-xs text-text-muted font-mono">
            Real-time kernel sockets (ss -tuln)
          </span>
        }
      >
        {listening && listening.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="p-3">Proto</th>
                  <th className="p-3">Port</th>
                  <th className="p-3">Bind Address</th>
                  <th className="p-3">Process / Service</th>
                  <th className="p-3 text-right">Firewall Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {listening.map((sock, idx) => {
                  const isPortAllowed = status?.rules?.some((r: any) => {
                    const rulePort = String(r.port || r.to || '');
                    return rulePort.includes(String(sock.port)) && (r.action || '').toUpperCase().includes('ALLOW');
                  });

                  return (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="p-3 uppercase text-cyan-400 font-bold">{sock.protocol}</td>
                      <td className="p-3 font-bold text-text-primary">{sock.port}</td>
                      <td className="p-3 text-text-muted">{sock.address}</td>
                      <td className="p-3 text-accent-violet-light font-semibold">{sock.process || 'kernel/daemon'}</td>
                      <td className="p-3 text-right">
                        {isPortAllowed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Open in UFW</span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              handleQuickOpen({
                                port: String(sock.port),
                                protocol: sock.protocol.toLowerCase(),
                                label: sock.process || `Port ${sock.port}`,
                              })
                            }
                            disabled={actionLoading}
                            className="text-[11px] py-1 px-2.5"
                          >
                            Allow in UFW
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-text-muted text-xs">
            {loading ? <Spinner label="Scanning listening sockets..." /> : 'No listening sockets discovered.'}
          </div>
        )}
      </Card>

      {/* Modal: Open Port / Range */}
      {openModalOpen && (
        <Modal
          open={openModalOpen}
          onClose={() => setOpenModalOpen(false)}
          title="Open Port / Port Range in UFW"
        >
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Add a packet filtering rule to UFW. This allows or denies inbound traffic to specific ports or port ranges.
            </p>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Port or Range (e.g. 8080, or 3000:3010)
              </label>
              <Input
                placeholder="e.g. 8080 or 8000:8010"
                value={newPort}
                onChange={(e) => setNewPort(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Protocol
                </label>
                <select
                  value={newProtocol}
                  onChange={(e) => setNewProtocol(e.target.value as any)}
                  className="w-full glass bg-[#12121a] border border-white/10 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-white/30"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="any">TCP & UDP (Any)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Action
                </label>
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value as any)}
                  className="w-full glass bg-[#12121a] border border-white/10 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-white/30"
                >
                  <option value="allow">ALLOW</option>
                  <option value="deny">DENY</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Source IP / Subnet (Optional)
              </label>
              <Input
                placeholder="Leave blank for Anywhere, or e.g. 192.168.1.100/32"
                value={newSourceIp}
                onChange={(e) => setNewSourceIp(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpenModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleOpenPort}
                disabled={!newPort.trim() || actionLoading}
              >
                {actionLoading ? <Spinner label="Applying..." /> : 'Apply UFW Rule'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Rule Confirmation Dialog */}
      {ruleToDelete && (
        <ConfirmDialog
          open={!!ruleToDelete}
          title="Close Port / Delete Firewall Rule"
          message={`Are you sure you want to delete rule [${ruleToDelete.index || ruleToDelete.port || ''}] (${ruleToDelete.to || ruleToDelete.port} ${ruleToDelete.action})? Incoming traffic to this port will revert to default policy.`}
          confirmLabel="Delete Rule"
          danger
          onConfirm={confirmDeleteRule}
          onClose={() => setRuleToDelete(null)}
        />
      )}

      {/* Firewall Master Action Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.type === 'enable' ? 'Enable UFW' : confirmAction.type === 'disable' ? 'Disable UFW' : 'Reset Rules'}
          danger={confirmAction.type === 'disable' || confirmAction.type === 'reset'}
          onConfirm={executeConfirmAction}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 8: WEB SSH TERMINAL (DIRECT INTERACTIVE SHELL)
// ─────────────────────────────────────────────────────────────────────────────

function TerminalTabView({
  nodeId,
  nodeLabel,
}: {
  nodeId: string | null;
  nodeLabel?: string;
}) {
  const [reconnectKey, setReconnectKey] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!nodeId) {
    return (
      <EmptyState
        title="No Compute Node Selected"
        message="Select a compute node from the top selector or Onboarding tab to launch an interactive Web SSH terminal session."
      />
    );
  }

  return (
    <div className={`space-y-4 ${isFullScreen ? 'fixed inset-0 z-50 p-6 bg-[#0a0a0f] overflow-auto' : ''}`}>
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent-violet/10 text-accent-violet-light border border-accent-violet/20">
              <TerminalIcon />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>Interactive Web SSH Terminal</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-accent-violet/20 text-accent-violet-light border border-accent-violet/30">
                  {nodeLabel || nodeId.slice(0, 8)}
                </span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Direct WebSocket SSH shell gateway with xterm.js terminal emulation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReconnectKey((k) => k + 1)}
            >
              Reconnect
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullScreen((fs) => !fs)}
            >
              {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            </Button>
          </div>
        </div>
      </Card>

      <div className={`glass rounded-2xl border border-white/[0.08] overflow-hidden p-2 bg-[#0a0a0f] shadow-2xl ${isFullScreen ? 'h-[calc(100vh-140px)]' : 'min-h-[500px]'}`}>
        <SshTerminal
          key={`${nodeId}-${reconnectKey}`}
          kind="node"
          id={nodeId}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}
