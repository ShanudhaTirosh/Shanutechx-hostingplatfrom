/**
 * Enforcement logic for a deployment's WAF rules. Pure and network-free so every rule-matching and rate-limiting
 * decision is directly testable; index.js wires this to the actual HTTP request Traefik forwards for checking.
 *
 * Backstory: rules were previously only ever written to the platform database. The "sync" endpoint that was supposed
 * to push them here just logged a message and returned {ok:true} — nothing was ever enforced. A customer could
 * "block" an attacker's IP, see it saved, and traffic from that IP would still reach their app unchanged.
 *
 * What is enforced here: action allow/block, matchType ip/ip_range/header/path/user_agent, and rate_limit (a request
 * count per IP per minute, since that is the only rate-limit parameter the schema and UI expose).
 *
 * What is NOT enforced (deliberately rejected earlier, in the API's validation, rather than accepted and ignored):
 * matchType "country" (needs a GeoIP source that was never wired in) and action "turnstile_challenge" (needs an
 * interactive challenge page and token verification that were never built). Accepting those and doing nothing would
 * repeat exactly the bug being fixed here.
 */

const net = require('net');

/** @typedef {{ id: string, action: 'allow'|'block'|'rate_limit', matchType: 'ip'|'ip_range'|'header'|'path'|'user_agent', matchValue: string, rateLimitPerMinute: number|null, isEnabled: boolean }} WafRule */

/** @typedef {{ ip: string, path: string, userAgent: string, headers: Record<string,string> }} CheckRequest */

function parseHeaderMatch(matchValue) {
  // "Name: value" (exact) or bare "Name" (present, any value). Header name match is case-insensitive per HTTP.
  const idx = matchValue.indexOf(':');
  if (idx === -1) return { name: matchValue.trim().toLowerCase(), value: null };
  return { name: matchValue.slice(0, idx).trim().toLowerCase(), value: matchValue.slice(idx + 1).trim() };
}

