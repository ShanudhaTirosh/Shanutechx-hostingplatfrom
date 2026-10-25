import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { canImpersonate } from '../lib/impersonation';
import { firebaseAuth } from '../lib/firebaseAdmin';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { ensureStaffMarkedInRealtimeDb } from '../lib/chatAdminSync';
import { hashApiKey } from '../lib/apiKeys';
import { env } from '../env';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    firebaseUid: string;
    email: string;
    role: 'customer' | 'admin' | 'support' | 'dev';
  };
}

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>`
 * OR developer API key sent as `x-api-key: shx_...` / `Authorization: Bearer shx_...`.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const header = req.headers.authorization;
  const token = apiKeyHeader || (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined);

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token or API key' });
  }

  // API Key Authentication path (token starting with shx_)
  if (token.startsWith('shx_')) {
    const keyHash = hashApiKey(token);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    if (apiKey.user.isBanned) {
      return res.status(403).json({
        error: 'Account Banned',
        message: `Your account has been suspended: ${apiKey.user.banReason || 'Policy Violation'}. Contact support.`,
        isBanned: true,
      });
    }

    void prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => null);

    req.user = {
      id: apiKey.user.id,
      firebaseUid: apiKey.user.firebaseUid,
      email: apiKey.user.email,
      role: apiKey.user.role,
    };
    return next();
  }

  const idToken = token;

  try {
    let decoded: import('firebase-admin/auth').DecodedIdToken;
    try {
      if (!firebaseAuth) {
        return res.status(503).json({ error: 'Firebase authentication service is not configured on server' });
      }
      decoded = await firebaseAuth.verifyIdToken(idToken);
    } catch (firebaseErr: any) {
      // Check if this is a webmail_session JWT token signed with env.projectAuthJwtSecret
      try {
        const payload = jwt.verify(idToken, env.projectAuthJwtSecret, { algorithms: ['HS256'] }) as any;
        if (payload?.type === 'webmail_session' && payload?.userId) {
          const webmailUser = await prisma.user.findUnique({ where: { id: payload.userId } });
          if (webmailUser && !webmailUser.isBanned) {
            req.user = {
              id: webmailUser.id,
              firebaseUid: webmailUser.firebaseUid,
              email: webmailUser.email,
              role: webmailUser.role,
            };
            return next();
          }
        }
      } catch (_) {}

      return res.status(401).json({ error: 'Invalid or expired token', detail: firebaseErr.code ?? firebaseErr.message });
    }

    let user: { id: string; firebaseUid: string; email: string; role: 'customer' | 'admin' | 'support' | 'dev'; isBanned: boolean; banReason?: string | null } | null = null;
    try {
      const allowedAdminList = env.allowedAdminEmails
        ? env.allowedAdminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const isConfiguredDevAdmin = Boolean(
        decoded.email_verified && decoded.email && allowedAdminList.includes(decoded.email.toLowerCase())
      );

      user = await prisma.user.findUnique({
        where: { firebaseUid: decoded.uid },
      });

      if (!user && decoded.email) {
        const existingByEmail = await prisma.user.findUnique({
          where: { email: decoded.email },
        });

        if (existingByEmail) {
          // Sync or update Firebase UID for OAuth login
          user = await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              firebaseUid: decoded.uid,
              displayName: existingByEmail.displayName || decoded.name || null,
              ...(isConfiguredDevAdmin ? { role: 'dev' } : {}),
            },
          });
        }
      }

      if (!user) {
        // New user: dev if matched in configured allowedAdminEmails, otherwise customer
        // B-14 FIX: Use unique placeholder if email is absent to avoid P2002 collision on User.email
        const fallbackEmail = decoded.email || `no-email-${decoded.uid}@shanutechx.internal`;
        user = await prisma.user.create({
          data: {
            firebaseUid: decoded.uid,
            email: fallbackEmail,
            displayName: decoded.name ?? null,
            role: isConfiguredDevAdmin ? 'dev' : 'customer',
          },
        });
      } else {
        if (isConfiguredDevAdmin && user.role !== 'dev') {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { role: 'dev' },
          });
        }
        if (decoded.email && user.email !== decoded.email && !user.email.endsWith('@shanutechx.internal')) {
          // Keep the stored email in sync if Firebase reports a change.
          user = await prisma.user.update({
            where: { id: user.id },
            data: { email: decoded.email },
          });
        }
      }
    } catch (_dbErr: any) {
      logger.error({ err: _dbErr, code: _dbErr?.code, message: _dbErr?.message, stack: _dbErr?.stack }, 'requireAuth DB operation failed');
      return res.status(503).json({ error: 'Database service temporarily unavailable', detail: _dbErr?.message });
    }

    if (user.isBanned) {
      return res.status(403).json({
        error: 'Account Banned',
        message: `Your account has been suspended: ${user.banReason || 'Policy Violation'}. Contact support.`,
        isBanned: true,
      });
    }

    req.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
    };

    // User Impersonation: Allows admin/dev staff to impersonate a customer account
    const impersonateUserId = req.headers['x-impersonate-user-id'] as string | undefined;
    if (impersonateUserId && (user.role === 'admin' || user.role === 'dev')) {
      const targetUser = await prisma.user.findUnique({ where: { id: impersonateUserId } });
      // Same rule as POST /admin/impersonate: customers only, and an admin only for customers assigned to them.
      if (targetUser && canImpersonate({ id: req.user!.id, role: req.user!.role }, targetUser)) {
        (req as any).adminUser = req.user;
        await prisma.auditLog.create({
          data: {
            adminId: user.id,
            action: 'user.impersonate',
            target: `User ${targetUser.id} (${targetUser.email})`,
            actorRole: user.role,
          },
        }).catch((err) => logger.warn({ err }, 'Failed to record impersonation audit log'));
        req.user = {
          id: targetUser.id,
          firebaseUid: targetUser.firebaseUid,
          email: targetUser.email,
          role: 'customer',
        };
      }
    }

    if (user.role === 'admin' || user.role === 'support') {
      void ensureStaffMarkedInRealtimeDb(user.firebaseUid);
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Restricts a route to admin or dev — dev has full permissions equivalent
 * to admin across all API surfaces (billing, CMS, credentials, audit log, etc.).
 * If you need truly admin-only (e.g. role assignment itself), add a separate
 * guard inline in that specific route.
 */
export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/** Restricts a route strictly to full admin role (excludes dev role). */
export function requireFullAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  // BUG-H03 FIX: 'dev' must NOT pass here — full admin is strictly the admin role.
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Full admin access required' });
  }
  next();
}

/** Restricts a route to admins OR support staff — tickets, chat, the customer directory. */
export function requireStaff(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'support' && req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
}

/**
 * Restricts a route to dev role only — the infrastructure-focused
 * counterpart to admin. Dev sees nodes, Leaseweb management, managed
 * databases, and raw API logs; dev does NOT see customers, billing,
 * payment review, CMS, or staff management (that split matters — a dev
 * debugging a failed VPS import shouldn't incidentally have a path to
 * approve payments or read the customer directory).
 */
export function requireDev(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Dev or Admin access required' });
  }
  next();
}

/**
 * Restricts a route to admin OR dev — used for the infrastructure surfaces
 * both roles legitimately need (nodes, Leaseweb, managed databases): an
 * admin still needs enough visibility here to unblock a customer issue
 * even without dev's full raw-log/API-health view, and dev needs it as
 * their whole job. Kept as a separate guard from requireAdmin/requireDev
 * rather than always checking both, so routes read as "who is this for"
 * at a glance.
 */
export function requireAdminOrDev(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Admin or dev access required' });
  }
  next();
}
