# Milestone 1: Adversarial Challenge & Stress-Testing Report

**Challenger:** `teamwork_challenger_m1_1`  
**Target Milestone:** Milestone 1 (M1) — Core Platform Integrity & Test Baseline  
**Evaluation Date:** 2026-10-28  
**Scope Under Challenge:**
- `packages/catalog/src/index.ts` (Catalog SDK validation & deployment helper)
- `services/node-agent/src/repo.js` (Git workspace prep, fallback branch fetch, and error string alignment)

---

## Challenge Summary

**Overall risk assessment**: **LOW**

The implementations in `packages/catalog/src/index.ts` and `services/node-agent/src/repo.js` demonstrate high empirical resilience against invalid inputs, boundary conditions, malformed environment configurations, unreachable git remotes, and branch variance. All error paths throw graceful, diagnostic exceptions, and no sensitive credentials or tokens leak.

---

## Challenges

### [Low] Challenge 1: Catalog SDK Input Boundary & Malformed Env Handling
- **Assumption challenged**: The Catalog SDK helper `CatalogHelper` relies on valid user inputs and might crash with `TypeError` or make malformed HTTP calls (`/api/catalog/undefined`) when provided empty objects, whitespace-only keys, missing required envVars, or unrecognized extra variables.
- **Attack scenario**: 
  - Submitting `{}`
  - Submitting `{ templateSlug: '' }`
  - Submitting `{ slug: '' }`
  - Submitting `{ templateSlug: '', slug: '' }`
  - Calling `validateEnv` with `envVars: undefined` or `envVars: null`
  - Passing whitespace-only strings for required env vars (e.g. `POSTGRES_PASSWORD: "   \t\n "`)
  - Supplying extra unrecognized environment variables along with required keys
  - Supplying only `slug` vs only `templateSlug`
- **Blast radius**: If unhandled, client applications could send invalid requests to the backend or crash ungracefully in the browser/node runtime.
- **Empirical Findings**:
  - `input.templateSlug || input.slug` correctly identifies missing or empty slugs and throws `Error("Cannot deploy template: 'templateSlug' or 'slug' is required")`.
  - `(!val || !val.trim())` in `validateEnv` ensures that whitespace-only values are treated as missing keys.
  - `input.envVars ?? {}` prevents `TypeError: Cannot read properties of undefined`.
  - Extra unrecognized env vars pass through without validation failure and are forwarded to `client.catalog.deploy(input)`.
- **Mitigation / Status**: Robust and verified. 24/24 adversarial tests in `tests/unit/catalogSdkAdversarial.test.ts` pass cleanly.

---

### [Low] Challenge 2: Git Fetch Failure Error Diagnostic & Branch Variance Fallback
- **Assumption challenged**: In `services/node-agent/src/repo.js`, fetch failures must halt the deployment rather than silently rebuilding stale code, must match test assertion regex `/Could not fetch the latest code for branch "main"/`, must preserve low-level git diagnostics, and must handle branch variance (e.g., repository initialized with `master` instead of `main` or vice-versa).
- **Attack scenario**:
  - Existing `.git` workspace where remote becomes unreachable (deleted/network failure): primary branch `main` fails and fallback `master` fails.
  - Deployment targeting `main` where remote only has `master`.
  - Deployment targeting `master` where remote only has `main`.
  - Deployment targeting a non-standard custom branch (e.g. `release-2026`) when remote fails.
  - Unauthenticated remote failure with secret access token embedded in URL (`http://x-access-token:SECRET@...`).
- **Blast radius**: If the error format does not match `/Could not fetch the latest code for branch "main"/`, CI and deployment supervisor assertions fail. If diagnostics are swallowed, debugging failed builds becomes impossible. If tokens leak in error messages, credentials are compromised.
- **Empirical Findings**:
  - When `branch === 'main'` (or default), the error thrown is:  
    `Could not fetch the latest code for branch "main" or "master": <git diagnostic message>`  
    This strictly satisfies regex `/Could not fetch the latest code for branch "main"/` and includes the raw git error (`git fetch failed: fatal: ...`).
  - When target branch is `main` but remote only has `master`, the fallback fetch executes successfully, updates the workspace, and allows deployment to proceed without failure.
  - When target branch is `master` but remote only has `main`, the fallback fetch executes successfully and allows deployment to proceed.
  - Non-standard branch failures halt immediately with:  
    `Could not fetch the latest code for branch "<branch>", so the deploy was stopped instead of rebuilding old code. <git diagnostic message>`
  - Credentials in the URL are scrubbed and never appear in error strings or in `.git/config`.
