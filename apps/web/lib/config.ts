/**
 * Centralized platform configuration for the public web app.
 * Ensures production builds never silently fallback to local development URLs.
 */

export const DASHBOARD_URL: string =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://dashboard.shanutechx.com'
    : 'http://localhost:3001');
