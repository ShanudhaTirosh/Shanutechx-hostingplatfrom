import { env } from '../env';
import { logger } from './logger';
import { resolveRepoUrlForBuild } from './gitAuth';
import { resolveExposureForBuild } from './exposureDefaults';

interface Node {
  id: string;
  ip: string;
}

function agentUrl(node: Node, path: string) {
  return `http://${node.ip}:${env.nodeAgentPort}${path}`;
}

function agentHeaders(extra: Record<string, string> = {}) {
  return { 'x-agent-secret': env.nodeAgentSecret, ...extra };
}

export async function callNodeAgent(
  node: Node,
  path: string,
  method: string = 'GET',
  body?: any,
  timeoutMs: number = 60_000
): Promise<any> {
  const url = agentUrl(node, path);
  const headers = agentHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`callNodeAgent failed (${res.status}): ${errorText}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

export interface BuildAndRunParams {
  deploymentId: string;
  repoUrl: string;
  branch?: string;
  subdomain?: string;
  rootDomain?: string;
  deploymentsRootDomain?: string;
  internalPort: number;
  envVars?: Record<string, string>;
  cpuLimit?: number;      // CPU cores limit (0.1-16)
  memoryLimit?: number;   // Memory in MB (64-32768)
  storageLimit?: number;  // Storage in GB (1-500)
  backupRepoUrl?: string;
  startCommand?: string;
  entryFile?: string;
  frameworkPreset?: string;
  exposureMode?: string;  // ssl_with_proxy | ssl_direct | no_ssl
  publishedPort?: number;
}

export interface BuildEvent {
  phase: 'fetch' | 'build' | 'run' | 'done' | 'error';
  message?: string;
  log?: string;
  containerId?: string;
  containerName?: string;
}

/**
 * Triggers a build-and-run on the target node and streams progress events
 * back via onEvent — the node-agent responds with newline-delimited JSON so
 * build logs can be relayed to the client dashboard live, not just at the end.
 */
export async function buildAndRun(
  node: Node,
  params: BuildAndRunParams,
  onEvent: (event: BuildEvent) => void
): Promise<BuildEvent> {
  // The stored repoUrl carries no credentials; resolve a fresh one here, the single point every build passes through
  // (create, redeploy, webhook, failover, previews), so a token is never persisted or stale.
  const repoUrl = await resolveRepoUrlForBuild(params.deploymentId, params.repoUrl);
  // Likewise for exposure: rebuilds that do not pass publishedPort/exposureMode must keep what the deployment has.
  const exposure = await resolveExposureForBuild(params.deploymentId, { exposureMode: params.exposureMode, publishedPort: params.publishedPort });
  const payload = {
    ...params,
    repoUrl,
    exposureMode: exposure.exposureMode,
    publishedPort: exposure.publishedPort,
    deploymentsRootDomain: params.deploymentsRootDomain || env.deploymentsRootDomain,
    rootDomain: params.rootDomain || env.rootDomain,
  };
  const res = await fetch(
    agentUrl(node, `/agent/deployments/${params.deploymentId}/build-and-run`),
    {
      method: 'POST',
      headers: agentHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(600_000), // 10-minute maximum build timeout
    }
  );


  if (!res.body) {
    throw new Error('node-agent returned no response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let finalEvent: BuildEvent = { phase: 'error', message: 'No completion event received' };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const event: BuildEvent = JSON.parse(line);
      onEvent(event);
      if (event.phase === 'done' || event.phase === 'error') {
        finalEvent = event;
      }
    }
  }

  return finalEvent;
}

export async function fetchLogs(node: Node, containerId: string, tail = 200) {
  const res = await fetch(
    agentUrl(node, `/agent/deployments/${containerId}/logs?tail=${tail}`),
    { headers: agentHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to fetch logs (${res.status})`);
  const data = (await res.json()) as { logs: string };
  return data.logs;
}

