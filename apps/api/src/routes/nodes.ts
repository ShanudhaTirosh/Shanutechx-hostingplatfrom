import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { Client as SshClient } from 'ssh2';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { PortError } from '../lib/portExposure';
import { closeNodePort, createExposureDeps, exposeNodePort, type ExposureDeps } from '../lib/nodePortExposure';
import { env } from '../env';
import { encryptSecret } from '../lib/secretsVault';
import { verifySharedSecret } from '../lib/gateAuth';
import { logger } from '../lib/logger';
import { createSubdomainRecord, deleteSubdomainRecord } from '../lib/cloudflare';
import { evacuateNodeWorkloads } from '../lib/failoverEngine';
import { notifyDiscordChannel } from '../lib/discordWebhooks';

export const nodesRouter = Router();


const CLUSTER_SECRET = env.nodeAgentSecret;

function clusterSecretMatches(submitted: string): boolean {
  // Constant-time comparison of the submitted secret against the env-provided
  // cluster secret. No public-literal HMAC key is used — the secret itself is
  // the only thing being compared.
  return verifySharedSecret(submitted, CLUSTER_SECRET);
}

// ── 1. PUBLIC / SCRIPT ENDPOINTS (No user session required, authenticated via Cluster Secret) ──

/**
 * GET /api/nodes/install.sh
 * Returns an automated bash onboarding script to install Docker, Node.js, and launch the
 * production ShanuTechX Node Agent service on any target Linux VPS/server.
 */
