/**
 * Validation for the API base URL the app sends credentials to.
 *
 * Every request carries the Firebase ID token or the admin/dev API key to this base URL, so an
 * attacker-supplied or mistyped URL (plain http://, a look-alike host, one with embedded
 * credentials) would hand those credentials over. The setting used to accept any string.
 *
 * Deliberately regex-based: React Native's built-in `URL` is incomplete (accessors such as
 * `hostname` throw "not implemented" on some versions), and this must behave the same in Node tests.
 */
export type ServerUrlResult = { ok: true; url: string } | { ok: false; error: string };

// Plain http is only ever acceptable for a dev machine / emulator, never for a real server.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

const URL_RE = /^(https?):\/\/(\[[0-9a-fA-F:]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?((?:\/[^\s?#]*)?)$/i;

export function normalizeServerUrl(input: string, opts: { allowInsecureLoopback?: boolean } = {}): ServerUrlResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter a server URL.' };

  if (/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i.test(raw)) {
    return { ok: false, error: 'The server URL must not contain a username or password.' };
  }
  if (/[?#]/.test(raw)) return { ok: false, error: 'The server URL must not contain a query string or fragment.' };

  const m = URL_RE.exec(raw);
  if (!m) return { ok: false, error: 'That is not a valid server URL (expected https://host[:port][/path]).' };

  const scheme = m[1].toLowerCase();
  const host = m[2].toLowerCase();
  const port = m[3];
  if (port !== undefined && Number(port) > 65535) return { ok: false, error: 'Invalid port number.' };

  if (scheme === 'http' && !(opts.allowInsecureLoopback && LOOPBACK_HOSTS.has(host))) {
    return { ok: false, error: 'The server URL must use https:// (credentials are sent to it).' };
  }

  const path = m[4].replace(/\/+$/, '');
  return { ok: true, url: `${scheme}://${host}${port ? `:${port}` : ''}${path}` };
}
