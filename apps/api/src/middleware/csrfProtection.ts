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

const ALLOWED_ORIGINS = [
  // Production domains (update these with your actual production URLs)
  'https://app.shanutechx.com',
  'https://shanutechx.com',
  'https://www.shanutechx.com',
  
  // Development/local origins
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

/**
 * Shared origin-allowlist check, used both by this CSRF middleware (for
 * state-changing requests) and by the CORS configuration in index.ts (for
 * every request, including GET). Previously index.ts had its own,
 * separate "reflect any Origin back with credentials: true" CORS
 * middleware instead of maintaining two divergent origin checks.
 */
export function isOriginAllowed(origin: string): boolean {
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.shanutechx.com') ||
    origin === 'https://shanutechx.com'
  );
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
  
  // If no Origin header, check Referer as fallback
  // (Some older browsers or tools don't send Origin)
  if (!origin && !referer) {
    logger.warn(
      {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      'CSRF: No Origin or Referer header on state-changing request'
    );
    res.status(403).json({ 
      error: 'Request origin could not be verified. Please ensure your browser allows Origin headers.' 
    });
    return;
  }
  
  // Check if origin or referer matches allowed list
  const requestOrigin = origin || (referer ? new URL(referer).origin : '');
  
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

/**
 * Helper function to add custom allowed origins at runtime (e.g., for testing or dynamic domains).
 * NOT recommended for production - configure ALLOWED_ORIGINS array instead.
 */
export function addAllowedOrigin(origin: string): void {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    ALLOWED_ORIGINS.push(origin);
    logger.info({ origin }, 'Added allowed origin for CSRF protection');
  }
}