export async function stopDeployment(node: Node, containerId: string) {
  const res = await fetch(agentUrl(node, `/agent/deployments/${containerId}/stop`), {
    method: 'POST',
    headers: agentHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to stop deployment (${res.status})`);
}

export async function cancelBuild(node: Node, deploymentId: string) {
  const res = await fetch(agentUrl(node, `/agent/deployments/${deploymentId}/cancel-build`), {
    method: 'POST',
    headers: agentHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to cancel build on node (${res.status})`);
}

export async function stopComposeProject(node: Node, projectName: string) {
  const res = await fetch(agentUrl(node, `/agent/compose/${encodeURIComponent(projectName)}`), {
    method: 'DELETE',
    headers: agentHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to stop compose project (${res.status})`);
}

export async function startDeployment(node: Node, containerId: string) {
  const res = await fetch(agentUrl(node, `/agent/deployments/${containerId}/start`), {
    method: 'POST',
    headers: agentHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to start deployment (${res.status})`);
}

export async function restartDeployment(node: Node, containerId: string) {
  const res = await fetch(agentUrl(node, `/agent/deployments/${containerId}/restart`), {
    method: 'POST',
    headers: agentHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to restart deployment (${res.status})`);
}

export async function fetchNodeStats(node: Node) {
  try {
    const res = await fetch(agentUrl(node, '/agent/stats'), { headers: agentHeaders(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return { cpuUsedPct: 0, ramUsedMb: 0, diskUsedGb: 0 };
    }
    const data: any = await res.json();
    return {
      cpuUsedPct: typeof data.cpuUsedPct === 'number' ? data.cpuUsedPct : (parseFloat(data.cpuUsedPct) || 0),
      ramUsedMb: typeof data.ramUsedMb === 'number' ? data.ramUsedMb : (parseInt(data.ramUsedMb, 10) || 0),
      diskUsedGb: typeof data.diskUsedGb === 'number' ? data.diskUsedGb : (parseInt(data.diskUsedGb, 10) || 0),
    };
  } catch {
    return { cpuUsedPct: 0, ramUsedMb: 0, diskUsedGb: 0 };
  }
}

/**
 * Writes a new LiveKit API key/secret into the node's LiveKit config and
 * restarts the LiveKit container so it picks it up — see the docstring on
 * routes/livekit.ts for why this has to happen at the node level rather
 * than via a LiveKit API call.
 */
export async function registerLiveKitKey(
  node: Node,
  keyPair: { apiKey: string; apiSecret: string }
): Promise<void> {
  const res = await fetch(agentUrl(node, '/agent/livekit/keys'), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(keyPair),
  });
  if (!res.ok) {
    throw new Error(`Failed to register LiveKit key on node (${res.status})`);
  }
}

export async function addCustomDomainRoute(
  node: Node,
  deploymentId: string,
  domain: string,
  internalPort: number,
  rootDomain: string
): Promise<void> {
  const res = await fetch(agentUrl(node, `/agent/deployments/${deploymentId}/domains`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ domain, internalPort, rootDomain }),
  });
  if (!res.ok) {
    throw new Error(`Failed to add custom domain route on node (${res.status})`);
  }
}

export async function removeCustomDomainRoute(node: Node, deploymentId: string, domain: string): Promise<void> {
  const res = await fetch(
    agentUrl(node, `/agent/deployments/${deploymentId}/domains/${encodeURIComponent(domain)}`),
    { method: 'DELETE', headers: agentHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Failed to remove custom domain route on node (${res.status})`);
  }
}

/** Provisions a standalone database container on the node — see services/node-agent/src/managedDb.js. */
export async function provisionDatabaseContainer(
  node: Node,
  params: { databaseId: string; type: 'postgres' | 'mysql' | 'redis' | 'mongodb'; password: string }
): Promise<{ containerId: string; containerName: string; internalPort: number }> {
  const res = await fetch(agentUrl(node, '/agent/managed-databases'), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to provision database container on node (${res.status})`);
  }
  return (await res.json()) as { containerId: string; containerName: string; internalPort: number };
}

/** Dynamically updates Docker cgroup resource limits for a running database container live. */
export async function scaleDatabaseContainer(
  node: Node,
  containerId: string,
  params: { cpuLimit?: number; memoryLimitMb?: number }
): Promise<{ ok: boolean }> {
  const res = await fetch(agentUrl(node, `/agent/managed-databases/${containerId}/scale`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to scale database container on node (${res.status})`);
  }
  return (await res.json()) as { ok: boolean };
}

/** Rotates master password live on a running database container via node-agent. */
export async function rotateDatabasePasswordOnNode(
  node: Node,
  containerId: string,
  params: {
    type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
    oldPassword?: string;
    newPassword: string;
    masterUsername?: string;
  }
): Promise<{ ok: boolean }> {
  const res = await fetch(agentUrl(node, `/agent/managed-databases/${containerId}/rotate-password`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Failed to rotate live database password on node (${res.status}): ${errorText}`);
  }
  return (await res.json()) as { ok: boolean };
}

/** Manages database engine users (create, delete, update) live on a running database container via node-agent. */
export async function manageDatabaseUserOnNode(
  node: Node,
  containerId: string,
  params: {
    type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
    action: 'create' | 'delete' | 'update';
    username: string;
    password?: string;
    role?: 'admin' | 'read_write' | 'read_only';
    masterPassword?: string;
  }
): Promise<{ ok: boolean }> {
  const res = await fetch(agentUrl(node, `/agent/managed-databases/${containerId}/manage-user`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Failed to manage database user on live engine (${res.status}): ${errorText}`);
  }
  return (await res.json()) as { ok: boolean };
}

/** Executes a SQL, Redis, or Mongo query on a live database container via node-agent. */
export async function executeDatabaseQueryOnNode(
  node: Node,
  containerId: string,
  params: {
    type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
    query: string;
    masterPassword?: string;
  }
): Promise<{ ok: boolean; exitCode: number; rawOutput: string; executionTimeMs: number }> {
  const res = await fetch(agentUrl(node, `/agent/managed-databases/${containerId}/query`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Query execution failed (${res.status}): ${errorText}`);
  }
  return (await res.json()) as { ok: boolean; exitCode: number; rawOutput: string; executionTimeMs: number };
}

/** Triggers a snapshot backup of a managed database on node. */
export async function backupDatabaseOnNode(
  node: Node,
  containerId: string,
  params: {
    type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
    databaseId: string;
    masterPassword?: string;
  }
): Promise<{ backupId: string; databaseId: string; filename: string; sizeBytes: number; createdAt: string }> {
  const res = await fetch(agentUrl(node, `/agent/managed-databases/${containerId}/backup`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Snapshot backup failed (${res.status}): ${errorText}`);
  }
  return (await res.json()) as { backupId: string; databaseId: string; filename: string; sizeBytes: number; createdAt: string };
}

/** Lists snapshot backups for a managed database from node. */
export async function listDatabaseBackupsOnNode(
  node: Node,
  databaseId: string
): Promise<{ backups: Array<{ backupId: string; databaseId: string; filename: string; sizeBytes: number; createdAt: string }> }> {
  const res = await fetch(agentUrl(node, `/agent/managed-databases/${databaseId}/backups`), {
    headers: agentHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Failed to list backups (${res.status}): ${errorText}`);
  }
  return (await res.json()) as { backups: Array<{ backupId: string; databaseId: string; filename: string; sizeBytes: number; createdAt: string }> };
}

/** Restores a snapshot backup into a managed database on node. */
export async function restoreDatabaseOnNode(
  node: Node,
  containerId: string,
  params: {
    type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
    databaseId: string;
    backupId: string;
    masterPassword?: string;
  }
): Promise<{ ok: boolean; containerId: string; backupId: string; message: string }> {
  const res = await fetch(agentUrl(node, `/agent/managed-databases/${containerId}/restore`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Snapshot restore failed (${res.status}): ${errorText}`);
  }
  return (await res.json()) as { ok: boolean; containerId: string; backupId: string; message: string };
}



/** Orchestrates live database migration from source node to target node. */
export async function migrateDatabaseContainer(
  sourceNode: Node,
  targetNode: Node,
  database: {
    id: string;
    type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
    password: string;
    containerId?: string | null;
  }
): Promise<{ containerId: string; containerName: string; internalPort: number }> {
  // 1. Provision fresh database container on target compute node
  const targetResult = await provisionDatabaseContainer(targetNode, {
    databaseId: database.id,
    type: database.type,
    password: database.password,
  });

  // 2. Stop and remove old source container gracefully
  if (database.containerId) {
    try {
      await stopDeployment(sourceNode, database.containerId);
    } catch {
      // Ignore source cleanup error if source node is already unreachable
    }
  }

  return targetResult;
}


export interface ResourceMetrics {
  cpuUsagePercent: number;      // Current CPU usage as percentage
  memoryUsedMb: number;          // Current memory usage in MB
  memoryLimitMb: number | null;  // Memory limit in MB (null if no limit set)
  memoryUsagePercent: number;    // Memory usage as percentage of limit
  storageUsedGb: number;         // Current storage usage in GB
  storageLimitGb: number | null; // Storage limit in GB (null if no limit set)
  storageUsagePercent: number;   // Storage usage as percentage of limit
  timestamp: string;             // ISO timestamp when metrics were captured
}

/**
 * Fetches current resource usage metrics for a deployment from the node-agent.
 * Returns CPU, memory, and storage utilization with percentages relative to configured limits.
 * 
 * @param node - The node where the deployment is running
 * @param containerId - The container ID of the deployment
 * @returns Resource metrics including CPU, memory, and storage usage with percentages
 * @throws Error if the node-agent request fails
 */
export async function getResourceUsage(node: Node, containerId: string): Promise<ResourceMetrics> {
  const res = await fetch(
    agentUrl(node, `/agent/deployments/${containerId}/metrics`),
    { headers: agentHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch resource metrics (${res.status})`);
  }
  return (await res.json()) as ResourceMetrics;
}

// ── Container management (Dev Dashboard -> Containers) ──────────────────────

export interface NodeContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  createdAt: number;
  ports: Array<{ privatePort: number; publicPort?: number; type: string }>;
}

export async function listNodeContainers(node: Node): Promise<NodeContainer[]> {
  const res = await fetch(agentUrl(node, '/agent/containers'), { headers: agentHeaders() });
  if (!res.ok) throw new Error(`Failed to list containers (${res.status})`);
  const data: any = await res.json();
  return data.containers;
}

export async function containerAction(
  node: Node,
  containerId: string,
  action: 'start' | 'stop' | 'restart'
): Promise<void> {
  const res = await fetch(agentUrl(node, `/agent/containers/${containerId}/${action}`), {
    method: 'POST',
    headers: agentHeaders(),
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to ${action} container (${res.status})`);
  }
}

export async function removeNodeContainer(node: Node, containerId: string): Promise<void> {
  const res = await fetch(agentUrl(node, `/agent/containers/${containerId}`), {
    method: 'DELETE',
    headers: agentHeaders(),
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to remove container (${res.status})`);
  }
}

export async function getContainerLogs(node: Node, containerId: string, tail = 200): Promise<string> {
  const res = await fetch(agentUrl(node, `/agent/containers/${containerId}/logs?tail=${tail}`), {
    headers: agentHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch logs (${res.status})`);
  const data: any = await res.json();
  return data.logs;
}

export async function pauseContainer(node: Node, containerId: string): Promise<void> {
  await callNodeAgent(node, `/agent/containers/${containerId}/pause`, 'POST');
}

export async function unpauseContainer(node: Node, containerId: string): Promise<void> {
  await callNodeAgent(node, `/agent/containers/${containerId}/unpause`, 'POST');
}

export async function renameContainer(node: Node, containerId: string, name: string): Promise<void> {
  await callNodeAgent(node, `/agent/containers/${containerId}/rename`, 'PUT', { name });
}

export async function containerTop(node: Node, containerId: string): Promise<any> {
  return callNodeAgent(node, `/agent/containers/${containerId}/top`, 'GET');
}

export async function containerChanges(node: Node, containerId: string): Promise<any> {
  return callNodeAgent(node, `/agent/containers/${containerId}/changes`, 'GET');
}

// ── Images Proxy ─────────────────────────────────────────────────────────────

export async function listNodeImages(node: Node): Promise<any[]> {
  const res = await callNodeAgent(node, '/agent/images', 'GET');
  return res.images || [];
}

export async function inspectNodeImage(node: Node, imageId: string): Promise<any> {
  return callNodeAgent(node, `/agent/images/${encodeURIComponent(imageId)}`, 'GET');
}

export async function pullNodeImage(node: Node, image: string, tag = 'latest'): Promise<any> {
  return callNodeAgent(node, '/agent/images/pull', 'POST', { image, tag });
}

export async function removeNodeImage(node: Node, imageId: string, force = false): Promise<void> {
  await callNodeAgent(node, `/agent/images/${encodeURIComponent(imageId)}?force=${force}`, 'DELETE');
}

export async function tagNodeImage(node: Node, imageId: string, repo: string, tag = 'latest'): Promise<void> {
  await callNodeAgent(node, `/agent/images/${encodeURIComponent(imageId)}/tag`, 'POST', { repo, tag });
}

export async function pruneNodeImages(node: Node): Promise<any> {
  return callNodeAgent(node, '/agent/images/prune', 'POST');
}

// ── Volumes Proxy ────────────────────────────────────────────────────────────

export async function listNodeVolumes(node: Node): Promise<any[]> {
  const res = await callNodeAgent(node, '/agent/volumes', 'GET');
  return res.volumes || [];
}

export async function inspectNodeVolume(node: Node, name: string): Promise<any> {
  return callNodeAgent(node, `/agent/volumes/${encodeURIComponent(name)}`, 'GET');
}

export async function createNodeVolume(node: Node, name: string, driver = 'local', labels?: Record<string, string>): Promise<any> {
  return callNodeAgent(node, '/agent/volumes', 'POST', { name, driver, labels });
}

export async function removeNodeVolume(node: Node, name: string): Promise<void> {
  await callNodeAgent(node, `/agent/volumes/${encodeURIComponent(name)}`, 'DELETE');
}

export async function pruneNodeVolumes(node: Node): Promise<any> {
  return callNodeAgent(node, '/agent/volumes/prune', 'POST');
}

// ── Networks Proxy ───────────────────────────────────────────────────────────

export async function listNodeNetworks(node: Node): Promise<any[]> {
  const res = await callNodeAgent(node, '/agent/networks', 'GET');
  return res.networks || [];
}

export async function inspectNodeNetwork(node: Node, networkId: string): Promise<any> {
  return callNodeAgent(node, `/agent/networks/${encodeURIComponent(networkId)}`, 'GET');
}

export async function createNodeNetwork(node: Node, name: string, driver = 'bridge', options?: any): Promise<any> {
  return callNodeAgent(node, '/agent/networks', 'POST', { name, driver, options });
}

export async function removeNodeNetwork(node: Node, networkId: string): Promise<void> {
  await callNodeAgent(node, `/agent/networks/${encodeURIComponent(networkId)}`, 'DELETE');
}

export async function pruneNodeNetworks(node: Node): Promise<any> {
  return callNodeAgent(node, '/agent/networks/prune', 'POST');
}

// ── System Proxy ─────────────────────────────────────────────────────────────

export async function getNodeDockerInfo(node: Node): Promise<any> {
  return callNodeAgent(node, '/agent/system/info', 'GET');
}

export async function getNodeDockerDf(node: Node): Promise<any> {
  return callNodeAgent(node, '/agent/system/df', 'GET');
}

export interface WafSyncRule {
  id: string;
  action: 'allow' | 'block' | 'rate_limit';
  matchType: 'ip' | 'ip_range' | 'header' | 'path' | 'user_agent';
  matchValue: string;
  rateLimitPerMinute: number | null;
  isEnabled: boolean;
}

/**
 * Pushes the deployment's CURRENT full rule set (and password-protection hash, if any) to the node, which is what
 * actually enforces them (see services/node-agent/src/waf.js). Non-blocking for the caller by design -- a rule save
 * should not fail just because a node is briefly unreachable -- but a failure here means the change did NOT take
 * effect, so it is logged loudly rather than swallowed, which is what silently discarded every WAF rule saved on
 * this platform before this function actually sent anything.
 */
export async function notifyAgentWafSync(node: Node, deploymentId: string, rules: WafSyncRule[], protectionPasswordHash: string | null): Promise<void> {
  try {
    await callNodeAgent(node, `/agent/deployments/${deploymentId}/waf/sync`, 'POST', { rules, protectionPasswordHash });
  } catch (err) {
    logger.error({ err, deploymentId, nodeId: node.id }, 'Failed to sync WAF rules to the node agent -- the saved rule(s) are NOT being enforced until this succeeds');
  }
}




// ─────────────────────────────────────────────────────────────────────────
// Deployment backups. The wire protocol is implemented by
// services/node-agent/src/backup.js + the /agent/backups and
// /agent/deployments/:id/backup/* routes. The API owns the GitHub token, so
// the agent only ever produces / consumes archives, never talks to GitHub.
// ─────────────────────────────────────────────────────────────────────────

export interface AgentBackupComponent {
  kind: 'workspace' | 'volume';
  name: string;
  file: string;
  sizeBytes: number;
  sha256: string;
}

export interface AgentCreateBackupResult {
  components: AgentBackupComponent[];
  skipped: { kind: string; name: string; reason: string }[];
  warnings: string[];
}

/** Error from a backup-related agent call. `code` mirrors the agent's BackupError.code when it sent one. */
export class AgentBackupError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'AgentBackupError';
  }
}

