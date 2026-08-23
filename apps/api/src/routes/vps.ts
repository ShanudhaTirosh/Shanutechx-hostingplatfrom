import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, canAccessResource } from '../middleware/rbac';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { notifyCustomer } from '../lib/notifications';

export const vpsRouter = Router();

vpsRouter.use(requireAuth);

/**
 * Handles VPS provisions for non-Leaseweb providers (any reseller where the
 * customer manages their VPS through that provider's own panel — a plain
 * handoff of panelUrl/username/password). When a VpsProvision has
 * `leasewebVpsId` set instead, real in-dashboard management (power,
 * console, credentials, snapshots, usage, password reset, and — admin/dev
 * only — terminate) is handled by routes/leaseweb.ts's
 * `/leaseweb/instances/provision/:id/*` endpoints instead of this file.
 */
const provisionSchema = z.object({
  userId: z.string(),
  orderItemId: z.string(),
  provider: z.string().min(1),
  externalId: z.string().optional(),
  panelUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

vpsRouter.post('/vps-provisions', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (req.user!.role === 'admin' && !(await canAccessResource(parsed.data.userId, req))) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const { password, ...rest } = parsed.data;
  const credentialRef = encryptSecret(password, env.secretsEncryptionKey);

  const provision = await prisma.vpsProvision.create({
    data: { ...rest, credentialRef, status: 'provisioned', provisionedAt: new Date() },
    include: { user: true },
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'vps.provision', target: provision.id },
  });

  void notifyCustomer(
    provision.user,
    `Your VPS is ready. Manage it at ${provision.panelUrl} — check your dashboard for login details.`
  );

  res.status(201).json({ provision: omitCredentialRef(provision) });
});

vpsRouter.get('/vps-provisions', async (req: AuthedRequest, res) => {
  // Phase 15: admin scoped to assigned customers' VPS provisions; also
  // fixes dev previously falling into the customer-only branch here.
  const where = await ownedResourceWhere(req);
  const provisions = await prisma.vpsProvision.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json({ provisions: provisions.map(omitCredentialRef) });
});

vpsRouter.get('/vps-provisions/:id/reveal-password', async (req: AuthedRequest, res) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision || !provision.credentialRef) return res.status(404).json({ error: 'Not found' });
  // Phase 15: was `role !== 'admin' && ...`, which actually locked dev out
  // of every customer's VPS credential too (dev !== 'admin'). Now dev is
  // unrestricted, admin only for an assigned customer.
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
  }

  const password = decryptSecret(provision.credentialRef, env.secretsEncryptionKey);

  if ((req.user!.role === 'admin' || req.user!.role === 'dev') && provision.userId !== req.user!.id) {
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'vps.reveal_password', target: provision.id },
    });
  }

  res.json({ password });
});

/**
 * DELETE /api/vps-provisions/:id
 * Remove a terminated VPS provision record (admin/dev or owner)
 */
vpsRouter.delete('/vps-provisions/:id', async (req: AuthedRequest, res) => {
  const provision = await prisma.vpsProvision.findUnique({ where: { id: req.params.id } });
  if (!provision) return res.status(404).json({ error: 'VPS provision not found' });
  if (!(await canAccessResource(provision.userId, req))) {
    return res.status(404).json({ error: 'Not found' });
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
