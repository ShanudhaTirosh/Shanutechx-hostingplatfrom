# Handoff Report: Auth Role Guard (`requireDev`) & Mailbox ACL (`canAccessMailbox`)

**Agent**: `teamwork_explorer_m1_2` (teamwork_explorer)  
**Parent Conversation ID**: `3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6`  
**Working Directory**: `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_explorer_m1_2\`  
**Target Milestone**: Milestone 1 (M1) — Core Platform Integrity & Test Baseline  
**Handoff Type**: Hard Handoff (Investigation & Strategy Complete)

---

## 1. Observation

### 1.1 Issue 1: `requireDev` Middleware Inadvertently Allows Admin Role
- **Direct File Observation**: `apps/api/src/middleware/auth.ts:260-270`
  ```typescript
  export function requireDev(
    req: AuthedRequest,
    res: Response,
    next: NextFunction
  ) {
    if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Dev or Admin access required' });
    }
    next();
  }
  ```
- **Test Command**: `npx tsx --test tests/integration/roleGuards.test.ts`
- **Verbatim Error**:
  ```text
  # Subtest: requireDev
      ok 1 - allows dev
      not ok 2 - blocks admin (dev-only means dev-only)
        ---
        duration_ms: 10.9391
        type: 'test'
        location: 'C:\Users\tiros\OneDrive\Desktop\shanutechx\tests\integration\roleGuards.test.ts:80:12'
        failureType: 'testCodeFailure'
        error: |-
          Expected values to be strictly equal:
          200 !== 403
        code: 'ERR_ASSERTION'
        name: 'AssertionError'
        expected: 403
        actual: 200
  ```
- **Observation Details**:
  In `roleGuards.test.ts:77-82`, the test makes an HTTP request with header `x-test-role: admin` to route `/dev-only` guarded by `requireDev`. Because the condition `req.user?.role !== 'dev' && req.user?.role !== 'admin'` evaluates to `false` when `req.user.role === 'admin'`, the middleware calls `next()`. The server responds with status code `200` instead of `403`.

### 1.2 Issue 2: Mailbox ACL Blanket Admin Denial Overrides Granular Permissions
- **Direct File Observation**: `apps/api/src/lib/mailboxAcl.ts:70-86` and `110-125`
  In `getUserMailboxPermissions` (lines 77–80):
  ```typescript
  // Admin role is strictly blocked from Webmail access
  if (userRole === 'admin') {
    return new Set();
  }
  ```
  In `canAccessMailbox` (lines 116–122):
  ```typescript
  if (userRole === 'admin') {
    return {
      allowed: false,
      reason: 'Access Denied: Admin users do not have access to Webmail.',
      permissions: [],
    };
  }
  ```
- **Test Command**: `npx tsx --test tests/unit/mailboxAcl.test.ts`
- **Verbatim Error**:
  ```text
  # Subtest: Read-only admin can read messages but is strictly denied write/sending permission
  not ok 3 - Read-only admin can read messages but is strictly denied write/sending permission
    ---
    duration_ms: 5.4832
    type: 'test'
    location: 'C:\Users\tiros\OneDrive\Desktop\shanutechx\tests\unit\mailboxAcl.test.ts:61:12'
    failureType: 'testCodeFailure'
    error: |-
      Expected values to be strictly equal:
      false !== true
    code: 'ERR_ASSERTION'
    name: 'AssertionError'
    expected: true
    actual: false
  
  # Subtest: Legacy allowedAdminIds fallback grants read & write when no ACL is specified
  not ok 6 - Legacy allowedAdminIds fallback grants read & write when no ACL is specified
    ---
    duration_ms: 0.5921
    type: 'test'
    location: 'C:\Users\tiros\OneDrive\Desktop\shanutechx\tests\unit\mailboxAcl.test.ts:96:12'
    failureType: 'testCodeFailure'
    error: |-
      Expected values to be strictly equal:
      false !== true
    code: 'ERR_ASSERTION'
    name: 'AssertionError'
    expected: true
    actual: false
  ```
- **Observation Details**:
  In `tests/unit/mailboxAcl.test.ts:60-61`, user `admin-read-only` has `role: 'admin'` and granular ACL `permissions: ['read']`. When calling `canAccessMailbox(dummyAccount, 'admin-read-only', 'admin', 'read')`, lines 116–122 immediately return `allowed: false` with reason `"Access Denied: Admin users do not have access to Webmail."` before ever checking the ACL entry.
  In line 95–96, user `legacy-staff` has `role: 'admin'` and is listed in `allowedAdminIds`. Calling `canAccessMailbox(legacyAcc, 'legacy-staff', 'admin', 'read')` similarly fails because lines 116–122 short-circuit the legacy fallback in `getUserMailboxPermissions:100-102`.

---

## 2. Logic Chain

### 2.1 Logic Chain for Issue 1 (`requireDev`)
1. **Observation**: `apps/api/src/middleware/auth.ts:265` checks `req.user?.role !== 'dev' && req.user?.role !== 'admin'`.
2. **Observation**: JSDoc at `apps/api/src/middleware/auth.ts:252-258` defines that dev role is dedicated to infrastructure (nodes, databases, raw logs) and must NOT cross into business surfaces, while admin handles billing and customer review.
3. **Observation**: `requireAdminOrDev` is already implemented at lines 280–289 for shared surfaces.
4. **Observation**: `tests/integration/roleGuards.test.ts:79-80` explicitly asserts that `requireDev` blocks `admin` with HTTP 403: `"blocks admin (dev-only means dev-only)"`.
5. **Inference**: `requireDev` was intended to restrict routes to `role === 'dev'` exclusively.
6. **Conclusion**: Changing `apps/api/src/middleware/auth.ts:265-267` to:
   ```typescript
   if (req.user?.role !== 'dev') {
     return res.status(403).json({ error: 'Dev access required' });
   }
   ```
   strictly enforces that only dev passes, while admin, support, customer, and unauthenticated requests are blocked with HTTP 403.

### 2.2 Logic Chain for Issue 2 (`mailboxAcl.ts`)
1. **Observation**: `apps/api/src/lib/mailboxAcl.ts:5-6` documents that the file provides granular permissions (`'read'`, `'write'`, `'manage'`) for mailboxes granted to admin and support staff.
2. **Observation**: `MailboxAclEntry` (line 15) and `updateMailboxAcl` (line 156) explicitly allow `role: 'admin' | 'support'`.
3. **Observation**: Lines 78–80 in `getUserMailboxPermissions` and lines 116–122 in `canAccessMailbox` intercept any user with `userRole === 'admin'` and unconditionally return an empty permissions set or `{ allowed: false }`.
4. **Observation**: This early return prevents execution from reaching:
   - Line 88 (`account.userId === userId` - mailbox owner check)
   - Line 93 (`acl.find((item) => item.userId === userId)` - granular ACL check)
   - Line 100 (`account.allowedAdminIds.includes(userId)` - backward compatibility check)
5. **Inference**: Removing the blanket `if (userRole === 'admin')` from both functions restores the intended capability-based access model:
   - An unassigned admin (not the owner, not in `mailboxAcl`, not in `allowedAdminIds`) receives `new Set()`, which triggers lines 131–137 returning `{ allowed: false, reason: 'Access denied: You do not have permission to access this mailbox...' }`.
   - An assigned admin with `'read'` permission receives `allowed: true` on `'read'`, but is rejected with `{ allowed: false, reason: 'Forbidden: Sending / Write permission is required...' }` on `'write'`.
   - A legacy admin in `allowedAdminIds` receives `['read', 'write']` permissions.
6. **Conclusion**: Deleting lines 77–80 and lines 116–122 completely resolves the two test failures while strengthening security through least-privilege capability enforcement.

---

## 3. Caveats

- **No Caveats / Assumptions**:
  - `requireDev` change is fully covered by existing integration tests (`tests/integration/roleGuards.test.ts`).
  - No application routes are negatively affected: routes requiring both admin and dev already use `requireAdminOrDev`. Routes using `requireDev` (such as Supabase developer platform SMTP config and global SMTP settings) are explicitly developer-user features.
  - Removing the blanket `userRole === 'admin'` denial in `mailboxAcl.ts` does NOT grant admins blanket access; admins remain strictly denied unless explicitly assigned in the mailbox's ACL or `allowedAdminIds`.

---

## 4. Conclusion & Actionable Fix Strategy

### 4.1 Fix 1: `apps/api/src/middleware/auth.ts`
Replace lines 265–267 in `apps/api/src/middleware/auth.ts`:
```typescript
<<<<
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Dev or Admin access required' });
  }