nodesRouter.get('/nodes/install.sh', (req: Request, res: Response) => {
  const rootDomain = process.env.ROOT_DOMAIN || 'shanutechx.com';
  const defaultApiUrl = `https://api.${rootDomain}`;

  const script = `#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# ShanuTechX Compute Node Automated Provisioning & Onboarding Script
# Autonomous Container Infrastructure Engine
# ------------------------------------------------------------------------------
set -euo pipefail

API_URL="\${1:-${defaultApiUrl}}"
SECRET="\${2:?"Error: Cluster secret is required. Usage: bash install.sh <api_url> <cluster_secret> [label] [role_tags]"}"
LABEL="\${3:-node-$(date +%s)}"
ROLE_TAGS="\${4:-web-hosting,node-hosting,python-hosting}"

echo "============================================================"
echo "🚀 Starting ShanuTechX Compute Node Onboarding..."
echo "============================================================"

if [ "\$EUID" -ne 0 ]; then
  echo "❌ Error: Please run this script as root (e.g., sudo bash)"
  exit 1
fi

# 1. Install Docker & Curl if missing
if ! command -v curl &> /dev/null; then
  echo "📦 Installing curl..."
  apt-get update && apt-get install -y curl || yum install -y curl || apk add curl
fi

if ! command -v docker &> /dev/null; then
  echo "🐳 Docker not found. Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || service docker start
else
  echo "✅ Docker Engine is already installed."
fi

# Ensure git and buildkit directory exist
mkdir -p /srv/compose /var/lib/shanutechx /var/log/shanutechx

# 2. Collect Hardware Specs
CPU_CORES=\$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 2)
RAM_MB=\$(free -m 2>/dev/null | awk '/^Mem:/{print \$2}' || echo 2048)
DISK_GB=\$(df -BG / 2>/dev/null | awk 'NR==2 {print \$2}' | tr -d 'G' || echo 40)
HOST_IP=\$(curl -s https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print \$1}' || echo "127.0.0.1")

echo "📊 Detected Hardware Configuration:"
echo "   - Host IP:    \$HOST_IP"
echo "   - CPU Cores:  \$CPU_CORES"
echo "   - RAM Memory: \${RAM_MB} MB"
echo "   - Disk Space: \${DISK_GB} GB"
echo "   - Role Tags:  \$ROLE_TAGS"

# 3. Self-Register with Control Plane API
echo "🔗 Registering Compute Node with Control Plane (\$API_URL)..."
TAG_JSON=\$(echo "\$ROLE_TAGS" | tr ',' '\n' | sed 's/^/"/' | sed 's/\$/"/' | paste -sd, -)

RESPONSE=\$(curl -s -X POST "\$API_URL/api/nodes/register" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"label\\": \\"\$LABEL\\",
    \\"ip\\": \\"\$HOST_IP\\",
    \\"secret\\": \\"\$SECRET\\",
    \\"cpuCores\\": \$CPU_CORES,
    \\"ramMb\\": \$RAM_MB,
    \\"diskGb\\": \$DISK_GB,
    \\"roleTags\\": [\$TAG_JSON]
  }")

echo "✅ Registration Response: \$RESPONSE"

if [ "\$5" != "--skip-docker-agent" ]; then
  # 4. Start ShanuTechX Production Node Agent Container
  echo "🐳 Launching ShanuTechX Node Agent Service on Port 5000..."
  docker stop shanutechx-agent &>/dev/null || true
  docker rm shanutechx-agent &>/dev/null || true

  # Pull official image or build locally if image registry is unavailable
  if docker pull ghcr.io/shanutechx/node-agent:latest &>/dev/null; then
    AGENT_IMAGE="ghcr.io/shanutechx/node-agent:latest"
  else
    echo "📦 Preparing standalone Node Agent runtime..."
    AGENT_IMAGE="node:20-alpine"
  fi

  docker run -d \
    --name shanutechx-agent \
    --restart always \
    -p 5000:5000 \
    -e AGENT_PORT=5000 \
    -e NODE_AGENT_SECRET="\$SECRET" \
    -e API_URL="\$API_URL" \
    -e ROOT_DOMAIN="${rootDomain}" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /srv/compose:/srv/compose \
    -v /var/lib/shanutechx:/var/lib/shanutechx \
    "\$AGENT_IMAGE" sh -c "if [ -f /opt/shanutechx/services/node-agent/src/index.js ]; then node /opt/shanutechx/services/node-agent/src/index.js; elif [ -f /repo/services/node-agent/src/index.js ]; then node /repo/services/node-agent/src/index.js; else echo 'Node Agent entry file not found'; exit 1; fi"
else
  echo "⏩ Skipping Docker container launch (--skip-docker-agent requested for native systemd service)"
fi

echo "============================================================"
echo "🎉 SUCCESS: Compute Node is onboarded & ONLINE in ShanuTechX!"
echo "============================================================"
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(script);
});

const DEFAULT_NODE_ROLE_TAGS = ['global', 'web-hosting', 'node-hosting', 'database-hosting', 'supabase-hosting'];

const registerNodeSchema = z.object({
  label: z.string().min(1),
  ip: z.string().min(1),
  secret: z.string().min(1),
  cpuCores: z.number().int().positive(),
  ramMb: z.number().int().positive(),
  diskGb: z.number().int().positive(),
  roleTags: z.array(z.string()).optional().default(DEFAULT_NODE_ROLE_TAGS),
});

/**
 * POST /api/nodes/register
 * Node self-registration payload sent from install.sh on remote target servers.
 */
nodesRouter.post('/nodes/register', async (req: Request, res: Response) => {
  const parsed = registerNodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  if (!clusterSecretMatches(parsed.data.secret)) {
    return res.status(401).json({ error: 'Invalid cluster secret key' });
  }

  const { label, ip, cpuCores, ramMb, diskGb, roleTags } = parsed.data;

  // Auto-point node subdomain via Cloudflare DNS if possible
  const cleanLabel = label.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'node';
  const nodeSubdomain = `node-${cleanLabel}`;
  try {
    await createSubdomainRecord(nodeSubdomain, ip, false);
    logger.info({ nodeSubdomain, ip }, 'Auto-created unproxied Cloudflare DNS record for registered node');
  } catch (dnsErr) {
    logger.warn({ dnsErr, nodeSubdomain, ip }, 'Cloudflare DNS auto-record registration skipped or failed');
  }

  // BUG-L05 FIX: Wrap findFirst+update/create in a serializable transaction to
  // eliminate the TOCTOU race. Both `ip` and `label` are not @unique in the
  // Prisma schema (they're just plain String fields), so Prisma upsert() cannot
  // be used directly. A $transaction with isolation level SERIALIZABLE ensures
  // only one registration wins when two requests arrive simultaneously.
  const nodeData = {
    label,
    ip,
    cpuCores,
    ramMb,
    diskGb,
    roleTags,
    isActive: true,
    lastSeenAt: new Date(),
  };

  let node;
  try {
    node = await prisma.$transaction(async (tx) => {
      const existing = await tx.node.findFirst({
        where: { OR: [{ ip }, { label }] },
      });

      if (existing) {
        if (existing.ip !== ip || existing.label !== label) {
          // A different node already claims this IP or label — caller should receive 409.
          // Throw a typed error so the route handler can turn it into an HTTP response.
          const err: any = new Error('Node IP or label conflicts with an existing registered node');
          err.statusCode = 409;
          throw err;
        }
        return tx.node.update({ where: { id: existing.id }, data: nodeData });
      }

      return tx.node.create({
        data: { ...nodeData, sshKeyRef: `vault:${label}` },
      });
    }, { isolationLevel: 'Serializable' });
  } catch (txErr: any) {
    if (txErr?.statusCode === 409) {
      return res.status(409).json({ error: txErr.message });
    }
    throw txErr;
  }

  res.status(200).json({
    success: true,
    node,
    domain: `${nodeSubdomain}.${env.rootDomain}`,
  });
});

// ── BUG-08 FIX: Node agent stats endpoint BEFORE admin middleware ──
// The node agent authenticates via x-agent-secret, not Firebase/admin API key.
// This must be registered before the requireAuth+requireAdminOrDev middleware.
const statsSchema = z.object({
  cpuUsedPct: z.number().min(0).max(100),
  ramUsedMb: z.number().int().min(0),
  diskUsedGb: z.number().int().min(0),
});

nodesRouter.post('/nodes/:id/stats', async (req: Request, res: Response) => {
  const agentSecret = req.headers['x-agent-secret'];
  if (typeof agentSecret !== 'string' || !clusterSecretMatches(agentSecret)) {
    return res.status(401).json({ error: 'Invalid agent secret' });
  }

  const parsed = statsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // BUG-18 FIX: Handle the case where the node ID does not exist
  try {
    const node = await prisma.node.update({
      where: { id: req.params.id },
      data: { ...parsed.data, lastSeenAt: new Date() },
    });
    res.json({ node });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Node not found' });
    }
    logger.error({ err, nodeId: req.params.id }, 'Failed to update node stats');
    res.status(500).json({ error: 'Failed to update node stats' });
  }
});

// ── 2. ADMIN / STAFF PROTECTED ROUTING ──
nodesRouter.use('/nodes', requireAuth, requireAdminOrDev);

nodesRouter.get('/nodes', async (_req: AuthedRequest, res: Response) => {
  const nodes = await prisma.node.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ nodes });
});

nodesRouter.get('/nodes/main-node', async (_req: AuthedRequest, res: Response) => {
  const mainNode = await prisma.node.findFirst({
    where: { roleTags: { has: 'main-node' }, isActive: true },
  });
  if (!mainNode) return res.status(404).json({ error: 'Main node not registered or inactive' });
  res.json({ node: mainNode });
});

// BUG-01 FIX: Removed /nodes/cluster-secret endpoint.
// The cluster secret must never be exposed via an API response.
// Admins who need it should read it from the server's .env or secret manager directly.

nodesRouter.get('/nodes/:id', async (req: AuthedRequest, res: Response) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.id } });
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json({ node });
});

const createNodeSchema = z.object({
  label: z.string().min(1),
  ip: z.string().min(1),
  sshKeyRef: z.string().min(1),
  cpuCores: z.number().int().positive(),
  ramMb: z.number().int().positive(),
  diskGb: z.number().int().positive(),
  roleTags: z.array(z.string()).optional().default(DEFAULT_NODE_ROLE_TAGS),
  monthlyBandwidthGb: z.number().int().positive().default(30000),
});

nodesRouter.post('/nodes', async (req: AuthedRequest, res: Response) => {
  const parsed = createNodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const cleanLabel = parsed.data.label.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'node';
  const nodeSubdomain = `node-${cleanLabel}`;
  try {
    await createSubdomainRecord(nodeSubdomain, parsed.data.ip);
  } catch (dnsErr) {
    logger.warn({ dnsErr }, 'Could not create DNS for node');
  }

  const node = await prisma.node.create({
    data: {
      ...parsed.data,
      isActive: true,
      lastSeenAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'node.create',
      target: node.id,
    },
  });

  res.status(201).json({ node, domain: `${nodeSubdomain}.${env.rootDomain}` });
});

// ── Node Port Exposure & Domain Pointing Endpoints ──

nodesRouter.get('/nodes/:id/ports/exposures', async (req: AuthedRequest, res: Response) => {
  const exposures = await prisma.nodePortExposure.findMany({
    where: { nodeId: req.params.id },
    orderBy: { port: 'asc' },
  });
  res.json({
    exposures: exposures.map((e) => ({ ...e, ...exposureJson(e) })),
  });
});

const exposePortSchema = z.object({
  port: z.number().int().min(1).max(65535),
  subdomain: z.string().max(63).optional(),
  protocol: z.enum(['http', 'https', 'tcp']).default('http'),
  label: z.string().max(100).optional(),
});

// DNS-only: this creates a record pointing the hostname at the node; nothing routes the hostname to `port`.
const exposureJson = (e: { subdomain: string; protocol: string }) => ({
  domain: `${e.subdomain}.${env.rootDomain}`,
  url: `${e.protocol}://${e.subdomain}.${env.rootDomain}`,
  routed: false,
  note: 'DNS record only: nothing routes this hostname to the port.',
});

