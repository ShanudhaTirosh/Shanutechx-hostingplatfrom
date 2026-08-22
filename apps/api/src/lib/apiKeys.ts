import crypto from 'crypto';

const KEY_PREFIX = 'shx_';

/**
 * Generates a new API key. Format: shx_<48 random hex chars>. The prefix
 * makes it recognizable in logs/GitHub secret-scanning the same way
 * stripe_/gh_ prefixes do, without needing a lookup to know what a leaked
 * string is.
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = KEY_PREFIX + crypto.randomBytes(24).toString('hex');
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12); // shown in the UI so a customer can tell keys apart without re-revealing them
  return { rawKey, keyHash, keyPrefix };
}

/**
 * SHA-256 rather than the AES-GCM secretsVault used elsewhere — API keys
 * are validated on every request (unlike SMTP/VPS passwords, which are only
 * decrypted when a human clicks "reveal"), and a one-way hash comparison is
 * both simpler and correct here: the server only ever needs to check
 * "does this match", never to recover the original value.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}
