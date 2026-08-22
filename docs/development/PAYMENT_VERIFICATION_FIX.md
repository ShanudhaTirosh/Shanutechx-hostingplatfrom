# Payment Verification Fixes — SMS Deposit Support

**Date:** 2026-07-23  
**Status:** ✅ Completed  

---

## 🎯 Issues Fixed

### 1. Bank Deposits Without URL (SMS-Only Payments)
**Problem:** Bank sometimes sends SMS with only amount and time, but no proof image URL. The verification system would skip these payments because it required `proofUrl` to exist.

**Fix:** Updated `verifyPayment()` to handle three payment scenarios:
1. **Image proof uploads** — Extract using OCR (Groq/Gemini)
2. **SMS deposits with extracted data** — Use pre-extracted SMS data from `extractedJson`
3. **SMS deposits without data** — Log warning and notify admin for manual review

**Code Changes:**
```typescript
// Before: Required proofUrl
if (!payment || !payment.proofUrl) return;

// After: Handle SMS-only payments
if (!payment.proofUrl && payment.extractedJson) {
  // Use pre-extracted SMS data
  extracted = payment.extractedJson as any;
} else if (payment.proofUrl) {
  // Extract from image
  extracted = await extractPayment(payment.proofUrl, 'image/jpeg');
} else {
  // Cannot verify - notify admin
  logger.warn({ paymentId }, 'Payment has no proof data');
}
```

---

### 2. Manual Verification Timeout Changed
**Problem:** 15-minute timeout was too long for customers waiting for payment approval.

**Fix:** Reduced auto-verification fallback from 15 minutes to 8 minutes.

**Changes:**
- **Payment proof upload delay:** `15 * 60 * 1000` → `8 * 60 * 1000` ms
- **Admin notification message:** "15-min" → "8-min"
- **Customer notification message:** "15 minutes" → "8 minutes"
- **Function documentation:** Updated all references from 15 to 8 minutes

---

## 📋 How It Works Now

### Payment Flow Timeline

```
T+0s    Customer uploads proof OR bank sends SMS
        └─> Payment created with status: 'manual_review'
        └─> Admin notified immediately
        └─> 8-minute timer starts

T+8min  Auto-verification runs IF admin hasn't reviewed yet
        ├─> Image proof: Extract with OCR (Groq/Gemini)
        ├─> SMS deposit: Use pre-extracted data
        └─> No data: Keep in manual review queue
        
        Score payment confidence:
        ├─> ≥90%: Auto-approve (order marked 'paid')
        ├─> 60-89%: Keep in manual review queue
        └─> <60%: Keep in manual review queue (not rejected)
```

### SMS Deposit Handling

**Scenario 1: SMS with deposit URL**
```
Bank sends: "Rs. 1500.00 deposited. Ref: ABC123. View: https://..."
└─> proofUrl: https://...
└─> extractedJson: { amount: 150000, reference: "ABC123", source: "combank" }
└─> Auto-verification: Extract from URL image
```

**Scenario 2: SMS without deposit URL** (NOW SUPPORTED)
```
Bank sends: "Rs. 1500.00 deposited at 10:45 AM. Ref: ABC123"
└─> proofUrl: null
└─> extractedJson: { amount: 150000, reference: "ABC123", source: "combank" }
└─> Auto-verification: Use extractedJson directly
```

**Scenario 3: No data**
```
└─> proofUrl: null
└─> extractedJson: null
└─> Auto-verification: Skip, notify admin
```

---

## 🔍 Files Modified

### `apps/api/src/lib/verifyPayment.ts`
- Updated function documentation (15 → 8 minutes)
- Removed `!payment.proofUrl` check from entry condition
- Added SMS-only payment handling logic
- Updated all notification messages (15 → 8 minutes)
- Added detailed logging for different payment types

### `apps/api/src/routes/payments.ts`
- Changed delay from `15 * 60 * 1000` to `8 * 60 * 1000`
- Updated admin notification message
- Updated customer-facing response message

---

## ✅ Testing Checklist

### Manual Tests Required

