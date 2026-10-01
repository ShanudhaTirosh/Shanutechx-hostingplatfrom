import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, canAccessResource } from '../middleware/rbac';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { notifyCustomer } from '../lib/notifications';
import { issueSshTicket } from '../lib/sshTerminalGateway';
import {
  execVpsSsh,
  getVpsSystemStats,
  rebootVpsSsh,
  changeVpsPasswordSsh,
  sftpListFiles,
  sftpDownloadFile,
  sftpUploadFile,
  sftpDeleteFile,
  extractArchiveSsh,
  renamePathSsh,
  mkdirSsh,
  touchFileSsh,
  getVpsFirewallRulesSsh,
  toggleVpsFirewallSsh,
  addVpsFirewallRuleSsh,
  deleteVpsFirewallRuleSsh,
  testVpsConnectionRaw,
} from '../lib/vpsSshClient';

export const vpsRouter = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max SFTP upload

vpsRouter.use(requireAuth);

const CREDENTIAL_SYNC_NOTICE =
  'IMPORTANT NOTE: If you change your root password directly inside the SSH terminal or external provider console, you MUST update your stored credentials in the control panel using "Update Credentials". Otherwise, automated reboot, SFTP file management, and browser SSH terminal will fail to authenticate.';

const provisionSchema = z.object({
  userId: z.string(),
  orderItemId: z.string(),
  provider: z.string().min(1).default('custom'),
  externalId: z.string().optional(),
  panelUrl: z.string().url().optional(),
  ip: z.string().min(1).optional(),
  sshPort: z.number().int().positive().default(22),
  username: z.string().min(1).default('root'),
  password: z.string().optional(),
});

const manualProvisionSchema = z.object({
  provider: z.string().min(1).default('leaseweb'),
  ip: z.string().min(1),
  sshPort: z.number().int().positive().default(22),
  username: z.string().min(1).default('root'),
  password: z.string().optional(),
  sshPrivateKey: z.string().optional(),
  sshPublicKey: z.string().optional(),
  notes: z.string().optional(),
});

const testConnectionSchema = z.object({
  ip: z.string().min(1),
  sshPort: z.number().int().positive().default(22),
  username: z.string().min(1).default('root'),
  password: z.string().min(1),
  testType: z.enum(['ssh', 'sftp', 'both']).default('both'),
});

/**
 * POST /api/vps-provisions/test-connection
 * Pre-delivery diagnostic: tests SSH and/or SFTP connectivity before assigning VPS to customer.
 */
vpsRouter.post('/vps-provisions/test-connection', requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const parsed = testConnectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await testVpsConnectionRaw(parsed.data);
  res.json(result);
});

/**
 * POST /api/vps-provisions/:id/test-connection
 * Diagnostic check: tests live SSH/SFTP connection for an existing VPS provision.
 */
vpsRouter.post('/vps-provisions/:id/test-connection', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision || !provision.credentialRef) return res.status(404).json({ error: 'VPS provision or credentials not found' });
  if (req.user!.role !== 'admin' && req.user!.role !== 'dev' && provision.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Not found' });
  }

  const password = decryptSecret(provision.credentialRef, env.secretsEncryptionKey);
  const testType = (req.body.testType as 'ssh' | 'sftp' | 'both') || 'both';

  const result = await testVpsConnectionRaw({
    ip: provision.ip || provision.externalId || '',
    sshPort: provision.sshPort || 22,
    username: provision.username || 'root',
    password,
    testType,
  });

  res.json(result);
});

/**
 * POST /api/vps-provisions
 * Provision a VPS manually (admin/dev) by providing IP, root login, and SSH port.
 */