====
  if (req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Dev access required' });
  }
>>>>
```

### 4.2 Fix 2: `apps/api/src/lib/mailboxAcl.ts`
1. Remove lines 77–80 in `getUserMailboxPermissions`:
   ```typescript
   <<<<
     // Admin role is strictly blocked from Webmail access
     if (userRole === 'admin') {
       return new Set();
     }
   ====
   >>>>
   ```
2. Remove lines 116–122 in `canAccessMailbox`:
   ```typescript
   <<<<
     if (userRole === 'admin') {
       return {
         allowed: false,
         reason: 'Access Denied: Admin users do not have access to Webmail.',
         permissions: [],
       };
     }
   ====
   >>>>
   ```

---

## 5. Verification Method

To independently verify the fixes:
1. **Integration Test**:
   ```bash
   npx tsx --test tests/integration/roleGuards.test.ts
   ```
   **Pass Condition**: 12/12 tests pass across 3 suites. Specifically, `requireDev -> blocks admin (dev-only means dev-only)` must return status `403` and pass.
2. **Unit Test**:
   ```bash
   npx tsx --test tests/unit/mailboxAcl.test.ts
   ```
   **Pass Condition**: 9/9 tests pass (0 failures). Specifically:
   - `Read-only admin can read messages but is strictly denied write/sending permission` passes.
   - `Legacy allowedAdminIds fallback grants read & write when no ACL is specified` passes.
3. **Full Integration Suite**:
   ```bash
   npx tsx --test tests/integration/*.test.ts
   ```
   **Pass Condition**: All integration test suites pass (exit code 0).
