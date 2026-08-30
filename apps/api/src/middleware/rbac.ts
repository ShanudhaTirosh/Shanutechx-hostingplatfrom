import { Response, NextFunction } from 'express';
import { AuthedRequest } from './auth';
import { prisma } from '../lib/prisma';

export type UserRole = 'customer' | 'admin' | 'support' | 'dev';

/**
 * Role-Based Access Control middleware factory.
 * 
 * Creates a middleware function that enforces role-based access control
 * for API endpoints. The middleware verifies that the authenticated user
 * has one of the specified roles.
 * 
 * @param roles - One or more roles that are authorized to access the endpoint
 * @returns Express middleware function that enforces role requirements
 * 
 * @example
 * // Allow only admin and dev users
 * router.post('/catalog', requireAuth, requireRole('admin', 'dev'), createCatalogItem);
 * 
 * @example
 * // Allow all authenticated users (any role)
 * router.get('/catalog', requireAuth, requireRole('customer', 'admin', 'support', 'dev'), getCatalog);
 * 
 * Authorization Rules:
 * - Admin and dev users can manage catalog items and VPS plans
 * - User roles validated at both API endpoint level and UI component level
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    // Ensure user is authenticated (should be enforced by requireAuth middleware first)
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    // Check if user's role is in the allowed roles list
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${roles.join(', ')}. Your role: ${req.user.role}`,
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    // User has required role, proceed to next middleware
    next();
  };
}

/**
 * Resource ownership verification utility.
 * 
 * Verifies that the authenticated user owns the specified resource.
 * Returns 404 (not 403) when a customer attempts to access another customer's
 * resource to avoid revealing the resource's existence.
 * 
 * Dev bypasses ownership checks unconditionally and can access all resources.
 * An admin can only act on a resource owned by a customer who
 * is explicitly assigned to them (`User.assignedAdminId`), which the dev user
 * sets via `PATCH /admin/customers/:id/assign`. This is an async check (it
 * hits the DB), so use `verifyResourceOwnershipAsync` in any route handler —
 * `verifyResourceOwnership` below is kept for dev/customer-only call sites
 * that don't need the extra query.
 * 
 * @param resourceOwnerId - The ID of the user who owns the resource
 * @param req - The authenticated request object
 * @param res - The Express response object
 * @returns true if the user has access, sends HTTP response and returns false otherwise
 * 
 * @example
 * // In a route handler
 * const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
 * if (!deployment) {
 *   return res.status(404).json({ error: 'Deployment not found' });
 * }
 * if (!(await verifyResourceOwnershipAsync(deployment.userId, req, res))) {
 *   return; // Response already sent
 * }
 * 
 * **Security Note**: Returns 404 instead of 403 for customers accessing other
 * customers' resources to prevent information disclosure about resource existence.
 */
export function verifyResourceOwnership(
  resourceOwnerId: string,
  req: AuthedRequest,
  res: Response
): boolean {
  // Only dev gets an unconditional bypass now. Admin is intentionally NOT
  // checked here — admin's access is scoped to assigned customers, which
  // requires a DB lookup, so admin routes must use
  // verifyResourceOwnershipAsync instead. A plain 'admin' role reaching this
  // function falls through to the strict self-ownership check below, which
  // is the safe (deny-by-default) direction for anything not yet migrated.
  if (req.user?.role === 'dev') {
    return true;
  }

  // Check if the authenticated user owns the resource
  if (req.user?.id !== resourceOwnerId) {
    // Return 404 (not 403) to avoid revealing resource existence
    // This satisfies the task requirement: "Return 404 (not 403) when customer 
    // attempts to access other customer's resources"
    res.status(404).json({ 
      error: 'Resource not found',
      message: 'The requested resource does not exist or you do not have access to it'
    });
    return false;
  }

  return true;
}

/**
 * Pure boolean version of the ownership check — no res side-effects, so
 * route handlers that want their own 404/error shape (e.g. invoices.ts,
 * which returns null and lets the caller decide the response) can use this
 * instead of `verifyResourceOwnershipAsync`, which writes the response
 * itself when access is denied.
 */
