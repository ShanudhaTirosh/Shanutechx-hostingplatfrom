# Codebase Bug Audit Report — Part 2 (previously unreviewed route files)

## Scope

This is a follow-up pass covering exactly the files listed as "Not yet reviewed" in the original
`BUG_AUDIT.md`'s *Files Reviewed* section — the remaining `apps/api/src/routes/` files, plus finishing the
two files that were only partially read last time (`domains.ts`, `orders.ts`). It does not re-cover
anything already reported in `BUG_AUDIT.md`, and it still does not touch `packages/{catalog,client,
deployments,node-agent,types,tracing}`, the three frontend apps, `infra/`, `templates/`, `config/`,
`docker/`, `firebase/`, `components/`, or `tests/` — those remain unreviewed.

**Files read in full this pass** (22 route files not previously read, in full, plus the lib file they lead
to for the domain-attach flow):

`metrics.ts`, `cms.ts`, `me.ts`, `pushTokens.ts`, `health.ts`, `templates.ts`, `webhooks.ts`, `services.ts`,
`backup.ts`, `aiSubscription.ts`, `analytics.ts`, `discordWebhookConfig.ts`, `status.ts`,
`traefikStatus.ts`, `tickets.ts`, `settings.ts`, `knowledgebase.ts`, `openapi.ts`, `vps-plans.ts`,
`admin.ts`, `projectAuth.ts`, `filesystem.ts`, plus the full remainder of `domains.ts` and `orders.ts`
(previously only partially read), and `lib/domain/manager.ts` (the implementation backing `domains.ts`,
read to verify the attach/verify/remove flow and confirm the SSL-renewal job is actually scheduled).

## Summary

- **Files reviewed this pass:** 24
- **Confirmed bugs:** 4
- **Severity breakdown:** 1 Critical/High · 1 Medium-High · 2 Medium/Low-Medium

Most of these files turned out clean — well-scoped auth middleware, consistent use of the RBAC helpers,
sensible error handling. The one standout is a serious, confirmed vulnerability in the project-auth
service (`projectAuth.ts`), detailed first below.

---

## Critical/High Issues

### 1. Project-auth OAuth and magic-link flows use an unvalidated, attacker-controlled `redirectUrl` — open redirect that leaks authentication tokens
- **File:** `apps/api/src/routes/projectAuth.ts`
- **Category:** Security — open redirect / token theft
- **Description:**
  - `GET /projects/:id/auth/oauth/:provider/start` (~lines 145-169) reads `redirectUrl` straight from the query string with only `typeof req.query.redirectUrl === 'string'` validation — no allowlist, no check that it matches the project's own registered domain. It's stored in the in-memory `oauthStates` map and used verbatim later.
  - `GET /projects/:id/auth/oauth/:provider/callback` (~lines 171-252): on successful OAuth exchange:
    ```js
    const jwtToken = signProjectAuthToken({ sub: authUser.id, projectId: req.params.id, email: authUser.email });
    const finalUrl = new URL(stateEntry.redirectUrl);
    finalUrl.searchParams.set('token', jwtToken);
    res.redirect(finalUrl.toString());
    ```
    redirects the browser to that same attacker-supplied `redirectUrl`, with a freshly signed, fully valid project-auth JWT attached as a query parameter.
  - `POST /projects/:id/auth/magic-link` (~lines 71-105) has the identical shape: `redirectUrl` is only validated as `z.string().url()` (any well-formed URL, any domain), and the single-use magic-link token is appended to it and emailed to the target address.
- **Why it's a bug:** An attacker can craft a link like `.../auth/oauth/google/start?redirectUrl=https://attacker.example/collect` (or the magic-link equivalent), send it to a victim who is a legitimate end-user of some project hosted on this platform, have them complete a real, legitimate OAuth login (or click a magic-link email that appears to come from the project), and the resulting authentication token — a signed JWT good enough to authenticate as that user via `GET /projects/:id/auth/me`, or a magic-link token redeemable via `/magic-link/verify` — is delivered straight to the attacker's own domain. This is a full account-takeover primitive for any project's end-users, not just a cosmetic redirect issue, since the token itself ends up in the attacker's hands.
- **Suggested fix:** Require `redirectUrl` to match a pre-registered allowlist per project (the same place `ProjectOAuthConfig.redirectUri` already lives is a natural home for this), reject anything else with a 400 before generating state/tokens.

---

## Medium-High Issues

