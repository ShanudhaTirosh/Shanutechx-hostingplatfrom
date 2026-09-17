'use client';

import { useEffect, useState } from 'react';
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
  MetricCard,
  ProgressBar,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function DevSystemPage() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [dfData, setDfData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function loadSystemData(nodeId: string) {
    setLoading(true);
    setSystemInfo(null);
    setDfData(null);
    Promise.all([
      api.dockerSystem.info(nodeId).catch(() => null),
      api.dockerSystem.df(nodeId).catch(() => null),
    ])
      .then(([info, df]) => {
        setSystemInfo(info);
        setDfData(df);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (selectedNodeId) loadSystemData(selectedNodeId);
  }, [selectedNodeId]);

  function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Docker Engine System Overview"
        description="Low-level Docker daemon info, cgroup driver details, kernel metrics, and disk space usage (docker df)."
        action={
          selectedNodeId ? (
            <Button size="sm" variant="secondary" onClick={() => loadSystemData(selectedNodeId)}>
              Refresh Telemetry
            </Button>
          ) : undefined
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

      {loading && <Spinner label="Querying Docker daemon info..." />}

      {/* Metrics Header */}
      {systemInfo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Docker Version"
            value={systemInfo.ServerVersion || 'N/A'}
            change={`API ${systemInfo.ApiVersion || '1.43'}`}
          />
          <MetricCard
            title="Containers"
            value={systemInfo.Containers || 0}
            change={`${systemInfo.ContainersRunning || 0} Running`}
            changeType="positive"
          />
          <MetricCard
            title="Images Stored"
            value={systemInfo.Images || 0}
            change="Cached Layers"
          />
          <MetricCard
            title="CPUs / Memory"
            value={`${systemInfo.NCPU || 0} Cores`}
            change={formatBytes(systemInfo.MemTotal)}
          />
        </div>
      )}

      {/* Daemon Details */}
      {systemInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Engine Architecture & Driver">
            <div className="space-y-2 text-xs font-mono text-text-muted">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Operating System:</span>
                <span className="text-white font-semibold">{systemInfo.OperatingSystem}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Kernel Version:</span>
                <span className="text-white font-semibold">{systemInfo.KernelVersion}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Architecture:</span>
                <span className="text-white font-semibold">{systemInfo.Architecture}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Storage Driver:</span>
                <span className="text-cyan-300 font-semibold">{systemInfo.Driver}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Cgroup Driver:</span>
                <span className="text-violet-300 font-semibold">{systemInfo.CgroupDriver || 'cgroupfs'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Docker Root Dir:</span>
                <span className="text-emerald-300 font-semibold">{systemInfo.DockerRootDir}</span>
              </div>
            </div>
          </Card>

          <Card title="Plugins & Features">
            <div className="space-y-2 text-xs font-mono text-text-muted">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>IPv4 Forwarding:</span>
                <span className={systemInfo.IPv4Forwarding ? 'text-emerald-400' : 'text-rose-400'}>
                  {systemInfo.IPv4Forwarding ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Bridge NF iptables:</span>
                <span className={systemInfo.BridgeNfIptables ? 'text-emerald-400' : 'text-rose-400'}>
                  {systemInfo.BridgeNfIptables ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Logging Driver:</span>
                <span className="text-white font-semibold">{systemInfo.LoggingDriver || 'json-file'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Live Restore:</span>
                <span className={systemInfo.LiveRestoreEnabled ? 'text-emerald-400' : 'text-amber-400'}>
                  {systemInfo.LiveRestoreEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Disk Usage (docker df) */}
      {dfData && (
        <Card title="Docker Engine Disk Usage Breakdown (docker df)">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider block mb-1">Images</span>
                <p className="text-lg font-bold text-white">{formatBytes(dfData.LayersSize || 0)}</p>
                <p className="text-xs text-text-faint">{dfData.Images?.length || 0} images total</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider block mb-1">Containers</span>
                <p className="text-lg font-bold text-white">
                  {formatBytes(dfData.Containers?.reduce((acc: number, c: any) => acc + (c.SizeRw || 0), 0) || 0)}
                </p>
                <p className="text-xs text-text-faint">{dfData.Containers?.length || 0} containers active</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider block mb-1">Volumes</span>
                <p className="text-lg font-bold text-white">
                  {formatBytes(dfData.Volumes?.reduce((acc: number, v: any) => acc + (v.UsageData?.Size || 0), 0) || 0)}
                </p>
                <p className="text-xs text-text-faint">{dfData.Volumes?.length || 0} volumes mounted</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider block mb-1">Build Cache</span>
                <p className="text-lg font-bold text-white">
                  {formatBytes(dfData.BuildCache?.reduce((acc: number, b: any) => acc + (b.Size || 0), 0) || 0)}
                </p>
                <p className="text-xs text-text-faint">{dfData.BuildCache?.length || 0} cache records</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
