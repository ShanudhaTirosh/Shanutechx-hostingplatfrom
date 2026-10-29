# Technical Investigation & Fix Strategy: Auth Role Guards & Mailbox ACL

**Author**: Teamwork Explorer (teamwork_explorer_m1_2)  
**Date**: 2026-10-28  
**Scope**: Milestone 1 (M1) — Auth Role Guard (`requireDev`) & Mailbox ACL (`canAccessMailbox`)  
**Status**: Investigation Complete — Fix Strategy Defined

---

## Executive Summary

This investigation analyzed two critical security/access control defects identified in the Milestone 1 audit:
1. **Defect 1 (`requireDev` in `apps/api/src/middleware/auth.ts:260-269`)**: The `requireDev` middleware inadvertently allowed users with the `admin` role by checking `req.user?.role !== 'dev' && req.user?.role !== 'admin'`, causing `tests/integration/roleGuards.test.ts:79-80` to fail with HTTP 200 instead of HTTP 403.
2. **Defect 2 (`canAccessMailbox` & `getUserMailboxPermissions` in `apps/api/src/lib/mailboxAcl.ts:70-145`)**: Artificial blanket denial checks (`if (userRole === 'admin') return ...`) unconditionally blocked all admin users from accessing webmail or mailbox accounts, regardless of whether they were the mailbox owner, had explicit granular ACL permissions (e.g. read-only admin), or were listed in legacy `allowedAdminIds`. This caused two test failures in `tests/unit/mailboxAcl.test.ts:60-70` and `89-100`.

Both defects have been reproduced, root causes traced with line-by-line evidence, and precise, non-breaking fix strategies with diff patches are documented below.

---

## 1. Investigation of Issue 1: Auth Role Guard (`requireDev`)

### 1.1 Code Under Inspection
- **Source File**: `apps/api/src/middleware/auth.ts`, lines 252–270
- **Test File**: `tests/integration/roleGuards.test.ts`, lines 77–82

```typescript
// apps/api/src/middleware/auth.ts:252-270
/**
 * Restricts a route to dev role only — the infrastructure-focused
 * counterpart to admin. Dev sees nodes, Leaseweb management, managed
 * databases, and raw API logs; dev does NOT see customers, billing,
 * payment review, CMS, or staff management (that split matters — a dev
 * debugging a failed VPS import shouldn't incidentally have a path to
 * approve payments or read the customer directory).
 */
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

### 1.2 Test Failure Reproduction & Observation
Running `npx tsx --test tests/integration/roleGuards.test.ts` yields:
```text
# Subtest: requireDev
    # Subtest: allows dev
    ok 1 - allows dev
    # Subtest: blocks admin (dev-only means dev-only)
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

### 1.3 Logic Chain & Root Cause Analysis
1. **Logical Condition**: `if (req.user?.role !== 'dev' && req.user?.role !== 'admin')`.
   - When an authenticated request arrives with `req.user.role === 'admin'`:
     - `req.user?.role !== 'dev'` evaluates to `true`.
     - `req.user?.role !== 'admin'` evaluates to `false`.
     - `true && false` evaluates to `false`.
   - The conditional branch returning HTTP 403 is skipped.
   - `next()` is called, allowing the `admin` user into the dev-only route and returning HTTP 200.
2. **Intent & Design Contradiction**:
   - The JSDoc comment directly above the function states: *"Restricts a route to dev role only — the infrastructure-focused counterpart to admin... (that split matters — a dev debugging a failed VPS import shouldn't incidentally have a path to approve payments or read the customer directory)."*
   - Furthermore, a dedicated middleware `requireAdminOrDev` already exists at lines 280–289:
     ```typescript
     export function requireAdminOrDev(req: AuthedRequest, res: Response, next: NextFunction) {
       if (req.user?.role !== 'admin' && req.user?.role !== 'dev') {
         return res.status(403).json({ error: 'Admin or dev access required' });
       }
       next();
     }
     ```
   - In `requireDev`, the author accidentally duplicated the dual check from `requireAdminOrDev` and wrote `'Dev or Admin access required'`.
   - `requireDev` must strictly allow ONLY the `dev` role. Users with `role === 'admin'`, `role === 'support'`, `role === 'customer'`, or unauthenticated requests must be rejected with HTTP 403.

### 1.4 Proposed Fix for `requireDev`
Modify `apps/api/src/middleware/auth.ts:265-267` to:
```typescript
export function requireDev(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Dev access required' });
  }
  next();
}
```

