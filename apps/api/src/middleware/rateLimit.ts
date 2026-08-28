import rateLimit from 'express-rate-limit';

/** Applied globally. Generous enough not to bother a real user, tight enough to blunt scripted abuse. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300, // Increased from 120 to 300 for better user experience
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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
  validate: { trustProxy: false },
  message: { error: 'Too many requests' },
});

/** Payment proof uploads trigger a Gemini API call — rate-limit per-window to protect the free-tier quota. */
export const paymentUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20, // Increased from 10 to 20
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Too many upload attempts, please wait a moment and try again' },
});

/** Sensitive auth endpoints (project signup, login, magic-link, password reset) to prevent brute-force attacks. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  limit: 15, // max 15 attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Too many authentication attempts, please try again in 15 minutes' },
});
