const Docker = require('dockerode');
const { resolveExposure } = require('./exposure');

const docker = new Docker(process.env.DOCKER_SOCKET ? { socketPath: process.env.DOCKER_SOCKET } : undefined);

const PUBLIC_NETWORK = process.env.AGENT_PUBLIC_NETWORK || 'shanutechx-public';

/**
 * Runs a built image as a container.
 *
 * How the container is exposed (Traefik, raw host port, or not at all) is decided by exposure.js; see the mode list
 * there. `routingMode` is the legacy way of asking for a direct host port and is kept for compatibility.
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
  agentPort = undefined,
  agentSecret = undefined,
  privateNetworkName = undefined,
  containerAlias = undefined,
}) {
  const containerName = `deploy-${deploymentId}`;

  // Replace any previous container for this deployment (redeploy case).
  await removeContainerIfExists(containerName);

  const labels = {};
  const networks = [];
  const portBindings = {};

  // Routing (Traefik labels / host port bindings) is decided in exposure.js.
  const exposure = resolveExposure({
    deploymentId,
    internalPort,
    subdomain,
    rootDomain,
    deploymentsRootDomain,
    routingMode,
    exposureMode,
    frameworkPreset,
    publishedPort,
    agentPort,
    agentSecret,
  });
  Object.assign(labels, exposure.labels);
  Object.assign(portBindings, exposure.portBindings);
  if (exposure.joinPublicNetwork) {
    labels['traefik.docker.network'] = PUBLIC_NETWORK;
    networks.push(PUBLIC_NETWORK);
  }

  // Private project environment network
  if (privateNetworkName && typeof privateNetworkName === 'string') {
    try {
      const net = docker.getNetwork(privateNetworkName);
      await net.inspect().catch(async () => {
        await docker.createNetwork({ Name: privateNetworkName, Driver: 'bridge' }).catch(() => {});
      });
      networks.push(privateNetworkName);
    } catch (_err) {}
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
      SecurityOpt: ['no-new-privileges:true'],
    },
    User: '1000:1000', // never run customer code as root
  };

  if (startCommand && typeof startCommand === 'string' && startCommand.trim().length > 0) {
    containerConfig.Cmd = ['sh', '-c', startCommand.trim()];
  }

  const container = await docker.createContainer(containerConfig);

  // Connect additional networks beyond the primary NetworkMode
  for (let i = 1; i < networks.length; i++) {
    const netName = networks[i];
    try {
      const net = docker.getNetwork(netName);
      await net.connect({
        Container: container.id,
        EndpointConfig: {
          Aliases: containerAlias ? [containerAlias, containerName] : [containerName],
        },
      });
    } catch (_e) {}
  }

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

// ─────────────────────────────────────────────────────────────
// Container Enhancements (Arcane-inspired)
// ─────────────────────────────────────────────────────────────

async function pauseContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.pause();
}

async function unpauseContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.unpause();
}

async function renameContainer(containerId, newName) {
  const container = docker.getContainer(containerId);
  await container.rename({ name: newName });
}

/** Returns the list of running processes inside a container (docker top). */
async function containerTop(containerId) {
  const container = docker.getContainer(containerId);
  return container.top();
}

/** Returns filesystem changes since the container was created. */
async function containerChanges(containerId) {
  const container = docker.getContainer(containerId);
  return container.changes();
}

/**
 * Streams live CPU/memory/network stats for a container via SSE-compatible
 * readable stream. Each data event is a JSON object with the full stats payload.
 */