vpsRouter.post('/vps-provisions', requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (req.user!.role === 'admin' && !(await canAccessResource(parsed.data.userId, req))) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const { password, ...rest } = parsed.data;
  const credentialRef = password ? encryptSecret(password, env.secretsEncryptionKey) : null;

  const provision = await prisma.vpsProvision.create({
    data: {
      ...rest,
      credentialRef,
      status: 'provisioned',
      provisionedAt: new Date(),
    },
    include: { user: true },
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'vps.provision', target: provision.id },
  });

  const loginIp = provision.ip || provision.externalId || 'Your assigned IP';
  void notifyCustomer(
    provision.user,
    `Your VPS is ready! IP: ${loginIp}, Username: ${provision.username || 'root'}. Check your dashboard to connect via SSH or manage your server.`
  );

  res.status(201).json({
    provision: omitCredentialRef(provision),
    notice: CREDENTIAL_SYNC_NOTICE,
  });
});

/**
 * POST /api/vps-provisions/:id/manual-provision
 * Admin/Dev manual setup completion endpoint: fills IP, username, credentials, provider, and notes.
 */
vpsRouter.post('/vps-provisions/:id/manual-provision', requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });

  const parsed = manualProvisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { password, sshPrivateKey, sshPublicKey, notes, ...rest } = parsed.data;

  let credentialRef = provision.credentialRef;
  if (password) {
    credentialRef = encryptSecret(password, env.secretsEncryptionKey);
  }

  let encSshPrivateKey = provision.sshPrivateKey;
  if (sshPrivateKey) {
    encSshPrivateKey = encryptSecret(sshPrivateKey, env.secretsEncryptionKey);
  }

  const updated = await prisma.vpsProvision.update({
    where: { id: provision.id },
    data: {
      ...rest,
      credentialRef,
      sshPrivateKey: encSshPrivateKey,
      sshPublicKey: sshPublicKey || undefined,
      notes: notes || undefined,
      status: 'provisioned',
      provisionedAt: new Date(),
      provisionedById: req.user!.id,
    },
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'vps.manual_provision_completed', target: provision.id },
  });

  void notifyCustomer(
    provision.user,
    `Your VPS server is provisioned and ready! Server IP: ${updated.ip}, Username: ${updated.username || 'root'}. Connect via SSH or manage directly in your dashboard.`
  );

  res.json({
    ok: true,
    provision: omitCredentialRef(updated),
    notice: CREDENTIAL_SYNC_NOTICE,
  });
});

/**
 * GET /api/vps-provisions/:id/download-key
 * Downloads the SSH Private Key (.pem file) for a provisioned VPS.
 */
vpsRouter.get('/vps-provisions/:id/download-key', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  let keyContent = '';
  if (provision.sshPrivateKey) {
    keyContent = decryptSecret(provision.sshPrivateKey, env.secretsEncryptionKey);
  } else if (provision.credentialRef) {
    const raw = decryptSecret(provision.credentialRef, env.secretsEncryptionKey);
    if (raw.includes('PRIVATE KEY')) {
      keyContent = raw;
    }
  }

  if (!keyContent) {
    return res.status(404).json({ error: 'No SSH Private Key attached to this VPS server provision' });
  }

  const safeIdentifier = (provision.ip || provision.id).replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `vps-key-${safeIdentifier}.pem`;
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(keyContent);
});

/**
 * GET /api/vps-provisions/admin/all
 * List all VPS provisions across all platform customers with user metadata (admin/dev only).
 */
vpsRouter.get('/vps-provisions/admin/all', requireAdminOrDev, async (req: AuthedRequest, res: Response) => {
  const provisions = await prisma.vpsProvision.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      },
    },
  });
  res.json({ provisions: provisions.map(omitCredentialRef), notice: CREDENTIAL_SYNC_NOTICE });
});

/**
 * GET /api/vps-provisions
 * List VPS provisions for current user (or all assigned for admin/dev).
 */
vpsRouter.get('/vps-provisions', async (req: AuthedRequest, res: Response) => {
  const where = await ownedResourceWhere(req);
  const provisions = await prisma.vpsProvision.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json({ provisions: provisions.map(omitCredentialRef), notice: CREDENTIAL_SYNC_NOTICE });
});

