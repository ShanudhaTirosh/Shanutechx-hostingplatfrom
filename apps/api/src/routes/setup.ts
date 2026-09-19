import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Client as SshClient } from 'ssh2';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { encryptSecret } from '../lib/secretsVault';
import { logger } from '../lib/logger';
import { initWildDuckOnBoot } from '../lib/wildduckInitializer';
import { requireAuth, requireDev, AuthedRequest } from '../middleware/auth';
import { verifySharedSecret } from '../lib/gateAuth';

export const setupRouter = Router();

/**
 * GET /api/setup/status
 * Returns current platform initialization status.
 * Sanitized to avoid disclosing host IP, infrastructure tags, or internal metrics publicly.
 */
setupRouter.get('/setup/status', async (_req: Request, res: Response) => {
  try {
    const [mainNode, devAdminCount] = await Promise.all([
      prisma.node.findFirst({
        where: { roleTags: { has: 'main-node' } },
      }),
      prisma.user.count({ where: { role: 'dev' } }),
    ]);

    res.json({
      isInitialized: !!mainNode && devAdminCount > 0,
      hasMainNode: !!mainNode,
      rootDomain: env.rootDomain,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to query setup status');
    res.status(500).json({ error: 'Setup status query failed' });
  }
});

const initializeMainNodeSchema = z.object({
  ip: z.string().min(1),
  sshPort: z.number().int().min(1).max(65535).default(22),
  sshUser: z.string().default('root'),
  sshPassword: z.string().optional(),
  privateKey: z.string().optional(),
  rootDomain: z.string().optional(),
  devAdminEmail: z.string().email(),
  cpuCores: z.number().int().positive().optional().default(4),
  ramMb: z.number().int().positive().optional().default(8192),
  diskGb: z.number().int().positive().optional().default(100),
});

/**
 * POST /api/setup/initialize-main-node
 * One-click automated setup & main node registration for Linux VPS host node.
 * Unauthenticated on first boot when isInitialized is false; strictly guarded
 * by requireAuth + requireDev once platform is initialized.
 */
setupRouter.post('/setup/initialize-main-node', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [existingMainNode, devCount] = await Promise.all([
      prisma.node.findFirst({ where: { roleTags: { has: 'main-node' } } }),
      prisma.user.count({ where: { role: 'dev' } }),
    ]);

    const isInitialized = !!existingMainNode && devCount > 0;

    // B-07 FIX: If platform is already initialized, enforce strict DEV superuser auth
    if (isInitialized) {
      return requireAuth(req as AuthedRequest, res, () => {
        requireDev(req as AuthedRequest, res, () => {
          proceedWithInitialization(req, res, true);
        });
      });
    }

    // First run bootstrap — ALWAYS require a setup token.
    // If SETUP_TOKEN is not configured, refuse to proceed (fail closed).
    const requiredToken = process.env.SETUP_TOKEN || process.env.BOOTSTRAP_TOKEN;
    if (!requiredToken) {
      logger.error('SETUP_TOKEN or BOOTSTRAP_TOKEN environment variable is required for first-run setup but was not configured.');
      return res.status(503).json({
        error: 'First-run setup requires a SETUP_TOKEN or BOOTSTRAP_TOKEN environment variable to be configured.',
        message: 'Set SETUP_TOKEN in your .env file before running first-time platform initialization.',
      });
    }
    const providedToken = (req.headers['x-setup-token'] as string) || (req.body && req.body.setupToken);
    // B-29 FIX: Use constant-time secret comparison
    if (!providedToken || !verifySharedSecret(providedToken, requiredToken)) {
      return res.status(401).json({ error: 'Invalid or missing setup authorization token (X-Setup-Token).' });
    }

    return await proceedWithInitialization(req, res, false);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Setup initialization check failed');
    return res.status(500).json({ error: 'Setup initialization check failed' });
  }
});

