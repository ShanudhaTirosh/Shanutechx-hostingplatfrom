/**
 * nodeEngine.js — Node Agent System Engine & Docker Orchestration Module
 * 
 * Provides host node telemetry, systemd service administration, Linux user accounts,
 * OS package management/installation, listening ports detection, UFW firewall rules,
 * advanced Docker container & network orchestration, and Docker Compose stack management.
 * 
 * SECURITY DIRECTIVE:
 * All commands are executed strictly via child_process.execFile / spawn with argument arrays.
 * User inputs are sanitized using strict regex whitelists before command execution.
 */

const { execFile, exec } = require('child_process');
const util = require('util');
const fs = require('fs/promises');
const path = require('path');
const si = require('systeminformation');
const Docker = require('dockerode');

const execFileAsync = util.promisify(execFile);
const execAsync = util.promisify(exec);
const docker = new Docker();

// Whitelist Regexes
const REGEX_SERVICE_NAME = /^[a-zA-Z0-9_\-\.]+\.service$|^[a-zA-Z0-9_\-\.]+$/;
const REGEX_USERNAME = /^[a-zA-Z0-9_-]{1,32}$/;
const REGEX_GROUPNAME = /^[a-zA-Z0-9_-]{1,32}$/;
const REGEX_PACKAGE_NAME = /^[a-zA-Z0-9_\-\.\+]{1,64}$/;
const REGEX_NETWORK_NAME = /^[a-zA-Z0-9_\-]{1,64}$/;

// ── 1. SYSTEM MONITORING & BANDWIDTH TELEMETRY ────────────────────────────

async function getSystemMonitoringInfo(monthlyBandwidthGb = 30000) {
  const [cpu, mem, load, fsSize, time, netStats] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.currentLoad(),
    si.fsSize(),
    si.time(),
    si.networkStats().catch(() => []),
  ]);

  // Aggregate network rx/tx bytes across all physical interfaces
  let totalRxBytes = 0;
  let totalTxBytes = 0;
  if (Array.isArray(netStats)) {
    for (const net of netStats) {
      if (net.iface && !net.iface.startsWith('lo') && !net.iface.startsWith('veth') && !net.iface.startsWith('br-')) {
        totalRxBytes += net.rx_bytes || 0;
        totalTxBytes += net.tx_bytes || 0;
      }
    }
  }

  const totalBytes = totalRxBytes + totalTxBytes;
  const usedGb = Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100;
  const limitGb = Math.max(1, Number(monthlyBandwidthGb) || 30000);
  const bandwidthPct = Math.min(100, Math.round((usedGb / limitGb) * 10000) / 100);

  return {
    uptimeSeconds: time.uptime,
    loadAverage: load.currentLoad,
    cpu: {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      cores: cpu.cores,
      usagePct: Math.round(load.currentLoad * 100) / 100,
    },
    memory: {
      totalMb: Math.round(mem.total / 1024 / 1024),
      usedMb: Math.round(mem.used / 1024 / 1024),
      freeMb: Math.round(mem.free / 1024 / 1024),
      usedPct: Math.round((mem.used / mem.total) * 10000) / 100,
    },
    disks: fsSize.map((disk) => ({
      fs: disk.fs,
      type: disk.type,
      sizeGb: Math.round(disk.size / 1024 / 1024 / 1024),
      usedGb: Math.round(disk.used / 1024 / 1024 / 1024),
      usedPct: Math.round(disk.use * 100) / 100,
      mount: disk.mount,
    })),
    network: {
      rxBytes: totalRxBytes,
      txBytes: totalTxBytes,
      rxGb: Math.round((totalRxBytes / (1024 * 1024 * 1024)) * 100) / 100,
      txGb: Math.round((totalTxBytes / (1024 * 1024 * 1024)) * 100) / 100,
      totalUsedGb: usedGb,
      monthlyLimitGb: limitGb,
      usedPct: bandwidthPct,
    },
  };
}

// ── 2. OS PACKAGE INSTALLATION & SYSTEM UPGRADES ──────────────────────────