/**
 * GET /api/vps-provisions/:id
 * Get single VPS provision details.
 */
vpsRouter.get('/vps-provisions/:id', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ provision: omitCredentialRef(provision), notice: CREDENTIAL_SYNC_NOTICE });
});

/**
 * GET /api/vps-provisions/:id/reveal-password
 * Decrypts and reveals the stored SSH root password or private key.
 */
vpsRouter.get('/vps-provisions/:id/reveal-password', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision || !provision.credentialRef) return res.status(404).json({ error: 'Credentials not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const password = decryptSecret(provision.credentialRef, env.secretsEncryptionKey);

  await prisma.auditLog.create({
    data: {
      adminId: (req.user!.role === 'admin' || req.user!.role === 'dev') ? req.user!.id : null,
      action: 'vps.reveal_password',
      target: provision.id,
      actorRole: req.user!.role,
    },
  });

  res.json({
    username: provision.username || 'root',
    password,
    ip: provision.ip || provision.externalId,
    sshPort: provision.sshPort || 22,
    credentialType: password.includes('PRIVATE KEY') ? 'private_key' : 'password',
    notice: CREDENTIAL_SYNC_NOTICE,
  });
});

/**
 * POST /api/vps-provisions/:id/ssh-ticket
 * Mint a short-lived single-use ticket for WebSockets interactive SSH terminal access.
 */
vpsRouter.post('/vps-provisions/:id/ssh-ticket', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const ticket = await issueSshTicket(provision.id, req.user!.id);
  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'vps.ssh_ticket_issued',
      target: provision.id,
      actorRole: req.user!.role === 'customer' ? 'customer' : null,
    },
  });

  res.json({ ticket, expiresInMs: 30_000, notice: CREDENTIAL_SYNC_NOTICE });
});

const renewVpsSchema = z.object({
  months: z.number().int().min(1).max(36).default(1),
  notes: z.string().optional(),
});

/**
 * POST /api/vps-provisions/:id/renew
 * Renewal endpoint for customers to renew their VPS subscription or Admins/Devs to extend customer VPS provisions.
 */
vpsRouter.post('/vps-provisions/:id/renew', async (req: AuthedRequest, res: Response) => {
  const parsed = renewVpsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });

  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { months, notes } = parsed.data;
  const isStaff = ['admin', 'dev'].includes(req.user!.role);

  const updated = await prisma.vpsProvision.update({
    where: { id: provision.id },
    data: {
      status: 'provisioned',
      notes: notes
        ? `${provision.notes ? provision.notes + '\n' : ''}[Renewed ${months}m]: ${notes}`
        : provision.notes,
    },
  });

  const renewalOrder = await prisma.order.create({
    data: {
      userId: provision.userId,
      status: 'paid',
      total: 15 * months,
      totalLkr: 4500 * months,
      currency: 'LKR',
      items: {
        create: [
          {
            quantity: 1,
            priceLkr: 4500 * months,
            configJson: {
              type: 'vps_renewal',
              vpsProvisionId: provision.id,
              months,
              renewedBy: req.user!.email,
            },
          },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'vps.renewed',
      target: `VPS ${provision.id} (${provision.ip || 'Pending IP'}) - ${months} Month(s)`,
      actorRole: isStaff ? null : 'customer',
    },
  });

  if (provision.user) {
    notifyCustomer(
      provision.user,
      `Your VPS (${provision.ip || provision.id}) has been renewed for ${months} month(s).`,
      undefined,
      '🚀 VPS Subscription Renewed!'
    ).catch(() => {});
  }

  res.json({
    ok: true,
    message: `VPS subscription successfully renewed for ${months} month(s).`,
    provision: updated,
    orderId: renewalOrder.id,
  });
});

const powerSchema = z.object({ action: z.enum(['reboot', 'start', 'status']) });

