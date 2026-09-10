const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PUBLIC_NETWORK = process.env.AGENT_PUBLIC_NETWORK || 'shanutechx-public';

/**
 * Runs a built image as a container.
 *
 * Supports three routing modes:
 * 1. 'proxied' (Default): Routed via Traefik reverse proxy over `PUBLIC_NETWORK` with
 *    automatic Let's Encrypt TLS certificate generation.
 * 2. 'direct': Non-proxied raw host port mapping (for game servers, DB listeners, TCP/UDP sockets).
 * 3. 'no_ssl': Plain HTTP proxying via Traefik on port 80 without TLS redirect.
 */
async function runContainer({
  deploymentId,
  imageTag,
  internalPort,
  subdomain,
  rootDomain,
  deploymentsRootDomain,
  envVars = {},
  cpuLimit = 1, // cores
  memLimitMb = 512,
  routingMode = 'proxied',
  exposureMode = 'ssl_with_proxy',
  startCommand = null,
  frameworkPreset = 'auto',
  publishedPort = null,
}) {
  const containerName = `deploy-${deploymentId}`;

  // Replace any previous container for this deployment (redeploy case).
  await removeContainerIfExists(containerName);

  const labels = {};
  const networks = [];
  const portBindings = {};

  const isBotProcess = ['nodejs_bot', 'python_bot', 'whatsapp_baileys'].includes(frameworkPreset);

  // Resolve effective exposure mode ('no_ssl', 'ssl_direct', 'ssl_with_proxy')
  const effectiveMode = exposureMode || (routingMode === 'direct' ? 'no_ssl' : 'ssl_with_proxy');

  if (effectiveMode === 'no_ssl' || routingMode === 'direct' || (isBotProcess && publishedPort)) {
    // Raw Host Port Mapping — bypass Traefik proxy for direct TCP/UDP (e.g. Lavalink or bot on direct port)
    if (publishedPort || internalPort) {
      const hostPort = String(publishedPort || internalPort);
      portBindings[`${internalPort}/tcp`] = [{ HostPort: hostPort }];
      portBindings[`${internalPort}/udp`] = [{ HostPort: hostPort }];
    }
  } else if (!isBotProcess || subdomain) {
    // Proxied Routing via Traefik (web services or bots with an HTTP management interface)
    const activeSubdomain = subdomain || `app-${deploymentId.slice(0, 8)}`;
    const routerName = `deploy-${deploymentId}`;
    const targetPort = internalPort && Number(internalPort) > 0 ? Number(internalPort) : 3000;
    const effectiveZone = deploymentsRootDomain || rootDomain || process.env.DEPLOYMENTS_ROOT_DOMAIN || process.env.ROOT_DOMAIN || 'shanutechx.com';

    labels['traefik.enable'] = 'true';
    labels['traefik.docker.network'] = PUBLIC_NETWORK;
    labels[`traefik.http.routers.${routerName}.rule`] = `Host(\`${activeSubdomain}.${effectiveZone}\`)`;
    labels[`traefik.http.services.${routerName}.loadbalancer.server.port`] = String(targetPort);

    if (effectiveMode === 'ssl_direct') {
      labels[`traefik.http.routers.${routerName}.entrypoints`] = 'websecure';
      labels[`traefik.http.routers.${routerName}.tls`] = 'true';
      labels[`traefik.http.routers.${routerName}.middlewares`] = 'gzip-compress@file';
    } else {
      // Default: ssl_with_proxy — Proxied + TLS Let's Encrypt
      labels[`traefik.http.routers.${routerName}.entrypoints`] = 'websecure';
      labels[`traefik.http.routers.${routerName}.tls.certresolver`] = 'le';
      labels[`traefik.http.routers.${routerName}.middlewares`] = 'security-headers@file,rate-limit@file,gzip-compress@file';
    }

    networks.push(PUBLIC_NETWORK);
  }

  const containerConfig = {
    name: containerName,
    Image: imageTag,
    Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
    Labels: labels,
    HostConfig: {
      PortBindings: portBindings,
      NanoCpus: cpuLimit * 1e9,
      Memory: memLimitMb * 1024 * 1024,
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: networks[0] || 'bridge',
    },
    User: '1000:1000', // never run customer code as root
  };

  if (startCommand && typeof startCommand === 'string' && startCommand.trim().length > 0) {
    containerConfig.Cmd = ['sh', '-c', startCommand.trim()];
  }

  const container = await docker.createContainer(containerConfig);

  await container.start();

  const info = await container.inspect();
  return { containerId: info.Id, containerName };
}