async function streamContainerStats(containerId) {
  const container = docker.getContainer(containerId);
  const statsStream = await container.stats({ stream: true });

  const { Transform } = require('stream');
  let buffer = '';
  const transform = new Transform({
    readableObjectMode: false,
    writableObjectMode: false,
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Retain incomplete trailing fragment
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const raw = JSON.parse(line);
          const cpuDelta = (raw.cpu_stats?.cpu_usage?.total_usage || 0) - (raw.precpu_stats?.cpu_usage?.total_usage || 0);
          const sysDelta = (raw.cpu_stats?.system_cpu_usage || 0) - (raw.precpu_stats?.system_cpu_usage || 0);
          const cpus = raw.cpu_stats?.online_cpus || 1;
          const cpuPercent = sysDelta > 0 && cpuDelta > 0 ? Math.round((cpuDelta / sysDelta) * cpus * 100 * 100) / 100 : 0;

          const memUsed = Math.round((raw.memory_stats?.usage || 0) / (1024 * 1024));
          const rawLimit = raw.memory_stats?.limit || 0;
          const memLimit = rawLimit > 0 && rawLimit < 1024 * 1024 * 1024 * 1024 ? Math.round(rawLimit / (1024 * 1024)) : null;
          const memPercent = memLimit ? Math.round((memUsed / memLimit) * 100 * 100) / 100 : 0;

          // Network I/O
          const nets = raw.networks || {};
          let rxBytes = 0, txBytes = 0;
          for (const iface of Object.values(nets)) {
            rxBytes += iface.rx_bytes || 0;
            txBytes += iface.tx_bytes || 0;
          }

          // Block I/O
          const blkStats = raw.blkio_stats?.io_service_bytes_recursive || [];
          let blkRead = 0, blkWrite = 0;
          for (const entry of blkStats) {
            if (entry.op === 'read' || entry.op === 'Read') blkRead += entry.value || 0;
            if (entry.op === 'write' || entry.op === 'Write') blkWrite += entry.value || 0;
          }

          const computed = {
            cpuPercent,
            memoryUsedMb: memUsed,
            memoryLimitMb: memLimit,
            memoryPercent: memPercent,
            networkRxBytes: rxBytes,
            networkTxBytes: txBytes,
            blockReadBytes: blkRead,
            blockWriteBytes: blkWrite,
            pids: raw.pids_stats?.current || 0,
            timestamp: new Date().toISOString(),
          };
          this.push(JSON.stringify(computed) + '\n');
        } catch (_e) {
          // Skip malformed line
        }
      }
      callback();
    },
  });

  statsStream.pipe(transform);
  statsStream.on('error', (err) => transform.destroy(err));
  // Allow callers to stop the underlying docker stats stream
  const origDestroy = transform.destroy.bind(transform);
  transform.destroy = (...args) => {
    if (typeof statsStream.destroy === 'function') statsStream.destroy();
    return origDestroy(...args);
  };
  return transform;
}

// ─────────────────────────────────────────────────────────────
// Image Management (Arcane-inspired)
// ─────────────────────────────────────────────────────────────

async function listImages() {
  const images = await docker.listImages({ all: false });
  return images.map((img) => ({
    id: img.Id,
    repoTags: img.RepoTags || [],
    repoDigests: img.RepoDigests || [],
    size: img.Size,
    virtualSize: img.VirtualSize,
    created: img.Created,
    labels: img.Labels || {},
    containers: img.Containers,
  }));
}

async function pullImage(imageName, tag = 'latest') {
  const fullName = `${imageName}:${tag}`;
  return new Promise((resolve, reject) => {
    docker.pull(fullName, (err, stream) => {
      if (err) return reject(err);
      const events = [];
      docker.modem.followProgress(stream, (pullErr, output) => {
        if (pullErr) return reject(pullErr);
        resolve({ image: fullName, events: output });
      }, (event) => {
        events.push(event);
      });
    });
  });
}

async function removeImage(imageId, force = false) {
  const image = docker.getImage(imageId);
  await image.remove({ force });
}

async function inspectImage(imageId) {
  const image = docker.getImage(imageId);
  return image.inspect();
}

async function tagImage(sourceId, repo, tag) {
  const image = docker.getImage(sourceId);
  await image.tag({ repo, tag });
}

async function pruneImages() {
  return docker.pruneImages({ filters: { dangling: { true: true } } });
}

// ─────────────────────────────────────────────────────────────
// Volume Management (Arcane-inspired)
// ─────────────────────────────────────────────────────────────

async function listVolumes() {
  const result = await docker.listVolumes();
  return (result.Volumes || []).map((v) => ({
    name: v.Name,
    driver: v.Driver,
    mountpoint: v.Mountpoint,
    scope: v.Scope,
    labels: v.Labels || {},
    options: v.Options || {},
    createdAt: v.CreatedAt,
  }));
}

async function createVolume(name, driver = 'local', labels = {}) {
  const vol = await docker.createVolume({ Name: name, Driver: driver, Labels: labels });
  return vol;
}