async function installSystemPackage(packageName) {
  if (!REGEX_PACKAGE_NAME.test(packageName)) {
    throw new Error('Invalid package name format');
  }

  // Detect package manager (debian/ubuntu apt-get, alpine apk, centos/rhel yum/dnf)
  try {
    const { stdout } = await execFileAsync('apt-get', ['update', '-y'], { timeout: 60000 });
    const installRes = await execFileAsync('apt-get', ['install', '-y', packageName], { timeout: 180000 });
    return { ok: true, package: packageName, output: stdout + '\n' + installRes.stdout };
  } catch (aptErr) {
    try {
      const { stdout } = await execFileAsync('apk', ['add', '--no-cache', packageName], { timeout: 60000 });
      return { ok: true, package: packageName, output: stdout };
    } catch (apkErr) {
      try {
        const { stdout } = await execFileAsync('yum', ['install', '-y', packageName], { timeout: 180000 });
        return { ok: true, package: packageName, output: stdout };
      } catch (yumErr) {
        throw new Error(`Package installation failed: ${aptErr.message || apkErr.message || yumErr.message}`);
      }
    }
  }
}

async function upgradeSystemPackages() {
  try {
    const updateRes = await execFileAsync('apt-get', ['update', '-y'], { timeout: 60000 });
    const upgradeRes = await execFileAsync('apt-get', ['upgrade', '-y'], { timeout: 300000 });
    return { ok: true, output: updateRes.stdout + '\n' + upgradeRes.stdout };
  } catch (aptErr) {
    try {
      const upgradeRes = await execFileAsync('apk', ['upgrade', '-U'], { timeout: 180000 });
      return { ok: true, output: upgradeRes.stdout };
    } catch (apkErr) {
      try {
        const upgradeRes = await execFileAsync('yum', ['update', '-y'], { timeout: 300000 });
        return { ok: true, output: upgradeRes.stdout };
      } catch (yumErr) {
        throw new Error(`Package upgrade failed: ${aptErr.message || apkErr.message || yumErr.message}`);
      }
    }
  }
}

// ── 3. LISTENING PORTS DETECTOR ───────────────────────────────────────────

async function getListeningPorts() {
  try {
    const { stdout } = await execFileAsync('ss', ['-tulpn']);
    const lines = stdout.split('\n');
    const ports = [];

    for (const line of lines) {
      if (line.includes('LISTEN') || line.includes('UNCONN')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const proto = parts[0];
          const localAddr = parts[4];
          const processInfo = parts[6] || '';
          
          const portMatch = localAddr.match(/:(\d+)$/);
          if (portMatch) {
            ports.push({
              protocol: proto.toUpperCase(),
              port: Number(portMatch[1]),
              address: localAddr,
              process: processInfo,
            });
          }
        }
      }
    }

    return ports;
  } catch (err) {
    console.error('[nodeEngine] getListeningPorts failed:', err?.message || err);
    return [];
  }
}

// ── 4. SYSTEMD SERVICE MANAGEMENT ──────────────────────────────────────────

async function listSystemdServices() {
  try {
    const { stdout } = await execFileAsync('systemctl', [
      'list-units',
      '--type=service',
      '--all',
      '--no-legend',
      '--no-pager',
    ]);

    const lines = stdout.split('\n');
    const services = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const name = parts[0];
        const load = parts[1];
        const active = parts[2];
        const sub = parts[3];
        const description = parts.slice(4).join(' ');

        if (name.endsWith('.service')) {
          services.push({
            name,
            status: active === 'active' ? 'active' : sub === 'failed' ? 'failed' : 'inactive',
            loadState: load,
            subState: sub,
            description,
          });
        }
      }
    }

    return services;
  } catch (err) {
    console.error('[nodeEngine] listSystemdServices failed:', err?.message || err);
    return [];
  }
}

