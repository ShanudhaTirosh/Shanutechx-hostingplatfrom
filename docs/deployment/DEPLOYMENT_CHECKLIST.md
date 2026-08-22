# Deployment Checklist — Audit Fixes

Use this checklist before deploying the audit fixes to production.

---

## 📋 Pre-Deployment

### Environment Variables
- [ ] Verify `GROQ_API_KEY` is set in production `.env`
- [ ] Verify `GROQ_API_KEY` has sufficient credits/quota
- [ ] Test Groq API connection manually:
  ```bash
  curl https://api.groq.com/openai/v1/chat/completions \
    -H "Authorization: Bearer $GROQ_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model": "meta-llama/llama-4-scout-17b-16e-instruct", "messages": [{"role": "user", "content": "test"}]}'
  ```

### Database
- [ ] No schema changes required (these are code-only fixes)
- [ ] Verify `AuditLog` table has space for new entries (fs.write, fs.delete)

### Build & Tests
- [ ] Run TypeScript compilation: `npm run build`
- [ ] Run linter: `npm run lint`
- [ ] Manual smoke tests (see below)

---

## 🧪 Smoke Tests (Staging)

### Critical Bug Fixes

#### 1. Payment Proof OCR (GROQ_API_KEY)
- [ ] Upload a payment proof image
- [ ] Verify OCR extraction works (check logs for Groq API calls)
- [ ] Verify payment status updates correctly
- [ ] **Expected:** No "groqApiKey does not exist" errors

#### 2. Catalog Customer Deploy (Auto Node Select)
- [ ] Log in as customer (not admin)
- [ ] Deploy a template from catalog without selecting a node
- [ ] Verify deployment succeeds and picks an active node
- [ ] **Expected:** Deployment creates successfully, no 404 errors

#### 3. Project CRUD Ownership Check
- [ ] Create project as Customer A
- [ ] Log in as Customer B
- [ ] Try to POST/PATCH/DELETE rows in Customer A's project
- [ ] **Expected:** 404 Not Found for Customer B, success for Customer A

#### 4. Catalog Routes (/catalog/nodes vs /:slug)
- [ ] As admin, navigate to `/api/catalog/nodes`
- [ ] Verify it returns node list, not "Template 'nodes' not found"
- [ ] Navigate to `/api/catalog/wordpress` (real template)
- [ ] **Expected:** Both routes work correctly

#### 5. Filesystem Audit Logs
- [ ] As admin, use file manager to write a file
- [ ] As admin, use file manager to delete a file
- [ ] Check Admin → Audit Log page
- [ ] **Expected:** See `fs.write` and `fs.delete` entries

### Security Fixes

#### 6. Support Role Sidebar
- [ ] Log in as support role user
- [ ] Verify sidebar shows only "Support" section (Tickets, Chat)
- [ ] Verify sidebar does NOT show customer sections (Cart, Orders, Deployments, etc.)
- [ ] **Expected:** Support sees limited nav only

#### 7. Project Password Exposure
- [ ] Navigate to Projects list (`GET /projects`)
- [ ] Inspect network response
- [ ] **Expected:** `dbPassword` field is NOT in the list response
- [ ] Navigate to single project (`GET /projects/:id`)
- [ ] **Expected:** `dbPassword` field IS present (for reveal functionality)

---

## 🚀 Deployment Steps

### 1. Git Workflow
```bash
# Create feature branch
git checkout -b fix/audit-critical-issues

# Commit changes
git add apps/api/src/env.ts
git add apps/api/src/routes/catalog.ts
git add apps/api/src/routes/projects.ts
git add apps/api/src/routes/filesystem.ts
git add apps/api/src/routes/analytics.ts
git add apps/dashboard/lib/types.ts
git add apps/dashboard/components/Sidebar.tsx
git commit -m "fix: resolve critical audit issues

- Make GROQ_API_KEY required for payment OCR
- Fix catalog customer deploy with auto node selection
- Add ownership checks to project CRUD endpoints
- Add audit logs for filesystem write/delete
- Fix /catalog/nodes route shadowing
- Restrict support role sidebar navigation
- Remove password from project list endpoint"

# Push and create PR
git push origin fix/audit-critical-issues
```

### 2. CI/CD Pipeline
- [ ] Wait for CI checks to pass (build, lint, tests)
- [ ] Request code review
- [ ] Merge to main branch

### 3. Production Deployment
- [ ] Deploy API: `cd apps/api && npm run deploy` (or your CD process)
- [ ] Deploy Dashboard: `cd apps/dashboard && npm run deploy`
- [ ] Monitor logs for first 10 minutes after deploy
- [ ] Check error tracking (Sentry/etc.) for new errors

### 4. Post-Deploy Verification
- [ ] Run smoke tests on production (use test account)
- [ ] Verify GROQ API key is working (check payment proofs)
- [ ] Monitor audit log for fs.write/fs.delete entries
- [ ] Check customer deployments from catalog

---

## 📊 Rollback Plan

If critical issues are discovered after deployment:

### Quick Rollback (5 minutes)
```bash
# Revert to previous stable commit
git revert HEAD
git push origin main

# Or rollback container/deployment
kubectl rollout undo deployment/api
kubectl rollout undo deployment/dashboard
```

### Partial Rollback (Individual Fixes)

If only one fix causes issues, revert specific changes:

```bash
# Example: Revert GROQ_API_KEY requirement
git revert <commit-hash> --no-commit
# Edit apps/api/src/env.ts to make GROQ_API_KEY optional again
git commit -m "hotfix: make GROQ_API_KEY optional temporarily"
```

---

## 🔍 Monitoring

### Key Metrics to Watch (First 24 Hours)

- **Payment Proof Success Rate:** Should increase (OCR now works)
- **Catalog Deploy Success Rate:** Should increase (auto node selection)
- **401/403 Errors:** Should not increase (verify ownership checks work)
- **Audit Log Growth:** Should include new fs.write/fs.delete entries

### Alerts to Configure

- Alert if GROQ_API_KEY quota exhausted
- Alert if catalog deploy failure rate > 10%
- Alert if audit log write failures occur
- Alert if 403 errors spike (indicates ownership check issues)

---

## 📞 Incident Response

If issues are detected:

1. **Triage** (5 min): Identify affected feature
2. **Assess Impact** (5 min): How many users affected?
3. **Decide** (5 min): Rollback or hotfix?
4. **Execute** (10-30 min): Deploy fix or rollback
5. **Verify** (10 min): Confirm issue resolved
6. **Postmortem** (24 hours): Document root cause

---

## ✅ Deployment Complete

After successful deployment:

- [ ] Update `AUDIT_FIXES_COMPLETE.md` with deployment date
- [ ] Close audit tracking ticket/issue
- [ ] Notify team in Slack/Discord
- [ ] Schedule review of remaining backlog items
- [ ] Update internal docs with any new behaviors

---

**Checklist Created:** 2026-07-23  
**Target Deployment Date:** TBD  
**Estimated Downtime:** 0 minutes (rolling deployment)