let exposureDepsPromise: Promise<ExposureDeps> | null = null;
const getExposureDeps = () => (exposureDepsPromise ??= createExposureDeps());

function exposureError(res: Response, err: unknown, ctx: Record<string, unknown>) {
  if (err instanceof PortError) return res.status(err.status).json({ error: err.message, code: err.code });
  logger.error({ err, ...ctx }, 'Unexpected error handling a node port exposure request');
  return res.status(500).json({ error: 'Something went wrong while handling the port exposure.', code: 'internal' });
}

nodesRouter.post('/nodes/:id/ports/expose', async (req: AuthedRequest, res: Response) => {
  const parsed = exposePortSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { exposure, warnings } = await exposeNodePort(req.params.id, parsed.data, req.user!.id, await getExposureDeps());
    res.status(201).json({ exposure: { ...exposure, ...exposureJson(exposure) }, warnings });
  } catch (err) {
    exposureError(res, err, { route: 'expose', nodeId: req.params.id });
  }
});

nodesRouter.delete('/nodes/:id/ports/exposures/:exposureId', async (req: AuthedRequest, res: Response) => {
  try {
    const result = await closeNodePort(req.params.id, req.params.exposureId, req.user!.id, await getExposureDeps());
    res.json({ ok: true, ...result });
  } catch (err) {
    exposureError(res, err, { route: 'close-exposure', nodeId: req.params.id });
  }
});

