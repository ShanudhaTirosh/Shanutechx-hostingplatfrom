# ShanuTechX - Quick Deployment Checklist

**Last Updated:** December 24, 2024  
**Platform Status:** ✅ Production Ready

---

## ✅ Pre-Deployment Checklist

### 1. Environment Configuration

#### API Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10&connection_timeout=5
SECRETS_ENCRYPTION_KEY=<64-char-hex-string>  # Generate with: openssl rand -hex 32
FIREBASE_SERVICE_ACCOUNT=<base64-encoded-json>

# Payment Processing
AUTO_VERIFY_DELAY_MS=86400000  # 24 hours (recommended)
GRACE_PERIOD_DAYS=7            # 7 days grace period (recommended)

# External Services
REDIS_URL=redis://host:6379
LEASEWEB_API_KEY=<your-api-key>
WILDDUCK_API_URL=<your-wildduck-url>
WILDDUCK_API_KEY=<your-wildduck-key>
WILDDUCK_FROM_ADDRESS=noreply@yourdomain.com

# Optional
NODE_ENV=production
PORT=4000
```

#### Dashboard Environment Variables
```bash
# Firebase Client Config (safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=<your-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-project-id>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>

# API Endpoint
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

---

### 2. Update CSRF Allowed Origins

**File:** `apps/api/src/middleware/csrfProtection.ts`

Replace placeholder domains with your production URLs:

```typescript
const ALLOWED_ORIGINS = [
  // ⚠️ UPDATE THESE BEFORE DEPLOYING
  'https://app.yourdomain.com',       // Your production dashboard
  'https://yourdomain.com',           // Your marketing site
  'https://www.yourdomain.com',       // WWW variant
  
  // Keep for local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];
```

---

### 3. Database Setup

```bash
# Run migrations
cd packages/db
npx prisma migrate deploy

# Verify schema
npx prisma db pull
```

---

### 4. Build & Test

```bash
# API Build
cd apps/api
npm run build
npm run start  # Test production build

# Dashboard Build
cd apps/dashboard
npm run build
npm run start  # Test production build

# Verify no TypeScript errors
✓ API: 0 errors
✓ Dashboard: 0 errors, 35 routes built
```

---

### 5. Security Verification

- [ ] `SECRETS_ENCRYPTION_KEY` is 64-character hex string (32 bytes)
- [ ] Firebase service account credentials are properly base64-encoded
- [ ] CSRF allowed origins updated with production domains
- [ ] No API keys or secrets in dashboard `.env` with `NEXT_PUBLIC_` prefix
- [ ] Database connection string includes pooling parameters
- [ ] Redis URL configured and accessible

---

### 6. Feature Testing

#### Critical Flows to Test:

**Authentication:**
```bash
✓ User registration
✓ User login
✓ Password reset (self-service)
✓ Role-based access control (customer/admin/dev)
```

**Orders & Payments:**
```bash
✓ Add item to cart
✓ Mixed-currency cart (should show clear cart option)
✓ Checkout (creates order with awaiting_payment status)
✓ Free order checkout (creates invoice with pdfUrl=null)
✓ Upload payment proof (schedules auto-verification)
✓ Admin payment review
```

**Deployments:**
```bash
✓ Deploy from template
✓ Deploy from Git repo
✓ Branch name validation (reject invalid characters)
✓ Preview deployment creation
✓ Deployment logs (mobile-friendly, 1000 line limit)
✓ Custom domain attachment
```

**Security:**
```bash
✓ CSRF protection (reject cross-origin POST requests)
✓ Rate limiting (60 calls/minute on webhooks)
✓ Error message sanitization (no Prisma errors exposed)
```

---

## 🚀 Deployment Steps

### 1. Deploy Database

```bash
# Run on production database
cd packages/db
DATABASE_URL=<production-url> npx prisma migrate deploy
```

### 2. Deploy API

```bash
cd apps/api
npm run build

# Start with process manager (PM2 recommended)
pm2 start dist/index.js --name shanutechx-api

# Or with Docker
docker build -t shanutechx-api .
docker run -d -p 4000:4000 --env-file .env shanutechx-api
```

### 3. Deploy Dashboard

```bash
cd apps/dashboard
npm run build

# Start with PM2
pm2 start npm --name shanutechx-dashboard -- start

# Or with Docker
docker build -t shanutechx-dashboard .
docker run -d -p 3000:3000 --env-file .env shanutechx-dashboard
```

### 4. Deploy Workers

```bash
cd apps/api
npm run worker  # Payment verification queue worker

# Or with PM2
pm2 start dist/worker.js --name shanutechx-worker
```