async function removeVolume(name) {
  const vol = docker.getVolume(name);
  await vol.remove();
}

async function inspectVolume(name) {
  const vol = docker.getVolume(name);
  return vol.inspect();
}

async function pruneVolumes() {
  return docker.pruneVolumes();
}

// ─────────────────────────────────────────────────────────────
// Network Management (Arcane-inspired)
// ─────────────────────────────────────────────────────────────

async function listNetworks() {
  const networks = await docker.listNetworks();
  return networks.map((n) => ({
    id: n.Id,
    name: n.Name,
    driver: n.Driver,
    scope: n.Scope,
    internal: n.Internal,
    enableIPv6: n.EnableIPv6,
    ipam: n.IPAM,
    containers: n.Containers || {},
    labels: n.Labels || {},
    created: n.Created,
  }));
}

async function createNetwork(name, driver = 'bridge', options = {}) {
  const network = await docker.createNetwork({
    Name: name,
    Driver: driver,
    Options: options,
  });
  return { id: network.id, name };
}

async function removeNetwork(networkId) {
  const network = docker.getNetwork(networkId);
  await network.remove();
}

async function inspectNetwork(networkId) {
  const network = docker.getNetwork(networkId);
  return network.inspect();
}

async function pruneNetworks() {
  return docker.pruneNetworks();
}

// ─────────────────────────────────────────────────────────────
// System Info (Arcane-inspired)
// ─────────────────────────────────────────────────────────────

async function getSystemInfo() {
  const info = await docker.info();
  return {
    dockerVersion: info.ServerVersion,
    apiVersion: info.ApiVersion,
    os: info.OperatingSystem,
    osType: info.OSType,
    architecture: info.Architecture,
    kernel: info.KernelVersion,
    cpus: info.NCPU,
    memoryBytes: info.MemTotal,
    containers: info.Containers,
    containersRunning: info.ContainersRunning,
    containersPaused: info.ContainersPaused,
    containersStopped: info.ContainersStopped,
    images: info.Images,
    storageDriver: info.Driver,
    runtimes: Object.keys(info.Runtimes || {}),
    swarm: info.Swarm?.LocalNodeState || 'inactive',
    name: info.Name,
    id: info.ID,
  };
}

async function getDiskUsage() {
  const df = await docker.df();
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return {
    images: {
      count: (df.Images || []).length,
      totalSize: (df.Images || []).reduce((sum, i) => sum + (i.Size || 0), 0),
      totalSizeHuman: formatSize((df.Images || []).reduce((sum, i) => sum + (i.Size || 0), 0)),
      reclaimable: (df.Images || []).filter((i) => (i.Containers || 0) === 0).reduce((sum, i) => sum + (i.Size || 0), 0),
    },
    containers: {
      count: (df.Containers || []).length,
      totalSize: (df.Containers || []).reduce((sum, c) => sum + (c.SizeRw || 0), 0),
      totalSizeHuman: formatSize((df.Containers || []).reduce((sum, c) => sum + (c.SizeRw || 0), 0)),
    },
    volumes: {
      count: (df.Volumes || []).length,
      totalSize: (df.Volumes || []).reduce((sum, v) => sum + (v.UsageData?.Size || 0), 0),
      totalSizeHuman: formatSize((df.Volumes || []).reduce((sum, v) => sum + (v.UsageData?.Size || 0), 0)),
    },
    buildCache: {
      count: (df.BuildCache || []).length,
      totalSize: (df.BuildCache || []).reduce((sum, b) => sum + (b.Size || 0), 0),
      totalSizeHuman: formatSize((df.BuildCache || []).reduce((sum, b) => sum + (b.Size || 0), 0)),
    },
  };
}

module.exports = {
  // Existing
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
  // Container enhancements
  pauseContainer,
  unpauseContainer,
  renameContainer,
  containerTop,
  containerChanges,
  streamContainerStats,
  // Image management
  listImages,
  pullImage,
  removeImage,
  inspectImage,
  tagImage,
  pruneImages,
  // Volume management
  listVolumes,
  createVolume,
  removeVolume,
  inspectVolume,
  pruneVolumes,
  // Network management
  listNetworks,
  createNetwork,
  removeNetwork,
  inspectNetwork,
  pruneNetworks,
  // System
  getSystemInfo,
  getDiskUsage,
};