/**
 * POST /api/vps-provisions/:id/power
 * SSH-based power management actions (reboot, status checks).
 */
vpsRouter.post('/vps-provisions/:id/power', async (req: AuthedRequest, res: Response) => {
  const parsed = powerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { action } = parsed.data;

  try {
    if (action === 'reboot') {
      const result = await rebootVpsSsh(provision);
      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'vps.ssh_reboot',
          target: provision.id,
          actorRole: req.user!.role === 'customer' ? 'customer' : null,
        },
      });
      return res.json({ ok: true, action: 'reboot', message: result.message });
    }

    if (action === 'start' || action === 'status') {
      // Check if SSH is online
      const check = await execVpsSsh(provision, 'uptime');
      return res.json({
        ok: true,
        action,
        status: check.code === 0 ? 'online' : 'offline',
        uptime: check.stdout.trim(),
      });
    }

    res.status(400).json({ error: 'Unsupported power action' });
  } catch (err: any) {
    res.status(502).json({
      error: `SSH Power action '${action}' failed: ${err.message}`,
      hint: 'If you updated your SSH password recently, make sure to sync your stored credentials in the platform.',
    });
  }
});

/**
 * POST /api/vps-provisions/:id/upgrade-packages
 * One-click OS package upgrade action: runs apt update & upgrade over SSH on the target VPS.
 */
vpsRouter.post('/vps-provisions/:id/upgrade-packages', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const upgradeCmd = `export DEBIAN_FRONTEND=noninteractive && if command -v apt-get >/dev/null 2>&1; then apt-get update -qq && apt-get upgrade -y; elif command -v dnf >/dev/null 2>&1; then dnf upgrade -y; elif command -v yum >/dev/null 2>&1; then yum update -y; else echo "Unsupported OS package manager" && exit 1; fi 2>&1`;

  try {
    const result = await execVpsSsh(
      provision,
      upgradeCmd,
      { timeoutMs: 300_000 }
    );

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'vps.upgrade_packages',
        target: provision.id,
        actorRole: req.user!.role === 'customer' ? 'customer' : null,
      },
    });

    res.json({
      ok: result.code === 0,
      exitCode: result.code,
      output: result.stdout,
      message: result.code === 0 ? 'OS packages upgraded successfully' : 'OS package upgrade failed or finished with warnings',
    });
  } catch (err: any) {
    res.status(502).json({
      error: `Package upgrade over SSH failed: ${err.message}`,
      hint: CREDENTIAL_SYNC_NOTICE,
    });
  }
});

/**
 * GET /api/vps-provisions/:id/stats
 * Telemetry endpoint: retrieves live CPU, RAM, Disk, and Uptime over SSH without needing an installed agent.
 */
vpsRouter.get('/vps-provisions/:id/stats', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const stats = await getVpsSystemStats(provision);
    res.json({ stats });
  } catch (err: any) {
    res.status(502).json({
      error: `Failed to fetch VPS telemetry over SSH: ${err.message}`,
      hint: CREDENTIAL_SYNC_NOTICE,
    });
  }
});

const changePasswordSchema = z.object({ newPassword: z.string().min(8) });

/**
 * POST /api/vps-provisions/:id/change-password
 * Changes the root/login password directly on the remote VPS over SSH and updates DB credentials.
 */
vpsRouter.post('/vps-provisions/:id/change-password', async (req: AuthedRequest, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { newPassword } = parsed.data;

  try {
    // 1. Execute password change remotely on VPS over SSH
    await changeVpsPasswordSsh(provision, newPassword);

    // 2. Encrypt and save updated password in DB
    const newCredentialRef = encryptSecret(newPassword, env.secretsEncryptionKey);
    await prisma.vpsProvision.update({
      where: { id: provision.id },
      data: { credentialRef: newCredentialRef },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'vps.change_password',
        target: provision.id,
        actorRole: req.user!.role === 'customer' ? 'customer' : null,
      },
    });

    res.json({
      ok: true,
      message: 'Password successfully changed on VPS server and updated in platform vault.',
      notice: CREDENTIAL_SYNC_NOTICE,
    });
  } catch (err: any) {
    res.status(502).json({
      error: `Failed to change password over SSH: ${err.message}`,
      hint: 'If you changed the password manually outside the platform, update your stored credentials using PATCH /vps-provisions/:id/update-credentials first.',
    });
  }
});

