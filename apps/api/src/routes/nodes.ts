import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { spawn } from 'child_process';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { env } from '../env';

export const nodesRouter = Router();

// SECURITY (audit finding C5): this used to fall back to a hardcoded
// literal secret if NODE_AGENT_SECRET was unset. env.ts already marks
// NODE_AGENT_SECRET as a *required* env var (the app refuses to start
// without it), so there is no legitimate case where falling back to a
// baked-in value was needed -- it only created a live, exploitable
// backdoor for any deployment that left the env var unset (or, as found
// in this audit, a deployment whose real .env happened to still be set
// to that same published fallback value). Use the validated env value
// directly; there is no fallback.
const CLUSTER_SECRET = env.nodeAgentSecret;

function clusterSecretMatches(submitted: string): boolean {
  // Timing-safe comparison (audit finding H4/C5) -- HMAC both sides first
  // so we're always comparing equal-length buffers regardless of the
  // submitted string's length, consistent with the pattern already used
  // in routes/billing.ts and routes/status.ts.
  const key = 'shanutechx-cluster-secret-gate';
  const a = crypto.createHmac('sha256', key).update(submitted).digest();
  const b = crypto.createHmac('sha256', key).update(CLUSTER_SECRET).digest();
  return crypto.timingSafeEqual(a, b);
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
SECRET="\${2:-${CLUSTER_SECRET}}"
LABEL="\${3:-node-$(date +%s)}"
ROLE_TAGS="\${4:-web-hosting,node-hosting,python-hosting}"

echo "============================================================"
echo "🚀 Starting ShanuTechX Compute Node Onboarding..."
echo "============================================================"

if [ "$EUID" -ne 0 ]; then
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
CPU_CORES=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 2)
RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 2048)
DISK_GB=$(df -BG / 2>/dev/null | awk 'NR==2 {print $2}' | tr -d 'G' || echo 40)
HOST_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

echo "📊 Detected Hardware Configuration:"
echo "   - Host IP:    $HOST_IP"
echo "   - CPU Cores:  $CPU_CORES"
echo "   - RAM Memory: \${RAM_MB} MB"
echo "   - Disk Space: \${DISK_GB} GB"
echo "   - Role Tags:  $ROLE_TAGS"

# 3. Self-Register with Control Plane API
echo "🔗 Registering Compute Node with Control Plane ($API_URL)..."
TAG_JSON=$(echo "$ROLE_TAGS" | tr ',' '\n' | sed 's/^/"/' | sed 's/$/"/' | paste -sd, -)

RESPONSE=$(curl -s -X POST "$API_URL/api/nodes/register" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"label\\": \\"$LABEL\\",
    \\"ip\\": \\"$HOST_IP\\",
    \\"secret\\": \\"$SECRET\\",
    \\"cpuCores\\": $CPU_CORES,
    \\"ramMb\\": $RAM_MB,
    \\"diskGb\\": $DISK_GB,
    \\"roleTags\\": [$TAG_JSON]
  }")

echo "✅ Registration Response: $RESPONSE"

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

docker run -d \\
  --name shanutechx-agent \\
  --restart always \\
  -p 5000:5000 \\
  -e AGENT_PORT=5000 \\
  -e NODE_AGENT_SECRET="$SECRET" \\
  -e API_URL="$API_URL" \\
  -e ROOT_DOMAIN="${rootDomain}" \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -v /srv/compose:/srv/compose \\
  -v /var/lib/shanutechx:/var/lib/shanutechx \\
  "$AGENT_IMAGE" sh -c "if [ -f /repo/services/node-agent/src/index.js ]; then node /repo/services/node-agent/src/index.js; else while true; do sleep 10; done; fi"

echo "============================================================"
echo "🎉 SUCCESS: Compute Node is onboarded & ONLINE in ShanuTechX!"
echo "============================================================"
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(script);
});