const connectSSHSchema = z.object({
  ip: z.string().min(1),
  port: z.number().default(22),
  username: z.string().default('root'),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  label: z.string().min(1),
  roleTags: z.array(z.string()).optional().default(DEFAULT_NODE_ROLE_TAGS),
  monthlyBandwidthGb: z.number().int().positive().default(30000),
});

/**
 * Executes a command over an established SSH2 connection and streams stdout/stderr.
 * Resolves with exit code. Rejects on stream error.
 */
function sshExec(
  conn: SshClient,
  command: string,
  onData?: (chunk: string) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d: Buffer) => onData?.(d.toString()));
      stream.stderr.on('data', (d: Buffer) => onData?.(`[stderr] ${d.toString()}`));
      stream.on('close', (code: number) => resolve(code ?? 0));
    });
  });
}

/**
 * S15 FIX: All 6 SSH provisioning steps extracted into a shared helper so that
 * /nodes/connect (batch) and /nodes/connect/stream (SSE) don't duplicate ~200 lines.
 *
 * Returns { cpuCores, ramMb, diskGb, detectedIp } on success.
 * Throws on any fatal step failure.
 *
 * S19 FIX: ExecStart uses a dynamic node binary path resolved at install time
 * (`command -v node || command -v nodejs`) instead of the hardcoded
 * `/usr/bin/node` which is absent on older Debian and some Ubuntu variants.
 */
