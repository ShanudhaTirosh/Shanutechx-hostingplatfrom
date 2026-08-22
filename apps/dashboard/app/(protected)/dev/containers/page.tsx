'use client';

import { useEffect, useState } from 'react';
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

/**
 * Dev/admin-only: every container on a chosen node, with start/stop/restart
 * and a logs viewer. Reuses the Node Agent's docker.js primitives — see
 * apps/api/src/routes/containers.ts. Stop here is non-destructive (docker
 * stop, not remove) since this list can include infra containers, not just
 * customer deployments.
 */
export default function DevContainersPage() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [containers, setContainers] = useState<NodeContainer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logsTarget, setLogsTarget] = useState<NodeContainer | null>(null);
  const [logs, setLogs] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    api.nodes.list().then((d) => {
      setNodes(d.nodes);
      if (d.nodes.length > 0) setSelectedNodeId(d.nodes[0].id);
    }).catch((err) => setError(err.message));
  }, []);

  function loadContainers(nodeId: string) {
    setContainers(null);
    api.containers.list(nodeId).then((d) => setContainers(d.containers)).catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (selectedNodeId) loadContainers(selectedNodeId);
  }, [selectedNodeId]);

  async function handleAction(container: NodeContainer, action: 'start' | 'stop' | 'restart') {
    if (!selectedNodeId) return;
    setBusyId(container.id);
    try {
      await api.containers.action(selectedNodeId, container.id, action);
      toast(`Container ${action === 'restart' ? 'restarted' : action + 'ped'}.`, 'success');
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
    setLogs('Loading...');
    try {
      const { logs } = await api.containers.logs(selectedNodeId, container.id);
      setLogs(logs || '(no output)');
    } catch (err: any) {
      setLogs(`Failed to load logs: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Containers"
        description="Every container running on a node — start, stop (non-destructive), restart, and view logs. Dev/admin only."
      />

      {error && <ErrorBanner message={error} />}

      {nodes === null && <Spinner label="Loading nodes..." />}
      {nodes?.length === 0 && <EmptyState message="No nodes registered yet — add one under Nodes first." />}

      {nodes && nodes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedNodeId(n.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedNodeId === n.id
                  ? 'bg-accent-violet text-white shadow-glow-violet'
                  : 'glass text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
              }`}
            >
              {n.label} ({n.ip})
            </button>
          ))}
        </div>
      )}

      {containers === null && selectedNodeId && <Spinner label="Loading containers..." />}
      {containers?.length === 0 && <EmptyState message="No containers found on this node." />}

      <div className="space-y-2">
        {containers?.map((c) => (
          <Card key={c.id} className="border border-white/[0.06] flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-medium text-text-primary text-sm truncate">{c.name}</p>
                <Badge status={c.state === 'running' ? 'running' : c.state === 'exited' ? 'stopped' : c.state} />
              </div>
              <p className="text-xs text-text-faint truncate">{c.image} · {c.status}</p>
              {c.ports.length > 0 && (
                <p className="text-[10px] text-text-faint">
                  {c.ports.map((p) => `${p.privatePort}${p.publicPort ? `→${p.publicPort}` : ''}/${p.type}`).join(', ')}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => handleViewLogs(c)}>Logs</Button>
              {c.state === 'running' ? (
                <>
                  <Button size="sm" variant="secondary" loading={busyId === c.id} onClick={() => handleAction(c, 'restart')}>Restart</Button>
                  <Button size="sm" variant="danger" loading={busyId === c.id} onClick={() => handleAction(c, 'stop')}>Stop</Button>
                </>
              ) : (
                <Button size="sm" variant="secondary" loading={busyId === c.id} onClick={() => handleAction(c, 'start')}>Start</Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!logsTarget} onClose={() => setLogsTarget(null)} title={`Logs — ${logsTarget?.name ?? ''}`} width="max-w-3xl">
        <pre className="bg-black/40 rounded-xl p-3 text-[11px] font-mono text-text-muted max-h-[60vh] overflow-auto whitespace-pre-wrap">
          {logs}
        </pre>
      </Modal>
    </div>
  );
}