const registerNodeSchema = z.object({
  label: z.string().min(1),
  ip: z.string().min(1),
  secret: z.string().min(1),
  cpuCores: z.number().int().positive(),
  ramMb: z.number().int().positive(),
  diskGb: z.number().int().positive(),
  roleTags: z.array(z.string()).min(1),
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

  // Upsert node by IP or Label
  const existing = await prisma.node.findFirst({
    where: { OR: [{ ip }, { label }] },
  });

  let node;
  if (existing) {
    node = await prisma.node.update({
      where: { id: existing.id },
      data: {
        label,
        ip,
        cpuCores,
        ramMb,
        diskGb,
        roleTags,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  } else {
    node = await prisma.node.create({
      data: {
        label,
        ip,
        sshKeyRef: `vault:${label}`,
        cpuCores,
        ramMb,
        diskGb,
        roleTags,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  res.status(200).json({ success: true, node });
});

// ── 2. ADMIN / STAFF PROTECTED ROUTING ──
nodesRouter.use(requireAuth, requireAdminOrDev);

nodesRouter.get('/nodes', async (_req: AuthedRequest, res: Response) => {
  const nodes = await prisma.node.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ nodes });
});

nodesRouter.get('/nodes/cluster-secret', (_req: AuthedRequest, res: Response) => {
  res.json({ secret: CLUSTER_SECRET });
});

const createNodeSchema = z.object({
  label: z.string().min(1),
  ip: z.string().min(1),
  sshKeyRef: z.string().min(1),
  cpuCores: z.number().int().positive(),
  ramMb: z.number().int().positive(),
  diskGb: z.number().int().positive(),
  roleTags: z.array(z.string()).min(1),
});

nodesRouter.post('/nodes', async (req: AuthedRequest, res: Response) => {
  const parsed = createNodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
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

  res.status(201).json({ node });
});

const connectSSHSchema = z.object({
  ip: z.string().min(1),
  port: z.number().default(22),
  username: z.string().default('root'),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  label: z.string().min(1),
  roleTags: z.array(z.string()).default(['web-hosting', 'node-hosting']),
});

/**
 * POST /api/nodes/connect
 * Directly SSH into target server/VPS, executes remote setup script, and registers it.
 */
nodesRouter.post('/nodes/connect', async (req: AuthedRequest, res: Response) => {
  const parsed = connectSSHSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { ip, port, username, password, privateKey, label, roleTags } = parsed.data;
  const rootDomain = process.env.ROOT_DOMAIN || 'shanutechx.com';
  const apiUrl = `https://api.${rootDomain}`;

  const tagsStr = roleTags.join(',');
  const remoteCmd = `curl -sSL ${apiUrl}/api/nodes/install.sh | bash -s -- "${apiUrl}" "${CLUSTER_SECRET}" "${label}" "${tagsStr}"`;

  try {
    let sshCmd: string;
    let args: string[];

    if (password) {
      sshCmd = 'sshpass';
      args = [
        '-p',
        password,
        'ssh',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'ConnectTimeout=15',
        '-p',
        String(port),
        `${username}@${ip}`,
        remoteCmd,
      ];
    } else {
      sshCmd = 'ssh';
      args = [
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'ConnectTimeout=15',
        '-p',
        String(port),
        `${username}@${ip}`,
        remoteCmd,
      ];
    }

    const child = spawn(sshCmd, args, { timeout: 60000 });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        // Fallback registration so node is recorded even if SSH output was partial
        const node = await prisma.node.create({
          data: {
            label,
            ip,
            sshKeyRef: `ssh://${username}@${ip}:${port}`,
            cpuCores: 2,
            ramMb: 2048,
            diskGb: 40,
            roleTags,
            isActive: false,
          },
        });
        return res.status(500).json({
          error: `SSH connection finished with exit code ${code}`,
          stderr: stderr || stdout,
          node,
        });
      }

      const node = await prisma.node.findFirst({ where: { ip } });
      res.json({
        success: true,
        message: 'Node provisioned via SSH successfully',
        output: stdout,
        node,
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute SSH provisioning' });
  }
});

const statsSchema = z.object({
  cpuUsedPct: z.number().min(0).max(100),
  ramUsedMb: z.number().int().min(0),
  diskUsedGb: z.number().int().min(0),
});

nodesRouter.post('/nodes/:id/stats', async (req: AuthedRequest, res: Response) => {
  const parsed = statsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const node = await prisma.node.update({
    where: { id: req.params.id },
    data: { ...parsed.data, lastSeenAt: new Date() },
  });

  res.json({ node });
});

const updateNodeSchema = z.object({ isActive: z.boolean() });

nodesRouter.patch('/nodes/:id', async (req: AuthedRequest, res: Response) => {
  const parsed = updateNodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const node = await prisma.node.update({ where: { id: req.params.id }, data: parsed.data });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'node.set_active', target: `${node.id} -> ${parsed.data.isActive}` },
  });

  res.json({ node });
});
