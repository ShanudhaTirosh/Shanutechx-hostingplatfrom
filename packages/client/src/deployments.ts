import type {
  Deployment,
  DeploymentCreateInput,
  DeploymentStatus,
  ResourceUsage,
  WebhookInfo,
} from '@shanutechx/types';
import { BaseClient } from './base.js';

export interface ListDeploymentsParams {
  status?: DeploymentStatus;
  nodeId?: string;
  page?: number;
  limit?: number;
}

export interface DeploymentListResponse {
  deployments: Deployment[];
  total: number;
  page: number;
  limit: number;
}

export interface EnvVarsResponse {
  envVars: Record<string, string>;
}

export class DeploymentsResource extends BaseClient {
  async list(params?: ListDeploymentsParams): Promise<DeploymentListResponse> {
    return this.httpGet<DeploymentListResponse>('/api/deployments', params as Record<string, string>);
  }

  async get(id: string): Promise<Deployment> {
    return this.httpGet<Deployment>(`/api/deployments/${id}`);
  }

  async create(input: DeploymentCreateInput): Promise<Deployment> {
    return this.httpPost<Deployment>('/api/deployments', input);
  }

  async stop(id: string): Promise<void> {
    return this.httpPost(`/api/deployments/${id}/stop`);
  }

  async start(id: string): Promise<void> {
    return this.httpPost(`/api/deployments/${id}/start`);
  }

  async restart(id: string): Promise<void> {
    return this.httpPost(`/api/deployments/${id}/restart`);
  }

  async redeploy(id: string): Promise<void> {
    return this.httpPost(`/api/deployments/${id}/redeploy`);
  }

  /**
   * Deployments are torn down via stop(). The Deployment record itself is kept.
   */
  async delete(_id: string): Promise<void> {
    throw new Error(
      'DeploymentsResource.delete() has no corresponding API route. Use stop() to stop the running deployment.'
    );
  }

  async getEnvVars(id: string): Promise<Record<string, string>> {
    const res = await this.httpGet<EnvVarsResponse>(`/api/deployments/${id}/env`);
    return res.envVars;
  }

  async updateEnvVars(
    id: string,
    envVars: Record<string, string>,
  ): Promise<void> {
    return this.httpPatch(`/api/deployments/${id}/env`, { envVars });
  }

  async getResourceUsage(id: string): Promise<ResourceUsage | null> {
    const deployment = await this.get(id);
    return (deployment as Deployment & { resourceUsage?: ResourceUsage | null }).resourceUsage ?? null;
  }

  async getLogs(id: string, lines?: number): Promise<string[]> {
    const res = await this.httpGet<{ logs: string[] }>(
      `/api/deployments/${id}/logs`,
      { lines },
    );
    return res.logs;
  }

  async getWebhookInfo(id: string): Promise<WebhookInfo> {
    return this.httpGet<WebhookInfo>(`/api/deployments/${id}/webhook-info`);
  }

  /**
   * Adds a custom domain to a deployment.
   */
  async addDomain(
    id: string,
    domain: string,
    cloudflare?: { apiToken: string; zoneId?: string },
  ): Promise<void> {
    return this.httpPost(`/api/deployments/${id}/custom-domain`, {
      domain,
      cloudflareApiToken: cloudflare?.apiToken,
      cloudflareZoneId: cloudflare?.zoneId,
    });
  }

  /** Verifies a pending custom domain's CNAME actually resolves, then
   * wires it up in the reverse proxy (issues TLS). */
  async verifyDomain(id: string): Promise<void> {
    return this.httpPost(`/api/deployments/${id}/custom-domain/verify`);
  }

  /** Removes a custom domain from a deployment. */
  async removeDomain(id: string, _domain?: string): Promise<void> {
    return this.httpDelete(`/api/deployments/${id}/custom-domain`);
  }

  /** Update/change a deployment's primary subdomain under the main domain */
  async updateSubdomain(id: string, subdomain: string): Promise<{ ok: boolean; subdomain: string; url: string }> {
    return this.httpPatch<{ ok: boolean; subdomain: string; url: string }>(`/api/deployments/${id}/subdomain`, { subdomain });
  }
}
