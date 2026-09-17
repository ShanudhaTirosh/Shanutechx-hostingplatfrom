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
  MetricRing,
  MetricCard,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

interface NodeContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  createdAt: number;
  ports: Array<{ privatePort: number; publicPort?: number; type: string }>;
}

export default function DevContainersPage() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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

  function loadContainers(nodeId: string) {
    setContainers(null);
    api.containers
      .list(nodeId)
      .then((d) => setContainers(d.containers))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (selectedNodeId) loadContainers(selectedNodeId);
  }, [selectedNodeId]);

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
    if (!selectedNodeId) return;
    setBusyId(container.id);
    try {
      if (action === 'pause') {
        await api.containers.pause(selectedNodeId, container.id);
        toast(`Container ${container.name} paused.`, 'success');
      } else if (action === 'unpause') {
        await api.containers.unpause(selectedNodeId, container.id);
        toast(`Container ${container.name} unpaused.`, 'success');
      } else if (action === 'remove') {
        await api.containers.remove(selectedNodeId, container.id);
        toast(`Container ${container.name} removed.`, 'success');
      } else {
        await api.containers.action(selectedNodeId, container.id, action);
        toast(`Container ${container.name} ${action === 'restart' ? 'restarted' : action + 'ped'}.`, 'success');
      }
      loadContainers(selectedNodeId);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewLogs(container: NodeContainer) {
    if (!selectedNodeId) return;
    setLogsTarget(container);
    setLogs('Loading logs...');
    try {
      const res = await api.containers.logs(selectedNodeId, container.id);
      setLogs(res.logs || '(no log output)');
    } catch (err: any) {
      setLogs(`Failed to load logs: ${err.message}`);
    }
  }

  async function handleViewTop(container: NodeContainer) {
    if (!selectedNodeId) return;
    setTopTarget(container);
    setTopData(null);
    try {
      const res = await api.containers.top(selectedNodeId, container.id);
      setTopData(res);
    } catch (err: any) {
      toast(`Failed to fetch processes: ${err.message}`, 'error');
    }
  }

  async function handleViewChanges(container: NodeContainer) {
    if (!selectedNodeId) return;
    setChangesTarget(container);
    setChangesData(null);
    try {
      const res = await api.containers.changes(selectedNodeId, container.id);
      setChangesData(res.changes || []);
    } catch (err: any) {
      toast(`Failed to fetch filesystem changes: ${err.message}`, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Docker Container Engine"
        description="Real-time Docker container management across all registered compute nodes."
        action={
          selectedNodeId ? (
            <Button size="sm" variant="secondary" onClick={() => loadContainers(selectedNodeId)}>
              Refresh
            </Button>
          ) : undefined
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
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {n.label} <span className="text-[10px] opacity-70">({n.ip})</span>
            </button>
          ))}
        </div>
      )}

      {/* Metrics Bar */}
      {containers && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Containers"
            value={stats.total}
            change="Active Node Engine"
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
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
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            title="Stopped"
            value={stats.stopped}
            change="Exited Containers"
            changeType="negative"
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search containers by name, image or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(['all', 'running', 'paused', 'stopped'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                statusFilter === filter
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-text-muted hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {nodes === null && <Spinner label="Discovering compute nodes..." />}
      {nodes?.length === 0 && <EmptyState message="No compute nodes registered in cluster." />}

      {containers === null && selectedNodeId && <Spinner label="Loading Docker containers..." />}
      {containers?.length === 0 && <EmptyState message="No Docker containers found on this node." />}

      {/* Containers List */}
      <div className="space-y-3">
        {filteredContainers.map((c) => (
          <Card key={c.id} className="glass-card hover:border-white/20 transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base tracking-tight truncate">{c.name}</span>
                  <Badge
                    status={
                      c.state === 'running'
                        ? 'running'
                        : c.state === 'paused'
                        ? 'pending'
                        : c.state === 'exited'
                        ? 'stopped'
                        : 'building'
                    }
                  />
                  <span className="text-[11px] font-mono text-text-faint bg-white/[0.05] px-2 py-0.5 rounded-md">
                    {c.id.substring(0, 12)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                  <span className="font-mono text-cyan-300/80">{c.image}</span>
                  <span>•</span>
                  <span>{c.status}</span>
                </div>

                {c.ports.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[10px] text-text-faint uppercase font-bold tracking-wider">Ports:</span>
                    {c.ports.map((p, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] font-mono bg-white/[0.06] text-text-primary px-2 py-0.5 rounded-lg border border-white/[0.08]"
                      >
                        {p.privatePort}
                        {p.publicPort ? ` → ${p.publicPort}` : ''} ({p.type})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions toolbar */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Button size="xs" variant="ghost" onClick={() => handleViewLogs(c)}>
                  Logs
                </Button>
                <Button size="xs" variant="ghost" onClick={() => handleViewTop(c)}>
                  Top
                </Button>
                <Button size="xs" variant="ghost" onClick={() => handleViewChanges(c)}>
                  Diff
                </Button>

                {c.state === 'running' && (
                  <>
                    <Button size="xs" variant="secondary" loading={busyId === c.id} onClick={() => handleAction(c, 'pause')}>
                      Pause
                    </Button>
                    <Button size="xs" variant="secondary" loading={busyId === c.id} onClick={() => handleAction(c, 'restart')}>
                      Restart
                    </Button>
                    <Button size="xs" variant="danger" loading={busyId === c.id} onClick={() => handleAction(c, 'stop')}>
                      Stop
                    </Button>
                  </>
                )}

                {c.state === 'paused' && (
                  <Button size="xs" variant="success" loading={busyId === c.id} onClick={() => handleAction(c, 'unpause')}>
                    Unpause
                  </Button>
                )}

                {(c.state === 'exited' || c.state === 'stopped') && (
                  <>
                    <Button size="xs" variant="success" loading={busyId === c.id} onClick={() => handleAction(c, 'start')}>
                      Start
                    </Button>
                    <Button size="xs" variant="danger" loading={busyId === c.id} onClick={() => handleAction(c, 'remove')}>
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Logs Modal */}
      <Modal open={!!logsTarget} onClose={() => setLogsTarget(null)} title={`Container Output — ${logsTarget?.name ?? ''}`} width="max-w-4xl">
        <pre className="bg-black/60 rounded-2xl p-4 text-[12px] font-mono text-emerald-400 max-h-[65vh] overflow-auto whitespace-pre-wrap border border-white/10 shadow-inner">
          {logs}
        </pre>
      </Modal>

      {/* Top Modal */}
      <Modal open={!!topTarget} onClose={() => setTopTarget(null)} title={`Active Processes — ${topTarget?.name ?? ''}`} width="max-w-4xl">
        {topData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-text-primary">
              <thead>
                <tr className="border-b border-white/10 text-text-muted">
                  {topData.Titles?.map((title: string, i: number) => (
                    <th key={i} className="p-2 font-semibold">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topData.Processes?.map((proc: string[], i: number) => (
                  <tr key={i} className="border-b border-white/[0.04] font-mono hover:bg-white/[0.02]">
                    {proc.map((val, j) => (
                      <td key={j} className="p-2 whitespace-nowrap">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Spinner label="Fetching active processes..." />
        )}
      </Modal>

      {/* Changes Modal */}
      <Modal open={!!changesTarget} onClose={() => setChangesTarget(null)} title={`Filesystem Diff — ${changesTarget?.name ?? ''}`} width="max-w-3xl">
        {changesData ? (
          <div className="max-h-[60vh] overflow-auto space-y-1 font-mono text-xs">
            {changesData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02]">
                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                  item.kind === 1 ? 'bg-emerald-500/20 text-emerald-400' :
                  item.kind === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {item.kind === 1 ? 'ADDED' : item.kind === 0 ? 'MODIFIED' : 'DELETED'}
                </span>
                <span className="text-text-primary truncate">{item.path}</span>
              </div>
            ))}
          </div>
        ) : (
          <Spinner label="Fetching filesystem changes..." />
        )}
      </Modal>
    </div>
  );
}