#### Diff Patch:
```diff
--- a/apps/api/src/middleware/auth.ts
+++ b/apps/api/src/middleware/auth.ts
@@ -262,7 +262,7 @@
   res: Response,
   next: NextFunction
 ) {
-  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
-    return res.status(403).json({ error: 'Dev or Admin access required' });
+  if (req.user?.role !== 'dev') {
+    return res.status(403).json({ error: 'Dev access required' });
   }
   next();
 }
```

---

## 2. Investigation of Issue 2: Mailbox ACL (`canAccessMailbox`)

### 2.1 Code Under Inspection
- **Source File**: `apps/api/src/lib/mailboxAcl.ts`, lines 70–145
- **Test File**: `tests/unit/mailboxAcl.test.ts`, lines 59–70 and 89–100

```typescript
// apps/api/src/lib/mailboxAcl.ts:70-86
export function getUserMailboxPermissions(
  account: { userId: string; mailboxAcl?: unknown; allowedAdminIds?: string[] } | null | undefined,
  userId: string,
  userRole?: string
): Set<MailboxPermission> {
  if (!account || !userId) return new Set();

  // Admin role is strictly blocked from Webmail access
  if (userRole === 'admin') {
    return new Set();
  }

  // Dev superusers always possess full, unrestricted permissions across all mailboxes
  if (userRole === 'dev') {
    return new Set(['read', 'write', 'manage']);
  }
  ...
```

```typescript
// apps/api/src/lib/mailboxAcl.ts:110-125
export function canAccessMailbox(
  account: { userId: string; mailboxAcl?: unknown; allowedAdminIds?: string[] } | null | undefined,
  userId: string,
  userRole?: string,
  requiredPermission: MailboxPermission = 'read'
): { allowed: boolean; reason?: string; permissions: MailboxPermission[] } {
  if (userRole === 'admin') {
    return {
      allowed: false,
      reason: 'Access Denied: Admin users do not have access to Webmail.',
      permissions: [],
    };
  }

  const permissionsSet = getUserMailboxPermissions(account, userId, userRole);
  ...
```

