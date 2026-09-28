import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthedRequest } from './auth';

/**
 * FIX: All limiters previously had `validate: { trustProxy: false }` which
 * conflicts with `app.set('trust proxy', 1)` in index.ts.
 * With that option, express-rate-limit used the raw socket IP — meaning all
 * traffic from behind a load balancer appeared as a single IP, breaking rate
 * limiting in production. Removing it lets the library respect Express's trust
 * proxy setting and read the correct client IP from X-Forwarded-For.
 */

/** Applied globally. Generous enough not to bother a real user, tight enough to blunt scripted abuse. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

/**
 * The SMS webhook has no Firebase auth — only an HMAC signature — so it's
 * the one endpoint truly open to the internet with no login wall at all.
 * Tight limit since a real device only sends one request per actual SMS.
 */
export const smsWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

/** Payment proof uploads trigger a Gemini API call — rate-limit per-window to protect the free-tier quota. */
export const paymentUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload attempts, please wait a moment and try again' },
});

/** Sensitive auth endpoints (project signup, login, magic-link, password reset) to prevent brute-force attacks. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  limit: 15,                 // max 15 attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes' },
});

/**
 * Per-user deployment creation limiter applied to POST /deployments.
 * Keys by authenticated user ID so a single account can't flood the build queue
 * even if they rotate IPs. Falls back to IP for unauthenticated requests.
 */
export const deploymentCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10-minute window
  limit: 20,                 // max 20 deployment creates per user per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // AuthedRequest populates req.user after the auth middleware runs.
    return (req as AuthedRequest).user?.id ?? req.ip ?? 'unknown';
  },
  message: { error: 'Too many deployment requests. Please wait before creating more.' },
});
