## 2026-10-28T14:15:54Z
You are the Implementation Worker (teamwork_worker) for Milestone 1: Core Platform Integrity & Test Baseline.
Your working directory is: c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_worker_m1_1\
Your parent conversation ID is: 3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEPS:
1. Read ORIGINAL_REQUEST.md at:
   c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read PROJECT.md at:
   c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\orchestrator\PROJECT.md
3. Read the three handoff reports from the Explorers:
   - c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_spec_miner_m1_1\handoff.md
   - c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_m1_2\handoff.md
   - c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_m1_3\handoff.md

EXCLUSIVE FILE WRITE OWNERSHIP:
You exclusively own and may modify:
- packages/catalog/src/index.ts
- apps/api/src/middleware/auth.ts
- apps/api/src/lib/mailboxAcl.ts
- services/node-agent/src/repo.js
- docs/complete-deployment.md
- docs/PRODUCTION_READY.md
- Delete components/supabase/BucketFileBrowser.tsx (and empty components/ directory)
DO NOT write to files owned by other modules.

TASKS TO IMPLEMENT:
1. Fix `packages/catalog/src/index.ts`:
   - Resolve TS2345: extract `const slug = input.templateSlug || input.slug; if (!slug) throw new Error(...)`.
   - In `validateEnv`, default `envVars: Record<string, string> = {}` and pass `input.envVars ?? {}` in `deployTemplate`.
   - Retain `Promise<Deployment>` return type.
2. Fix `apps/api/src/middleware/auth.ts:265`:
   - Change `requireDev` to strictly check `if (req.user?.role !== 'dev') return res.status(403).json({ error: 'Dev access required' });` so admin and customer are rejected with HTTP 403.
3. Fix `apps/api/src/lib/mailboxAcl.ts`:
   - Remove the blanket `if (userRole === 'admin')` from `getUserMailboxPermissions` and `canAccessMailbox` so assigned admins and legacy allowedAdminIds receive their explicit permissions.
4. Fix `services/node-agent/src/repo.js:161`:
   - Align git fetch error message to throw `Could not fetch the latest code for branch "${branch}" or "${altBranch}": ${fetchErr.message}`.
5. Create `docs/complete-deployment.md` and `docs/PRODUCTION_READY.md`:
   - Include complete, authentic production deployment architecture and installation guides referencing Node >= 22 (e.g. `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -`).
6. Remove orphan file `components/supabase/BucketFileBrowser.tsx`.

VERIFICATION REQUIREMENTS:
Run and report the exact results of:
1. `npm run type-check --workspace=packages/catalog`
2. `npm run build:sdk`
3. `npx tsx --test tests/unit/nodeVersion.test.ts`
4. `npx tsx --test tests/unit/mailboxAcl.test.ts`
5. `npx tsx --test tests/unit/nodeAgentRepoAuth.test.ts`
6. `npx tsx --test tests/integration/roleGuards.test.ts`
7. `npm run test:unit`
8. `npm run test:integration`

OUTPUT:
- Write report to `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_worker_m1_1\changes.md`
- Write formal handoff to `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_worker_m1_1\handoff.md`
- Send message back to parent (3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6).