### 2.2 Test Failure Reproduction & Observation
Running `npx tsx --test tests/unit/mailboxAcl.test.ts` yields:
```text
# Subtest: Mailbox ACL & Profile Management Suite
    ok 1 - Dev role possesses full superuser permissions across any mailbox
    ok 2 - Account owner has full read, write, and manage permissions on own mailbox
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
    ok 4 - Support user with read+write permissions can send emails but cannot manage settings
    ok 5 - Unassigned user is completely denied access
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

### 2.3 Logic Chain & Root Cause Analysis
1. **The Blanket Denial Blocks Legitimate Access**:
   - Lines 116–122 in `canAccessMailbox` intercept any user where `userRole === 'admin'` and immediately return:
     `{ allowed: false, reason: 'Access Denied: Admin users do not have access to Webmail.', permissions: [] }`.
   - Lines 78–80 in `getUserMailboxPermissions` intercept any user where `userRole === 'admin'` and return `new Set()`.
2. **Why this causes Failure 1 (`Read-only admin can read messages`)**:
   - In `dummyAccount`, a staff member `admin-read-only` has `role: 'admin'` and is granted `permissions: ['read']` in `mailboxAcl`.
   - `canAccessMailbox(dummyAccount, 'admin-read-only', 'admin', 'read')` is expected to return `{ allowed: true, permissions: ['read'] }`.
   - Because of lines 116–122, it instead returns `{ allowed: false, ... }`, failing assertion line 61 (`assert.equal(readCheck.allowed, true)`).
3. **Why this causes Failure 2 (`Legacy allowedAdminIds fallback grants read & write`)**:
   - In `legacyAcc`, `allowedAdminIds: ['legacy-staff']` is set while `mailboxAcl: null`.
   - For backwards compatibility with the pre-granular ACL schema, lines 100–102 of `getUserMailboxPermissions` provide:
     ```typescript
     if (Array.isArray(account.allowedAdminIds) && account.allowedAdminIds.includes(userId)) {
       return new Set(['read', 'write']);
     }
     ```
   - When calling `canAccessMailbox(legacyAcc, 'legacy-staff', 'admin', 'read')`, the user's role is `'admin'`.
   - Lines 116–122 and lines 78–80 short-circuit before lines 100–102 can ever be evaluated, returning `allowed: false` instead of `allowed: true`.
4. **Architectural & Security Misunderstanding**:
   - The developer who added `if (userRole === 'admin')` assumed admins should never view mailboxes.
   - However, the system's security model is **granular capability-based RBAC**:
     - Admins do **NOT** have automatic global access to customer mailboxes.
     - Unassigned admins (not the account owner, not in `mailboxAcl`, not in `allowedAdminIds`) receive `new Set()` from `getUserMailboxPermissions`.
     - Lines 131–137 of `canAccessMailbox` handle this safely:
       ```typescript
       if (permissionsSet.size === 0) {
         return {
           allowed: false,
           reason: 'Access denied: You do not have permission to access this mailbox. Please contact an administrator.',
           permissions: [],
         };
       }
       ```
     - Only when a dev superuser has explicitly granted granular access (e.g., `'read'` only for an admin auditor or support specialist) does that admin obtain permissions.
     - An admin with only `'read'` is strictly denied `'write'` or `'manage'` by lines 139–144:
       `reason: "Forbidden: Sending / Write permission is required for this mailbox. You currently have [read] access."`
   - Therefore, the blanket `if (userRole === 'admin')` checks in BOTH `getUserMailboxPermissions` (lines 78–80) and `canAccessMailbox` (lines 116–122) are erroneous and completely undermine the granular ACL design.

### 2.4 Proposed Fix for `mailboxAcl.ts`
1. Remove lines 77–80 in `getUserMailboxPermissions`:
   ```typescript
   // REMOVE:
   // // Admin role is strictly blocked from Webmail access
   // if (userRole === 'admin') {
   //   return new Set();
   // }
   ```
2. Remove lines 116–122 in `canAccessMailbox`:
   ```typescript
   // REMOVE:
   // if (userRole === 'admin') {
   //   return {
   //     allowed: false,
   //     reason: 'Access Denied: Admin users do not have access to Webmail.',
   //     permissions: [],
   //   };
   // }
   ```

#### Diff Patch:
```diff
--- a/apps/api/src/lib/mailboxAcl.ts
+++ b/apps/api/src/lib/mailboxAcl.ts
@@ -74,11 +74,6 @@
 ): Set<MailboxPermission> {
   if (!account || !userId) return new Set();
 
-  // Admin role is strictly blocked from Webmail access
-  if (userRole === 'admin') {
-    return new Set();
-  }
-
   // Dev superusers always possess full, unrestricted permissions across all mailboxes
   if (userRole === 'dev') {
     return new Set(['read', 'write', 'manage']);
@@ -113,14 +108,6 @@
   userRole?: string,
   requiredPermission: MailboxPermission = 'read'
 ): { allowed: boolean; reason?: string; permissions: MailboxPermission[] } {
-  if (userRole === 'admin') {
-    return {
-      allowed: false,
-      reason: 'Access Denied: Admin users do not have access to Webmail.',
-      permissions: [],
-    };
-  }
-
   const permissionsSet = getUserMailboxPermissions(account, userId, userRole);
   const permissionsList = Array.from(permissionsSet);
```

---

## 3. Impact Assessment & Invariant Verification

| Invariant / Requirement | Impact of Proposed Changes | Verified By |
|---|---|---|
| **Dev role strictness** | Dev-only endpoints (`/dev-only`, `/supabase/smtp/*`, `/smtp/global-config`) strictly block `admin`, `support`, and `customer` with 403. | `tests/integration/roleGuards.test.ts:77-82` |
| **Admin or Dev shared routes** | Routes using `requireAdminOrDev` (`/admin-or-dev`, `/managed-databases/*`, `/nodes/*`) remain accessible to both admin and dev, while blocking support and customer. | `tests/integration/roleGuards.test.ts:84-91` |
| **Superuser dev mailbox access** | Dev superusers retain unrestricted `['read', 'write', 'manage']` on any mailbox. | `tests/unit/mailboxAcl.test.ts:39-47` |
| **Mailbox owner rights** | Account owners retain full `['read', 'write', 'manage']` on their own mailboxes. | `tests/unit/mailboxAcl.test.ts:49-57` |
| **Granular admin ACL** | Admins granted `'read'` can read, but are rejected with 403 / Forbidden on `'write'` and `'manage'`. | `tests/unit/mailboxAcl.test.ts:59-70` |
| **Unassigned admin denial** | Admins not in `mailboxAcl` or `allowedAdminIds` receive `{ allowed: false, reason: 'Access denied: ...' }`. | `tests/unit/mailboxAcl.test.ts:83-87` |
| **Legacy admin backward compatibility** | Mailboxes with legacy `allowedAdminIds` grant `['read', 'write']` to designated admins. | `tests/unit/mailboxAcl.test.ts:89-100` |

---

## 4. Verification Method

Once the implementer applies the diff patches, the fixes can be verified by running:
1. `npx tsx --test tests/integration/roleGuards.test.ts`
   - Expected: 12 passing tests across 3 suites (0 failures).
2. `npx tsx --test tests/unit/mailboxAcl.test.ts`
   - Expected: 9 passing tests (0 failures).
