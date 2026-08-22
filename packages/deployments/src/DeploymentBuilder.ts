import type { Deployment, DeploymentCreateInput } from '@shanutechx/types';
import type { ShanuTechXClient } from '@shanutechx/client';

/**
 * Fluent builder for constructing and triggering app deployments.
 *
 * @example
 * ```typescript
 * const deployment = await new DeploymentBuilder(client)
 *   .fromRepo('https://github.com/myorg/myapp')
 *   .onNode('node-123')
 *   .withPort(8080)
 *   .withEnv({ NODE_ENV: 'production', PORT: '8080' })
 *   .withLimits({ cpuCores: 1, memoryMb: 1024 })
 *   .deploy();
 * ```
 */
export class DeploymentBuilder {
  private config: Partial<DeploymentCreateInput> = {
    internalPort: 3000,
    envVars: {},
  };

  constructor(private readonly client: ShanuTechXClient) {}

  /** Set the repository URL (GitHub/GitLab/public git) */
  fromRepo(repoUrl: string): this {
    this.config.repoUrl = repoUrl;
    return this;
  }

  /** Select target VPS node ID */
  onNode(nodeId: string): this {
    this.config.nodeId = nodeId;
    return this;
  }

  /** Set internal application port */
  withPort(port: number): this {
    this.config.internalPort = port;
    return this;
  }

  /** Add or override environment variables */
  withEnv(envVars: Record<string, string>): this {
    this.config.envVars = {
      ...(this.config.envVars || {}),
      ...envVars,
    };
    return this;
  }

  /** Set container resource limits */
  withLimits(limits: { cpuCores?: number; memoryMb?: number; storageGb?: number }): this {
    if (limits.cpuCores !== undefined) this.config.cpuLimit = limits.cpuCores;
    if (limits.memoryMb !== undefined) this.config.memoryLimit = limits.memoryMb;
    if (limits.storageGb !== undefined) this.config.storageLimit = limits.storageGb;
    return this;
  }

  /** Associate a specific Git account ID for authentication */
  withGitAccount(gitAccountId: string): this {
    this.config.gitAccountId = gitAccountId;
    return this;
  }

  /** Set custom subdomain */
  withSubdomain(subdomain: string): this {
    this.config.subdomain = subdomain;
    return this;
  }

  /** Execute deployment creation */
  async deploy(): Promise<Deployment> {
    if (!this.config.repoUrl) {
      throw new Error('DeploymentBuilder error: repository URL is required (.fromRepo())');
    }
    if (!this.config.nodeId) {
      throw new Error('DeploymentBuilder error: node ID is required (.onNode())');
    }

    return this.client.deployments.create(this.config as DeploymentCreateInput);
  }
}
