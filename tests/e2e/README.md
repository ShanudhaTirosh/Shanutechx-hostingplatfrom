# E2E Tests

Playwright test scaffolding for the critical signup → checkout → deploy
path. **These are not yet wired into CI** — two prerequisites are missing:

1. **A Firebase Auth emulator** — the signup/login step needs a real (or
   emulated) Firebase Auth instance to create test accounts against.
   `firebase emulators:start --only auth` is the standard way to run one
   locally; CI would need the `firebase-tools` CLI installed and the
   emulator started as a background service before the test run.
2. **A seeded test database** — the checkout step needs at least one
   `Service` row (ideally a `billingPeriod: one_time`, `price: 0` service
   so the test doesn't also need a working payment-proof flow) to exist
   before the test can add anything to a cart.

## Running locally (once the above exist)

```bash
npm install -D @playwright/test
npx playwright install chromium

# Terminal 1
npm run dev:api
# Terminal 2
npm run dev:dashboard
# Terminal 3
firebase emulators:start --only auth
# Terminal 4
npx playwright test --config=tests/e2e/playwright.config.ts
```

## What this test actually covers

Signup → add service to cart → checkout → (free-tier auto-activates) →
create a deployment → deployment reaches `running` status. This is
deliberately the happy path only — it does not yet cover payment-proof
upload (needs a real Gemini API key + a fixture image) or SMS payment
matching (needs the HMAC signing flow exercised end-to-end).
