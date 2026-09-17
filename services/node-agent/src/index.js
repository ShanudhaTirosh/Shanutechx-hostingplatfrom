const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const pino = require('pino');
const { prepareWorkspace, pushWorkspaceToRemote, WORKSPACES_DIR } = require('./repo');
const { buildImage } = require('./build');
const {
  runContainer, stopAndRemove, stopContainer, getLogs, streamLogs, startContainer, restartContainer, listContainers, getContainerMetrics, inspectContainer,
  // Container enhancements (Arcane-inspired)
  pauseContainer, unpauseContainer, renameContainer, containerTop, containerChanges, streamContainerStats,
  // Image management
  listImages, pullImage, removeImage, inspectImage, tagImage, pruneImages,
  // Volume management
  listVolumes, createVolume, removeVolume, inspectVolume, pruneVolumes,
  // Network management
  listNetworks: listDockerNetworksNew, createNetwork: createDockerNetworkNew, removeNetwork, inspectNetwork, pruneNetworks,
  // System
  getSystemInfo, getDiskUsage,
} = require('./docker');
const { collectStats } = require('./stats');
const { addKey } = require('./livekit');
const { addDomainRoute, removeDomainRoute } = require('./customDomain');
const { provisionDatabase, scaleDatabase, rotateDatabasePassword, manageDatabaseUser } = require('./managedDb');
const { listDir, readFile, writeFile, writeBinaryFile, extractArchive, makeDir, remove: fsRemove, rename } = require('./filesystem');
const { provisionProject, deprovisionProject, execSql, listTables, validateIdentifier, insertRow, updateRow, deleteRow } = require('./projects');

const nodeEngine = require('./nodeEngine');

