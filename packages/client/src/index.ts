/**
 * @shanutechx/client
 *
 * Full-featured HTTP API client for the ShanuTechX platform.
 *
 * @example
 * ```typescript
 * import { ShanuTechXClient } from '@shanutechx/client';
 *
 * const client = new ShanuTechXClient({
 *   apiUrl: 'https://api.shanutechx.com',
 *   token: 'your-jwt-token',          // or call client.auth.login() first
 * });
 *
 * // List all your deployments
 * const { deployments } = await client.deployments.list();
 *
 * // Read a file from a deployment workspace
 * const content = await client.fs.read('deploy-id', 'src/index.ts');
 *
 * // Get connected Git repos
 * const repos = await client.git.listAllRepos();
 * ```
 */

import type { ShanuTechXClientConfig } from './base.js';
import { BaseClient } from './base.js';
import { AuthResource } from './auth.js';
import { DeploymentsResource } from './deployments.js';
import { FilesystemResource } from './filesystem.js';
import { CatalogResource } from './catalog.js';
import { NodesResource } from './nodes.js';
import { DatabasesResource } from './databases.js';
import { GitResource } from './git.js';
import { MonitoringResource } from './monitoring.js';

export { ShanuTechXClientConfig };

/**
 * The main ShanuTechX SDK client.
 * All API resources are namespaced under this object.
 */
export class ShanuTechXClient extends BaseClient {
  /** Authentication — login, register, refresh token, get current user */
  readonly auth: AuthResource;

  /** Deployments — create, start/stop, env vars, logs, webhooks, domains */
  readonly deployments: DeploymentsResource;

  /** File Manager — browse, read, write, upload, extract, git push */
  readonly fs: FilesystemResource;

  /** App Catalog — list templates, deploy one-click apps */
  readonly catalog: CatalogResource;

  /** Platform Nodes — list nodes, get stats */
  readonly nodes: NodesResource;

  /** Managed Databases — provision PostgreSQL, MySQL, Redis, MongoDB */
  readonly databases: DatabasesResource;

  /** Git Integration — connect GitHub/GitLab accounts, list repos */
  readonly git: GitResource;

  /** Uptime Monitoring — HTTP/TCP/DNS/SSL synthetic monitors */
  readonly monitoring: MonitoringResource;

  constructor(config: ShanuTechXClientConfig) {
    super(config);

    // All sub-resources share the same config so they use the same token
    const shared = config;
    this.auth = new AuthResource(shared);
    this.deployments = new DeploymentsResource(shared);
    this.fs = new FilesystemResource(shared);
    this.catalog = new CatalogResource(shared);
    this.nodes = new NodesResource(shared);
    this.databases = new DatabasesResource(shared);
    this.git = new GitResource(shared);
    this.monitoring = new MonitoringResource(shared);
  }

  /**
   * Set the auth token on all sub-resources simultaneously.
   * Call this after a successful login.
   */
  override setToken(token: string): void {
    super.setToken(token);
    [
      this.auth,
      this.deployments,
      this.fs,
      this.catalog,
      this.nodes,
      this.databases,
      this.git,
      this.monitoring,
    ].forEach((r) => r.setToken(token));
  }

  /** Clear the auth token from all sub-resources (after logout). */
  override clearToken(): void {
    super.clearToken();
    [
      this.auth,
      this.deployments,
      this.fs,
      this.catalog,
      this.nodes,
      this.databases,
      this.git,
      this.monitoring,
    ].forEach((r) => r.clearToken());
  }

  /**
   * Convenience: login and automatically store the returned token.
   * @returns The full auth session (token + user)
   */
  async login(email: string, password: string) {
    const session = await this.auth.login({ email, password });
    this.setToken(session.token);
    return session;
  }
}

// Named exports for tree-shaking / direct sub-resource imports
export { AuthResource } from './auth.js';
export { DeploymentsResource } from './deployments.js';
export { FilesystemResource } from './filesystem.js';
export { CatalogResource } from './catalog.js';
export { NodesResource } from './nodes.js';
export { DatabasesResource } from './databases.js';
export { GitResource } from './git.js';
export { MonitoringResource } from './monitoring.js';
export { BaseClient } from './base.js';
export type { FileItem, FileListResponse } from './filesystem.js';
export type { ListDeploymentsParams, DeploymentListResponse, EnvVarsResponse } from './deployments.js';
export type { Monitor, MonitorCreateInput } from './monitoring.js';
