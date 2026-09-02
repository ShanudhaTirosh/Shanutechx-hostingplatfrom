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
} from '../lib/vpsSshClient';

export const vpsRouter = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max SFTP upload

vpsRouter.use(requireAuth);

const CREDENTIAL_SYNC_NOTICE =
  '⚠️ IMPORTANT NOTE: If you change your root password directly inside the SSH terminal or external provider console, you MUST update your stored credentials in the control panel using "Update Credentials". Otherwise, automated reboot, SFTP file management, and browser SSH terminal will fail to authenticate.';

const provisionSchema = z.object({
  userId: z.string(),
  orderItemId: z.string(),
  provider: z.string().min(1).default('custom'),
  externalId: z.string().optional(),
  panelUrl: z.string().url().optional(),
  ip: z.string().min(1).optional(),
  sshPort: z.number().int().positive().default(22),
  username: z.string().min(1).default('root'),
  password: z.string().min(1),
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
  const credentialRef = encryptSecret(password, env.secretsEncryptionKey);

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

  if ((req.user!.role === 'admin' || req.user!.role === 'dev') && provision.userId !== req.user!.id) {
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'vps.reveal_password', target: provision.id },
    });
  }

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

const powerSchema = z.object({ action: z.enum(['reboot', 'stop', 'start', 'status']) });

/**
 * POST /api/vps-provisions/:id/power
 * SSH-based power management actions (reboot, shutdown, status checks).
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

    if (action === 'stop') {
      // Shutdown host
      void execVpsSsh(provision, 'sudo shutdown -h now || shutdown -h now || sudo poweroff || poweroff').catch(() => {});
      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'vps.ssh_shutdown',
          target: provision.id,
          actorRole: req.user!.role === 'customer' ? 'customer' : null,
        },
      });
      return res.json({ ok: true, action: 'stop', message: 'Shutdown signal sent to VPS over SSH.' });
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
 */
vpsRouter.get('/vps-provisions/:id/sftp/download', async (req: AuthedRequest, res: Response) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const remotePath = req.query.path as string;
  if (!remotePath) return res.status(400).json({ error: 'File path query parameter is required' });

  try {
    const buffer = await sftpDownloadFile(provision, remotePath);
    const filename = remotePath.split('/').pop() || 'download';
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(502).json({ error: `SFTP download failed: ${err.message}` });
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

function omitCredentialRef<T extends { credentialRef: string | null }>(provision: T) {
  const { credentialRef, ...rest } = provision;
  return rest;
}