### 2. OAuth login doesn't check the provider's email-verified flag — possible account takeover via email confusion
- **File:** `apps/api/src/lib/oauthProviders.ts` (`extractProfile` for each provider), consumed by `apps/api/src/routes/projectAuth.ts`'s OAuth callback (`findOrCreateVerifiedUser(projectId, email)`, whose own name implies the email is trusted as verified)
- **Category:** Security — authentication logic gap
- **Description:** Google's `extractProfile` takes `p.email` directly with no check of Google's own `email_verified` field in the same profile payload. Discord's `extractProfile` similarly takes the profile email with no verified-flag check evident in this file. GitHub's path is partially mitigated: if the primary `/user` response already includes a public email, that's used unconditionally; only when it's absent does the code fall back to `/user/emails` and correctly filter for `e.primary && e.verified`.
- **Why it's a bug:** `findOrCreateVerifiedUser` marks the resulting `ProjectAuthUser.emailVerified = true` based on nothing more than "an OAuth provider handed back this email string," without confirming that email is actually verified/owned by the authenticating account per the provider's own signal. An attacker who controls an OAuth account with an unverified/spoofable email matching a real end-user's address could sign in and be treated by the project as that verified user.
- **Note:** Exploitability depends on each OAuth provider's specific behavior around allowing unverified emails to appear in profile responses, and on whether an affected project also does email-based account merging elsewhere — flagged for verification against live provider behavior rather than fully proven end-to-end.
- **Suggested fix:** Check `email_verified`/equivalent for Google and Discord the same way the GitHub fallback already does; refuse to treat the email as verified when the provider doesn't confirm it.

---

## Medium Issues

### 3. `POST /admin/users` lets a plain `admin` (not just `dev`) create a new user with `role: 'dev'`, bypassing the platform's own dev-role protection policy
- **File:** `apps/api/src/routes/admin.ts` (`adminRouter.use(requireAuth, requireAdmin)` at router level, then `POST /admin/users`, ~lines 52-84)
- **Category:** Authorization-policy gap
- **Description:** `requireAdmin` (middleware/auth.ts) accepts both `admin` and `dev` roles. `createUserSchema` allows `role: z.enum(['customer','support','dev','admin'])` with no restriction tied to the caller's own role. Compare with the sibling `PATCH /admin/staff/:userId/role` in the same file, which explicitly blocks a plain admin from promoting/demoting anyone to/from `dev` ("Only the platform dev account can change another dev user's role"). `POST /admin/users` has no equivalent check.
- **Mitigating factor** (confirmed by reading `middleware/auth.ts`): the created row gets a synthetic `firebaseUid: manual_${Date.now()}_${Math.random()...}` with no real Firebase account behind it, and `requireAuth`'s login upsert matches strictly by `firebaseUid` (not email), so nobody can actually sign in as this row through the normal auth flow, and `POST /api-keys` only ever creates keys for the caller's own `req.user!.id` — there's no way for the creating admin (or anyone) to actually exercise dev privileges through this phantom account today.
- **Why it's still a bug:** It's a real policy-enforcement gap — the intended protection exists on one endpoint and is simply missing on another that achieves the same end state — and the resulting row isn't fully inert: it appears in `GET /admin/staff` and `GET /admin/all-users` listings as a real `dev`-role account, which could confuse admins, get selected from a dropdown expecting a real staff member, or become an active escalation path with no code change needed here if account-linking-by-email is ever added to the auth flow later.
- **Suggested fix:** In `POST /admin/users`, restrict `role: 'dev'` to callers who are themselves `dev`, mirroring the check already present in the role-change endpoint.

### 4. `GET /deployments/:id/uptime` excludes the `dev` role from staff-level access (only checks `admin`)
- **File:** `apps/api/src/routes/status.ts` (~lines 95-100)
- **Category:** Logic inconsistency
- **Description:**
  ```js
  if (req.user!.role !== 'admin' && deployment.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Not found' });
  }
  ```
  Every other staff-access check in this codebase treats `dev` as at least as privileged as `admin` (`role !== 'admin' && role !== 'dev'`). Here, only `'admin'` is exempted from the ownership check.
- **Why it's a bug:** A `dev`-role user (the platform's own highest-privilege/owner role) gets a 404 "Not found" when checking uptime history for any deployment they don't personally own — a real access-control inconsistency, almost certainly just a missed `role !== 'dev'` clause.
- **Severity:** Low-Medium (impacts the platform's own most-trusted internal role, not outside actors; a correctness bug rather than a security hole).
- **Suggested fix:** Add `&& req.user!.role !== 'dev'` to the condition.

---

## Files Reviewed This Pass, No Issues Found

`metrics.ts`, `cms.ts`, `me.ts`, `pushTokens.ts`, `health.ts`, `templates.ts`, `webhooks.ts`, `services.ts`,
`backup.ts`, `aiSubscription.ts` (minor theoretical double-click race noted but too low-impact to report —
worst case is a harmless duplicate open ticket), `analytics.ts`, `discordWebhookConfig.ts`,
`traefikStatus.ts`, `tickets.ts`, `settings.ts`, `knowledgebase.ts`, `openapi.ts`, `vps-plans.ts`,
`filesystem.ts`, `domains.ts` (full — attach/verify/remove flow correctly uses
`verifyResourceOwnershipAsync`, `lib/domain/manager.ts`'s certificate-expiration job is confirmed properly
scheduled via `worker.ts`'s `ssl-renewal` queue), `orders.ts` (full).

## Still Not Reviewed (unchanged from BUG_AUDIT.md)

`packages/{catalog,client,deployments,node-agent,types,tracing}`; `services/discord-bot/src/client.js` and
`index.js`; `apps/dashboard`, `apps/web`, `apps/mobile-admin` (all frontend code); `infra/` file contents;
`templates/`; `config/`; `docker/`; `firebase/`; `components/`; `tests/`.