function ipToLong(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** IPv4 only. IPv6 rules are accepted (not rejected) but never match, so they fail safe as a no-op rather than throwing. */
function matchesIp(ip, matchValue) {
  if (net.isIP(ip) !== 4) return false;
  return ip === matchValue.trim();
}

function matchesIpRange(ip, cidr) {
  if (net.isIP(ip) !== 4) return false;
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (net.isIP(base) !== 4 || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipLong = ipToLong(ip);
  const baseLong = ipToLong(base);
  if (ipLong === null || baseLong === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipLong & mask) === (baseLong & mask);
}

function matchesHeader(headers, matchValue) {
  if (!headers || typeof headers !== 'object') return false;
  const { name, value } = parseHeaderMatch(matchValue);
  const actual = headers[name];
  if (actual === undefined) return false;
  return value === null || actual === value;
}

function matchesPath(path, matchValue) {
  if (!path || typeof path !== 'string') return false;
  // A trailing "*" matches a prefix; otherwise the path must match exactly.
  if (matchValue.endsWith('*')) return path.startsWith(matchValue.slice(0, -1));
  return path === matchValue;
}

function matchesUserAgent(userAgent, matchValue) {
  if (!userAgent || typeof userAgent !== 'string') return false;
  return userAgent.toLowerCase().includes(matchValue.toLowerCase());
}

function ruleMatches(rule, req) {
  switch (rule.matchType) {
    case 'ip':
      return matchesIp(req.ip, rule.matchValue);
    case 'ip_range':
      return matchesIpRange(req.ip, rule.matchValue);
    case 'header':
      return matchesHeader(req.headers, rule.matchValue);
    case 'path':
      return matchesPath(req.path, rule.matchValue);
    case 'user_agent':
      return matchesUserAgent(req.userAgent, rule.matchValue);
    default:
      return false; // an unrecognised or not-yet-supported matchType never matches, i.e. never silently "protects"
  }
}

/**
 * A simple fixed-window counter per (deploymentId, ip, ruleId), reset once a minute. Good enough for "block after
 * N requests per IP per minute"; not distributed, so it only limits per node, which matches everything else here
 * being node-local. `now` is injectable for tests.
 */
class RateLimiter {
  constructor() {
    this.windows = new Map(); // key -> { windowStart, count }
  }

  /** Returns true if this request should be allowed through. */
  hit(key, limitPerMinute, now = Date.now()) {
    const windowStart = Math.floor(now / 60000) * 60000;
    const entry = this.windows.get(key);
    if (!entry || entry.windowStart !== windowStart) {
      this.windows.set(key, { windowStart, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limitPerMinute;
  }

  /** Removes windows older than the current one, so memory does not grow forever across many distinct IPs. */
  sweep(now = Date.now()) {
    const windowStart = Math.floor(now / 60000) * 60000;
    for (const [key, entry] of this.windows) {
      if (entry.windowStart !== windowStart) this.windows.delete(key);
    }
  }
}

/**
 * Decides what to do with one request against one deployment's rule set.
 * Precedence: block rules are checked first (a matching block always wins, however allow/rate-limit rules are
 * ordered), then rate-limit rules, then allow rules; a deployment with rules but no match defaults to allow.
 * A deployment with zero enabled rules is not even worth calling this for; index.js skips the check entirely then.
 */
function evaluate(rules, req, limiter, now = Date.now()) {
  const enabled = rules.filter((r) => r.isEnabled);
  const block = enabled.find((r) => r.action === 'block' && ruleMatches(r, req));
  if (block) return { decision: 'block', ruleId: block.id };

  for (const rule of enabled) {
    if (rule.action !== 'rate_limit' || !ruleMatches(rule, req)) continue;
    const limit = rule.rateLimitPerMinute;
    if (!Number.isInteger(limit) || limit <= 0) continue; // misconfigured rule: fails open, not closed
    const key = `${rule.id}:${req.ip}`;
    if (!limiter.hit(key, limit, now)) return { decision: 'rate_limited', ruleId: rule.id };
  }

  return { decision: 'allow', ruleId: null };
}

/**
 * Enforces "URL Password Protection" (HTTP Basic Auth in front of the whole deployment) without a bcrypt compare
 * on every single request: bcrypt is deliberately slow (hundreds of ms), and a request-scoped compare would both
 * make every page load slow and let an attacker burn CPU on the node just by hammering the auth prompt.
 *
 * A browser that has been given valid credentials automatically resends the exact same Authorization header on
 * every subsequent request to the same realm (that is what HTTP Basic Auth is), so the verified header value is
 * cached per deployment after the first successful bcrypt compare; later requests with that same header skip
 * bcrypt entirely. The cache is cleared for a deployment whenever its rules/password are resynced, so a changed or
 * removed password takes effect immediately rather than "eventually".
 */
class PasswordGate {
  /** compare: (password, hash) => Promise<boolean> -- injected so tests do not have to run real, slow bcrypt. */
  constructor(compare) {
    this._compare = compare;
    this._verified = new Map(); // deploymentId -> Set<raw "Basic ..." header value that has already been checked>
  }

  invalidate(deploymentId) {
    this._verified.delete(deploymentId);
  }

  async check(deploymentId, hash, authorizationHeader) {
    if (!hash) return { ok: true }; // protection is off for this deployment
    if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Basic ')) return { ok: false, reason: 'missing' };

    const cache = this._verified.get(deploymentId);
    if (cache && cache.has(authorizationHeader)) return { ok: true };

    let decoded;
    try {
      decoded = Buffer.from(authorizationHeader.slice('Basic '.length), 'base64').toString('utf8');
    } catch {
      return { ok: false, reason: 'malformed' };
    }
    // Only the password is checked; the username portion (before the first ":") is accepted but ignored, matching
    // the existing feature (a single shared password per deployment, no separate usernames).
    const colon = decoded.indexOf(':');
    const password = colon === -1 ? decoded : decoded.slice(colon + 1);

    const match = await this._compare(password, hash);
    if (!match) return { ok: false, reason: 'wrong' };

    let set = this._verified.get(deploymentId);
    if (!set) {
      set = new Set();
      this._verified.set(deploymentId, set);
    }
    set.add(authorizationHeader);
    // Cap so long-lived, high-traffic deployments cannot grow this without bound; oldest entry is evicted first.
    if (set.size > 1000) set.delete(set.values().next().value);
    return { ok: true };
  }
}

module.exports = { evaluate, ruleMatches, matchesIp, matchesIpRange, matchesHeader, matchesPath, matchesUserAgent, RateLimiter, PasswordGate };