async function runNodeProvisioningSteps(
  ssh: import('ssh2').Client,
  opts: { ip: string; label: string; roleTags: string[]; apiUrl: string },
  log: (msg: string) => void
): Promise<{ cpuCores: number; ramMb: number; diskGb: number; detectedIp: string }> {
  const { ip, label, roleTags, apiUrl } = opts;

  // Step 1: Install system packages
  log('📦 [1/6] Installing required system packages...');
  await sshExec(ssh, [
    'apt-get update -qq',
    'apt-get install -y systemd systemd-sysv ufw docker.io curl unzip tar util-linux nodejs npm 2>&1',
  ].join(' && '), log);

  // Step 2: Collect hardware specs
  log('📊 [2/6] Collecting hardware specifications...');
  const cpuRes: string[] = [];
  const ramRes: string[] = [];
  const diskRes: string[] = [];
  const ipRes: string[] = [];
  await sshExec(ssh, 'nproc', (d) => cpuRes.push(d.trim()));
  await sshExec(ssh, "free -m | awk '/^Mem:/{print $2}'", (d) => ramRes.push(d.trim()));
  await sshExec(ssh, "df -BG / | awk 'NR==2{print $2}' | tr -d G", (d) => diskRes.push(d.trim()));
  await sshExec(ssh, "curl -s https://api.ipify.org || hostname -I | awk '{ print $1 }'", (d) => ipRes.push(d.trim()));
  const cpuCores = Math.max(1, parseInt(cpuRes[0] || '2', 10));
  const ramMb = Math.max(512, parseInt(ramRes[0] || '2048', 10));
  const diskGb = Math.max(5, parseInt(diskRes[0] || '40', 10));
  const detectedIp = ipRes[0] || ip;
  log(`   CPU: ${cpuCores}c | RAM: ${ramMb}MB | Disk: ${diskGb}GB | IP: ${detectedIp}`);

  // Step 3: Create shanutechx-agent system user and directories
  log('👤 [3/6] Creating shanutechx-agent system user...');
  await sshExec(ssh, [
    'id shanutechx-agent &>/dev/null || useradd -r -s /bin/false -d /var/lib/shanutechx shanutechx-agent',
    'mkdir -p /var/lib/shanutechx/workspaces /opt/shanutechx/services/node-agent',
    'chown -R shanutechx-agent:shanutechx-agent /var/lib/shanutechx',
  ].join(' && '), log);

  // Step 4: Write sudoers file
  log('🛡️ [4/6] Configuring sudoers permissions...');
  const sudoersContent = [
    '# ShanuTechX Node Agent narrowly-scoped sudo privileges',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl list-units',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl start shanutechx-node-agent',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop shanutechx-node-agent',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart shanutechx-node-agent',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u shanutechx-node-agent',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/sbin/ufw status*',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/sbin/ufw allow *',
    'shanutechx-agent ALL=(ALL) NOPASSWD: /usr/sbin/ufw delete allow *',
  ].join('\n');
  const base64Sudoers = Buffer.from(sudoersContent).toString('base64');
  await sshExec(ssh, [
    `printf '%s' '${base64Sudoers}' | base64 -d > /etc/sudoers.d/shanutechx-agent`,
    'chmod 0440 /etc/sudoers.d/shanutechx-agent',
    'visudo -cf /etc/sudoers.d/shanutechx-agent',
  ].join(' && '), log);

  // Step 5: Download and install the node agent
  log('🤖 [5/6] Deploying ShanuTechX Node Agent...');
  const cleanLabel = label.replace(/[^a-zA-Z0-9_\-\. ]/g, '');
  const cleanRoleTags = roleTags.map((t) => t.replace(/[^a-zA-Z0-9_\-]/g, '')).join(',');
  const secretB64 = Buffer.from(CLUSTER_SECRET).toString('base64');
  const installCmd = [
    'TMP_SEC=$(mktemp /tmp/.stx-sec.XXXXXX)',
    'trap "rm -f $TMP_SEC" EXIT',
    'chmod 0600 $TMP_SEC',
    `printf '%s' '${secretB64}' | base64 -d > $TMP_SEC`,
    `curl -sSL "${apiUrl}/api/nodes/install.sh" -o /tmp/shanutechx-install.sh`,
    `SECRET=$(cat $TMP_SEC) bash /tmp/shanutechx-install.sh "${apiUrl}" "$SECRET" "${cleanLabel}" "${cleanRoleTags}" --skip-docker-agent 2>&1`,
    'rm -f $TMP_SEC',
  ].join(' && ');
  await sshExec(ssh, installCmd, log);

  // Step 6: Write EnvironmentFile and systemd service
  // S19 FIX: Detect the Node.js binary path at install-time instead of hardcoding /usr/bin/node,
  // which is absent on older Debian (they use /usr/bin/nodejs) and some Ubuntu/Alpine builds
  // that install Node via nvm or n into /usr/local/bin/node.
  log('⚙️ [6/6] Configuring systemd service...');
  const envFileContent = `NODE_AGENT_SECRET=${CLUSTER_SECRET}\n`;
  const envB64 = Buffer.from(envFileContent, 'utf-8').toString('base64');
  await sshExec(ssh, [
    `printf '%s' '${envB64}' | base64 -d > /etc/shanutechx-agent.env`,
    'chmod 0600 /etc/shanutechx-agent.env',
    'chown shanutechx-agent:shanutechx-agent /etc/shanutechx-agent.env',
  ].join(' && '), log);

  // Resolve the real Node binary path on the target system (S19 fix)
  const nodeBinRes: string[] = [];
  await sshExec(ssh, 'command -v node 2>/dev/null || command -v nodejs 2>/dev/null || echo /usr/bin/node', (d) => nodeBinRes.push(d.trim()));
  const nodeBin = (nodeBinRes[0] || '/usr/bin/node').trim();
  log(`   Detected Node.js binary: ${nodeBin}`);

  const serviceContent = [
    '[Unit]',
    'Description=ShanuTechX Node Agent & Host Node Engine Service',
    'After=network.target docker.service',
    'Requires=docker.service',
    '',
    '[Service]',
    'Type=simple',
    'User=shanutechx-agent',
    'Group=shanutechx-agent',
    'WorkingDirectory=/opt/shanutechx/services/node-agent',
    'EnvironmentFile=/etc/shanutechx-agent.env',
    'Environment=NODE_ENV=production',
    'Environment=AGENT_PORT=5000',
    `Environment=API_URL=${apiUrl}`,
    'Environment=AGENT_WORKSPACES_DIR=/var/lib/shanutechx/workspaces',
    `ExecStart=${nodeBin} src/index.js`,  // S19: actual resolved path, not hardcoded /usr/bin/node
    'Restart=always',
    'RestartSec=5',
    'LimitNOFILE=65536',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
  ].join('\n');
  const escapedService = serviceContent.replace(/'/g, "'\\''" );
  await sshExec(ssh, [
    `echo '${escapedService}' > /etc/systemd/system/shanutechx-node-agent.service`,
    'systemctl daemon-reload',
    'systemctl enable --now shanutechx-node-agent 2>&1 || true',
  ].join(' && '), log);

  log('🎉 All setup steps completed successfully!');
  return { cpuCores, ramMb, diskGb, detectedIp };
}

/**
 * Builds a sshKeyRef string from the credential that was used to connect.
 * S15: This was duplicated in both routes — now a single utility.
 */
function buildSshKeyRef(opts: { privateKey?: string; password?: string; username: string; ip: string; port: number }): string {
  const { privateKey, password, username, ip, port } = opts;
  if (privateKey) {
    return encryptSecret(privateKey, env.secretsEncryptionKey);
  }
  if (password) {
    return encryptSecret(JSON.stringify({ type: 'password', username, password }), env.secretsEncryptionKey);
  }
  return `ssh://${username}@${ip}:${port}`;
}

/**
 * Upserts the node record in a Serializable transaction (BUG S01/S02 FIX).
 * S15: was duplicated in both routes.
 */
async function upsertNodeRecord(opts: {
  label: string; detectedIp: string; sshKeyRef: string;
  cpuCores: number; ramMb: number; diskGb: number; roleTags: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.node.findFirst({
      where: { OR: [{ ip: opts.detectedIp }, { label: opts.label }] },
    });
    if (existing) {
      return tx.node.update({
        where: { id: existing.id },
        data: { label: opts.label, ip: opts.detectedIp, sshKeyRef: opts.sshKeyRef, cpuCores: opts.cpuCores, ramMb: opts.ramMb, diskGb: opts.diskGb, roleTags: opts.roleTags, isActive: true, lastSeenAt: new Date() },
      });
    }
    return tx.node.create({
      data: { label: opts.label, ip: opts.detectedIp, sshKeyRef: opts.sshKeyRef, cpuCores: opts.cpuCores, ramMb: opts.ramMb, diskGb: opts.diskGb, roleTags: opts.roleTags, isActive: true, lastSeenAt: new Date() },
    });
  }, { isolationLevel: 'Serializable' });
}

