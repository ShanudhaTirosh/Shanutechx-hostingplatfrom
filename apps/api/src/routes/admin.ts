import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireDev, AuthedRequest } from '../middleware/auth';
import { parsePagination } from '../lib/pagination';
import { canImpersonate } from '../lib/impersonation';

import { banUserAndTeardownResources, unbanUser } from '../lib/abuseDetector';
import { fullFirebaseDataMigration, syncProductsToFirebase, syncPanelSettingsToFirebase } from '../lib/firebaseSync';
import { removeStaffFromRealtimeDb } from '../lib/chatAdminSync';

export const adminRouter = Router();

adminRouter.use('/admin', requireAuth, requireAdmin);

adminRouter.get('/admin/customers', async (req: AuthedRequest, res) => {
  const { take, skip } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' && req.query.search.trim().length > 0 ? req.query.search.trim() : undefined;
  const roleQuery = typeof req.query.role === 'string' ? req.query.role.trim() : undefined;
  const scoped = req.query.scoped === 'true';

  // Support filtering across all roles (customer, support, admin, dev) or 'all'
  const where: any = {
    ...(roleQuery && roleQuery !== 'all' ? { role: roleQuery } : {}),
    ...(scoped && req.user!.role === 'admin' ? { assignedAdminId: req.user!.id } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { id: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        assignedAdmin: { select: { id: true, email: true, displayName: true } },
        _count: {
          select: {
            orders: true,
            deployments: true,
            vpsProvisions: true,
            tickets: true,
            managedDatabases: true,
            smtpAccounts: true,
          },
        },
        orders: { where: { status: 'paid' }, select: { total: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const result = customers.map((c) => ({
    id: c.id,
    email: c.email,
    displayName: c.displayName,
    role: c.role,
    firebaseUid: c.firebaseUid,
    phoneNumber: c.phoneNumber,
    discordUserId: c.discordUserId,
    isBanned: c.isBanned,
    bannedAt: c.bannedAt,
    banReason: c.banReason,
    createdAt: c.createdAt,
    assignedAdminId: c.assignedAdminId,
    assignedAdmin: c.assignedAdmin,
    orderCount: c._count.orders,
    deploymentsCount: c._count.deployments,
    vpsCount: c._count.vpsProvisions,
    ticketsCount: c._count.tickets,
    databasesCount: c._count.managedDatabases,
    smtpCount: c._count.smtpAccounts,
    servicesCount: c._count.vpsProvisions + c._count.deployments + c._count.managedDatabases + c._count.smtpAccounts,
    totalSpent: c.orders.reduce((sum: number, o: { total: number }) => sum + o.total, 0),
  }));

  res.json({
    customers: result,
    total,
    take,
    skip,
    isScoped: scoped && req.user!.role === 'admin',
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

/**
 * 360-degree customer details endpoint: returns full profile, complete order
 * history, purchased plans & items, payment proofs, active VPS provisions,
 * running app deployments, managed databases, SMTP mailboxes, and tickets.
 */
adminRouter.get('/admin/customers/:userId', async (req: AuthedRequest, res) => {
  const customer = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: {
      assignedAdmin: { select: { id: true, email: true, displayName: true } },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          items: {
            include: {
              plan: { include: { product: true } },
              service: true,
            },
          },
          payments: true,
          invoice: true,
        },
      },
      vpsProvisions: {
        orderBy: { createdAt: 'desc' },
        include: {
          orderItem: {
            include: {
              plan: { include: { product: true } },
            },
          },
        },
      },
      deployments: {
        orderBy: { createdAt: 'desc' },
        include: {
          node: { select: { id: true, label: true, ip: true } },
          orderItem: {
            include: {
              plan: { include: { product: true } },
            },
          },
        },
      },
      managedDatabases: {
        orderBy: { createdAt: 'desc' },
        include: {
          node: { select: { id: true, label: true, ip: true } },
        },
      },
      smtpAccounts: {
        orderBy: { createdAt: 'desc' },
      },
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        include: {
          orderItem: {
            include: {
              plan: { include: { product: true } },
              service: true,
            },
          },
        },
      },
      tickets: {
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const paidOrders = customer.orders.filter((o) => o.status === 'paid');
  const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);

  res.json({
    customer: {
      id: customer.id,
      email: customer.email,
      displayName: customer.displayName,
      role: customer.role,
      avatarUrl: customer.avatarUrl,
      phoneNumber: customer.phoneNumber,
      discordUserId: customer.discordUserId,
      isBanned: customer.isBanned,
      bannedAt: customer.bannedAt,
      banReason: customer.banReason,
      createdAt: customer.createdAt,
      assignedAdminId: customer.assignedAdminId,
      assignedAdmin: customer.assignedAdmin,
      totalSpent,
      orderCount: customer.orders.length,
      orders: customer.orders,
      vpsProvisions: customer.vpsProvisions,
      deployments: customer.deployments,
      managedDatabases: customer.managedDatabases,
      smtpAccounts: customer.smtpAccounts,
      subscriptions: customer.subscriptions,
      tickets: customer.tickets,
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
adminRouter.patch(['/admin/staff/:userId/role', '/admin/customers/:userId/role'], async (req: AuthedRequest, res) => {
  const parsed = setRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (req.params.userId === req.user!.id) {
    return res.status(400).json({
      error: 'Cannot change your own role — have another admin do it, to avoid locking yourself out.',
    });
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Protect the dev role: no one can alter or demote a dev user account.
  if (target.role === 'dev') {
    return res.status(403).json({
      error: 'Developer superuser accounts are permanently locked and cannot be demoted or altered under any circumstances.',
    });
  }

  // Changing an ADMIN account's role (e.g. demoting another admin) is an administrative-role change
  // too: only dev may do it, matching the rule for assigning admin/dev below.
  if (target.role === 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({
      error: 'Only the platform dev account can change the role of an admin account.',
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

adminRouter.patch('/admin/customers/:userId/assign', async (req: AuthedRequest, res) => {
  const parsed = assignCustomerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const customer = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!customer) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (parsed.data.adminId) {
    const admin = await prisma.user.findUnique({ where: { id: parsed.data.adminId } });
    if (!admin || (admin.role !== 'admin' && admin.role !== 'dev')) {
      return res.status(400).json({ error: 'adminId must belong to a user with the admin or dev role' });
    }
  }

  const updated = await prisma.user.update({
    where: { id: customer.id },
    data: { assignedAdminId: parsed.data.adminId },
    include: {
      assignedAdmin: { select: { id: true, email: true, displayName: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'customer.assign',
      target: `${updated.email} -> ${parsed.data.adminId ?? 'unassigned'}`,
    },
  });

  res.json({
    user: {
      id: updated.id,
      email: updated.email,
      assignedAdminId: updated.assignedAdminId,
      assignedAdmin: updated.assignedAdmin,
    },
  });
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
  if (!(await canAccessResource(targetUser.id, req, undefined, undefined, 'write'))) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Dev superuser account is permanently immune to bans/suspensions
  if (targetUser.role === 'dev') {
    return res.status(403).json({ error: 'Developer superuser accounts cannot be banned or suspended under any circumstances.' });
  }

  if (targetUser.role === 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only the platform dev account can ban administrators.' });
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
  if (!(await canAccessResource(targetUser.id, req, undefined, undefined, 'write'))) {
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

  // Customers only, and admins only for customers assigned to them (dev is unrestricted). This also
  // stops the endpoint from returning the profile of staff accounts.
  if (!canImpersonate({ id: req.user!.id, role: req.user!.role }, target)) {
    return res.status(403).json({ error: 'You can only impersonate active customer accounts assigned to you' });
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