async function agentBackupFailure(res: Response, what: string): Promise<AgentBackupError> {
  let message = '';
  let code: string | undefined;
  try {
    const j = (await res.json()) as { error?: string; code?: string };
    message = j.error || '';
    code = j.code;
  } catch {
    /* non-JSON error body */
  }
  return new AgentBackupError(message || `Node agent failed to ${what} (${res.status})`, res.status, code);
}

/** False for an agent that predates backups (404). Network failures propagate so the caller reports "node unreachable". */
export async function agentSupportsBackups(node: Node): Promise<boolean> {
  const res = await fetch(agentUrl(node, '/agent/backups/capabilities'), { headers: agentHeaders(), signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return false;
  if (!res.ok) throw await agentBackupFailure(res, 'check backup support');
  return true;
}

export async function agentCreateBackup(
  node: Node,
  deploymentId: string,
  params: { backupId: string; volumes: { name: string; hostPath: string }[]; includeWorkspace: boolean; maxBytes?: number }
): Promise<AgentCreateBackupResult> {
  const res = await fetch(agentUrl(node, `/agent/deployments/${deploymentId}/backup/create`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
    // Archiving a large workspace/volume can legitimately take a while.
    signal: AbortSignal.timeout(30 * 60_000),
  });
  if (!res.ok) throw await agentBackupFailure(res, 'create the backup archives');
  return (await res.json()) as AgentCreateBackupResult;
}

export async function agentOpenBackupFile(node: Node, backupId: string, file: string): Promise<{ body: ReadableStream<Uint8Array>; size: number }> {
  const res = await fetch(agentUrl(node, `/agent/backups/${backupId}/files/${encodeURIComponent(file)}`), {
    headers: agentHeaders(),
    signal: AbortSignal.timeout(30 * 60_000),
  });
  if (!res.ok || !res.body) throw await agentBackupFailure(res, 'read the backup archive');
  const size = Number(res.headers.get('content-length'));
  if (!Number.isFinite(size) || size <= 0) throw new AgentBackupError('Node agent did not report the archive size', 502);
  return { body: res.body, size };
}

/** Best effort by design: a leftover spool dir is pruned by the agent after 6h, so callers may ignore failures. */
export async function agentDeleteBackup(node: Node, backupId: string): Promise<void> {
  const res = await fetch(agentUrl(node, `/agent/backups/${backupId}`), { method: 'DELETE', headers: agentHeaders(), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw await agentBackupFailure(res, 'clean up the backup spool');
}

export async function agentRestoreComponent(
  node: Node,
  deploymentId: string,
  comp: { kind: 'workspace' | 'volume'; name: string; hostPath?: string; sha256: string; sizeBytes: number; maxBytes?: number },
  body: ReadableStream<Uint8Array>
): Promise<{ warnings: string[] }> {
  const q = new URLSearchParams({ kind: comp.kind, name: comp.name, sha256: comp.sha256 });
  if (comp.hostPath) q.set('hostPath', comp.hostPath);
  if (comp.maxBytes) q.set('maxBytes', String(comp.maxBytes));
  const res = await fetch(agentUrl(node, `/agent/deployments/${deploymentId}/backup/restore?${q.toString()}`), {
    method: 'POST',
    headers: agentHeaders({ 'Content-Type': 'application/gzip', 'Content-Length': String(comp.sizeBytes) }),
    body: body as unknown as RequestInit['body'],
    // Required by undici when streaming a request body.
    duplex: 'half',
    signal: AbortSignal.timeout(30 * 60_000),
  } as RequestInit);
  if (!res.ok) throw await agentBackupFailure(res, 'restore the backup archive');
  const j = (await res.json()) as { warnings?: string[] };
  return { warnings: j.warnings ?? [] };
}