const updateCredentialsSchema = z.object({
  ip: z.string().min(1).optional(),
  sshPort: z.number().int().positive().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

/**
 * PATCH /api/vps-provisions/:id/update-credentials
 * Out-of-band sync: updates stored IP/SSH Port/Username/Password in the platform DB if modified externally.
 */
vpsRouter.patch('/vps-provisions/:id/update-credentials', async (req: AuthedRequest, res: Response) => {
  const parsed = updateCredentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { password, ip, sshPort, username } = parsed.data;
  const updateData: any = {};

  if (ip !== undefined) updateData.ip = ip;
  if (sshPort !== undefined) updateData.sshPort = sshPort;
  if (username !== undefined) updateData.username = username;
  if (password !== undefined) {
    updateData.credentialRef = encryptSecret(password, env.secretsEncryptionKey);
  }

  const updated = await prisma.vpsProvision.update({
    where: { id: provision.id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'vps.update_credentials',
      target: provision.id,
      actorRole: req.user!.role === 'customer' ? 'customer' : null,
    },
  });

  res.json({
    ok: true,
    provision: omitCredentialRef(updated),
    notice: 'Stored credentials updated successfully. Platform management tools will now use these credentials for SSH, reboot, and SFTP access.',
  });
});

// ── SFTP FILE MANAGEMENT ENDPOINTS ──

/**
 * GET /api/vps-provisions/:id/sftp/list
 * Browse directory files over SFTP.
 */
vpsRouter.get('/vps-provisions/:id/sftp/list', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const remotePath = (req.query.path as string) || '/root';

  try {
    const items = await sftpListFiles(provision, remotePath);
    res.json({ path: remotePath, items, notice: CREDENTIAL_SYNC_NOTICE });
  } catch (err: any) {
    res.status(502).json({ error: `SFTP directory read failed (${remotePath}): ${err.message}` });
  }
});

/**
 * GET /api/vps-provisions/:id/sftp/download
 * Download a file from VPS over SFTP.
 *
 * S17 FIX: Streams the SFTP read-stream directly into the HTTP response rather than
 * buffering the entire file in the Node.js heap (which could spike up to 50 MB).
 */
vpsRouter.get('/vps-provisions/:id/sftp/download', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const remotePath = req.query.path as string;
  if (!remotePath) return res.status(400).json({ error: 'File path query parameter is required' });

  const filename = remotePath.split('/').pop() || 'download';
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  try {
    // Pass `res` as the destination writable — sftpDownloadFile pipes directly into it
    await sftpDownloadFile(provision, remotePath, res);
  } catch (err: any) {
    // Only attempt to send an error response if headers have not been flushed yet
    if (!res.headersSent) {
      res.status(502).json({ error: `SFTP download failed: ${err.message}` });
    } else {
      // Headers already sent — destroy the connection to signal failure to the client
      res.destroy();
    }
  }
});

/**
 * POST /api/vps-provisions/:id/sftp/upload
 * Upload a file to VPS over SFTP (supports multipart upload or JSON text payload).
 */
