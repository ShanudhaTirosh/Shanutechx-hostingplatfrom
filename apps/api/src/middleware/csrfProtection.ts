import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/**
 * CSRF Protection Middleware using Origin header validation.
 * 
 * While Firebase JWT (Bearer token) inherently provides some CSRF protection
 * (attackers can't steal tokens from cookies), Origin validation provides
 * defense-in-depth by ensuring state-changing requests come from trusted origins.
 * 
 * This prevents scenarios where a malicious site makes authenticated fetch()
 * requests to our API if a user is logged into the dashboard.
 */

// Additional origins can be injected at runtime for staging or other environments
// without a code change (e.g. EXTRA_ALLOWED_ORIGINS=https://staging.shanutechx.com)
const extraOrigins = process.env.EXTRA_ALLOWED_ORIGINS
  ? process.env.EXTRA_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const ALLOWED_ORIGINS = [
  // Production domains
  'https://app.shanutechx.com',
  'https://shanutechx.com',
  'https://www.shanutechx.com',

  // Development/local origins — excluded in production to avoid expanding the attack surface.
  // Set NODE_ENV=production on all production servers.
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']
    : []),

  ...extraOrigins,
];

/**
 * Shared origin-allowlist check, used both by this CSRF middleware (for
 * state-changing requests) and by the CORS configuration in index.ts (for
 * every request, including GET). Previously index.ts had its own,
 * separate "reflect any Origin back with credentials: true" CORS
 * middleware instead of maintaining two divergent origin checks.
 */
export function isOriginAllowed(origin: string): boolean {
  // Exact-match production/development origins, or any production (HTTPS)
  // first-party subdomain of shanutechx.com. The wildcard is TLS-gated so an
  // http:// downgrade can never be accepted.
  return ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.shanutechx\.com$/.test(origin);
}

/**
 * Validates Origin header for state-changing requests (POST, PUT, DELETE, PATCH).
 * Read operations (GET, HEAD, OPTIONS) are allowed without origin validation.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only validate state-changing methods
  const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    return next();
  }
  
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // No Origin AND no Referer → this is a non-browser caller (curl, cron,
  // webhook providers, our node-agent, server-to-server). Browsers always
  // send Origin/Referer on cross-origin requests, and the CSRF threat model
  // only concerns browser-based cross-site requests, so a header-less
  // state-changing call cannot be a forged browser request. Allow it.
  if (!origin && !referer) {
    return next();
  }

  // At least one of Origin/Referer is present (i.e. a browser-originated
  // request). Verify it points at a trusted host.
  // BUG-15 FIX: Safely parse referer header using try/catch to prevent 500 TypeError crash on malformed Referer.
  let requestOrigin = origin ?? '';
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = '';
    }
  }
  
  if (!isOriginAllowed(requestOrigin)) {
    logger.warn(
      {
        method: req.method,
        path: req.path,
        origin: requestOrigin,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      'CSRF: Blocked request from disallowed origin'
    );
    res.status(403).json({ 
      error: 'Request origin not allowed. Cross-origin requests from this domain are not permitted.' 
    });
    return;
  }
  
  // Origin validated, proceed
  next();
}


