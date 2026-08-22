# Remaining Tasks from Audit

This document tracks the non-critical issues identified in the audit that should be implemented in future sprints.

---

## 🟡 High Priority (Next Sprint)

### #13: Password Reset Flow
**Severity:** Missing Feature  
**Impact:** Users who forget passwords have no self-service recovery  
**Effort:** 2 hours  

**Implementation:**
1. Add "Forgot password?" link to login page
2. Use Firebase's `sendPasswordResetEmail(auth, email)`
3. Add success/error toast notifications

**Files to modify:**
- `apps/dashboard/app/login/page.tsx`

---

### #9: Payment Review Queue History Tab
**Severity:** Missing Feature  
**Impact:** Admins can't see payment approval history  
**Effort:** 4 hours  

**Implementation:**
1. Add tabs to review queue page: "Pending" | "Approved" | "Rejected"
2. Filter payments by status
3. Add date range filter

**Files to modify:**
- `apps/dashboard/app/(protected)/admin/review-queue/page.tsx`
- `apps/api/src/routes/payments.ts` (add filters)

---

### #12: Webhook Test Button
**Severity:** Missing Feature  
**Impact:** Developers can't test webhooks without waiting for events  
**Effort:** 3 hours  

**Implementation:**
1. Add `POST /api/webhooks/:id/test` endpoint
2. Add "Test" button in developer page next to each webhook
3. Send sample payload and display result

**Files to modify:**
- `apps/api/src/routes/webhooks.ts`
- `apps/dashboard/app/(protected)/developer/page.tsx`

---

## 🟡 Medium Priority (Backlog)

### #8: Analytics Page Implementation
**Severity:** Missing Feature  
**Impact:** Data exists but UI may not render charts  
**Effort:** 6 hours  

**Action:** Verify if `apps/dashboard/app/(protected)/admin/analytics/page.tsx` properly renders charts. If placeholder, implement with chart library (recharts/visx).

---

### #11: Customer Notification System
**Severity:** Missing Feature  
**Impact:** Customers miss important updates (payment approved, deploy complete, etc.)  
**Effort:** 12 hours  

**Implementation:**
1. Create notification dropdown component
2. Add `GET /api/notifications` endpoint
3. Poll or use SSE for real-time updates
4. Mark as read functionality

**Files to create:**
- `apps/dashboard/components/NotificationBell.tsx`
- `apps/api/src/routes/notifications.ts` (already exists, needs integration)

---

### #16: Deployment Logs Mobile/Memory Fix
**Severity:** UX Bug  
**Impact:** Long builds crash browser on mobile  
**Effort:** 2 hours  

**Implementation:**
1. Add `max-height` and `overflow-y: auto` to log container
2. Limit log buffer to last 1000 lines
3. Add "Download full log" button

**Files to modify:**
- `apps/dashboard/app/(protected)/deployments/page.tsx`

---

## 🔵 Low Priority (Nice to Have)

### #18: Soft-Delete Services
**Severity:** Code Quality  
**Impact:** Deleting services with active subscribers causes FK errors  
**Effort:** 4 hours  

**Implementation:**
1. Add `isActive: boolean` to Service model
2. Change DELETE to UPDATE setting `isActive = false`
3. Filter inactive services from catalog

**Files to modify:**
- `packages/db/prisma/schema.prisma`
- `apps/api/src/routes/services.ts`

---

### #20: Catalog Disk Read Caching
**Severity:** Performance  
**Impact:** High load on catalog endpoint reads disk every request  
**Effort:** 2 hours  

**Implementation:**
```typescript
let catalogCache: { data: TemplateMeta[], expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedCatalog(): TemplateMeta[] {
  if (catalogCache && Date.now() < catalogCache.expiresAt) {
    return catalogCache.data;
  }
  const data = readCatalog();
  catalogCache = { data, expiresAt: Date.now() + CACHE_TTL };
  return data;
}
```

**Files to modify:**
- `apps/api/src/routes/catalog.ts`

---

### #21: Audit Log Search/Filter
**Severity:** Code Quality  
**Impact:** Large audit logs become unusable  
**Effort:** 4 hours  

**Implementation:**
1. Add search input for action/target
2. Add date range picker
3. Add pagination

**Files to modify:**
- `apps/dashboard/app/(protected)/admin/audit-log/page.tsx`
- `apps/api/src/routes/admin.ts`

---

### #22: Conditional Service Nav Items
**Severity:** UX  
**Impact:** Customers see nav items for services they don't have  
**Effort:** 3 hours  

**Implementation:**
1. Fetch user's active subscriptions on sidebar mount
2. Only show SMTP/LiveKit/VPS nav if user has active subscription
3. Cache in context to avoid repeated API calls

**Files to modify:**
- `apps/dashboard/components/Sidebar.tsx`

---

### #10: Web App Missing Pages
**Severity:** Marketing  
**Impact:** Incomplete public-facing site  
**Effort:** 8 hours  

**Implementation:**
1. Create `/contact` page with form
2. Create `/about` page with team info
3. Create `/features` comparison page
4. Link `/status` to API status endpoint

**Files to create:**
- `apps/web/app/contact/page.tsx`
- `apps/web/app/about/page.tsx`
- `apps/web/app/features/page.tsx`

---

### #15: Bootstrap Log Viewer
**Severity:** Missing Feature  
**Impact:** Admins can't debug node provisioning failures  
**Effort:** 3 hours  

**Implementation:**
1. Add "View Logs" button in nodes page
2. Fetch from `NodeBootstrapLog` table
3. Display in modal/side panel

**Files to modify:**
- `apps/dashboard/app/(protected)/admin/nodes/page.tsx`

---

## 📋 Sprint Planning Estimate

| Sprint | Tasks | Total Effort | Priority |
|--------|-------|--------------|----------|
| **Sprint 1** | #13, #9, #12 | 9 hours | High |
| **Sprint 2** | #8, #11, #16 | 20 hours | Medium |
| **Sprint 3** | #18, #20, #21, #22 | 13 hours | Low |
| **Sprint 4** | #10, #15 | 11 hours | Low |

**Total Remaining Work:** ~53 hours (6-7 days)

---

## ✅ Verification Checklist

After implementing each task, verify:

- [ ] TypeScript compilation passes
- [ ] No new console errors
- [ ] Feature works on mobile
- [ ] Added to documentation if user-facing
- [ ] Audit log created for admin actions
- [ ] Error handling with user-friendly messages

---

**Document Created:** 2026-07-23  
**Status:** Backlog Ready
