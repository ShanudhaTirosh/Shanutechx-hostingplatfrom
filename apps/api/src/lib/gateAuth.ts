import crypto from 'crypto';

/**
 * Constant-time comparison of a submitted shared secret against the expected
 * value. The caller sends the raw secret (header or query), and we compare it
 * directly to the env-provided secret without leaking length or content via
 * timing. Length mismatch short-circuits to false (timingSafeEqual throws on
 * unequal lengths, so we guard first).
 */
export function verifySharedSecret(submitted: unknown, expected: string): boolean {
  if (typeof submitted !== 'string' || submitted.length === 0 || !expected) return false;
  const hashA = crypto.createHash('sha256').update(submitted).digest();
  const hashB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