async function controlSystemdService(action, serviceName) {
  const allowedActions = ['start', 'stop', 'restart', 'enable', 'disable'];
  if (!allowedActions.includes(action)) {
    throw new Error(`Invalid service action: ${action}`);
  }

  if (!REGEX_SERVICE_NAME.test(serviceName)) {
    throw new Error('Invalid service name formatting');
  }

  const cleanName = serviceName.endsWith('.service') ? serviceName : `${serviceName}.service`;
  await execFileAsync('systemctl', [action, cleanName]);
  return { ok: true, action, service: cleanName };
}

async function getServiceLogs(serviceName, linesCount = 100) {
  if (!REGEX_SERVICE_NAME.test(serviceName)) {
    throw new Error('Invalid service name formatting');
  }

  const cleanName = serviceName.endsWith('.service') ? serviceName : `${serviceName}.service`;
  const count = Math.min(Math.max(1, linesCount), 500);

  const { stdout } = await execFileAsync('journalctl', [
    '-u',
    cleanName,
    '-n',
    String(count),
    '--no-pager',
  ]);

  return { service: cleanName, logs: stdout };
}

// ── 5. LINUX USER MANAGEMENT ───────────────────────────────────────────────

async function listLinuxUsers() {
  try {
    const passwdContent = await fs.readFile('/etc/passwd', 'utf8');
    const lines = passwdContent.split('\n');
    const users = [];

    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;
      const parts = line.split(':');
      if (parts.length >= 7) {
        const username = parts[0];
        const uid = parseInt(parts[2], 10);
        const gid = parseInt(parts[3], 10);
        const gecos = parts[4];
        const home = parts[5];
        const shell = parts[6];

        if (uid >= 1000 || username === 'root') {
          users.push({ username, uid, gid, gecos, home, shell });
        }
      }
    }

    return users;
  } catch (err) {
    console.error('[nodeEngine] listLinuxUsers failed:', err?.message || err);
    return [];
  }
}

async function createLinuxUser(username, password) {
  if (!REGEX_USERNAME.test(username)) {
    throw new Error('Invalid username. Must be 1-32 alphanumeric characters, dashes, or underscores.');
  }

  await execFileAsync('useradd', ['-m', '-s', '/bin/bash', username]);

  if (password) {
    await new Promise((resolve, reject) => {
      const child = execFile('passwd', [username], (err, _stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(undefined);
      });
      child.stdin.write(`${password}\n${password}\n`);
      child.stdin.end();
    });
  }

  return { ok: true, username };
}

async function deleteLinuxUser(username, removeHome = true) {
  if (!REGEX_USERNAME.test(username)) {
    throw new Error('Invalid username');
  }

  const args = removeHome ? ['-r', username] : [username];
  await execFileAsync('userdel', args);
  return { ok: true, username };
}

async function setLinuxUserPassword(username, password) {
  if (!REGEX_USERNAME.test(username)) {
    throw new Error('Invalid username');
  }

  return new Promise((resolve, reject) => {
    const child = execFile('passwd', [username], (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ ok: true, username });
    });

    child.stdin.write(`${password}\n${password}\n`);
    child.stdin.end();
  });
}

async function modifyLinuxUserGroups(username, group, action = 'add') {
  if (!REGEX_USERNAME.test(username) || !REGEX_GROUPNAME.test(group)) {
    throw new Error('Invalid username or group name');
  }

  if (action === 'add') {
    await execFileAsync('usermod', ['-aG', group, username]);
  } else if (action === 'remove') {
    await execFileAsync('gpasswd', ['-d', username, group]);
  }

  return { ok: true, username, group, action };
}

// ── 6. DOCKER CONTAINER & NETWORK ORCHESTRATION ────────────────────────────

async function listDockerContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers.map((c) => ({
      id: c.Id,
      shortId: c.Id.slice(0, 12),
      names: c.Names.map((n) => n.replace(/^\//, '')),
      image: c.Image,
      status: c.Status,
      state: c.State,
      created: c.Created,
      ports: c.Ports.map((p) => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
      })),
    }));
  } catch (err) {
    console.error('[nodeEngine] listDockerContainers failed:', err?.message || err);
    return [];
  }
}

