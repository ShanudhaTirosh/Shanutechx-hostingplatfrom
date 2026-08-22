import type { NodeStats } from '@shanutechx/types';

export interface NodeAgentClientConfig {
  /** Node Agent URL, e.g. http://10.0.0.5:5000 */
  agentUrl: string;
  /** Shared secret for authenticating with the agent */
  secret: string;
  /** Timeout in ms (default: 30000) */
  timeout?: number;
}

export class NodeAgentClient {
  private agentUrl: string;
  private secret: string;
  private timeout: number;

  constructor(config: NodeAgentClientConfig) {
    this.agentUrl = config.agentUrl.replace(/\/$/, '');
    this.secret = config.secret;
    this.timeout = config.timeout ?? 30_000;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.agentUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-agent-secret': this.secret,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`NodeAgent HTTP ${res.status}: ${text}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /** Health check */
  async health(): Promise<{ status: string; version?: string }> {
    return this.request('GET', '/agent/health');
  }

  /** Get node hardware stats */
  async stats(): Promise<NodeStats> {
    return this.request('GET', '/agent/stats');
  }

  /** List running deployment containers */
  async listContainers(): Promise<Array<{ id: string; names: string[]; state: string }>> {
    return this.request('GET', '/agent/containers');
  }

  /** Stop container by deployment ID */
  // Audit finding H10: these three previously called
  // POST /agent/{stop,start,restart}/:id, which does not exist on the
  // real node-agent service -- its routes are action-last
  // (/agent/deployments/:id/{stop,start,restart}), not action-first.
  async stopContainer(deploymentId: string): Promise<void> {
    return this.request('POST', `/agent/deployments/${deploymentId}/stop`);
  }

  /** Start container by deployment ID */
  async startContainer(deploymentId: string): Promise<void> {
    return this.request('POST', `/agent/deployments/${deploymentId}/start`);
  }

  /** Restart container by deployment ID */
  async restartContainer(deploymentId: string): Promise<void> {
    return this.request('POST', `/agent/deployments/${deploymentId}/restart`);
  }

  /** Read workspace file */
  async readFile(deploymentId: string, path: string): Promise<string> {
    const res = await this.request<{ content: string }>(
      'GET',
      `/agent/fs/${deploymentId}/read?path=${encodeURIComponent(path)}`,
    );
    return res.content;
  }

  /** Write workspace file */
  async writeFile(deploymentId: string, path: string, content: string): Promise<void> {
    return this.request('PUT', `/agent/fs/${deploymentId}/write`, { path, content });
  }
}
