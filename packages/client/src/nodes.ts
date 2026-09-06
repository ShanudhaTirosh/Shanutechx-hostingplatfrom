import type { PlatformNode, NodeStats } from '@shanutechx/types';
import { BaseClient } from './base.js';

export class NodesResource extends BaseClient {
  async list(): Promise<PlatformNode[]> {
    const res = await this.httpGet<{ nodes: PlatformNode[] }>('/api/nodes');
    return res.nodes;
  }

  async get(id: string): Promise<PlatformNode> {
    const res = await this.httpGet<{ node: PlatformNode }>(`/api/nodes/${id}`);
    return res.node;
  }

  async getStats(id: string): Promise<NodeStats> {
    const node: any = await this.get(id);
    return {
      nodeId: id,
      cpuUsagePercent: node.cpuUsedPct ?? 0,
      memoryUsedMb: node.ramUsedMb ?? 0,
      memoryTotalMb: (node.ramMb ?? node.ramGb ? (node.ramGb * 1024) : 2048),
      diskUsedGb: node.diskUsedGb ?? 0,
      diskTotalGb: node.diskGb ?? 40,
      loadAverage: [0, 0, 0],
      uptimeSeconds: 0,
      timestamp: node.lastSeenAt || new Date().toISOString(),
    };
  }

  async getInstallScript(): Promise<string> {
    const res = await fetch(`${this.apiUrl}/api/nodes/install.sh`);
    return res.text();
  }

  async triggerFailover(id: string): Promise<{ success: boolean; message: string; result: any }> {
    return this.httpPost<{ success: boolean; message: string; result: any }>(`/api/nodes/${id}/failover`, {});
  }

  async getFailoverStatus(id: string): Promise<{ logs: any[] }> {
    return this.httpGet<{ logs: any[] }>(`/api/nodes/${id}/failover-status`);
  }
}

