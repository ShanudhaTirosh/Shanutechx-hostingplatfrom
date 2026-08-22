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
   * Audit finding H10: there is no DELETE /api/deployments/:id route on
   * the real API -- deployments are torn down via stop() (which stops
   * and removes the running container) but the Deployment record itself
   * is never hard-deleted. This previously called a nonexistent route
   * and would 404. Throwing explicitly here is intentional: adding a
   * real delete-the-record endpoint needs a deliberate decision about
   * cascade behavior (subscriptions, invoices, logs) that's outside the
   * scope of this fix -- use stop() to tear down the running workload.
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

  // Audit finding H10: there is no GET /api/deployments/:id/stats route.
  // Live resource usage is embedded in the deployment detail response
  // (GET /api/deployments/:id) as `resourceUsage`, which can be null if
  // the node-agent couldn't be reached. Fetch the detail and extract it.
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
   * Audit finding H10: previously POSTed to /domains (no such route).
   * The real route is POST /api/deployments/:id/custom-domain, which
   * only supports one custom domain per deployment at a time (not an
   * array), and separately optionally accepts a scoped Cloudflare API
   * token to auto-create the DNS record instead of asking the customer
   * to add a CNAME manually. cloudflare credentials are used once and
   * never stored server-side.
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

  /** Audit finding H10: previously DELETE /domains/:domain (no such
   * route, and the real API only tracks one custom domain per
   * deployment, not a set) -- fixed to DELETE /custom-domain. */
  async removeDomain(id: string, _domain?: string): Promise<void> {
    return this.httpDelete(`/api/deployments/${id}/custom-domain`);
  }

  /** Update/change a deployment's primary subdomain under the main domain */
  async updateSubdomain(id: string, subdomain: string): Promise<{ ok: boolean; subdomain: string; url: string }> {
    return this.httpPatch<{ ok: boolean; subdomain: string; url: string }>(`/api/deployments/${id}/subdomain`, { subdomain });
  }
}
