import type { PlatformNode, NodeStats } from '@shanutechx/types';
import { BaseClient } from './base.js';

export class NodesResource extends BaseClient {
  async list(): Promise<PlatformNode[]> {
    const res = await this.httpGet<{ nodes: PlatformNode[] }>('/api/nodes');
    return res.nodes;
  }

  async get(id: string): Promise<PlatformNode> {
    return this.httpGet<PlatformNode>(`/api/nodes/${id}`);
  }

  async getStats(id: string): Promise<NodeStats> {
    return this.httpGet<NodeStats>(`/api/nodes/${id}/stats`);
  }

  async getInstallScript(): Promise<string> {
    const res = await this.httpGet<{ script: string }>('/api/nodes/install-script');
    return res.script;
  }
}