vpsRouter.post(
  '/vps-provisions/:id/sftp/upload',
  upload.single('file'),
  async (req: AuthedRequest, res: Response) => {
    const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
    if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
    if (!(await canAccessResource(provision.userId, req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const remotePath = (req.body.remotePath || req.query.remotePath) as string;
    if (!remotePath) return res.status(400).json({ error: 'remotePath is required' });

    let buffer: Buffer;
    if (req.file) {
      buffer = req.file.buffer;
    } else if (typeof req.body.content === 'string') {
      buffer = Buffer.from(req.body.content, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Please upload a file or provide string content in request body' });
    }

    try {
      await sftpUploadFile(provision, remotePath, buffer);
      res.json({ ok: true, remotePath, message: 'File successfully uploaded over SFTP' });
    } catch (err: any) {
      res.status(502).json({ error: `SFTP upload failed (${remotePath}): ${err.message}` });
    }
  }
);

/**
 * DELETE /api/vps-provisions/:id/sftp/delete
 * Delete a file or folder from VPS over SFTP.
 */
vpsRouter.delete('/vps-provisions/:id/sftp/delete', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const remotePath = req.query.path as string;
  const isDirectory = req.query.isDirectory === 'true';
  if (!remotePath) return res.status(400).json({ error: 'path query parameter is required' });

  try {
    await sftpDeleteFile(provision, remotePath, isDirectory);
    res.json({ ok: true, remotePath, message: `${isDirectory ? 'Directory' : 'File'} deleted over SFTP` });
  } catch (err: any) {
    res.status(502).json({ error: `SFTP deletion failed (${remotePath}): ${err.message}` });
  }
});

const extractSchema = z.object({
  archivePath: z.string().min(1),
  targetDirectory: z.string().optional(),
});

/**
 * POST /api/vps-provisions/:id/sftp/extract
 * Extract a zip/tar/tgz archive directly on the remote VPS over SSH.
 */
vpsRouter.post('/vps-provisions/:id/sftp/extract', async (req: AuthedRequest, res: Response) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const result = await extractArchiveSsh(provision, parsed.data.archivePath, parsed.data.targetDirectory);
    res.json({ ok: true, message: result.message });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

const renameSchema = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
});

/**
 * POST /api/vps-provisions/:id/sftp/rename
 * Rename / move a file or folder on the remote VPS over SSH.
 */
vpsRouter.post('/vps-provisions/:id/sftp/rename', async (req: AuthedRequest, res: Response) => {
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    await renamePathSsh(provision, parsed.data.oldPath, parsed.data.newPath);
    res.json({ ok: true, message: 'Renamed successfully' });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

const mkdirSchema = z.object({ dirPath: z.string().min(1) });

/**
 * POST /api/vps-provisions/:id/sftp/mkdir
 * Create a directory on the remote VPS over SSH.
 */
vpsRouter.post('/vps-provisions/:id/sftp/mkdir', async (req: AuthedRequest, res: Response) => {
  const parsed = mkdirSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    await mkdirSsh(provision, parsed.data.dirPath);
    res.json({ ok: true, message: 'Directory created successfully' });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

const touchSchema = z.object({ filePath: z.string().min(1) });

/**
 * POST /api/vps-provisions/:id/sftp/touch
 * Create an empty file on the remote VPS over SSH.
 */
vpsRouter.post('/vps-provisions/:id/sftp/touch', async (req: AuthedRequest, res: Response) => {
  const parsed = touchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    await touchFileSsh(provision, parsed.data.filePath);
    res.json({ ok: true, message: 'File created successfully' });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * GET /api/vps-provisions/:id/sftp/read-file
 * Read text file content over SFTP for online editor preview/edit.
 */
vpsRouter.get('/vps-provisions/:id/sftp/read-file', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const remotePath = req.query.path as string;
  if (!remotePath) return res.status(400).json({ error: 'path query parameter is required' });

  try {
    const buffer = await sftpDownloadFile(provision, remotePath);
    if (!buffer) return res.status(500).json({ error: 'Unexpected empty buffer from SFTP' });
    const content = (buffer as Buffer).toString('utf-8');
    res.json({ path: remotePath, content });
  } catch (err: any) {
    res.status(502).json({ error: `Read file failed: ${err.message}` });
  }
});

const saveFileSchema = z.object({
  remotePath: z.string().min(1),
  content: z.string(),
});

/**
 * POST /api/vps-provisions/:id/sftp/save-file
 * Save text file content over SFTP from online editor.
 */
vpsRouter.post('/vps-provisions/:id/sftp/save-file', async (req: AuthedRequest, res: Response) => {
  const parsed = saveFileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const buffer = Buffer.from(parsed.data.content, 'utf-8');
    await sftpUploadFile(provision, parsed.data.remotePath, buffer);
    res.json({ ok: true, message: 'File saved successfully over SFTP' });
  } catch (err: any) {
    res.status(502).json({ error: `Save file failed: ${err.message}` });
  }
});

/**
 * DELETE /api/vps-provisions/:id
 * Remove a terminated VPS provision record (admin/dev or owner).
 */
vpsRouter.delete('/vps-provisions/:id', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (provision.status !== 'terminated') {
    return res.status(409).json({ error: 'Cannot delete an active VPS provision. It must be terminated first.' });
  }

  await prisma.vpsProvision.delete({ where: { id: provision.id } });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'vps.delete_provision', target: provision.id },
  });

  res.json({ ok: true, deletedId: provision.id });
});

/**
 * GET /api/vps-provisions/:id/firewall
 * Retrieves active Firewall rules and toggle status over SSH.
 */
vpsRouter.get('/vps-provisions/:id/firewall', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const data = await getVpsFirewallRulesSsh(provision);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: `Firewall query failed: ${err.message}` });
  }
});