const PORT = process.env.AGENT_PORT || 5000;
const AGENT_SECRET = process.env.NODE_AGENT_SECRET;
const ROOT_DOMAIN = process.env.ROOT_DOMAIN;
const BIND_HOST = process.env.AGENT_BIND_HOST || '0.0.0.0';
const ALLOWED_IPS = (process.env.AGENT_ALLOWED_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

if (!AGENT_SECRET) {
  logger.fatal('Missing NODE_AGENT_SECRET in env. Refusing to start.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Liveness — Docker HEALTHCHECK target. Registered before the auth
// middleware so Docker's healthcheck doesn't need the shared secret.
app.get('/agent/health', (_req, res) => {
  res.json({ ok: true, service: 'shanutechx-node-agent', ts: new Date().toISOString() });
});

// This service must NEVER be exposed publicly — bind it to a private
// interface/VPN/overlay network, and rely on this shared secret as a second
// layer of defense, not the only one. See BIND_HOST below and the
// deployment docs for enforcing that at the network level too.
app.use((req, res, next) => {
  if (ALLOWED_IPS.length > 0) {
    // Use only the real TCP peer address — never x-forwarded-for, which is
    // trivially spoofable by the client and must not be used for access control
    // unless there is a trusted reverse proxy stripping/overwriting it first.
    const remoteIp = req.socket.remoteAddress;
    if (!remoteIp || !ALLOWED_IPS.includes(remoteIp)) {
      logger.warn({ remoteIp }, 'node-agent: rejected request from IP not in AGENT_ALLOWED_IPS');
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  // Timing-safe comparison. HMAC both sides first so this works safely.
  const submitted = req.headers['x-agent-secret'];
  const key = 'shanutechx-node-agent-gate';
  const isValid =
    typeof submitted === 'string' &&
    crypto.timingSafeEqual(
      crypto.createHmac('sha256', key).update(submitted).digest(),
      crypto.createHmac('sha256', key).update(AGENT_SECRET).digest()
    );
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/agent/stats', async (_req, res) => {
  try {
    const stats = await collectStats();
    res.json(stats);
  } catch (err) {
    logger.error({ err }, 'Failed to collect stats');
    res.status(500).json({ error: 'Failed to collect stats' });
  }
});

// ── Container management (Dev Dashboard -> Containers) ─────────────────────
// Sees every container on this node, not just ones this agent deployed —
// deliberately broad, since the point of this page is "what's actually
// running here", including anything deployed by hand.

app.get('/agent/containers', async (_req, res) => {
  try {
    const containers = await listContainers();
    res.json({ containers });
  } catch (err) {
    logger.error({ err }, 'Failed to list containers');
    res.status(500).json({ error: 'Failed to list containers' });
  }
});

app.post('/agent/containers/:containerId/start', async (req, res) => {
  try {
    await startContainer(req.params.containerId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to start container');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/containers/:containerId/stop', async (req, res) => {
  try {
    await stopContainer(req.params.containerId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to stop container');
    res.status(500).json({ error: err.message });
  }
});

app.delete('/agent/containers/:containerId', async (req, res) => {
  try {
    await stopAndRemove(req.params.containerId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to remove container');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/containers/:containerId/restart', async (req, res) => {
  try {
    await restartContainer(req.params.containerId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to restart container');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/containers/:containerId/logs', async (req, res) => {
  try {
    const tail = req.query.tail ? parseInt(req.query.tail, 10) : 200;
    const logs = await getLogs(req.params.containerId, tail);
    res.json({ logs });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch container logs');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/containers/:containerId/inspect', async (req, res) => {
  try {
    const info = await inspectContainer(req.params.containerId);
    res.json(info);
  } catch (err) {
    logger.error({ err }, 'Failed to inspect container');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/containers/:containerId/pause', async (req, res) => {
  try {
    await pauseContainer(req.params.containerId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to pause container');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/containers/:containerId/unpause', async (req, res) => {
  try {
    await unpauseContainer(req.params.containerId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to unpause container');
    res.status(500).json({ error: err.message });
  }
});

app.put('/agent/containers/:containerId/rename', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    await renameContainer(req.params.containerId, name);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to rename container');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/containers/:containerId/top', async (req, res) => {
  try {
    const result = await containerTop(req.params.containerId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to get container processes');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/containers/:containerId/changes', async (req, res) => {
  try {
    const changes = await containerChanges(req.params.containerId);
    res.json({ changes: changes || [] });
  } catch (err) {
    logger.error({ err }, 'Failed to get container changes');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/containers/:containerId/stats/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write('data: {"type":"connected"}\n\n');

  let statsStream;
  try {
    statsStream = await streamContainerStats(req.params.containerId);
    req.on('close', () => { if (statsStream) statsStream.destroy(); });
    statsStream.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) res.write(`data: ${line}\n\n`);
    });
    statsStream.on('end', () => res.end());
    statsStream.on('error', () => res.end());
  } catch (err) {
    logger.error({ err }, 'Failed to start stats stream');
    res.write(`data: {"error":"${err.message}"}\n\n`);
    res.end();
  }
});

// ── Image Management (Arcane-inspired) ───────────────────────────────────────

app.get('/agent/images', async (_req, res) => {
  try {
    const images = await listImages();
    res.json({ images });
  } catch (err) {
    logger.error({ err }, 'Failed to list images');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/images/:imageId', async (req, res) => {
  try {
    const info = await inspectImage(decodeURIComponent(req.params.imageId));
    res.json(info);
  } catch (err) {
    logger.error({ err }, 'Failed to inspect image');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/images/pull', async (req, res) => {
  const { image, tag } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image name is required' });
  try {
    const result = await pullImage(image, tag || 'latest');
    logger.info({ image, tag }, 'Image pulled');
    res.json(result);
  } catch (err) {
    logger.error({ err, image }, 'Failed to pull image');
    res.status(500).json({ error: err.message });
  }
});

app.delete('/agent/images/:imageId', async (req, res) => {
  const force = req.query.force === 'true';
  try {
    await removeImage(decodeURIComponent(req.params.imageId), force);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to remove image');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/images/:imageId/tag', async (req, res) => {
  const { repo, tag } = req.body || {};
  if (!repo) return res.status(400).json({ error: 'repo is required' });
  try {
    await tagImage(decodeURIComponent(req.params.imageId), repo, tag || 'latest');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to tag image');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/images/prune', async (_req, res) => {
  try {
    const result = await pruneImages();
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to prune images');
    res.status(500).json({ error: err.message });
  }
});

// ── Volume Management (Arcane-inspired) ──────────────────────────────────────

app.get('/agent/volumes', async (_req, res) => {
  try {
    const volumes = await listVolumes();
    res.json({ volumes });
  } catch (err) {
    logger.error({ err }, 'Failed to list volumes');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/volumes/:name', async (req, res) => {
  try {
    const info = await inspectVolume(req.params.name);
    res.json(info);
  } catch (err) {
    logger.error({ err }, 'Failed to inspect volume');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/volumes', async (req, res) => {
  const { name, driver, labels } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const vol = await createVolume(name, driver, labels);
    logger.info({ name }, 'Volume created');
    res.status(201).json(vol);
  } catch (err) {
    logger.error({ err }, 'Failed to create volume');
    res.status(500).json({ error: err.message });
  }
});

app.delete('/agent/volumes/:name', async (req, res) => {
  try {
    await removeVolume(req.params.name);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to remove volume');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/volumes/prune', async (_req, res) => {
  try {
    const result = await pruneVolumes();
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to prune volumes');
    res.status(500).json({ error: err.message });
  }
});

// ── Network Management (Arcane-inspired) ─────────────────────────────────────

app.get('/agent/networks', async (_req, res) => {
  try {
    const networks = await listDockerNetworksNew();
    res.json({ networks });
  } catch (err) {
    logger.error({ err }, 'Failed to list networks');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/networks/:networkId', async (req, res) => {
  try {
    const info = await inspectNetwork(req.params.networkId);
    res.json(info);
  } catch (err) {
    logger.error({ err }, 'Failed to inspect network');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/networks', async (req, res) => {
  const { name, driver, options } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await createDockerNetworkNew(name, driver, options);
    logger.info({ name, driver }, 'Network created');
    res.status(201).json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to create network');
    res.status(500).json({ error: err.message });
  }
});

app.delete('/agent/networks/:networkId', async (req, res) => {
  try {
    await removeNetwork(req.params.networkId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to remove network');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/networks/prune', async (_req, res) => {
  try {
    const result = await pruneNetworks();
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to prune networks');
    res.status(500).json({ error: err.message });
  }
});

// ── Docker System Info (Arcane-inspired) ─────────────────────────────────────

app.get('/agent/system/info', async (_req, res) => {
  try {
    const info = await getSystemInfo();
    res.json(info);
  } catch (err) {
    logger.error({ err }, 'Failed to get system info');
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/system/df', async (_req, res) => {
  try {
    const df = await getDiskUsage();
    res.json(df);
  } catch (err) {
    logger.error({ err }, 'Failed to get disk usage');
    res.status(500).json({ error: err.message });
  }
});


/**
 * Build and run a deployment. Body:
 *   { deploymentId, repoUrl, branch?, subdomain?, internalPort, envVars? }
 * `subdomain` is omitted for non-public services (e.g. Discord bots).
 */
app.post('/agent/deployments/:deploymentId/build-and-run', async (req, res) => {
  const { deploymentId } = req.params;
  const {
    repoUrl,
    branch,
    subdomain,
    rootDomain: reqRootDomain,
    deploymentsRootDomain: reqDeploymentsRootDomain,
    internalPort,
    envVars,
    cpuLimit,
    memoryLimit,
    backupRepoUrl,
    routingMode,
    exposureMode,
    startCommand,
    entryFile,
    frameworkPreset,
    publishedPort,
  } = req.body || {};

  if (!repoUrl || !internalPort) {
    return res.status(400).json({ error: 'repoUrl and internalPort are required' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson');

  const emit = (event) => res.write(JSON.stringify(event) + '\n');

  try {
    logger.info({ deploymentId, repoUrl, startCommand, exposureMode }, 'Starting build');
    emit({ phase: 'fetch', message: 'Fetching repository...' });
    const workspaceDir = await prepareWorkspace(deploymentId, repoUrl, branch || 'main', backupRepoUrl);

    emit({ phase: 'build', message: 'Building container image...' });
    const imageTag = `shanutechx/${deploymentId}:latest`;
    await buildImage({
      workspaceDir,
      imageTag,
      envVars,
      startCommand,
      entryFile,
      frameworkPreset,
      onData: (chunk) => emit({ phase: 'build', log: chunk.toString() }),
    });

    emit({ phase: 'run', message: 'Starting container...' });
    const { containerId, containerName } = await runContainer({
      deploymentId,
      imageTag,
      internalPort,
      subdomain,
      rootDomain: reqRootDomain || ROOT_DOMAIN,
      deploymentsRootDomain: reqDeploymentsRootDomain,
      envVars,
      cpuLimit: cpuLimit ?? 1,
      memLimitMb: memoryLimit ?? 512,
      routingMode: routingMode || 'proxied',
      exposureMode: exposureMode || 'ssl_with_proxy',
      startCommand: startCommand || null,
      frameworkPreset: frameworkPreset || 'auto',
      publishedPort: publishedPort ?? null,
    });


    logger.info({ deploymentId, containerId, subdomain }, 'Deployment complete');
    emit({ phase: 'done', containerId, containerName });
    res.end();
  } catch (err) {
    logger.error({ deploymentId, err }, 'Build/run failed');
    emit({ phase: 'error', message: err.message, stderr: err.stderr });
    res.end();
  }
});

const activeBuilds = new Map();

app.post('/agent/deployments/:deploymentId/cancel-build', async (req, res) => {
  const { deploymentId } = req.params;
  const build = activeBuilds.get(deploymentId);
  if (build) {
    try {
      if (typeof build.kill === 'function') build.kill();
      activeBuilds.delete(deploymentId);
      logger.info({ deploymentId }, 'Build process cancelled');
      return res.json({ ok: true, message: 'Build cancelled' });
    } catch (err) {
      logger.error({ deploymentId, err }, 'Error cancelling build process');
    }
  }
  res.json({ ok: true, message: 'No active build process found or already stopped' });
});

app.get('/agent/deployments/:containerId/logs', async (req, res) => {
  try {
    const logs = await getLogs(req.params.containerId, Number(req.query.tail) || 200);
    res.json({ logs });
  } catch (err) {
    logger.error({ containerId: req.params.containerId, err }, 'Failed to fetch logs');
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /agent/deployments/:containerId/metrics
 */
app.get('/agent/deployments/:containerId/metrics', async (req, res) => {
  try {
    const metrics = await getContainerMetrics(req.params.containerId);
    res.json(metrics);
  } catch (err) {
    logger.error({ containerId: req.params.containerId, err }, 'Failed to fetch container metrics');
    res.status(500).json({ error: 'Failed to fetch container metrics' });
  }
});

/**
 * GET /agent/deployments/:containerId/logs/stream
 * Streams container logs in real-time using Server-Sent Events (SSE).
 * Returns stdout and stderr with timestamps as they arrive from Docker.
 */
app.get('/agent/deployments/:containerId/logs/stream', async (req, res) => {
  const { containerId } = req.params;
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // CORS headers for browser clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial connection confirmation
  res.write('data: {"type":"connected","message":"Log stream connected"}\n\n');
  
  let logStream;
  
  try {
    logStream = await nodeEngine.getDockerContainerLogStream(containerId);

    const cleanup = () => {
      if (logStream && typeof logStream.destroy === 'function') {
        logStream.destroy();
      }
    };

    req.on('close', () => {
      logger.info({ containerId }, 'Client disconnected from log stream');
      cleanup();
    });

    logStream.on('data', (chunk) => {
      // Each chunk is plain text log data (already demultiplexed or raw buffer)
      const lines = chunk.toString('utf-8').split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const event = {
            type: 'log',
            data: line,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      }
    });
    
    logStream.on('end', () => {
      res.write('data: {"type":"end","message":"Log stream ended"}\n\n');
      res.end();
    });
    
    logStream.on('error', (err) => {
      logger.error({ containerId, err }, 'Error streaming logs');
      res.write(`data: ${JSON.stringify({type:"error",message:"Stream error"})}\n\n`);
      res.end();
    });
    
  } catch (err) {
    logger.error({ containerId, err }, 'Failed to start log stream');
    res.write(`data: ${JSON.stringify({type:"error",message:"Failed to start log stream"})}\n\n`);
    res.end();
  }
});

app.post('/agent/deployments/:containerId/stop', async (req, res) => {
  try {
    await stopContainer(req.params.containerId);
    logger.info({ containerId: req.params.containerId }, 'Container stopped');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ containerId: req.params.containerId, err }, 'Failed to stop container');
    res.status(500).json({ error: 'Failed to stop container' });
  }
});


app.post('/agent/deployments/:containerId/start', async (req, res) => {
  try {
    await startContainer(req.params.containerId);
    logger.info({ containerId: req.params.containerId }, 'Container started');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ containerId: req.params.containerId, err }, 'Failed to start container');
    res.status(500).json({ error: 'Failed to start container' });
  }
});

app.post('/agent/deployments/:containerId/restart', async (req, res) => {
  try {
    await restartContainer(req.params.containerId);
    logger.info({ containerId: req.params.containerId }, 'Container restarted');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ containerId: req.params.containerId, err }, 'Failed to restart container');
    res.status(500).json({ error: 'Failed to restart container' });
  }
});

/** Adds a new LiveKit key/secret to this node's LiveKit instance and restarts it. */
app.post('/agent/livekit/keys', async (req, res) => {
  const { apiKey, apiSecret } = req.body || {};
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'apiKey and apiSecret are required' });
  }

  try {
    await addKey(apiKey, apiSecret);
    logger.info({ apiKey }, 'LiveKit key registered');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ apiKey, err }, 'Failed to add LiveKit key');
    res.status(500).json({ error: 'Failed to add LiveKit key' });
  }
});

app.post('/agent/deployments/:deploymentId/domains', async (req, res) => {
  const { domain, internalPort, rootDomain } = req.body || {};
  if (!domain || !internalPort) {
    return res.status(400).json({ error: 'domain and internalPort are required' });
  }

  try {
    await addDomainRoute(req.params.deploymentId, domain, internalPort, rootDomain);
    logger.info({ deploymentId: req.params.deploymentId, domain }, 'Custom domain route added');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ deploymentId: req.params.deploymentId, domain, err }, 'Failed to add custom domain route');
    res.status(500).json({ error: 'Failed to add custom domain route' });
  }
});

app.delete('/agent/deployments/:deploymentId/domains/:domain', async (req, res) => {
  try {
    await removeDomainRoute(req.params.deploymentId, req.params.domain);
    logger.info({ deploymentId: req.params.deploymentId, domain: req.params.domain }, 'Custom domain route removed');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ deploymentId: req.params.deploymentId, domain: req.params.domain, err }, 'Failed to remove custom domain route');
    res.status(500).json({ error: 'Failed to remove custom domain route' });
  }
});

app.post('/agent/managed-databases', async (req, res) => {
  const { databaseId, type, password } = req.body || {};
  if (!databaseId || !type || !password) {
    return res.status(400).json({ error: 'databaseId, type, and password are required' });
  }

  try {
    const result = await provisionDatabase({ databaseId, type, password });
    logger.info({ databaseId, type, containerId: result.containerId }, 'Managed database provisioned');
    res.status(201).json(result);
  } catch (err) {
    logger.error({ databaseId, type, err }, 'Failed to provision managed database');
    res.status(500).json({ error: 'Failed to provision managed database' });
  }
});

app.post('/agent/managed-databases/:containerId/scale', async (req, res) => {
  const { containerId } = req.params;
  const { cpuLimit, memoryLimitMb } = req.body || {};

  try {
    const result = await scaleDatabase({ containerId, cpuLimit, memoryLimitMb });
    logger.info({ containerId, cpuLimit, memoryLimitMb }, 'Managed database scaled');
    res.json(result);
  } catch (err) {
    logger.error({ containerId, err }, 'Failed to scale managed database');
    res.status(500).json({ error: 'Failed to scale managed database' });
  }
});

app.post('/agent/managed-databases/:containerId/rotate-password', async (req, res) => {
  const { containerId } = req.params;
  const { type, oldPassword, newPassword, masterUsername } = req.body || {};
  if (!type || !newPassword) {
    return res.status(400).json({ error: 'type and newPassword are required' });
  }

  try {
    const result = await rotateDatabasePassword({ containerId, type, oldPassword, newPassword, masterUsername });
    logger.info({ containerId, type }, 'Managed database password rotated live');
    res.json(result);
  } catch (err) {
    logger.error({ containerId, err: err.message }, 'Failed to rotate managed database password');
    res.status(500).json({ error: err.message || 'Failed to rotate managed database password' });
  }
});

app.post('/agent/managed-databases/:containerId/manage-user', async (req, res) => {
  const { containerId } = req.params;
  const { type, action, username, password, role, masterPassword } = req.body || {};
  if (!type || !action || !username) {
    return res.status(400).json({ error: 'type, action, and username are required' });
  }

  try {
    const result = await manageDatabaseUser({ containerId, type, action, username, password, role, masterPassword });
    logger.info({ containerId, type, action, username }, 'Managed database user operation executed live');
    res.json(result);
  } catch (err) {
    logger.error({ containerId, username, err: err.message }, 'Failed to manage database user');
    res.status(500).json({ error: err.message || 'Failed to manage database user' });
  }
});



// ── Filesystem routes (browser File Manager / IDE) ───────────────────────────

app.get('/agent/fs/:deploymentId/list', async (req, res) => {
  try {
    const items = await listDir(req.params.deploymentId, req.query.path || '');
    res.json({ items });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get('/agent/fs/:deploymentId/read', async (req, res) => {
  try {
    const content = await readFile(req.params.deploymentId, req.query.path || '');
    res.json({ content });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.put('/agent/fs/:deploymentId/write', async (req, res) => {
  const { path: filePath, content } = req.body || {};
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content are required' });
  }
  try {
    await writeFile(req.params.deploymentId, filePath, content);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post('/agent/fs/:deploymentId/mkdir', async (req, res) => {
  const { path: dirPath } = req.body || {};
  if (!dirPath) return res.status(400).json({ error: 'path is required' });
  try {
    await makeDir(req.params.deploymentId, dirPath);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.delete('/agent/fs/:deploymentId/delete', async (req, res) => {
  const { path: filePath } = req.body || {};
  if (!filePath) return res.status(400).json({ error: 'path is required' });
  try {
    await fsRemove(req.params.deploymentId, filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post('/agent/fs/:deploymentId/rename', async (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  try {
    await rename(req.params.deploymentId, from, to);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post('/agent/fs/:deploymentId/upload-binary', async (req, res) => {
  const { path: filePath, base64Content } = req.body || {};
  if (!filePath || !base64Content) return res.status(400).json({ error: 'path and base64Content are required' });
  try {
    await writeBinaryFile(req.params.deploymentId, filePath, base64Content);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post('/agent/fs/:deploymentId/extract', async (req, res) => {
  const { path: archivePath } = req.body || {};
  if (!archivePath) return res.status(400).json({ error: 'path is required' });
  try {
    await extractArchive(req.params.deploymentId, archivePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Purge workspace directory for 24h retention cleanup
app.delete('/agent/fs/:deploymentId/cleanup', async (req, res) => {
  try {
    const dir = path.join(WORKSPACES_DIR, req.params.deploymentId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push workspace to remote shadow backup repo
app.post(['/agent/fs/:deploymentId/git-commit-push', '/agent/deployments/:deploymentId/git-backup-push'], async (req, res) => {
  const { remoteUrl, commitMessage, authorName, authorEmail } = req.body || {};
  if (!remoteUrl) return res.status(400).json({ error: 'remoteUrl is required' });
  try {
    await pushWorkspaceToRemote(
      req.params.deploymentId,
      remoteUrl,
      commitMessage,
      authorName,
      authorEmail
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, deploymentId: req.params.deploymentId }, 'Failed git-commit-push in node-agent');
    res.status(500).json({ error: err.message });
  }
});


// ── Node Engine System & Container Management Routes ─────────────────────────

app.get('/agent/engine/monitoring', async (req, res) => {
  const limitGb = req.query.monthlyLimitGb ? Number(req.query.monthlyLimitGb) : 30000;
  try {
    const data = await nodeEngine.getSystemMonitoringInfo(limitGb);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/engine/packages/install', async (req, res) => {
  const { packageName } = req.body || {};
  try {
    const result = await nodeEngine.installSystemPackage(packageName);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/agent/engine/packages/upgrade', async (_req, res) => {
  try {
    const result = await nodeEngine.upgradeSystemPackages();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/engine/ports', async (_req, res) => {
  try {
    const ports = await nodeEngine.getListeningPorts();
    res.json({ ports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/engine/services', async (_req, res) => {
  try {
    const services = await nodeEngine.listSystemdServices();
    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/engine/services/action', async (req, res) => {
  const { action, serviceName } = req.body || {};
  try {
    const result = await nodeEngine.controlSystemdService(action, serviceName);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/agent/engine/services/logs', async (req, res) => {
  const { serviceName, lines } = req.query || {};
  try {
    const result = await nodeEngine.getServiceLogs(String(serviceName), lines ? Number(lines) : 100);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/agent/engine/users', async (_req, res) => {
  try {
    const users = await nodeEngine.listLinuxUsers();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/engine/users', async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const result = await nodeEngine.createLinuxUser(username, password);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/agent/engine/users/:username', async (req, res) => {
  const removeHome = req.query.removeHome !== 'false';
  try {
    const result = await nodeEngine.deleteLinuxUser(req.params.username, removeHome);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/agent/engine/users/:username/password', async (req, res) => {
  const { password } = req.body || {};
  try {
    const result = await nodeEngine.setLinuxUserPassword(req.params.username, password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/agent/engine/users/:username/groups', async (req, res) => {
  const { group, action } = req.body || {};
  try {
    const result = await nodeEngine.modifyLinuxUserGroups(req.params.username, group, action || 'add');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/agent/engine/docker/containers', async (_req, res) => {
  try {
    const containers = await nodeEngine.listDockerContainers();
    res.json({ containers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/engine/docker/containers', async (req, res) => {
  try {
    const result = await nodeEngine.createDockerContainer(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/agent/engine/docker/containers/:id/action', async (req, res) => {
  const { action } = req.body || {};
  try {
    const result = await nodeEngine.controlDockerContainer(action, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/agent/engine/docker/containers/:id/logs', async (req, res) => {
  const tail = req.query.tail ? Number(req.query.tail) : 200;
  try {
    const result = await nodeEngine.getDockerContainerLogs(req.params.id, tail);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/agent/engine/docker/networks', async (_req, res) => {
  try {
    const networks = await nodeEngine.listDockerNetworks();
    res.json({ networks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/engine/docker/networks', async (req, res) => {
  const { name, driver } = req.body || {};
  try {
    const result = await nodeEngine.createDockerNetwork(name, driver);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/agent/engine/docker/compose', async (req, res) => {
  const { yamlContent, projectName } = req.body || {};
  try {
    const result = await nodeEngine.deployDockerCompose(yamlContent, projectName);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/agent/engine/docker/prune', async (_req, res) => {
  try {
    const result = await nodeEngine.pruneDockerResources();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/engine/firewall', async (_req, res) => {
  try {
    const status = await nodeEngine.getUfwStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/engine/firewall/rules', async (req, res) => {
  const { port, protocol, action } = req.body || {};
  try {
    const result = await nodeEngine.addUfwRule(port, protocol, action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/agent/engine/firewall/rules', async (req, res) => {
  const { port, protocol } = req.query || {};
  try {
    const result = await nodeEngine.deleteUfwRule(port, protocol);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Projects routes (Supabase-like DB project provisioning) ──────────────────

app.post('/agent/projects', async (req, res) => {
  const { projectId, dbName, dbUsername, password } = req.body || {};
  if (!projectId || !dbName || !dbUsername || !password) {
    return res.status(400).json({ error: 'projectId, dbName, dbUsername, and password are required' });
  }
  try {
    const result = await provisionProject({ projectId, dbName, dbUsername, password });
    logger.info({ projectId, dbName }, 'Project provisioned');
    res.status(201).json(result);
  } catch (err) {
    logger.error({ projectId, err }, 'Failed to provision project');
    res.status(500).json({ error: err.message });
  }
});

app.delete('/agent/projects/:projectId', async (req, res) => {
  const { dbName, dbUsername } = req.body || {};
  try {
    await deprovisionProject({ projectId: req.params.projectId, dbName, dbUsername });
    logger.info({ projectId: req.params.projectId }, 'Project deprovisioned');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ projectId: req.params.projectId, err }, 'Failed to deprovision project');
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/projects/:projectId/sql', async (req, res) => {
  const { sql, dbName } = req.body || {};
  if (!sql || !dbName) return res.status(400).json({ error: 'sql and dbName are required' });
  try {
    const result = await execSql({ projectId: req.params.projectId, dbName, sql });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/agent/projects/:projectId/tables', async (req, res) => {
  const { dbName } = req.query;
  if (!dbName) return res.status(400).json({ error: 'dbName query param required' });
  try {
    const tables = await listTables({ dbName });
    res.json({ tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/projects/:projectId/tables/:table/rows', async (req, res) => {
  const { dbName, page = '1', limit = '50' } = req.query;
  if (!dbName) return res.status(400).json({ error: 'dbName required' });
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    validateIdentifier(req.params.table, 'tableName');
    const result = await execSql({
      projectId: req.params.projectId,
      dbName,
      sql: `SELECT * FROM "${req.params.table}" LIMIT ${parseInt(limit)} OFFSET ${offset};`,
    });
    const countResult = await execSql({
      projectId: req.params.projectId,
      dbName,
      sql: `SELECT COUNT(*) AS total FROM "${req.params.table}";`,
    });
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    res.json({ rows: result.rows, total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/agent/projects/:projectId/tables/:table/rows', async (req, res) => {
  const { dbName, ...row } = req.body || {};
  if (!dbName) return res.status(400).json({ error: 'dbName required' });
  try {
    const result = await insertRow({
      projectId: req.params.projectId,
      dbName,
      tableName: req.params.table,
      row,
    });
    res.status(201).json({ row: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/agent/projects/:projectId/tables/:table/rows/:pk', async (req, res) => {
  const { dbName, pkColumn = 'id', ...row } = req.body || {};
  if (!dbName) return res.status(400).json({ error: 'dbName required' });
  try {
    const result = await updateRow({
      projectId: req.params.projectId,
      dbName,
      tableName: req.params.table,
      pkColumn,
      pkValue: req.params.pk,
      row,
    });
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/agent/projects/:projectId/tables/:table/rows/:pk', async (req, res) => {
  const { dbName, pkColumn = 'id' } = req.query || req.body || {};
  if (!dbName) return res.status(400).json({ error: 'dbName required' });
  try {
    await deleteRow({
      projectId: req.params.projectId,
      dbName,
      tableName: req.params.table,
      pkColumn,
      pkValue: req.params.pk,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ── Docker Compose template deployments ──────────────────────────────────────

const os = require('os');
const { randomBytes } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const COMPOSE_DIR = process.env.COMPOSE_DATA_DIR || '/srv/compose';

/** Auto-generate values for SERVICE_PASSWORD_* / SERVICE_USER_* / SERVICE_URL_* placeholders. */
function resolveEnvVars(yamlContent, userEnvVars = {}) {
  const autoEnv = { ...userEnvVars };

  // SERVICE_PASSWORD_<NAME> → random 24-char hex
  const pwMatches = yamlContent.matchAll(/SERVICE_PASSWORD_([A-Z0-9_]+)/g);
  for (const m of pwMatches) {
    const key = `SERVICE_PASSWORD_${m[1]}`;
    if (!autoEnv[key]) autoEnv[key] = randomBytes(16).toString('hex');
  }

  // SERVICE_USER_<NAME> → sensible default username
  const userMatches = yamlContent.matchAll(/SERVICE_USER_([A-Z0-9_]+)/g);
  for (const m of userMatches) {
    const key = `SERVICE_USER_${m[1]}`;
    if (!autoEnv[key]) autoEnv[key] = m[1].toLowerCase();
  }

  return autoEnv;
}

/**
 * POST /agent/compose/up
 * Body: { composeYaml: string, projectName: string, envVars?: Record<string,string> }
 * Writes the YAML to disk, then runs `docker compose up -d`.
 */
app.post('/agent/compose/up', async (req, res) => {
  const { composeYaml, projectName, envVars } = req.body || {};
  if (!composeYaml || !projectName) {
    return res.status(400).json({ error: 'composeYaml and projectName are required' });
  }

  const safeProject = projectName.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 60);
  const projectDir = `${COMPOSE_DIR}/${safeProject}`;

  try {
    // Create project directory
    fs.mkdirSync(projectDir, { recursive: true });

    // Write env vars with auto-generated secrets
    const resolvedEnv = resolveEnvVars(composeYaml, envVars || {});
    const envFileContent = Object.entries(resolvedEnv)
      .map(([k, v]) => `${k}="${String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
      .join('\n');

    fs.writeFileSync(`${projectDir}/docker-compose.yml`, composeYaml, 'utf8');
    if (envFileContent) fs.writeFileSync(`${projectDir}/.env`, envFileContent, 'utf8');

    // Pull images first (so we can give a better error), then bring up
    await execFileAsync('docker', ['compose', '-p', safeProject, '-f', `${projectDir}/docker-compose.yml`, '--env-file', `${projectDir}/.env`, 'pull', '--quiet'], { cwd: projectDir });
    const { stdout, stderr } = await execFileAsync('docker', ['compose', '-p', safeProject, '-f', `${projectDir}/docker-compose.yml`, '--env-file', `${projectDir}/.env`, 'up', '-d', '--remove-orphans'], { cwd: projectDir });

    logger.info({ safeProject }, 'Compose stack started');
    res.status(201).json({
      ok: true,
      project: safeProject,
      env: Object.fromEntries(Object.entries(resolvedEnv).filter(([k]) => k.startsWith('SERVICE_PASSWORD_') || k.startsWith('SERVICE_USER_'))),
      stdout,
      stderr,
    });
  } catch (err) {
    logger.error({ safeProject, err }, 'Failed to start compose stack');
    res.status(500).json({ error: err.stderr || err.message });
  }
});

/**
 * DELETE /agent/compose/:project
 * Tears down a compose project (docker compose down -v).
 */
app.delete('/agent/compose/:project', async (req, res) => {
  const safeProject = req.params.project.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const projectDir = `${COMPOSE_DIR}/${safeProject}`;

  try {
    await execFileAsync('docker', ['compose', '-p', safeProject, '-f', `${projectDir}/docker-compose.yml`, 'down', '-v', '--remove-orphans']);
    require('fs').rmSync(projectDir, { recursive: true, force: true });
    logger.info({ safeProject }, 'Compose stack torn down');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ safeProject, err }, 'Failed to tear down compose stack');
    res.status(500).json({ error: err.stderr || err.message });
  }
});

/**
 * GET /agent/compose/:project/logs
 * Returns logs for a compose project.
 */
app.get('/agent/compose/:project/logs', async (req, res) => {
  const safeProject = req.params.project.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const projectDir = `${COMPOSE_DIR}/${safeProject}`;
  const tail = req.query.tail || '200';

  try {
    const { stdout } = await execFileAsync('docker', ['compose', '-p', safeProject, '-f', `${projectDir}/docker-compose.yml`, 'logs', '--no-color', '--tail', tail]);
    res.json({ logs: stdout });
  } catch (err) {
    res.status(500).json({ error: err.stderr || err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, BIND_HOST, () => {
  logger.info({ port: PORT, host: BIND_HOST }, 'node-agent listening');
  if (BIND_HOST === '0.0.0.0' && ALLOWED_IPS.length === 0) {
    logger.warn(
      'node-agent is bound to all interfaces with no AGENT_ALLOWED_IPS configured. ' +
        'This service must not be reachable from the public internet -- set AGENT_BIND_HOST ' +
        'to a private-network address, and/or set AGENT_ALLOWED_IPS to your control plane\'s IP(s), ' +
        'and firewall this port at the OS/cloud level.'
    );
  }

  // Periodic autonomous stats reporting loop back to control plane API
  const API_URL = process.env.API_URL;
  const NODE_ID = process.env.NODE_ID;
  if (API_URL && NODE_ID) {
    setInterval(async () => {
      try {
        const stats = await collectStats();
        await fetch(`${API_URL}/api/nodes/${NODE_ID}/stats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-agent-secret': AGENT_SECRET,
          },
          body: JSON.stringify(stats),
        });
      } catch (err) {
        logger.debug({ err }, 'Periodic node stats reporting failed');
      }
    }, 60_000);
  }
});


