// ─── Node / VPS Node Types ─────────────────────────────────────────────────

export type NodeStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

export interface PlatformNode {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: NodeStatus;
  region: string | null;
  cpuCores: number | null;
  ramGb: number | null;
  diskGb: number | null;
  os: string | null;
  agentVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface NodeStats {
  nodeId: string;
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  loadAverage: [number, number, number];
  uptimeSeconds: number;
  timestamp: string;
}