- **Mitigation / Status**: Fully verified. 8/8 adversarial tests in `tests/unit/nodeAgentRepoAdversarial.test.ts` pass cleanly.

---

## Stress Test Results

| Suite / Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| `validateEnv(template, undefined)` | Returns `{ valid: false, missingKeys: ['POSTGRES_PASSWORD', 'POSTGRES_DB'] }` | Returned `{ valid: false, missingKeys: ['POSTGRES_PASSWORD', 'POSTGRES_DB'] }` | **PASS** |
| `validateEnv(template, {})` | Returns `{ valid: false, missingKeys: ['POSTGRES_PASSWORD', 'POSTGRES_DB'] }` | Returned `{ valid: false, missingKeys: ['POSTGRES_PASSWORD', 'POSTGRES_DB'] }` | **PASS** |
| `validateEnv(template, null)` | Coalesces null to `{}` without throwing TypeError | Coalesced null safely; returned `{ valid: false, ... }` | **PASS** |
| `validateEnv(template, { POSTGRES_PASSWORD: '   ' })` | Whitespace-only string treated as missing | Added to `missingKeys` | **PASS** |
| `validateEnv(template, { ..., UNRECOGNIZED_VAR: 'val' })` | Extra variables tolerated, valid: true | Returned `{ valid: true, missingKeys: [] }` | **PASS** |
| `deployTemplate({})` | Rejects with `"Cannot deploy template: 'templateSlug' or 'slug' is required"` | Rejected with exact message | **PASS** |
| `deployTemplate({ templateSlug: '' })` | Rejects with `"Cannot deploy template: 'templateSlug' or 'slug' is required"` | Rejected with exact message | **PASS** |
| `deployTemplate({ slug: '' })` | Rejects with `"Cannot deploy template: 'templateSlug' or 'slug' is required"` | Rejected with exact message | **PASS** |
| `deployTemplate({ templateSlug: '', slug: '' })` | Rejects with `"Cannot deploy template: 'templateSlug' or 'slug' is required"` | Rejected with exact message | **PASS** |
| `deployTemplate({ templateSlug: 'postgresql', envVars: undefined })` | Rejects with missing required env vars diagnostic | Rejected with `Cannot deploy template 'postgresql': Missing required environment variables: POSTGRES_PASSWORD, POSTGRES_DB` | **PASS** |
| `deployTemplate({ slug: 'redis' })` | Resolves slug fallback, invokes deploy client | Successfully deployed with `{ slug: 'redis' }` | **PASS** |
| `deployTemplate({ templateSlug: 'redis', envVars: { EXTRA: '1' } })` | Deploys cleanly with extra envVars forwarded | Successfully deployed with extra envVars intact | **PASS** |
| `repo.prepareWorkspace` unreachable `main` | Throws error matching `/Could not fetch the latest code for branch "main"/` and retains git stderr | Throws error matching regex; retains `git fetch failed: fatal: ...` | **PASS** |
| `repo.prepareWorkspace` unreachable `master` | Throws error containing `"master" or "main"` and retains git stderr | Throws error matching regex; retains `git fetch failed: fatal: ...` | **PASS** |
| `repo.prepareWorkspace` omitted branch | Defaults to `main`, throws matching `/Could not fetch the latest code for branch "main"/` | Throws error matching regex; retains git diagnostics | **PASS** |
| `repo.prepareWorkspace` custom branch fail | Throws `Could not fetch the latest code for branch "<branch>", so the deploy was stopped...` | Throws expected error; retains git diagnostics | **PASS** |
| `repo.prepareWorkspace` requested `main`, remote only `master` | Fallback fetch succeeds; workspace updated to latest commit | Successfully updated workspace; no error | **PASS** |
| `repo.prepareWorkspace` requested `master`, remote only `main` | Fallback fetch succeeds; workspace updated to latest commit | Successfully updated workspace; no error | **PASS** |
| `repo.prepareWorkspace` failed fetch with auth token | Error message and `.git/config` redacted of token and base64 string | Secret token completely absent from error and disk | **PASS** |

---

## Unchallenged Areas

- **Full Docker Container Execution in Node Agent**: Node agent container lifecycle commands (`docker.js`, `build.js`) require a running Docker daemon and are scheduled under Milestone 2 (M2) and Milestone 6 (M6). Milestone 1 scope is strictly limited to Git repo error handling, Catalog SDK types/validation, and auth/mailbox ACL baselines.

---

## Final Recommendation

Based on empirical test execution across 32 total adversarial challenge cases (24 SDK + 8 Repo), all boundary conditions and error cases behave reliably according to specification.

**Verdict: APPROVE**