async function controlDockerContainer(action, containerId) {
  const allowedActions = ['start', 'stop', 'restart', 'remove'];
  if (!allowedActions.includes(action)) {
    throw new Error(`Invalid container action: ${action}`);
  }

  const container = docker.getContainer(containerId);
  if (action === 'start') await container.start();
  else if (action === 'stop') await container.stop();
  else if (action === 'restart') await container.restart();
  else if (action === 'remove') await container.remove({ force: true });

  return { ok: true, action, containerId };
}

function stripDockerLogHeaders(buffer) {
  const chunks = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;
    const payloadLen = buffer.readUInt32BE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + payloadLen;
    if (payloadEnd > buffer.length) break;
    chunks.push(buffer.slice(payloadStart, payloadEnd));
    offset = payloadEnd;
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function getDockerContainerLogs(containerId, tail = 200) {
  const container = docker.getContainer(containerId);
  const logsBuffer = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });

  const raw = Buffer.isBuffer(logsBuffer) ? logsBuffer : Buffer.from(logsBuffer);
  const logs = stripDockerLogHeaders(raw);

  return { containerId, logs };
}

async function getDockerContainerLogStream(containerId, tail = 100) {
  const container = docker.getContainer(containerId);
  return await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
}

async function createDockerContainer({ name, image, env = [], ports = [], volumes = [], network }) {
  // Pull image if not local
  try {
    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (pullErr) => {
          if (pullErr) return reject(pullErr);
          resolve();
        });
      });
    });
  } catch (e) {
    console.warn(`[nodeEngine] docker.pull for image ${image} encountered notice: ${e?.message || e}. Continuing with local image if available.`);
  }

  const portBindings = {};
  const exposedPorts = {};
  if (Array.isArray(ports)) {
    for (const p of ports) {
      if (p.hostPort && p.containerPort) {
        const key = `${p.containerPort}/tcp`;
        exposedPorts[key] = {};
        portBindings[key] = [{ HostPort: String(p.hostPort) }];
      }
    }
  }

  const RESTRICTED_HOST_PATHS = [
    '/var/run/docker.sock',
    '/proc',
    '/sys',
    '/etc',
    '/dev',
    '/root',
    '/',
  ];

  const binds = Array.isArray(volumes)
    ? volumes
        .filter((v) => {
          if (!v.hostPath || !v.containerPath) return false;
          const normalized = path.normalize(v.hostPath).replace(/\\/g, '/').toLowerCase();
          const isRestricted = RESTRICTED_HOST_PATHS.some((p) => normalized === p || normalized.startsWith(p + '/'));
          return !isRestricted;
        })
        .map((v) => `${v.hostPath}:${v.containerPath}`)
    : [];

  const container = await docker.createContainer({
    name,
    Image: image,
    Env: Array.isArray(env) ? env : [],
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Binds: binds,
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: network || 'bridge',
      SecurityOpt: ['no-new-privileges:true'],
    },
  });

  await container.start();
  return { ok: true, containerId: container.id, name };
}

async function listDockerNetworks() {
  try {
    const networks = await docker.listNetworks();
    return networks.map((n) => ({
      id: n.Id,
      name: n.Name,
      driver: n.Driver,
      scope: n.Scope,
    }));
  } catch (err) {
    console.error('[nodeEngine] listDockerNetworks failed:', err?.message || err);
    return [];
  }
}

async function createDockerNetwork(name, driver = 'bridge') {
  if (!REGEX_NETWORK_NAME.test(name)) {
    throw new Error('Invalid network name format');
  }
  const net = await docker.createNetwork({ Name: name, Driver: driver });
  return { ok: true, id: net.id, name };
}

const REGEX_PROJECT_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

const os = require('os');

