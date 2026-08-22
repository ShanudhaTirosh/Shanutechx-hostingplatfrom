/**
 * Integration test for the role-guard middleware itself. Unlike the pure
 * unit tests in tests/unit/, this spins up a real Express app using the
 * actual middleware functions and hits it with real HTTP requests — the
 * closest thing to "log in as dev, confirm tickets are blocked" that's
 * possible without a running Firebase Auth emulator + seeded database.
 *
 * NOTE: importing middleware/auth.ts transitively imports lib/prisma.ts
 * (requireAuth needs it for its own DB lookup), so this test requires a
 * real generated Prisma client to run — `prisma generate` must have
 * succeeded first, same requirement as running the actual API. It could
 * not be executed in the sandbox this was developed in (Prisma's engine
 * binary CDN is network-blocked there — see NEXT_STEPS.md); the
 * requireStaff/requireDev/requireAdminOrDev functions under test are pure
 * (no DB access themselves), so this is purely an import-time
 * environment requirement, not a flaw in the test or the guards.
 *
 * Run: npx tsx --test tests/integration/roleGuards.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import {
  requireStaff,
  requireDev,
  requireAdminOrDev,
  AuthedRequest,
} from '../../apps/api/src/middleware/auth';

type Role = 'customer' | 'admin' | 'support' | 'dev';

// A tiny stand-in for requireAuth that just trusts an `x-test-role` header
// instead of verifying a real Firebase token — the guards under test
// (requireStaff/requireDev/requireAdminOrDev) run identically regardless
// of how req.user got populated, so this isolates exactly the logic this
// test cares about.
function fakeAuth(req: AuthedRequest, _res: express.Response, next: express.NextFunction) {
  const role = req.headers['x-test-role'] as Role | undefined;
  if (role) {
    req.user = { id: 'u1', firebaseUid: 'fb1', email: 'test@example.com', role };
  }
  next();
}

let server: Server;
const PORT = 4325;
const BASE = `http://localhost:${PORT}`;

before(() => {
  const app = express();
  app.use(fakeAuth);
  app.get('/staff-only', requireStaff, (_req, res) => res.json({ ok: true }));
  app.get('/dev-only', requireDev, (_req, res) => res.json({ ok: true }));
  app.get('/admin-or-dev', requireAdminOrDev, (_req, res) => res.json({ ok: true }));
  server = app.listen(PORT);
});

after(() => {
  server.close();
});

async function requestAs(role: Role | null, path: string): Promise<number> {
  const headers: Record<string, string> = role ? { 'x-test-role': role } : {};
  const res = await fetch(`${BASE}${path}`, { headers });
  return res.status;
}

describe('requireStaff (tickets/chat)', () => {
  it('allows admin', async () => assert.equal(await requestAs('admin', '/staff-only'), 200));
  it('allows support', async () => assert.equal(await requestAs('support', '/staff-only'), 200));
  it('blocks dev', async () => assert.equal(await requestAs('dev', '/staff-only'), 403));
  it('blocks customer', async () => assert.equal(await requestAs('customer', '/staff-only'), 403));
});

describe('requireDev', () => {
  it('allows dev', async () => assert.equal(await requestAs('dev', '/dev-only'), 200));
  it('blocks admin (dev-only means dev-only)', async () =>
    assert.equal(await requestAs('admin', '/dev-only'), 403));
  it('blocks support', async () => assert.equal(await requestAs('support', '/dev-only'), 403));
});

describe('requireAdminOrDev (nodes/Leaseweb/managed-databases/templates/vps/livekit)', () => {
  it('allows admin', async () => assert.equal(await requestAs('admin', '/admin-or-dev'), 200));
  it('allows dev', async () => assert.equal(await requestAs('dev', '/admin-or-dev'), 200));
  it('blocks support (the exact bug class caught twice during this build: wrong role reaching infra)', async () =>
    assert.equal(await requestAs('support', '/admin-or-dev'), 403));
  it('blocks customer', async () => assert.equal(await requestAs('customer', '/admin-or-dev'), 403));
  it('blocks unauthenticated', async () => assert.equal(await requestAs(null, '/admin-or-dev'), 403));
});
