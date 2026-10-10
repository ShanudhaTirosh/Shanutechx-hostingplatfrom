import { Response, NextFunction } from 'express';
import { AuthedRequest } from './auth';
import { prisma } from '../lib/prisma';

export type UserRole = 'customer' | 'admin' | 'support' | 'dev';

/**
 * Role-Based Access Control middleware factory.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    if (req.user.role !== 'dev' && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${roles.join(', ')}. Your role: ${req.user.role}`,
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
}

export function verifyResourceOwnership(
  resourceOwnerId: string,
  req: AuthedRequest,
  res: Response
): boolean {
  if (req.user?.role === 'dev') {
    return true;
  }

  if (req.user?.id !== resourceOwnerId) {
    res.status(404).json({ 
      error: 'Resource not found',
      message: 'The requested resource does not exist or you do not have access to it'
    });
    return false;
  }

  return true;
}

/**
 * Pure boolean version of the ownership & team permission check.
 * Differentiates read vs write actions for team member permissions.
 */
export async function canAccessResource(
  resourceOwnerId: string,
  req: AuthedRequest,
  resourceType?: string,
  resourceId?: string,
  action: 'read' | 'write' = 'read'
): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'dev') return true;
  if (req.user.id === resourceOwnerId) return true;

  if (req.user.role === 'admin') {
    const owner = await prisma.user.findUnique({
      where: { id: resourceOwnerId },
      select: { assignedAdminId: true },
    });
    if (!owner) return false; // Default DENY if owner row does not exist
    return owner.assignedAdminId === req.user.id;
  }

  // Support staff have read-only visibility into customer resources for ticket investigation (MED-05)
  if (req.user.role === 'support') {
    return action === 'read';
  }

  if (req.user.id) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: req.user.id,
        team: { ownerId: resourceOwnerId },
      },
      include: { permissions: true },
    });

    if (membership) {
      if (['owner', 'admin'].includes(membership.role)) {
        return true;
      }
      if (membership.role === 'developer') {
        return action === 'read' || action === 'write';
      }

      if (membership.permissions && membership.permissions.length > 0) {
        const allowedPermissions = action === 'read' ? ['read', 'write', 'admin'] : ['write', 'admin'];

        if (resourceType && resourceId) {
          return membership.permissions.some(
            (p) => p.resourceType === (resourceType as any) && p.resourceId === resourceId && allowedPermissions.includes(p.permission)
          );
        }
        if (resourceType) {
          return membership.permissions.some(
            (p) => p.resourceType === (resourceType as any) && allowedPermissions.includes(p.permission)
          );
        }
        return membership.permissions.some((p) => allowedPermissions.includes(p.permission));
      }
    }
  }

  return false;
}

export async function verifyResourceOwnershipAsync(
  resourceOwnerId: string,
  req: AuthedRequest,
  res: Response,
  action: 'read' | 'write' = 'read'
): Promise<boolean> {
  if (await canAccessResource(resourceOwnerId, req, undefined, undefined, action)) {
    return true;
  }
  res.status(404).json({
    error: 'Resource not found',
    message: 'The requested resource does not exist or you do not have access to it',
  });
  return false;
}

export async function ticketVisibilityWhere(req: AuthedRequest): Promise<Record<string, unknown>> {
  if (req.user?.role === 'dev' || req.user?.role === 'support') {
    return {};
  }
  if (req.user?.role === 'admin') {
    return {
      OR: [
        { user: { assignedAdminId: req.user.id } },
        { user: { assignedAdminId: null } },
        { userId: req.user.id },
      ],
    };
  }
  return { userId: req.user?.id };
}

export async function canSeeTicket(ticketOwnerId: string, req: AuthedRequest): Promise<boolean> {
  if (req.user?.role === 'dev' || req.user?.role === 'support') return true;
  if (req.user?.role === 'admin') {
    const owner = await prisma.user.findUnique({ where: { id: ticketOwnerId }, select: { assignedAdminId: true } });
    if (!owner) return false; // Default DENY if owner record is missing
    return owner.assignedAdminId === req.user.id || owner.assignedAdminId == null;
  }
  return req.user?.id === ticketOwnerId;
}

export async function paymentReviewVisibilityWhere(req: AuthedRequest): Promise<Record<string, unknown>> {
  if (req.user?.role === 'dev') return {};
  if (req.user?.role === 'admin') {
    return {
      OR: [
        { order: { user: { assignedAdminId: req.user.id } } },
        { order: { user: { assignedAdminId: null } } },
      ],
    };
  }
  return { order: { userId: req.user?.id } };
}

export async function canReviewPayment(orderOwnerId: string, req: AuthedRequest): Promise<boolean> {
  if (req.user?.role === 'dev') return true;
  if (req.user?.role === 'admin') {
    const owner = await prisma.user.findUnique({ where: { id: orderOwnerId }, select: { assignedAdminId: true } });
    if (!owner) return false; // Default DENY if owner record missing
    return owner.assignedAdminId === req.user.id || owner.assignedAdminId == null;
  }
  return false;
}

export async function ownedResourceWhere(
  req: AuthedRequest,
  userIdField: string = 'userId'
): Promise<Record<string, unknown>> {
  if (req.user?.role === 'dev') {
    return {};
  }
  if (req.user?.role === 'admin') {
    return {
      OR: [
        { [userIdField]: req.user.id },
        { user: { assignedAdminId: req.user.id } },
      ],
    };
  }
  return { [userIdField]: req.user?.id };
}

export function isSupportStaff(req: AuthedRequest): boolean {
  return req.user?.role === 'admin' || 
         req.user?.role === 'support' || 
         req.user?.role === 'dev';
}

export function hasInfrastructureAccess(req: AuthedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.role === 'dev';
}