const toggleFirewallSchema = z.object({
  enabled: z.boolean(),
});

/**
 * POST /api/vps-provisions/:id/firewall/toggle
 * Enable or Disable Host Firewall (UFW) over SSH.
 */
vpsRouter.post('/vps-provisions/:id/firewall/toggle', async (req: AuthedRequest, res: Response) => {
  const parsed = toggleFirewallSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const result = await toggleVpsFirewallSsh(provision, parsed.data.enabled);
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'vps.firewall_toggle', target: `${provision.id}:${result.status}` },
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: `Firewall toggle failed: ${err.message}` });
  }
});

const addRuleSchema = z.object({
  action: z.enum(['allow', 'deny']).default('allow'),
  port: z.union([z.string(), z.number()]).optional(),
  protocol: z.enum(['tcp', 'udp', 'any']).default('tcp'),
  sourceIp: z.string().optional(),
  comment: z.string().optional(),
});

/**
 * POST /api/vps-provisions/:id/firewall/rules
 * Add a new host firewall security rule over SSH.
 */
vpsRouter.post('/vps-provisions/:id/firewall/rules', async (req: AuthedRequest, res: Response) => {
  const parsed = addRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const result = await addVpsFirewallRuleSsh(provision, parsed.data);
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'vps.firewall_add_rule', target: `${provision.id}:${parsed.data.port || 'ALL'}` },
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: `Add firewall rule failed: ${err.message}` });
  }
});

/**
 * DELETE /api/vps-provisions/:id/firewall/rules/:ruleIndex
 * Delete a host firewall security rule by index over SSH.
 */
vpsRouter.delete('/vps-provisions/:id/firewall/rules/:ruleIndex', async (req: AuthedRequest, res: Response) => {
  const ruleIndex = parseInt(req.params.ruleIndex, 10);
  if (isNaN(ruleIndex) || ruleIndex < 1) {
    return res.status(400).json({ error: 'Invalid rule index' });
  }

  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const result = await deleteVpsFirewallRuleSsh(provision, ruleIndex);
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'vps.firewall_delete_rule', target: `${provision.id}:rule#${ruleIndex}` },
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: `Delete firewall rule failed: ${err.message}` });
  }
});

function omitCredentialRef<T extends { credentialRef: string | null }>(provision: T) {
  const { credentialRef, ...rest } = provision;
  return rest;
}
