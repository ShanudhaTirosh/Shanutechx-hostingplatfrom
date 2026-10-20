import test from 'node:test';
import assert from 'node:assert/strict';
import express, { Router } from 'express';
import { useForOwnRoutes } from '../../apps/api/src/lib/routerGuard';

const requireToken = (req: any, res: any, next: any) =>
  req.headers.authorization === 'Bearer ok' ? next() : res.status(401).json({ error: 'unauthorized' });

async function start() {
  // Mirrors index.ts: every router mounted at the same prefix, auth-gated router FIRST.
  const gated = Router();
  gated.get('/open', (_req, res) => res.json({ ok: 'public-before-guard' }));
  useForOwnRoutes(gated, requireToken);
  gated.get('/secret', (_req, res) => res.json({ ok: 'secret' }));
  gated.post('/items/:id', (req, res) => res.json({ id: req.params.id }));

  const later = Router();
  later.get('/public', (_req, res) => res.json({ ok: 'later-public' }));
  later.post('/webhook', (_req, res) => res.json({ ok: 'webhook' }));

  const app = express();
  app.use('/api', gated);
  app.use('/api', later);
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  const call = (method: string, path: string, headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}/api${path}`, { method, headers });
  return { call, close: () => srv.close() };
}

test('routes of routers mounted AFTER a gated router stay reachable without a token', async () => {
  const { call, close } = await start();
  try {
    assert.equal((await call('GET', '/public')).status, 200);
    assert.equal((await call('POST', '/webhook')).status, 200);
  } finally { close(); }
});

test("the gated router's own routes still require auth", async () => {
  const { call, close } = await start();
  try {
    assert.equal((await call('GET', '/secret')).status, 401);
    assert.equal((await call('POST', '/items/7')).status, 401);
    assert.equal((await call('GET', '/secret', { authorization: 'Bearer ok' })).status, 200);
    const r = await call('POST', '/items/7', { authorization: 'Bearer ok' });
    assert.deepEqual(await r.json(), { id: '7' });
  } finally { close(); }
});

test('HEAD on a GET route is guarded too, and unknown paths fall through to 404 (not 401)', async () => {
  const { call, close } = await start();
  try {
    assert.equal((await call('HEAD', '/secret')).status, 401);
    assert.equal((await call('GET', '/nope')).status, 404);
  } finally { close(); }
});

test('async middleware rejections become an error response instead of a hung request', async () => {
  const r = Router();
  useForOwnRoutes(r, async () => { throw new Error('boom'); });
  r.get('/x', (_q, s) => s.json({}));
  const app = express();
  app.use('/api', r);
  app.use((_e: any, _q: any, s: any, _n: any) => s.status(500).json({ error: 'handled' }));
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/x`, { signal: AbortSignal.timeout(3000) });
    assert.equal(res.status, 500);
  } finally { srv.close(); }
});
