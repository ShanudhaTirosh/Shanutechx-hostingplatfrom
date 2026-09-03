import { Request, Response, NextFunction } from 'express';
import { firebaseAuth } from '../lib/firebaseAdmin';
import { prisma } from '../lib/prisma';
import { ensureStaffMarkedInRealtimeDb } from '../lib/chatAdminSync';
import { hashApiKey } from '../lib/apiKeys';

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
      return res.status(401).json({ error: 'Invalid or expired token', detail: firebaseErr.code ?? firebaseErr.message });
    }

    let user: { id: string; firebaseUid: string; email: string; role: 'customer' | 'admin' | 'support' | 'dev'; isBanned: boolean; banReason?: string | null };
    try {
      user = await prisma.user.upsert({
        where: { firebaseUid: decoded.uid },
        update: { email: decoded.email ?? '' },
        create: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? '',
          displayName: decoded.name ?? null,
        },
      });
    } catch (dbErr: any) {
      return res.status(503).json({ error: 'Database unavailable — cannot authenticate. Please try again shortly.', detail: dbErr.message });
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
  if (req.user?.role !== 'admin' && req.user?.role !== 'dev') {
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
  if (req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Dev access required' });
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