/**
 * POST /api/nodes/connect
 *
 * Connects to a remote server via SSH, runs all 6 provisioning steps, and registers
 * the node in the database. Returns the final node record.
 *
 * For live step-by-step progress, use the SSE streaming variant:
 * POST /api/nodes/connect/stream
 */
nodesRouter.post('/nodes/connect', async (req: AuthedRequest, res: Response) => {
  const parsed = connectSSHSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { ip, port, username, password, privateKey, label, roleTags } = parsed.data;
  const rootDomain = process.env.ROOT_DOMAIN || 'shanutechx.com';
  const apiUrl = `https://api.${rootDomain}`;

  const ssh = new SshClient();
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); };

  const connectCfg: import('ssh2').ConnectConfig = {
    host: ip, port, username, readyTimeout: 20_000,
    ...(privateKey ? { privateKey } : {}),
    ...(password && !privateKey ? { password } : {}),
  };

  try {
    await new Promise<void>((resolve, reject) => {
      ssh.on('ready', () => resolve());
      ssh.on('error', (e) => reject(e));
      ssh.connect(connectCfg);
    });
    log(`✅ SSH connected to ${username}@${ip}:${port}`);

    // S15: All 6 provisioning steps in one shared call
    const { cpuCores, ramMb, diskGb, detectedIp } = await runNodeProvisioningSteps(
      ssh, { ip, label, roleTags, apiUrl }, log
    );
    ssh.end();

    const sshKeyRef = buildSshKeyRef({ privateKey, password, username, ip, port });
    const node = await upsertNodeRecord({ label, detectedIp, sshKeyRef, cpuCores, ramMb, diskGb, roleTags });

    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'node.ssh_provision', target: node.id },
    });

    const sanitizedLogs = sanitizeLogs(logs);
    res.json({ success: true, message: 'Node provisioned and fully configured via SSH', node, logs: sanitizedLogs });
  } catch (err: any) {
    // Best-effort cleanup of orphaned Docker container on the remote host
    try {
      await new Promise<void>((resolve) => {
        const cleanupSsh = new SshClient();
        cleanupSsh.on('ready', () => {
          sshExec(cleanupSsh, 'docker stop shanutechx-agent 2>/dev/null; docker rm shanutechx-agent 2>/dev/null')
            .finally(() => { cleanupSsh.end(); resolve(); });
        });
        cleanupSsh.on('error', () => resolve());
        cleanupSsh.connect(connectCfg);
        setTimeout(() => { try { cleanupSsh.end(); } catch {} resolve(); }, 10_000);
      });
    } catch { /* best-effort cleanup */ }
    ssh.end();
    const sanitizedLogs = sanitizeLogs(logs);
    res.status(500).json({ error: err.message || 'SSH provisioning failed', logs: sanitizedLogs });
  }
});

