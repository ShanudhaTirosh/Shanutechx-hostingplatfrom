/**
 * cockpit.js — Node Agent System Management & Security Module (Cockpit-style)
 * 
 * Provides secure system monitoring, systemd service management, Linux user admin,
 * Docker container operations, and UFW firewall rule configuration.
 * 
 * SECURITY DIRECTIVE:
 * All commands are executed strictly via child_process.execFile / spawn with argument arrays.
 * User inputs are sanitized using strict regex validation before reaching execFile.
 */

const { execFile } = require('child_process');
const util = require('util');
const fs = require('fs/promises');
const si = require('systeminformation');
const Docker = require('dockerode');

const execFileAsync = util.promisify(execFile);
const docker = new Docker();

// Validation Whitelists
const REGEX_SERVICE_NAME = /^[a-zA-Z0-9_\-\.]+\.service$|^[a-zA-Z0-9_\-\.]+$/;
const REGEX_USERNAME = /^[a-zA-Z0-9_-]{1,32}$/;
const REGEX_GROUPNAME = /^[a-zA-Z0-9_-]{1,32}$/;

// ── 1. SYSTEM MONITORING ───────────────────────────────────────────────────

async function getSystemMonitoringInfo() {
  const [cpu, mem, load, fsSize, time] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.currentLoad(),
    si.fsSize(),
    si.time(),
  ]);

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
  };
}

// ── 2. SYSTEMD SERVICE MANAGEMENT ──────────────────────────────────────────

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
    // Return empty list if systemctl isn't available (e.g., inside container or Windows host)
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

// ── 3. LINUX USER MANAGEMENT ───────────────────────────────────────────────

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
    return [];
  }
}

async function createLinuxUser(username, password) {
  if (!REGEX_USERNAME.test(username)) {
    throw new Error('Invalid username. Must be 1-32 alphanumeric characters, dashes, or underscores.');
  }

  await execFileAsync('useradd', ['-m', '-s', '/bin/bash', username]);

  if (password) {
    // Await the password setting instead of fire-and-forget (Bug 3 fix)
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

// ── 4. DOCKER CONTAINER MANAGEMENT ─────────────────────────────────────────

async function listDockerContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers.map((c) => ({
      id: c.Id,
      shortId: c.Id.slice(0, 12),
      names: c.Names.map((n) => n.replace(/^\//, '')),
      image: c.Image,
      status: c.Status,
      state: c.State, // 'running' | 'exited' | 'paused'
      created: c.Created,
      ports: c.Ports.map((p) => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
      })),
    }));
  } catch (err) {
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

/**
 * Strips the 8-byte Docker stream multiplexer header from each log chunk.
 * Format: [stream_type (1B), padding (3B), length (4B big-endian), payload...]
 * Without stripping, raw binary headers appear as garbage control characters.
 */
function stripDockerLogHeaders(buffer) {
  const chunks = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break; // incomplete header — stop
    const payloadLen = buffer.readUInt32BE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + payloadLen;
    if (payloadEnd > buffer.length) break; // incomplete chunk — stop
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

  // logsBuffer may be a Buffer or a string depending on the Dockerode version
  const raw = Buffer.isBuffer(logsBuffer) ? logsBuffer : Buffer.from(logsBuffer);
  const logs = stripDockerLogHeaders(raw);

  return { containerId, logs };
}

// ── 5. UFW FIREWALL CONFIGURATION ──────────────────────────────────────────

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
  getUfwStatus,
  addUfwRule,
  deleteUfwRule,
};
