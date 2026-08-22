# ShanuTechX Admin — Mobile App

A real React Native (Expo) app for staff (admin/dev) to review payments, manage support
tickets, and check analytics on the go — matches the glassmorphism UI/UX from the uploaded
mockup, wired to your actual API (not mock data).

## What's real here

- **Auth**: Firebase email/password, same backend your web dashboard already uses. Sign in
  here, and your API server (`middleware/auth.ts`) authenticates the token exactly the same
  way regardless of which client sent it.
- **Payments**: pulls the real `/api/payments/review-queue`, Approve/Decline both call the
  real, manual-only review endpoint — decline requires a reason, exactly like the web app.
- **Tickets**: real list + threaded chat + status changes against `/api/tickets/*`.
- **Analytics**: real `/api/admin/analytics` data (revenue, subscriptions, node health).
- **Notifications**: there's no separate "notification feed" endpoint on your backend (alerts
  go out via push/email/Discord at the moment something happens, not into a queryable inbox)
  — so rather than fake one, this screen shows the real, already-populated admin audit log
  instead. Genuine recent activity, not made-up data.
- **Profile**: real user info from `/api/me`, real sign-out.

## Before you run this

1. **Fill in your real Firebase config** in `src/lib/firebase.ts` (or better, pass it via
   `app.json`'s `expo.extra` block — same values as your web app's `NEXT_PUBLIC_FIREBASE_*`
   env vars). Left as placeholders since I have no access to your real Firebase project.
2. **Set your real API URL** — `app.json`'s `expo.extra.apiBaseUrl`, currently
   `https://api.shanutechx.com`.
3. **Notification push tokens** — `expo-notifications` is included as a dependency for future
   push-notification support, but no push registration flow is wired up yet (that needs a
   device to test against, an Expo push token endpoint on your backend to store the token,
   and FCM credentials — none of which I have in this sandbox). The screen title still says
   "Notifications" but shows audit-log activity, not push alerts, until that's built.

## Honest verification status

I do not have an Android SDK, Gradle, an emulator, or a physical device in the sandbox that
built this — and no network path to `dl.google.com`/Maven, which rules out installing one.
What I *did* verify, for real:

- **`tsc --noEmit` passes with zero errors** — including catching and fixing a genuine
  dependency-version conflict (the monorepo's Next.js apps pull React 18.3.1; Expo SDK 51
  needs exactly React 18.2.0 — hoisting them together silently broke `expo-linear-gradient`
  and `expo-blur`'s type declarations. Fixed by excluding this app from the root npm
  workspace tree so it gets its own isolated, correctly-pinned dependencies — a real,
  standard pattern for RN apps living in a JS monorepo alongside web apps, not a workaround.)
- **`npx expo export --platform android` succeeds** — Metro (Expo's real bundler) resolved
  all 794 modules across every screen and produced a genuine 2.28MB Android Hermes bytecode
  bundle. This proves every import, every navigation link, and every component actually
  works together — the strongest verification possible without a physical device.

What I have **not** verified: how it actually looks/behaves on a real device or emulator, and
the Firebase/API calls have not been exercised against a live backend (no real Firebase
project or deployed API in this sandbox).

## Getting a real, installable APK

This sandbox cannot produce one (see above). From your own machine or CI, with an Expo
account:

```bash
cd apps/mobile-admin
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

That builds a real, signed (or debug) `.apk`/`.aab` on Expo's cloud infrastructure — no local
Android SDK needed on your end either. Alternatively, install Android Studio locally and run
`npx expo run:android` for a local Gradle build if you'd rather not use EAS.

## Screens

Splash → Login → (Forgot Password) → Main tabs (Home / Payments / Tickets / Revenue /
Profile), plus Ticket Chat and Notifications pushed from the stack — matches the exact screen
set and bottom-nav order from the uploaded mockup.