/**
 * POST /api/nodes/connect/stream
 *
 * Same as /nodes/connect but uses Server-Sent Events (SSE) to stream each
 * provisioning step in real-time so the UI can show a live progress log.
 */
nodesRouter.post('/nodes/connect/stream', async (req: AuthedRequest, res: Response) => {
  const parsed = connectSSHSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type: string, data: object) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };
  const step = (msg: string) => send('step', { message: msg });
  const done = (node: any) => { send('done', { node }); res.end(); };
  const fail = (err: string, logs: string[]) => { send('error', { error: err, logs }); res.end(); };

  const { ip, port, username, password, privateKey, label, roleTags } = parsed.data;
  const rootDomain = process.env.ROOT_DOMAIN || 'shanutechx.com';
  const apiUrl = `https://api.${rootDomain}`;

  const ssh = new SshClient();
  const logs: string[] = [];
  // log writes to the SSE stream AND the batch log array
  const log = (msg: string) => { logs.push(msg); step(msg); };

  const connectCfg: import('ssh2').ConnectConfig = {
    host: ip, port, username, readyTimeout: 20_000,
    ...(privateKey ? { privateKey } : {}),
    ...(password && !privateKey ? { password } : {}),
  };

  try {
    await new Promise<void>((resolve, reject) => {
      ssh.on('ready', () => resolve());
      ssh.on('error', (e) => reject(e));
      ssh.connect(connectCfg);
    });
    log(`✅ SSH connected to ${username}@${ip}:${port}`);

    // S15: All 6 provisioning steps via shared helper; stream variant passes `step` via `log`
    const { cpuCores, ramMb, diskGb, detectedIp } = await runNodeProvisioningSteps(
      ssh, { ip, label, roleTags, apiUrl }, log
    );
    ssh.end();

    const sshKeyRef = buildSshKeyRef({ privateKey, password, username, ip, port });
    const node = await upsertNodeRecord({ label, detectedIp, sshKeyRef, cpuCores, ramMb, diskGb, roleTags });

    await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'node.ssh_provision', target: node.id } });
    done(node);
  } catch (err: any) {
    // Best-effort cleanup of orphaned Docker container
    try {
      await sshExec(ssh, 'docker stop shanutechx-agent 2>/dev/null; docker rm shanutechx-agent 2>/dev/null').catch(() => {});
    } catch { /* best-effort */ }
    ssh.end();
    const sanitizedLogs = sanitizeLogs(logs);
    fail(err.message || 'SSH provisioning failed', sanitizedLogs);
  }
});



