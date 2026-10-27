import type {
  Deployment,
  DeploymentCreateInput,
  DeploymentStatus,
  ResourceUsage,
  WebhookInfo,
  WebHostingDeployInput,
  BotHostingDeployInput,
  BotDeploymentResponse,
  RepoDeployInput,
  NixpacksConfig,
  NixpacksConfigResponse,
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
    const res = await this.httpGet<{ logs: string | string[] }>(
      `/api/deployments/${id}/logs`,
      lines !== undefined ? { tail: lines, lines } : undefined,
    );
    if (Array.isArray(res.logs)) return res.logs;
    return typeof res.logs === 'string' ? res.logs.split('\n').filter(Boolean) : [];
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

  /**
   * Deploy web hosting application (PHP, HTML, Node.js, Next.js, Vite, Python)
   * with automatic subdomain provisioning and SSL certificate.
   */
  async deployWebHosting(input: WebHostingDeployInput): Promise<Deployment> {
    const res = await this.httpPost<{ ok: boolean; deployment?: Deployment; error?: any }>(
      '/api/deployments/web-hosting',
      input,
    );
    return res.deployment ?? (res as unknown as Deployment);
  }

  /** Alias for deployWebHosting */
  async deployWeb(input: WebHostingDeployInput): Promise<Deployment> {
    return this.deployWebHosting(input);
  }

  /**
   * Guided bot hosting deployment supporting continuous 24/7 runners for
   * Discord (Python/Node.js), WhatsApp (Baileys QR), and Lavalink audio nodes.
   */
  async deployBotHosting(input: BotHostingDeployInput): Promise<BotDeploymentResponse> {
    return this.httpPost<BotDeploymentResponse>('/api/deployments/bot-hosting', input);
  }

  /** Alias for deployBotHosting */
  async deployBot(input: BotHostingDeployInput): Promise<BotDeploymentResponse> {
    return this.deployBotHosting(input);
  }

  /**
   * Deploy application from Git repository (Public/Private GitHub/GitLab/Custom)
   * using Nixpacks, Railwaypacks (Railpack), or Dockerfile engine.
   */
  async deployRepo(input: RepoDeployInput): Promise<Deployment> {
    const payload = {
      serviceType: input.serviceType ?? 'web_hosting',
      repoUrl: input.repoUrl,
      preferredName: input.preferredName,
      branch: input.branch ?? 'main',
      customSubdomain: input.customSubdomain,
      internalPort: input.internalPort ?? 3000,
      envVars: input.envVars,
      builder: input.builder ?? input.nixpacksConfig?.builder ?? 'AUTO',
      rootDir: input.rootDir ?? input.nixpacksConfig?.rootDir ?? null,
      watchPaths: input.watchPaths ?? input.nixpacksConfig?.watchPaths ?? [],
      nixpacksConfig: input.nixpacksConfig,
      gitProvider: input.gitProvider,
      gitAccountId: input.gitAccountId,
      gitToken: input.gitToken,
      startCommand: input.startCommand,
      entryFile: input.entryFile,
      frameworkPreset: input.frameworkPreset ?? 'auto',
      exposureMode: input.exposureMode ?? 'ssl_with_proxy',
      publishedPort: input.publishedPort,
      cpuLimit: input.cpuLimit,
      memoryLimit: input.memoryLimit,
      storageLimit: input.storageLimit,
      orderItemId: input.orderItemId,
      isPendingConfig: input.isPendingConfig,
    };

    const res = await this.httpPost<{ ok: boolean; deployment?: Deployment } | Deployment>(
      '/api/deployments',
      payload,
    );
    if ('deployment' in res && res.deployment) {
      return res.deployment;
    }
    return res as Deployment;
  }

  /**
   * Retrieve Nixpacks and Monorepo build configuration for a deployment.
   */
  async getNixpacksConfig(id: string): Promise<NixpacksConfigResponse> {
    return this.httpGet<NixpacksConfigResponse>(`/api/deployments/${id}/nixpacks`);
  }

  /**
   * Update Nixpacks / Railwaypack phases, packages, and build settings for a deployment.
   */
  async updateNixpacksConfig(id: string, config: NixpacksConfig): Promise<NixpacksConfigResponse> {
    return this.httpPut<NixpacksConfigResponse>(`/api/deployments/${id}/nixpacks`, config);
  }
}

