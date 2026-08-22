import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireDev, AuthedRequest } from '../middleware/auth';
import { parsePagination } from '../lib/pagination';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/admin/customers', async (req: AuthedRequest, res) => {
  const { take, skip } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  // Phase 15: admin only sees customers explicitly assigned to them by dev.
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
    createdAt: c.createdAt,
    orderCount: c._count.orders,
    totalSpent: c.orders.reduce((sum: number, o: { total: number }) => sum + o.total, 0),
  }));

  res.json({ customers: result, total, take, skip });
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

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      displayName: parsed.data.displayName || parsed.data.email.split('@')[0],
      role: parsed.data.role,
      firebaseUid: `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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
 * Supports ?search= for instant filtering.
 */
adminRouter.get('/admin/all-users', async (req: AuthedRequest, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, email: true, displayName: true, role: true },
  });
  res.json({ users });
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

  // Protect the dev role: only the dev user themselves (via another path) can
  // touch another dev account. Regular admins are blocked.
  if (target.role === 'dev' && req.user!.role !== 'dev') {
    return res.status(403).json({
      error: 'Only the platform dev account can change another dev user\'s role.',
    });
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

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
 * The audit log has been written to since Phase 0 (every admin action:
 * payment approvals, CMS edits, node changes, staff role changes, secret
 * reveals) but there was never a page to actually read it back — this
 * closes that gap.
 */
adminRouter.get('/admin/audit-log', async (req: AuthedRequest, res) => {
  const { take, skip } = parsePagination(req.query);

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { admin: { select: { email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  res.json({ entries, total, take, skip });
});

/**
 * Phase 15 — assigns (or unassigns, with adminId: null) a customer to an
 * admin. Dev-only: this is how dev delegates day-to-day customer management
 * without giving that admin platform-wide visibility. Requires
 * `User.assignedAdminId` on the schema (see packages/db/prisma/schema.prisma
 * — add this migration; it wasn't present as of this change).
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