async function removeContainerIfExists(containerName) {
  try {
    const existing = docker.getContainer(containerName);
    await existing.remove({ force: true });
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
}

async function stopAndRemove(containerId) {
  const container = docker.getContainer(containerId);
  await container.remove({ force: true });
}

async function stopContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.stop();
}

async function restartContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.restart();
}

async function getContainerLogs(containerId, tail = 100) {
  const container = docker.getContainer(containerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  return logs.toString('utf-8');
}

async function inspectContainer(containerId) {
  const container = docker.getContainer(containerId);
  return container.inspect();
}

/** Lists every container on this node */
async function listContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map((c) => ({
    id: c.Id,
    name: (c.Names && c.Names[0] || '').replace(/^\//, ''),
    image: c.Image,
    state: c.State,
    status: c.Status,
    createdAt: c.Created,
    ports: (c.Ports || []).map((p) => ({
      privatePort: p.PrivatePort,
      publicPort: p.PublicPort,
      type: p.Type,
    })),
  }));
}

async function startContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.start();
}

/** Fetches a tail of recent logs as a single plain-text string. */
async function getLogs(containerId, tail = 200) {
  return getContainerLogs(containerId, tail);
}

/**
 * Returns a live, already-demultiplexed Readable stream of stdout+stderr
 * for a running container (follow: true). Docker's raw log stream is
 * multiplexed (an 8-byte header per frame identifying stdout vs stderr)
 * unless the container was created with a TTY, so this uses dockerode's
 * modem.demuxStream to produce plain text chunks, matching what the SSE
 * handler in index.js expects ("already demultiplexed").
 */
async function streamLogs(containerId) {
  const container = docker.getContainer(containerId);
  const rawStream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 100,
    timestamps: false,
  });

  const { PassThrough } = require('stream');
  const out = new PassThrough();
  // demuxStream writes stdout and stderr frames onto the two streams
  // passed to it; route both onto the same PassThrough so the caller
  // gets one interleaved plain-text stream.
  docker.modem.demuxStream(rawStream, out, out);
  rawStream.on('end', () => out.end());
  rawStream.on('error', (err) => out.destroy(err));
  // Let callers stop the underlying docker log stream when they're done.
  out.destroy = ((original) => (...args) => {
    if (typeof rawStream.destroy === 'function') rawStream.destroy();
    return original.apply(out, args);
  })(out.destroy.bind(out));
  return out;
}

/**
 * Live CPU/memory/storage usage for a single container, shaped to match
 * apps/api's ResourceMetrics type.
 */
async function getContainerMetrics(containerId) {
  const container = docker.getContainer(containerId);
  const [stats, info] = await Promise.all([
    container.stats({ stream: false }),
    container.inspect({ size: true }),
  ]);

  // CPU %: standard Docker CLI formula -- delta of container CPU usage
  // over delta of system CPU usage, scaled by the number of CPUs.
  const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
  const onlineCpus = stats.cpu_stats?.online_cpus || (stats.cpu_stats?.cpu_usage?.percpu_usage || []).length || 1;
  const cpuUsagePercent =
    systemDelta > 0 && cpuDelta > 0 ? Math.round((cpuDelta / systemDelta) * onlineCpus * 100 * 100) / 100 : 0;

  const memoryStats = stats.memory_stats || {};
  const memoryUsedMb = Math.round((memoryStats.usage || 0) / (1024 * 1024));
  const rawMemLimit = memoryStats.limit || 0;
  // Docker reports an effectively "no limit" value as the host's total
  // memory when the container wasn't given an explicit --memory; treat
  // limits above 1 TB as "no configured limit" rather than a real number.
  const memoryLimitMb = rawMemLimit > 0 && rawMemLimit < 1024 * 1024 * 1024 * 1024
    ? Math.round(rawMemLimit / (1024 * 1024))
    : null;
  const memoryUsagePercent = memoryLimitMb ? Math.round((memoryUsedMb / memoryLimitMb) * 100 * 100) / 100 : 0;

  const storageUsedGb = info.SizeRw != null ? Math.round((info.SizeRw / (1024 * 1024 * 1024)) * 100) / 100 : 0;

  return {
    cpuUsagePercent,
    memoryUsedMb,
    memoryLimitMb,
    memoryUsagePercent,
    storageUsedGb,
    storageLimitGb: null, // no per-container disk quota mechanism configured on this node
    storageUsagePercent: 0,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  runContainer,
  stopAndRemove,
  stopContainer,
  startContainer,
  restartContainer,
  getContainerLogs,
  getLogs,
  streamLogs,
  listContainers,
  getContainerMetrics,
  inspectContainer,
};
