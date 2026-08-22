import crypto from 'crypto';
import type { Request } from 'express';

/**
 * Verifies the HMAC-SHA256 signature sent by the SMS-forwarding device/app,
 * computed over the exact raw request body bytes using the given secret.
 * This is a device endpoint, not a user one — there's no Firebase token
 * here, so this signature is the only thing standing between this route and
 * the internet. Using req.rawBody (captured in index.ts's express.json
 * verify hook) instead of re-stringifying req.body matters: JSON.stringify
 * of a parsed object isn't guaranteed byte-identical to what the sender
 * actually signed.
 */
export function verifySmsSignature(req: Request, secret: string): boolean {
  const signature = req.headers['x-sms-signature'];
  if (typeof signature !== 'string' || !req.rawBody) return false;

  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Constant-time comparison to avoid leaking signature bytes via timing.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