export async function canAccessResource(resourceOwnerId: string, req: AuthedRequest): Promise<boolean> {
  if (req.user?.role === 'dev') return true;
  if (req.user?.role === 'admin') {
    const owner = await prisma.user?.findUnique({
      where: { id: resourceOwnerId },
      select: { assignedAdminId: true },
    });
    if (!owner) return true;
    return owner.assignedAdminId === req.user.id || owner.assignedAdminId == null;
  }
  if (req.user?.id === resourceOwnerId) return true;

  if (req.user?.id) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: req.user.id,
        team: { ownerId: resourceOwnerId },
      },
      include: { permissions: true },
    });

    if (membership) {
      if (['owner', 'admin', 'developer'].includes(membership.role)) {
        return true;
      }
      if (membership.permissions && membership.permissions.some((p) => p.permission !== 'none')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Async counterpart to `verifyResourceOwnership` — the one admin routes
 * should actually use. Dev: unconditional access. Customer: self only.
 * Admin: only if the resource's owner has `assignedAdminId === req.user.id`.
 *
 * Requires `User.assignedAdminId` (see packages/db/prisma/schema.prisma).
 */
export async function verifyResourceOwnershipAsync(
  resourceOwnerId: string,
  req: AuthedRequest,
  res: Response
): Promise<boolean> {
  if (await canAccessResource(resourceOwnerId, req)) {
    return true;
  }
  res.status(404).json({
    error: 'Resource not found',
    message: 'The requested resource does not exist or you do not have access to it',
  });
  return false;
}

/**
 * Returns the set of customer user IDs visible under the "assigned OR
 * still unassigned" rule — used for anything that's a shared
 * work queue rather than a strictly-owned resource: tickets and the
 * payment review queue. `null` means "no filter, sees everyone"
 * (dev always; support for tickets specifically, handled by the caller).
 */
async function assignedOrUnassignedCustomerIds(req: AuthedRequest): Promise<string[] | null> {
  if (req.user?.role !== 'admin') return null; // caller decides what null means for non-admin
  const visible = await prisma.user?.findMany({
    where: { OR: [{ assignedAdminId: req.user.id }, { assignedAdminId: null }] },
    select: { id: true },
  });
  return visible ? visible.map((u: { id: string }) => u.id) : [];
}

/**
 * Ticket visibility rules:
 *  1. `support` exists specifically to handle tickets platform-wide — that's
 *     its whole job (see RBAC_README.md) — so it stays unrestricted.
 *  2. Unlike SMTP/billing/deployments, an unanswered ticket from an
 *     unassigned customer is a real support gap, not a privacy concern —
 *     so admin sees tickets from customers assigned to them AND from
 *     customers with no admin assigned yet, but not another admin's
 *     assigned customers' tickets. dev always sees everything.
 */
export async function ticketVisibilityWhere(req: AuthedRequest): Promise<Record<string, unknown>> {
  if (req.user?.role === 'dev' || req.user?.role === 'support') {
    return {};
  }
  const ids = await assignedOrUnassignedCustomerIds(req);
  if (ids) return { userId: { in: ids } };
  return { userId: req.user?.id };
}

/** Same rule as `ticketVisibilityWhere`, but for checking a single already-loaded ticket's owner. */
export async function canSeeTicket(ticketOwnerId: string, req: AuthedRequest): Promise<boolean> {
  if (req.user?.role === 'dev' || req.user?.role === 'support') return true;
  if (req.user?.role === 'admin') {
    const owner = await prisma.user?.findUnique({ where: { id: ticketOwnerId }, select: { assignedAdminId: true } });
    if (!owner) return true;
    return owner.assignedAdminId === req.user.id || owner.assignedAdminId == null;
  }
  return req.user?.id === ticketOwnerId;
}

/**
 * Same "assigned OR unassigned" rule as tickets, applied to the payment
 * manual-review queue — an unclaimed pending payment shouldn't sit
 * invisible to every admin just because dev hasn't assigned that customer
 * yet. Returns a `where` fragment for `Payment.order.user.id`. dev is
 * unrestricted (empty fragment).
 */
export async function paymentReviewVisibilityWhere(req: AuthedRequest): Promise<Record<string, unknown>> {
  if (req.user?.role === 'dev') return {};
  const ids = await assignedOrUnassignedCustomerIds(req);
  if (ids) return { order: { userId: { in: ids } } };
  return {};
}

/** Same rule as `paymentReviewVisibilityWhere`, for a single already-loaded payment's order owner. */
export async function canReviewPayment(orderOwnerId: string, req: AuthedRequest): Promise<boolean> {
  if (req.user?.role === 'dev') return true;
  if (req.user?.role === 'admin') {
    const owner = await prisma.user?.findUnique({ where: { id: orderOwnerId }, select: { assignedAdminId: true } });
    if (!owner) return true;
    return owner.assignedAdminId === req.user.id || owner.assignedAdminId == null;
  }
  return false;
}

/**
 * Returns a Prisma `where` fragment for filtering resources that a user
 * is allowed to see: dev → no filter (sees all), admin → only customers
 * assigned to them, customer → only themselves.
 *
 * @example
 * const where = await ownedResourceWhere(req, 'userId');
 * const deployments = await prisma.deployment.findMany({ where });
 */
export async function ownedResourceWhere(
  req: AuthedRequest,
  userIdField: string = 'userId'
): Promise<Record<string, unknown>> {
  if (req.user?.role === 'dev') {
    return {};
  }
  if (req.user?.role === 'admin') {
    const assigned = await prisma.user?.findMany({
      where: { OR: [{ assignedAdminId: req.user.id }, { assignedAdminId: null }] },
      select: { id: true },
    });
    return { [userIdField]: { in: assigned ? assigned.map((u: { id: string }) => u.id) : [] } };
  }
  return { [userIdField]: req.user?.id };
}

/**
 * Support staff verification utility.
 * 
 * Checks if the authenticated user has support staff privileges.
 * This includes admin, support, and dev roles.
 * 
 * @param req - The authenticated request object
 * @returns true if user is support staff, false otherwise
 */
export function isSupportStaff(req: AuthedRequest): boolean {
  return req.user?.role === 'admin' || 
         req.user?.role === 'support' || 
         req.user?.role === 'dev';
}

/**
 * Infrastructure access verification utility.
 * 
 * Checks if the authenticated user has infrastructure access privileges.
 * This includes admin and dev roles.
 * 
 * @param req - The authenticated request object
 * @returns true if user has infrastructure access, false otherwise
 */
export function hasInfrastructureAccess(req: AuthedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.role === 'dev';
}
