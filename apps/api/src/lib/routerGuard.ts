import type { NextFunction, Request, Response, Router } from 'express';

/**
 * Express gotcha this exists for
 * ------------------------------
 * Every router in this API is mounted at the same `/api` prefix. A path-less
 * `someRouter.use(requireAuth)` runs for EVERY `/api/*` request that reaches that router - even
 * ones the router has no route for - so a router mounted early silently put `requireAuth` in
 * front of every router mounted after it. In practice `/api/auth/login`, `/api/services`,
 * `/api/status/public`, `/api/cms/*`, the SMS/deploy webhooks and the bots' `/api/internal/*`
 * endpoints (which authenticate with a shared secret, not a Firebase token) all answered 401.
 *
 * `useForOwnRoutes(router, ...mw)` registers middleware that runs only when one of THIS
 * router's own routes matches the request's path + method; otherwise it calls `next()` so the
 * request continues to the routers mounted after it.
 */

type Middleware = (req: any, res: Response, next: NextFunction) => unknown;

function ownsRequest(router: Router, req: Request): boolean {
  const method = req.method.toLowerCase();
  const stack: any[] = (router as any).stack || [];
  return stack.some((layer) => {
    const route = layer.route;
    if (!route) return false;
    if (!layer.match(req.path)) return false;
    return Boolean(route.methods._all || route.methods[method] || (method === 'head' && route.methods.get));
  });
}

function runChain(handlers: Middleware[], req: Request, res: Response, done: NextFunction) {
  let i = 0;
  const step = (err?: unknown) => {
    if (err) return done(err);
    const handler = handlers[i++];
    if (!handler) return done();
    try {
      const result = handler(req, res, step) as { catch?: (fn: (e: unknown) => void) => void } | undefined;
      // Express 4 ignores rejected promises from async middleware (the request would hang): forward them.
      if (result && typeof result.catch === 'function') result.catch(step);
    } catch (e) {
      step(e);
    }
  };
  step();
}

export function useForOwnRoutes(router: Router, ...handlers: Middleware[]): void {
  router.use((req, res, next) => {
    if (!ownsRequest(router, req)) return next();
    runChain(handlers, req, res, next);
  });
}
