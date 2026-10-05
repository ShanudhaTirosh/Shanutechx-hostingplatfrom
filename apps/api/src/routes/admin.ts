import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireDev, AuthedRequest } from '../middleware/auth';
import { parsePagination } from '../lib/pagination';

import { banUserAndTeardownResources, unbanUser } from '../lib/abuseDetector';
import { fullFirebaseDataMigration, syncProductsToFirebase, syncPanelSettingsToFirebase } from '../lib/firebaseSync';
import { removeStaffFromRealtimeDb } from '../lib/chatAdminSync';

export const adminRouter = Router();

adminRouter.use('/admin', requireAuth, requireAdmin);

adminRouter.get('/admin/customers', async (req: AuthedRequest, res) => {
  const { take, skip } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  // Admin only sees customers explicitly assigned to them by dev.
  // Dev (which also passes requireAdmin) still sees everyone.
  const where = {
    role: 'customer' as const,
    ...(req.user!.role === 'admin' ? { assignedAdminId: req.user!.id } : {}),
    ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        _count: { select: { orders: true } },
        orders: { where: { status: 'paid' }, select: { total: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const result = customers.map((c: (typeof customers)[number]) => ({
    id: c.id,
    email: c.email,
    displayName: c.displayName,
    firebaseUid: c.firebaseUid,
    phoneNumber: c.phoneNumber,
    discordUserId: c.discordUserId,
    isBanned: c.isBanned,
    bannedAt: c.bannedAt,
    banReason: c.banReason,
    createdAt: c.createdAt,
    orderCount: c._count.orders,
    totalSpent: c.orders.reduce((sum: number, o: { total: number }) => sum + o.total, 0),
  }));

  res.json({
    customers: result,
    total,
    take,
    skip,
    isScoped: req.user!.role === 'admin',
  });
});

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(['customer', 'support', 'dev', 'admin']).default('customer'),
});

/** Admin endpoint to manually create customer or staff user accounts. */
adminRouter.post('/admin/users', async (req: AuthedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(400).json({ error: 'User with this email already exists' });

  if (['dev', 'admin'].includes(parsed.data.role) && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only the platform dev account can assign admin or dev roles.' });
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      displayName: parsed.data.displayName || parsed.data.email.split('@')[0],
      role: parsed.data.role,
      firebaseUid: `manual_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'admin.create_user',
      target: user.email,
    },
  });

  res.status(201).json({ user });
});

/**
 * Resolves a Firebase UID to the matching customer — used by the admin chat
 * inbox, which is keyed by Firebase UID (that's what Realtime DB security
 * rules can see), to show an actual name/email instead of a raw UID.
 */
adminRouter.get('/admin/customers/by-firebase-uid/:uid', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { firebaseUid: req.params.uid } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    customer: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      firebaseUid: user.firebaseUid,
    },
  });
});

/** Lists current staff (admin + support) so an admin can see who has what access. */
adminRouter.get('/admin/staff', async (_req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['admin', 'support', 'dev'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, displayName: true, role: true, createdAt: true },
  });
  res.json({ staff });
});

/**
 * Returns ALL users (any role) for admin dropdowns — e.g. the "assign to
 * user" picker in the managed-database and SMTP provisioning forms.
 * Supports ?search= for instant filtering and sorts users who paid for VPS
 * plans at the top of the list.
 */
adminRouter.get('/admin/all-users', async (req: AuthedRequest, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      orders: {
        where: { status: 'paid' },
        select: { id: true, total: true },
      },
      vpsProvisions: {
        select: { id: true, status: true, ip: true },
      },
    },
  });

  const formatted = users.map((u: any) => {
    const paidOrders = u.orders || [];
    const vpsCount = u.vpsProvisions ? u.vpsProvisions.length : 0;
    const hasPaidVps = paidOrders.length > 0 || vpsCount > 0;
    const totalSpent = paidOrders.reduce((acc: number, o: any) => acc + (o.total || 0), 0);
    const awaitingDelivery = paidOrders.length > 0 && vpsCount < paidOrders.length;

    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      hasPaidVps,
      paidOrderCount: paidOrders.length,
      totalSpent,
      vpsCount,
      awaitingDelivery,
    };
  });

  // Sort paid VPS users awaiting delivery FIRST, then already-assigned paid users, then by total spent
  formatted.sort((a: any, b: any) => {
    if (a.awaitingDelivery && !b.awaitingDelivery) return -1;
    if (!a.awaitingDelivery && b.awaitingDelivery) return 1;
    if (a.hasPaidVps && !b.hasPaidVps) return -1;
    if (!a.hasPaidVps && b.hasPaidVps) return 1;
    return b.totalSpent - a.totalSpent;
  });

  res.json({ users: formatted });
});

const setRoleSchema = z.object({ role: z.enum(['customer', 'support', 'dev', 'admin']) });

/**
 * Promotes/demotes a user between customer, support, and admin. Without
 * this, the support role could only ever be assigned via raw database
 * access — not something you'd want to be the only way to manage staff.
 *
 * Rules:
 *  - You cannot change your own role.
 *  - Only the 'dev' user can change another 'dev' user's role (prevents
 *    admins from silently demoting the platform owner).
 *  - Only the 'dev' user can assign 'admin' or 'dev' roles.
 */
adminRouter.patch('/admin/staff/:userId/role', async (req: AuthedRequest, res) => {
  const parsed = setRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (req.params.userId === req.user!.id) {
    return res.status(400).json({
      error: 'Cannot change your own role — have another admin do it, to avoid locking yourself out.',
    });
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Protect the dev role: no one can demote a dev user account.
  if (target.role === 'dev' && parsed.data.role !== 'dev') {
    return res.status(403).json({
      error: 'Developer accounts cannot be demoted to a lower role.',
    });
  }

  if (['dev', 'admin'].includes(parsed.data.role) && req.user!.role !== 'dev') {
    return res.status(403).json({
      error: 'Only the platform dev account can assign administrative roles (admin or dev).',
    });
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  if (['customer'].includes(parsed.data.role) && target.firebaseUid) {
    await removeStaffFromRealtimeDb(target.firebaseUid);
  }

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'staff.set_role',
      target: `${target.email} -> ${parsed.data.role}`,
    },
  });

  res.json({
    user: { id: updated.id, email: updated.email, role: updated.role },
  });
});

/**
 * The audit log records admin actions (payment approvals, CMS edits, node changes,
 * staff role changes, secret reveals). This endpoint provides paginated access.
 */
adminRouter.get('/admin/audit-log', async (req: AuthedRequest, res) => {
  const { take, skip } = parsePagination(req.query);

  const where =
    req.user!.role === 'admin'
      ? {
          OR: [
            { adminId: req.user!.id },
            { admin: { assignedAdminId: req.user!.id } },
          ],
        }
      : {};

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { admin: { select: { email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ entries, total, take, skip });
});

/**
 * Assigns (or unassigns, with adminId: null) a customer to an admin.
 * Dev-only: allows dev to delegate day-to-day customer management.
 */
const assignCustomerSchema = z.object({ adminId: z.string().nullable() });

adminRouter.patch('/admin/customers/:userId/assign', requireDev, async (req: AuthedRequest, res) => {
  const parsed = assignCustomerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const customer = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!customer || customer.role !== 'customer') {
    return res.status(404).json({ error: 'Customer not found' });
  }

  if (parsed.data.adminId) {
    const admin = await prisma.user.findUnique({ where: { id: parsed.data.adminId } });
    if (!admin || admin.role !== 'admin') {
      return res.status(400).json({ error: 'adminId must belong to a user with the admin role' });
    }
  }

  const updated = await prisma.user.update({
    where: { id: customer.id },
    data: { assignedAdminId: parsed.data.adminId },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'customer.assign',
      target: `${updated.email} -> ${parsed.data.adminId ?? 'unassigned'}`,
    },
  });

  res.json({ user: { id: updated.id, email: updated.email, assignedAdminId: updated.assignedAdminId } });
});

/** Ban a user account and stop all their running deployments. */
const banUserSchema = z.object({ reason: z.string().optional() });

adminRouter.post('/admin/users/:userId/ban', async (req: AuthedRequest, res) => {
  const parsed = banUserSchema.safeParse(req.body);
  const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  if (targetUser.id === req.user!.id) {
    return res.status(400).json({ error: 'Cannot ban your own user account.' });
  }

  const { canAccessResource } = await import('../middleware/rbac');
  if (!(await canAccessResource(targetUser.id, req))) {
    return res.status(404).json({ error: 'User not found' });
  }

  if ((targetUser.role === 'dev' || targetUser.role === 'admin') && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only the platform dev account can ban administrative staff.' });
  }

  const result = await banUserAndTeardownResources({
    userId: targetUser.id,
    reason: parsed.success && parsed.data.reason ? parsed.data.reason : 'Suspended by Admin',
    detectedBy: req.user!.email,
    actorId: req.user!.id,
  });

  if (targetUser.firebaseUid) {
    await removeStaffFromRealtimeDb(targetUser.firebaseUid);
  }

  res.json({
    ok: true,
    message: `User ${targetUser.email} has been banned and ${result.stoppedDeploymentsCount} deployments stopped.`,
  });
});

/** Unban a user account and restore access. */
adminRouter.post('/admin/users/:userId/unban', async (req: AuthedRequest, res) => {
  const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const { canAccessResource } = await import('../middleware/rbac');
  if (!(await canAccessResource(targetUser.id, req))) {
    return res.status(404).json({ error: 'User not found' });
  }

  await unbanUser({
    userId: targetUser.id,
    adminUserId: req.user!.id,
  });

  res.json({
    ok: true,
    message: `User ${targetUser.email} has been unbanned.`,
  });
});

/**
 * Triggers a full migration and real-time sync of products, client accounts,
 * settings, and orders from PostgreSQL to Firebase Firestore and Realtime Database.
 */
adminRouter.post('/admin/firebase-sync', async (req: AuthedRequest, res) => {
  const syncResult = await fullFirebaseDataMigration();
  
  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'firebase.full_sync',
      target: `Synced ${syncResult.syncedUsersCount} users, products, orders & settings to Firestore`,
    },
  });

  res.json({
    ok: true,
    message: 'Firebase Firestore & Realtime Database sync completed successfully!',
    result: syncResult,
  });
});

/**
 * Impersonate a customer account (Paymenter Feature). Allows staff to view and inspect
 * client area as a customer.
 */
adminRouter.post('/admin/impersonate/:userId', async (req: AuthedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.isBanned) {
    return res.status(400).json({ error: 'Cannot impersonate a banned user' });
  }

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'admin.impersonate_user',
      target: target.email,
    },
  });

  res.json({
    ok: true,
    impersonatedUser: {
      id: target.id,
      email: target.email,
      displayName: target.displayName,
      role: target.role,
    },
  });
});