---

## 📊 Post-Deployment Monitoring

### Immediate (First 24 Hours)

Monitor for:
- [ ] Authentication failures
- [ ] Payment processing errors
- [ ] Deployment failures
- [ ] API error rates
- [ ] Redis connection issues
- [ ] Database query performance

### First Week

Monitor for:
- [ ] Webhook delivery success rates
- [ ] Cart currency conflicts (user feedback)
- [ ] Mobile usability issues
- [ ] Performance bottlenecks
- [ ] Support ticket patterns

---

## ⚠️ Known Limitations (Non-Blocking)

### Optional Enhancements Available

These are documented for future implementation but **do not block production:**

1. **Node Health Monitoring** - Nodes selected first-come vs load-based (6h to implement)
2. **Mobile Sidebar** - Fixed width on mobile vs collapsible (3h to implement)
3. **TypeScript Strict Mode** - Not enabled, but no critical type issues found (6h to implement)

See `SPRINT_5_LOW_PRIORITY_COMPLETE.md` for full list (15 items, 31h estimated).

---

## 🔧 Configuration Reference

### Business Logic Tuning

Adjust based on your risk tolerance:

#### Payment Auto-Approval
```bash
# Conservative (default): 24 hours
AUTO_VERIFY_DELAY_MS=86400000

# Moderate: 6 hours
AUTO_VERIFY_DELAY_MS=21600000

# Aggressive: 1 hour (not recommended)
AUTO_VERIFY_DELAY_MS=3600000
```

#### Subscription Grace Period
```bash
# Aggressive: 3 days
GRACE_PERIOD_DAYS=3

# Default: 7 days
GRACE_PERIOD_DAYS=7

# Lenient: 14 days
GRACE_PERIOD_DAYS=14

# Enterprise: 30 days
GRACE_PERIOD_DAYS=30
```

---

## 🆘 Troubleshooting

### API Won't Start

**Error:** "SECRETS_ENCRYPTION_KEY is not configured"
```bash
# Generate new key
openssl rand -hex 32

# Set in .env
SECRETS_ENCRYPTION_KEY=<generated-key>
```

**Error:** "Redis connection refused"
```bash
# Verify Redis is running
redis-cli ping

# Check REDIS_URL format
REDIS_URL=redis://localhost:6379
```

### Dashboard Build Fails

**Error:** "NEXT_PUBLIC_FIREBASE_API_KEY not found"
```bash
# Verify all NEXT_PUBLIC_ variables are set
grep NEXT_PUBLIC_ .env

# Required variables:
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_API_BASE_URL=...
```

### CSRF Protection Blocking Requests

**Error:** "Request origin not allowed"
```bash
# Add your domain to ALLOWED_ORIGINS
# File: apps/api/src/middleware/csrfProtection.ts

const ALLOWED_ORIGINS = [
  'https://your-actual-domain.com',  # Add this
  // ...
];
```

---

## 📞 Support & Documentation

### Full Documentation

- `COMPREHENSIVE_AUDIT_REPORT.md` - All 35 issues identified
- `SPRINT_2_PROGRESS.md` - Medium-priority fixes
- `SPRINT_3_COMPLETE.md` - High-priority completion
- `SPRINT_4_COMPLETE.md` - Security & UX polish
- `SPRINT_5_LOW_PRIORITY_COMPLETE.md` - Optional enhancements
- `AUDIT_COMPLETION_SUMMARY.md` - Executive summary

### Key Files to Review

**Security:**
- `apps/api/src/middleware/csrfProtection.ts` - CSRF protection
- `apps/api/src/middleware/rateLimit.ts` - Rate limiting
- `apps/api/src/lib/secretsVault.ts` - Secrets encryption

**Business Logic:**
- `apps/api/src/lib/billingRules.ts` - Subscription lifecycle
- `apps/api/src/lib/verifyPayment.ts` - Payment verification
- `apps/api/src/routes/orders.ts` - Cart and checkout

---

## ✅ Final Checklist

Before going live:

- [ ] All environment variables configured
- [ ] CSRF allowed origins updated
- [ ] Database migrations deployed
- [ ] API builds without errors
- [ ] Dashboard builds without errors
- [ ] Critical flows tested in staging
- [ ] Security verification complete
- [ ] Monitoring configured
- [ ] Backup strategy in place

---

**Status:** ✅ READY FOR PRODUCTION  
**All Critical & High & Medium-Priority Issues:** RESOLVED  
**Low-Priority Enhancements:** DOCUMENTED FOR FUTURE  

**Good luck with your launch! 🚀**
