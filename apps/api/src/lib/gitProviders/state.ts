import crypto from 'crypto';
import { env } from '../../env';

/**
 * Signed, short-lived, single-purpose `state` token used across both the
 * GitHub App installation redirect and the GitLab OAuth authorize
 * redirect. Prevents the account-linking CSRF that a predictable/guessable
 * state value (the old code used the user's own ID directly) would allow:
 * an attacker who could get a victim to visit a crafted callback URL
 * could otherwise link the attacker's own provider account to the
 * victim's ShanuTechX account.
 *
 * Format: base64url(payloadJson).base64url(hmacSha256(payloadJson)) — a
 * minimal HMAC-signed token rather than a full JWT library dependency,
 * since the payload is tiny and short-lived (5 minutes).
 */

interface StatePayload {
  userId: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'gitea';
  nonce: string;
  iat: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function createState(userId: string, provider: 'github' | 'gitlab' | 'bitbucket' | 'gitea'): string {
  const payload: StatePayload = {
    userId,
    provider,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
  };
  const payloadStr = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', env.gitOauthStateSecret).update(payloadStr).digest();
  return `${b64url(payloadStr)}.${b64url(sig)}`;
}

const STATE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes — just long enough for the redirect round trip

/**
 * Verifies and decodes a state token. Returns null if the signature is
 * invalid, the token is malformed, the provider doesn't match what was
 * expected, or the token has expired.
 */
export function verifyState(token: string, expectedProvider: 'github' | 'gitlab' | 'bitbucket' | 'gitea'): { userId: string } | null {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const expectedSig = crypto.createHmac('sha256', env.gitOauthStateSecret).update(payloadStr).digest();
    const providedSig = Buffer.from(sigB64, 'base64url');

    if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
      return null;
    }

    const payload: StatePayload = JSON.parse(payloadStr);
    if (payload.provider !== expectedProvider) return null;
    if (Date.now() - payload.iat > STATE_MAX_AGE_MS) return null;

    return { userId: payload.userId };
  } catch {
    return null;
  }
}
