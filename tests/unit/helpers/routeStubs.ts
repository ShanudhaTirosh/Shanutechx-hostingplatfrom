import Module, { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import express from 'express';

/**
 * Mounts a REAL API router against a fake Prisma and a stubbed requireAuth so route handlers can be
 * exercised over HTTP without a database or Firebase.
 *
 *  - Fake prisma: any `prisma.<model>.<method>(...)` is recorded in `calls` and answered by
 *    `handlers['<model>.<method>']`, defaulting to `null` (i.e. "not found").
 *  - Stub auth: `requireAuth` sets `req.user` from the `x-test-user` / `x-test-role` headers, every
 *    other export of middleware/auth is a pass-through.
 */
export type Calls = Array<{ fn: string; args: any[] }>;
type Handlers = Record<string, (...args: any[]) => any>;

export function makeFakePrisma(handlers: Handlers = {}) {
  const calls: Calls = [];
  const prisma: any = new Proxy({}, {
    get: (_t, model: string) => {
      // `$transaction`, `$queryRaw`, ... are methods on the client itself, not models.
      if (typeof model === 'string' && model.startsWith('$')) {
        return async (...args: any[]) => {
          calls.push({ fn: model, args });
          return handlers[model] ? handlers[model](...args) : null;
        };
      }
      return new Proxy({}, {
        get: (_m, method: string) => async (...args: any[]) => {
          const key = `${model}.${method}`;
          calls.push({ fn: key, args });
          if (handlers[key]) return handlers[key](...args);
          // Like the real client: list queries return [] and counts 0 (only single-row lookups are null).
          if (method === 'findMany') return [];
          if (method === 'count') return 0;
          return null;
        },
      });
    },
  });
  return { prisma, calls, count: (fn: string) => calls.filter((c) => c.fn === fn).length };
}

/** `routeName` is the file name under apps/api/src/routes (without extension), e.g. 'orders'. */
export async function mountRouter(routeName: string, exportName: string, prisma: any, mountAt = '/api') {
  const req = createRequire(import.meta.url);
  const routerFile = fileURLToPath(new URL(`../../../apps/api/src/routes/${routeName}.ts`, import.meta.url));
  const M: any = Module;
  const origLoad = M._load;
  // `require` caches modules, which would keep the FIRST test's fake prisma bound inside the router.
  for (const k of Object.keys(req.cache)) if (k.includes('/apps/api/src/')) delete req.cache[k];
  // Redis / BullMQ are only imported as side effects of shared libs: stub them (no sockets, no noise).
  const noop: any = new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : k === 'status' ? 'ready' : noop), apply: () => noop, construct: () => noop });
  const noopModule = { __esModule: true, default: noop, Redis: noop, Queue: noop, Worker: noop, QueueEvents: noop, FlowProducer: noop };
  const prismaModule = { PrismaClient: class { constructor() { return prisma; } }, Prisma: {}, prisma, default: prisma };
  M._load = function (request: string, parent: any, ...rest: any[]) {
    const from: string = parent?.filename || '';
    if (request === 'ioredis' || request === 'bullmq') return noopModule;
    if (request === '@prisma/client' || request === '.prisma/client/default' || request === '@shanutechx/db') return prismaModule;
    if (/apps\/api\/src/.test(from) && /(^|\/)prisma(\.ts|\.js)?$/.test(request)) return prismaModule;
    if (/apps\/api\/src\/routes/.test(from) && /middleware\/auth(\.ts|\.js)?$/.test(request)) {
      const passthrough = (_q: any, _s: any, next: any) => next();
      const requireAuth = (q: any, _s: any, next: any) => {
        q.user = { id: q.headers['x-test-user'], role: q.headers['x-test-role'] || 'customer', email: 'test@example.com' };
        next();
      };
      return new Proxy({ requireAuth }, { get: (t: any, k: string) => (k in t ? t[k] : passthrough) });
    }
    return origLoad.call(this, request, parent, ...rest);
  };
  let mod: any;
  try {
    mod = req(routerFile);
  } finally {
    M._load = origLoad;
  }
  const app = express();
  app.use(express.json());
  app.use(mountAt, mod[exportName]);
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const call = async (method: string, path: string, opts: { user?: string; role?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-test-user': opts.user || 'u1', 'x-test-role': opts.role || 'customer', ...(opts.headers || {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(5000),
    });
    let json: any = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, json };
  };
  return { call, close: () => server.close() };
}

/** Loads any module under apps/api/src (e.g. 'lib/notifications') against the same stubs as mountRouter. */
export function loadApiModule(relFromApiSrc: string, prisma: any): any {
  const req = createRequire(import.meta.url);
  const file = fileURLToPath(new URL(`../../../apps/api/src/${relFromApiSrc}.ts`, import.meta.url));
  const M: any = Module;
  const origLoad = M._load;
  for (const k of Object.keys(req.cache)) if (k.includes('/apps/api/src/')) delete req.cache[k];
  const noop: any = new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : k === 'status' ? 'ready' : noop), apply: () => noop, construct: () => noop });
  const noopModule = { __esModule: true, default: noop, Redis: noop, Queue: noop, Worker: noop, QueueEvents: noop, FlowProducer: noop };
  const prismaModule = { PrismaClient: class { constructor() { return prisma; } }, Prisma: {}, prisma, default: prisma };
  M._load = function (request: string, parent: any, ...rest: any[]) {
    const from: string = parent?.filename || '';
    if (request === 'ioredis' || request === 'bullmq') return noopModule;
    if (request === '@prisma/client' || request === '.prisma/client/default' || request === '@shanutechx/db') return prismaModule;
    if (/apps\/api\/src/.test(from) && /(^|\/)prisma(\.ts|\.js)?$/.test(request)) return prismaModule;
    return origLoad.call(this, request, parent, ...rest);
  };
  try { return req(file); } finally { M._load = origLoad; }
}