async function proceedWithInitialization(req: Request, res: Response, isReconfiguration: boolean) {
  const parsed = initializeMainNodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const {
    ip,
    sshPort,
    sshUser,
    sshPassword,
    privateKey,
    devAdminEmail,
    cpuCores,
    ramMb,
    diskGb,
  } = parsed.data;

  // 1. Verify SSH or local loopback connection
  if (ip !== '127.0.0.1' && ip !== 'localhost') {
    const sshOk = await new Promise<boolean>((resolve) => {
      const conn = new SshClient();
      conn
        .on('ready', () => {
          conn.end();
          resolve(true);
        })
        .on('error', (err) => {
          logger.warn({ err: err.message, ip, sshPort }, 'SSH handshake check failed during setup');
          resolve(false);
        })
        .connect({
          host: ip,
          port: sshPort,
          username: sshUser,
          password: sshPassword,
          privateKey: privateKey,
          readyTimeout: 10000,
        });
    });

    if (!sshOk) {
      return res.status(400).json({
        error: `Could not connect to Linux VPS over SSH at ${sshUser}@${ip}:${sshPort}. Check IP, port, and password/key.`,
      });
    }
  }

  // 2. Encrypt & Store SSH Credentials in Secrets Vault
  let sshKeyRef: string;
  if (privateKey) {
    sshKeyRef = encryptSecret(privateKey, env.secretsEncryptionKey);
  } else if (sshPassword) {
    sshKeyRef = encryptSecret(
      JSON.stringify({ type: 'password', username: sshUser, password: sshPassword, port: sshPort }),
      env.secretsEncryptionKey
    );
  } else {
    sshKeyRef = `ssh://${sshUser}@${ip}:${sshPort}`;
  }

  // 3. Upsert Main Node in Database
  const mainRoleTags = ['main-node', 'global', 'web-hosting', 'node-hosting', 'database-hosting', 'supabase-hosting', 'mail-hosting'];
  const existingNode = await prisma.node.findFirst({
    where: { OR: [{ roleTags: { has: 'main-node' } }, { ip }] },
  });

  const nodeData = {
    label: 'main-node',
    ip,
    sshKeyRef,
    cpuCores,
    ramMb,
    diskGb,
    roleTags: mainRoleTags,
    isActive: true,
    lastSeenAt: new Date(),
  };

  const mainNode = existingNode
    ? await prisma.node.update({ where: { id: existingNode.id }, data: nodeData })
    : await prisma.node.create({ data: nodeData });

  // 4. Create/Ensure Dev Admin User (B-07 FIX: Do not grant dev role post-initialization)
  let devAdmin = await prisma.user.findUnique({ where: { email: devAdminEmail.toLowerCase() } });
  if (!devAdmin) {
    if (isReconfiguration) {
      return res.status(403).json({
        error: 'Platform is already initialized. New dev admin accounts cannot be created via setup endpoint.',
      });
    }
    devAdmin = await prisma.user.create({
      data: {
        email: devAdminEmail.toLowerCase(),
        firebaseUid: `dev-${Date.now()}`,
        role: 'dev',
        displayName: 'Platform Owner (Dev)',
      },
    });
  } else if (devAdmin.role !== 'dev') {
    return res.status(400).json({
      error: `User account with email ${devAdminEmail} already exists as a non-dev user.`,
    });
  }

  // 5. Auto-Initialize WildDuck Mail Server & DKIM
  const wildduckStatus = await initWildDuckOnBoot();

  logger.info({ nodeId: mainNode.id, devAdminEmail, ip }, 'Platform setup and Main Node auto-registration complete');

  res.status(200).json({
    success: true,
    message: 'Linux VPS successfully registered as Main Node and platform bootstrapped!',
    mainNode: {
      id: mainNode.id,
      label: mainNode.label,
      ip: mainNode.ip,
      roleTags: mainNode.roleTags,
      isActive: mainNode.isActive,
    },
    devAdmin: {
      id: devAdmin.id,
      email: devAdmin.email,
      role: devAdmin.role,
    },
    wildduck: wildduckStatus,
  });
}
