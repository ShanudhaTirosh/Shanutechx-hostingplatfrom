import crypto from 'crypto';

/**
 * Server-side proof that a user entered their settings PIN recently.
 *
 * POST /settings/verify-password used to answer `{ unlocked: true }` and nothing else, so the PIN
 * was only a UI gate: the sensitive settings endpoints (e.g. replacing the platform's backup GitHub
 * token/org) never checked it. The server now issues a short-lived HMAC token bound to the user id;
 * those endpoints require it. Stateless, so nothing to store or clean up.
 */
export const SETTINGS_UNLOCK_TTL_MS = 30 * 60 * 1000;

function hmac(payload: string, secret: string): string {
  const key = crypto.createHash('sha256').update(`settings-unlock:${secret}`).digest();
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

export function issueSettingsUnlockToken(userId: string, secret: string, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + SETTINGS_UNLOCK_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return { token: `${Buffer.from(payload).toString('base64url')}.${hmac(payload, secret)}`, expiresAt };
}

export function verifySettingsUnlockToken(token: unknown, userId: string, secret: string, now = Date.now()): boolean {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  let payload: string;
  try {
    payload = Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const given = Buffer.from(parts[1]);
  const expected = Buffer.from(hmac(payload, secret));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;

  const dot = payload.lastIndexOf('.');
  if (dot < 0) return false;
  const tokenUser = payload.slice(0, dot);
  const expiresAt = Number(payload.slice(dot + 1));
  return tokenUser === userId && Number.isFinite(expiresAt) && expiresAt > now;
}
