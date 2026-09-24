# Per-deployment firewall (WAF)

> **What this fixes.** Every rule, the Turnstile toggle, and the password-protection setting were saved to the
> database and then "synced" to the node agent — which logged one line and did nothing. A customer could block an
> attacker's IP, see it saved, and the attacker's traffic would keep reaching their app unchanged. Rules, rate
> limits and password protection are now actually enforced; Turnstile is explicitly disabled rather than left fake.

## What's enforced, and how

A Traefik `forwardAuth` middleware is attached to every **proxied** (HTTPS) deployment's router, pointing at the
node agent itself (`http://127.0.0.1:<agent port>/agent/waf-check/<deploymentId>`). Traefik calls it once per
request, before the request reaches the container:

1. **WAF rules** (`services/node-agent/src/waf.js`) — `block` and `rate_limit` actions matching by IP, IP range
   (CIDR), request header, path (exact or `prefix*`), or user agent. A matching block always wins; rate limits are a
   fixed count of requests per IP per minute. No match defaults to allow. Disabled rules are never applied.
2. **Password protection** — HTTP Basic Auth in front of the whole deployment, checked after WAF rules (so a
   blocked IP gets 403, never the password prompt). The password is stored as a bcrypt hash; verifying it against a
   fresh guess is deliberately slow, so a browser's cached credential value is remembered after the first correct
   check and skips bcrypt on every later request from that browser. Failed attempts are rate-limited per IP (20/min)
   so hammering the prompt can't burn CPU on the node.

A deployment with no active rules and no password gets a fast, empty check (`200 OK`) — the middleware is always
attached so that turning a rule on takes effect immediately, with **no redeploy needed**, rather than only
protecting deployments created after a rule already existed.

**This only applies to proxied (HTTPS) deployments.** `direct_port` and `internal` exposure bypass Traefik
entirely — there is no HTTP request for a forwardAuth check to intercept, so a firewall cannot apply there.

## Deliberately NOT enforced (and rejected, not silently accepted)

- **`matchType: "country"`** — no GeoIP source is wired in. Creating a rule with this is rejected with a clear
  message, not silently accepted and ignored.
- **`action: "turnstile_challenge"`**, and the separate `wafTurnstileEnabled` toggle — needs an interactive
  challenge page and server-side token verification that were never built. `POST .../waf/turnstile` now refuses to
  turn it on; the dashboard shows it as "Coming soon" instead of a working-looking switch.

If either becomes worth building, wire it into `waf.js`'s `ruleMatches()`/`evaluate()` and the sync payload the same
way IP/path/header rules are — the plumbing (sync, cache invalidation, forwardAuth route) already exists.

## Existing deployments and existing settings

- **Redeploy required once.** The forwardAuth middleware is a Docker label, fixed at container creation. A
  deployment that has not been redeployed since this shipped is not protected yet, however many rules exist for it.
  The dashboard and the rules API respond say this.
- **Existing password-protection settings were inert.** `deploymentProtectionPassword` held a reversibly-encrypted
  password that was never checked anywhere. Run the migration once the API is deployed:

  ```
  npx tsx apps/api/src/scripts/migrateWafPasswordHashes.ts            # dry run
  npx tsx apps/api/src/scripts/migrateWafPasswordHashes.ts --apply
  ```

  This decrypts each existing password and writes the equivalent bcrypt hash to the new
  `deploymentProtectionPasswordHash` column, so an already-configured (previously non-functional) password starts
  being enforced with the same value the customer set — do this, and consider notifying affected customers, before
  they get an unexpected password prompt on their next redeploy.
- **A stale `wafTurnstileEnabled: true` from before this fix** is never reported as on any more; the rules endpoint
  always reports Turnstile as `{ enabled: false, supported: false }`.

## Not verified

Everything in `waf.js` (rule matching, rate limiting, the password gate's caching) is unit- and mutation-tested, and
the node-agent HTTP routes are tested by spawning the real agent process. **Not verified**: that Traefik's
`forwardAuth` actually forwards the request headers this relies on (`X-Forwarded-For`, `X-Forwarded-Uri`,
`X-Forwarded-User-Agent`, `Authorization`) the way this assumes — there is no running Traefik in the environment
this was built in. Confirm this against a real node before relying on it, particularly that `Authorization` is
forwarded to the auth-check call (needed for password protection); if it is not, that middleware needs
`authRequestHeaders` set explicitly to include it.

## A related, still-fake feature found along the way

**Edge Rules** (rewrites, redirects, custom headers, and "cron" rules — `routes/edgeRules.ts`, the deployment's
Edge Rules tab) has exactly the same problem: saved to the database, synced to an endpoint that did nothing. It was
not fixed here (a materially different task — rewrites/redirects/headers could reuse this session's Traefik-label
approach fairly cheaply; scheduled ("cron") rules need an actual job scheduler, which is unrelated to Traefik
entirely). The sync call was removed so it stops pretending to do something, and the API now reports
`enforced: false` on save so the dashboard can say so honestly. It is not yet updated to show that.

## Code map

`services/node-agent/src/waf.js` (matching, rate limiting, password gate) + the `/agent/waf-check` and
`/agent/deployments/:id/waf/sync` routes in `index.js`; `services/node-agent/src/exposure.js` (attaches the
middleware); `apps/api/src/routes/waf.ts`; `apps/api/src/lib/nodeAgentClient.ts` (`notifyAgentWafSync`);
`apps/dashboard/.../deployments/[id]/waf/page.tsx`. Tests: `nodeAgentWaf.test.ts` (pure logic),
`nodeAgentWafHttp.test.ts` (real agent process over HTTP), `nodeAgentExposure.test.ts` (the middleware label).