async function deployDockerCompose(yamlContent, projectName = 'stx-stack') {
  if (!REGEX_PROJECT_NAME.test(projectName)) {
    throw new Error('Invalid project name format. Only alphanumeric characters, dashes, and underscores are allowed.');
  }

  const baseDir = path.join(os.tmpdir(), 'stx-compose-');
  const targetDir = await fs.mkdtemp(baseDir);
  const composePath = path.join(targetDir, 'docker-compose.yml');
  await fs.writeFile(composePath, yamlContent, { encoding: 'utf8', mode: 0o600 });

  try {
    const { stdout, stderr } = await execFileAsync('docker', ['compose', '-f', composePath, '-p', projectName, 'up', '-d']);
    return { ok: true, output: stdout + '\n' + stderr };
  } catch (err) {
    try {
      const { stdout, stderr } = await execFileAsync('docker-compose', ['-f', composePath, '-p', projectName, 'up', '-d']);
      return { ok: true, output: stdout + '\n' + stderr };
    } catch (e) {
      throw new Error(`Docker Compose deployment failed: ${err.message || e.message}`);
    }
  } finally {
    await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function pruneDockerResources() {
  const containers = await docker.pruneContainers();
  const images = await docker.pruneImages();
  return { ok: true, containersPruned: containers.ContainersDeleted?.length || 0, imagesPruned: images.ImagesDeleted?.length || 0 };
}

// ── 7. UFW FIREWALL CONFIGURATION ──────────────────────────────────────────

async function getUfwStatus() {
  try {
    const { stdout } = await execFileAsync('ufw', ['status', 'verbose']);
    const lines = stdout.split('\n');
    const isActive = stdout.includes('Status: active');

    const rules = [];
    let parsingRules = false;

    for (const line of lines) {
      if (line.includes('To') && line.includes('Action') && line.includes('From')) {
        parsingRules = true;
        continue;
      }
      if (parsingRules && line.trim()) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          rules.push({
            to: parts[0],
            action: parts[1],
            from: parts[2],
          });
        }
      }
    }

    return { active: isActive, rules, raw: stdout };
  } catch (err) {
    return { active: false, rules: [], raw: 'UFW not installed or insufficient permissions' };
  }
}

async function addUfwRule(port, protocol = 'tcp', action = 'allow') {
  const portNum = Number(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error('Port must be an integer between 1 and 65535');
  }

  const cleanProto = String(protocol).toLowerCase();
  if (cleanProto !== 'tcp' && cleanProto !== 'udp') {
    throw new Error('Protocol must be tcp or udp');
  }

  const cleanAction = String(action).toLowerCase();
  if (cleanAction !== 'allow' && cleanAction !== 'deny') {
    throw new Error('Action must be allow or deny');
  }

  const rule = `${portNum}/${cleanProto}`;
  await execFileAsync('ufw', [cleanAction, rule]);
  return { ok: true, port: portNum, protocol: cleanProto, action: cleanAction };
}

async function deleteUfwRule(port, protocol = 'tcp') {
  const portNum = Number(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error('Port must be an integer between 1 and 65535');
  }

  const cleanProto = String(protocol).toLowerCase();
  if (cleanProto !== 'tcp' && cleanProto !== 'udp') {
    throw new Error('Protocol must be tcp or udp');
  }

  const rule = `${portNum}/${cleanProto}`;
  await execFileAsync('ufw', ['delete', 'allow', rule]).catch(() =>
    execFileAsync('ufw', ['delete', 'deny', rule])
  );

  return { ok: true, port: portNum, protocol: cleanProto };
}

module.exports = {
  getSystemMonitoringInfo,
  installSystemPackage,
  upgradeSystemPackages,
  getListeningPorts,
  listSystemdServices,
  controlSystemdService,
  getServiceLogs,
  listLinuxUsers,
  createLinuxUser,
  deleteLinuxUser,
  setLinuxUserPassword,
  modifyLinuxUserGroups,
  listDockerContainers,
  controlDockerContainer,
  getDockerContainerLogs,
  getDockerContainerLogStream,
  createDockerContainer,
  listDockerNetworks,
  createDockerNetwork,
  deployDockerCompose,
  pruneDockerResources,
  getUfwStatus,
  addUfwRule,
  deleteUfwRule,
};
