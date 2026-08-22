import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { hashApiKey } from '../lib/apiKeys';
import { AuthedRequest, requireAuth } from './auth';

/**
 * Accepts either a Firebase ID token OR an API key in the Authorization
 * header — requireAuth already handles Firebase tokens; this wraps it to
 * also accept `Bearer shx_...` for scripted/API access, resolving to the
 * same req.user shape so every existing route works unchanged either way.
 *
 * API keys always resolve to role 'customer' regardless of the underlying
 * user's actual role — a key is scoped to "act as this customer for their
 * own resources", never a path to admin/support access even if the person
 * happens to be staff.
 */
export async function requireAuthOrApiKey(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const token = header.slice('Bearer '.length);

  if (token.startsWith('shx_')) {
    const keyHash = hashApiKey(token);
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash }, include: { user: true } });

    if (!apiKey || apiKey.revokedAt) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    void prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    req.user = {
      id: apiKey.user.id,
      firebaseUid: apiKey.user.firebaseUid,
      email: apiKey.user.email,
      role: 'customer',
    };
    return next();
  }

  return requireAuth(req, res, next);
}