#### Test 1: Image Proof Upload (Existing Flow)
- [ ] Customer uploads payment screenshot
- [ ] Verify payment created with `status: 'manual_review'`
- [ ] Admin notified with "8-min" message
- [ ] Wait 8 minutes (or manually trigger queue job)
- [ ] Verify auto-verification runs on image
- [ ] Check payment status updated based on confidence

#### Test 2: SMS Deposit Without URL (NEW)
- [ ] Simulate SMS webhook with amount/reference but no URL
- [ ] Verify payment created with `extractedJson` populated
- [ ] Verify `proofUrl` is null
- [ ] Wait 8 minutes or trigger queue
- [ ] Verify auto-verification uses `extractedJson` directly
- [ ] Check logs show "Using pre-extracted SMS data (no proof URL)"

#### Test 3: SMS Deposit With URL (Existing)
- [ ] Simulate SMS webhook with URL
- [ ] Verify payment created with both `proofUrl` and `extractedJson`
- [ ] Verify auto-verification extracts from URL image

#### Test 4: Admin Manual Review (Before 8 Minutes)
- [ ] Create payment proof
- [ ] Admin approves/rejects within 8 minutes
- [ ] Verify auto-verification skips with log: "Payment already processed by admin"

#### Test 5: Payment With No Data
- [ ] Create payment with null `proofUrl` and null `extractedJson`
- [ ] Verify auto-verification skips with warning log
- [ ] Verify admin notified: "Payment has no proof data for auto-verification"

---

## 🚀 Deployment Notes

### Environment Variables
No new environment variables required.

### Database Changes
No schema migrations required. Uses existing fields:
- `payment.proofUrl` (can be null)
- `payment.extractedJson` (can be null)
- `payment.status` (existing enum)

### Breaking Changes
None. This is backward-compatible:
- Image proofs work as before
- SMS deposits with URLs work as before
- SMS deposits without URLs now work (previously failed silently)

### Performance Impact
Minimal. Logic branches early for SMS-only payments, skipping expensive OCR calls.

---

## 📊 Expected Outcomes

### Before Fix
- ❌ SMS deposits without URL: Verification fails silently
- ⏰ Manual review timeout: 15 minutes
- 📉 Customer satisfaction: Waiting too long for approvals

### After Fix
- ✅ SMS deposits without URL: Auto-verification works
- ⏰ Manual review timeout: 8 minutes (47% faster)
- 📈 Customer satisfaction: Faster payment approvals
- 🔧 Admin workload: Reduced (fewer edge cases)

---

## 🔄 Rollback Plan

If issues detected after deployment:

### Quick Rollback
```bash
git revert HEAD
git push origin main
```

### Partial Rollback (Keep 8-minute timeout, revert SMS handling)
Edit `apps/api/src/lib/verifyPayment.ts`:
```typescript
// Revert to requiring proofUrl
if (!payment || !payment.proofUrl) return;
```

### Increase Timeout Back to 15 Minutes
Change all `8 * 60 * 1000` back to `15 * 60 * 1000`

---

## 📞 Monitoring

### Key Metrics to Watch

1. **Auto-verification success rate** (should increase)
2. **SMS deposit success rate** (should increase significantly)
3. **Average payment approval time** (should decrease from ~15min to ~8min)
4. **Manual review queue size** (should decrease)

### Alerts to Configure

- Alert if auto-verification error rate > 5%
- Alert if SMS deposits without URL fail
- Alert if payment queue grows beyond normal size

### Logs to Monitor

```
INFO: Using pre-extracted SMS data (no proof URL)
WARN: Payment has no proof data, cannot auto-verify
INFO: Payment already processed by admin, skipping 8-minute auto-verify fallback
```

---

## ✅ TypeScript Compilation

All changes pass TypeScript compilation:
- `apps/api/src/lib/verifyPayment.ts` ✅
- `apps/api/src/routes/payments.ts` ✅

---

**Fix Completed:** 2026-07-23  
**Ready for Deployment:** ✅  
**Estimated Impact:** High (improves customer experience + handles edge case)
