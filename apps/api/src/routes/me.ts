import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { env } from '../env';

export const meRouter = Router();

meRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      firebaseUid: true,
      email: true,
      role: true,
      displayName: true,
      phoneNumber: true,
      discordUserId: true,
      isBanned: true,
      createdAt: true,
    },
  });
  res.json({ user: user || req.user, rootDomain: env.rootDomain });
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  // E.164-ish: allow a leading + and 7-15 digits. Real validation happens
  // implicitly the first time a WhatsApp send to this number fails or
  // succeeds — this is just enough to catch obvious typos before saving.
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/)
    .nullable()
    .optional(),
  discordUserId: z
    .string()
    .regex(/^[0-9]{15,25}$/)
    .nullable()
    .optional(),
}).strict();

/**
 * Lets a customer link the contact channels notifyCustomer() actually uses.
 * Without this, those fields could only ever be set by an admin editing the
 * database directly — there was no real onboarding path for a customer to
 * opt into WhatsApp/Discord notifications themselves.
 */
meRouter.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data,
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      discordUserId: user.discordUserId,
    },
  });
});

const updateRoleSchema = z.object({
  role: z.enum(['customer', 'support', 'dev', 'admin']),
});

meRouter.patch('/me/role', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updatedUser = await prisma.user.update({
    where: { id: req.user!.id },
    data: { role: parsed.data.role },
    select: {
      id: true,
      firebaseUid: true,
      email: true,
      role: true,
      displayName: true,
      phoneNumber: true,
      discordUserId: true,
      isBanned: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'user.switch_role',
      target: `${req.user!.email} -> ${parsed.data.role}`,
    },
  }).catch(() => null);

  res.json({ user: updatedUser, rootDomain: env.rootDomain });
});