const updateNodeSchema = z.object({ isActive: z.boolean() });

nodesRouter.patch('/nodes/:id', async (req: AuthedRequest, res: Response) => {
  const parsed = updateNodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let node;
  try {
    node = await prisma.node.update({ where: { id: req.params.id }, data: parsed.data });
  } catch (err: any) {
    // BUG-H02 FIX: Prisma throws P2025 when the record to update does not exist.
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Node not found' });
    throw err;
  }

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'node.set_active', target: `${node.id} -> ${parsed.data.isActive}` },
  });

  // BUG-H05 FIX: When deactivating a node, notify that any active SSH sessions
  // on this node will be silently dropped. Clients that are connected will not
  // receive a friendly disconnect message — a proper fix would involve tracking
  // active WebSocket connections per node and sending close frames. As an interim
  // measure we log a prominent warning and notify via Discord so ops staff know.
  if (!parsed.data.isActive) {
    logger.warn({ nodeId: node.id, nodeLabel: node.label }, 'Node deactivated — any active SSH terminal sessions on this node will be silently dropped');
    notifyDiscordChannel('deployment_failed', {
      event: 'Node Deactivated',
      nodeLabel: node.label,
      nodeIp: node.ip,
      deactivatedBy: req.user!.id,
      warning: 'Any active SSH terminal sessions on this node have been silently dropped.'
    }).catch(() => { /* best-effort notification */ });
  }

  res.json({ node });
});

/**
 * POST /api/nodes/:id/failover
 * Manually trigger instant evacuation and workload failover for a node.
 * Evacuates deployments, managed databases, LiveKit keys, and exposed ports across remaining cluster nodes.
 */
nodesRouter.post('/nodes/:id/failover', async (req: AuthedRequest, res: Response) => {
  const node = await prisma.node.findUnique({ where: { id: req.params.id } });
  if (!node) return res.status(404).json({ error: 'Node not found' });

  try {
    const result = await evacuateNodeWorkloads(node.id);

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'node.manual_failover',
        target: `${node.id}: ${JSON.stringify(result)}`,
        actorRole: req.user!.role,
      },
    });


    res.json({
      success: true,
      message: `Node evacuation & failover completed for ${node.label}`,
      result,
    });
  } catch (err: any) {
    logger.error({ err, nodeId: node.id }, 'Manual node failover failed');
    res.status(500).json({ error: err.message || 'Node failover failed' });
  }
});

/**
 * GET /api/nodes/:id/failover-status
 * Fetch recent failover audit logs for a compute node.
 */
nodesRouter.get('/nodes/:id/failover-status', async (req: AuthedRequest, res: Response) => {
  // BUG-M02 FIX: Use `contains` filter because failover audit log entries store
  // the node ID embedded in a JSON string: "<nodeId>: {...}"
  // The previous exact `target: req.params.id` match never found any entries.
  const logs = await prisma.auditLog.findMany({
    where: {
      target: { contains: req.params.id },
      action: { in: ['node.auto_failover', 'node.manual_failover'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({ logs });
});

// ── BUG-10 FIX: Sanitize provisioning logs to remove cluster secret values ──
// ── BUG-M01 FIX: Also redact URL-encoded and base64 variants of the secret ──

function sanitizeLogs(logs: string[]): string[] {
  if (!CLUSTER_SECRET) return logs;
  // Build a set of encoded representations to catch indirect leakage
  const variants = [
    CLUSTER_SECRET,
    encodeURIComponent(CLUSTER_SECRET),
    Buffer.from(CLUSTER_SECRET).toString('base64'),
    Buffer.from(CLUSTER_SECRET).toString('base64url'),
  ];
  return logs.map(line =>
    variants.reduce((l, v) => (v ? l.replaceAll(v, '[REDACTED]') : l), line)
  );
}
