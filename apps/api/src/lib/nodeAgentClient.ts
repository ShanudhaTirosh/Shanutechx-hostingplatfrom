import { env } from '../env';

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
  body?: any
): Promise<any> {
  const url = agentUrl(node, path);
  const headers = agentHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
  const res = await fetch(
    agentUrl(node, `/agent/deployments/${params.deploymentId}/build-and-run`),
    {
      method: 'POST',
      headers: agentHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
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
  const res = await fetch(agentUrl(node, '/agent/stats'), { headers: agentHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch node stats (${res.status})`);
  return (await res.json()) as { cpuUsedPct: number; ramUsedMb: number; diskUsedGb: number };
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
