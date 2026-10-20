import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';

/**
 * Static guard for an Express gotcha that took down most unauthenticated endpoints:
 * every router is mounted at the shared `/api` prefix, so a path-less `router.use(mw)` runs for
 * EVERY /api request reaching that router - including requests meant for routers mounted later.
 * Use `useForOwnRoutes(router, ...)` (lib/routerGuard) or a path-scoped `router.use('/x', mw)`.
 */
const API_SRC = path.join(__dirname, '../../apps/api/src');
const indexSrc = fs.readFileSync(path.join(API_SRC, 'index.ts'), 'utf8');

// routerName -> mount path, from `app.use('/api...', someRouter)`
const mounts = new Map<string, string>();
for (const m of indexSrc.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+Router)\s*\)/g)) mounts.set(m[2], m[1]);
for (const m of indexSrc.matchAll(/app\.use\(\s*(\w+Router)\s*\)/g)) mounts.set(m[1], '/');

test('index.ts mounts were parsed (sanity)', () => {
  assert.ok(mounts.size > 40, `expected many router mounts, parsed ${mounts.size}`);
  assert.equal(mounts.get('productsRouter'), '/api');
});

test('no router mounted at /api (or root) uses a path-less router.use(...)', () => {
  const routesDir = path.join(API_SRC, 'routes');
  const offenders: string[] = [];
  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
    for (const m of src.matchAll(/^(\w+Router)\.use\(\s*(?!['"`\[])/gm)) {
      const mount = mounts.get(m[1]);
      if (mount === '/api' || mount === '/') offenders.push(`${file}: ${m[1]}.use(...) is path-less but mounted at ${mount}`);
    }
  }
  assert.deepEqual(offenders, []);
});

// Routes in these files are intentionally reachable without a Firebase user token: public pages,
// OAuth/SSO flows, signed webhooks, cron endpoints and the bots' shared-secret endpoints.
// Each one authenticates itself (signature / secret / token) or is genuinely public.
const SELF_AUTHENTICATING_OR_PUBLIC = new Set([
  'health.ts', 'services.ts', 'cms.ts', 'openapi.ts', 'reviews.ts', 'metrics.ts', 'gitConnect.ts',
  'webmailAuth.ts', 'projectAuth.ts', 'status.ts', 'auth.ts', 'internalBot.ts', 'setup.ts', 'sms.ts',
  'prWebhooks.ts', 'deployWebhooks.ts', 'billing.ts', 'backup.ts',
  // mounted under their own prefix with their own gate
  'settings.ts', 'knowledgebase.ts', 'emailsV1.ts', 'studioPlatform.ts',
]);

test('every route is covered by an auth gate (or lives in a reviewed public/self-authenticating file)', () => {
  const routesDir = path.join(API_SRC, 'routes');
  const routeRe = /^\s*(\w+)\.(get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]+)\3/gm;
  const uncovered: string[] = [];
  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.ts'))) {
    if (SELF_AUTHENTICATING_OR_PUBLIC.has(file)) continue;
    const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
    const fullGate = /^useForOwnRoutes\(\w+,\s*requireAuth/m.test(src) || /^\w+Router\.use\(\s*requireAuth/m.test(src);
    const scoped = [...src.matchAll(/^\w+Router\.use\(\s*['"]([^'"]+)['"]\s*,\s*requireAuth/gm)].map((m) => m[1]);
    const matches = [...src.matchAll(routeRe)];
    matches.forEach((m, i) => {
      const seg = src.slice(m.index!, i + 1 < matches.length ? matches[i + 1].index! : src.length);
      const afterPath = seg.slice(m[0].length);
      const mids = afterPath.split(/async\s*\(|\(\s*req|\(\s*_req|function\s*\(/, 1)[0];
      const covered =
        mids.includes('requireAuth') ||
        fullGate ||
        scoped.some((x) => m[4].startsWith(x)) ||
        /requireAuth\(\s*req|verifySharedSecret|jwt\.verify|signature/.test(seg.slice(0, 900));
      if (!covered) uncovered.push(`${file}: ${m[2].toUpperCase()} ${m[4]}`);
    });
  }
  assert.deepEqual(uncovered, []);
});

// ---------------------------------------------------------------------------------------------
// canAccessResource(owner, req, type?, id?, action = 'read') defaults to READ. Support staff are
// read-only by policy and team members may hold view-only permissions, so anything that changes state
// must authorise with 'write'. Checked on the TypeScript AST (not text), because a hand-rolled parser
// silently skipped handlers it could not parse:
//   - a call inside a POST/PUT/PATCH/DELETE handler must pass 'write'
//   - a call in a shared helper (outside any handler, e.g. loadOwnedDeployment, canAccessFs,
//     resolveNodeAccess, the SSH terminal gateway) must state what it needs: 'read' | 'write' |
//     accessActionForRequest(req) | a pass-through `action` parameter
// ---------------------------------------------------------------------------------------------
type AccessCall = { file: string; args: string[]; route?: { method: string; path: string } };

function collectAccessCalls(): AccessCall[] {
  const out: AccessCall[] = [];
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
    });
  for (const file of walk(API_SRC)) {
    const rel = path.relative(API_SRC, file);
    if (rel === path.join('middleware', 'rbac.ts')) continue; // the definition itself
    const text = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'canAccessResource') {
        let route: AccessCall['route'];
        for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
          if (
            ts.isCallExpression(p) &&
            ts.isPropertyAccessExpression(p.expression) &&
            /^(get|post|put|patch|delete)$/.test(p.expression.name.text) &&
            ts.isIdentifier(p.expression.expression) &&
            /(Router|^router)$/i.test(p.expression.expression.text) &&
            p.arguments[0] &&
            ts.isStringLiteralLike(p.arguments[0])
          ) {
            route = { method: p.expression.name.text.toUpperCase(), path: (p.arguments[0] as ts.StringLiteralLike).text };
            break;
          }
        }
        out.push({ file: rel, args: node.arguments.map((a) => a.getText(sf)), route });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

test('canAccessResource is found (sanity: the AST scan sees the codebase)', () => {
  const calls = collectAccessCalls();
  assert.ok(calls.length >= 80, `expected 80+ calls, found ${calls.length}`);
  assert.ok(calls.some((c) => c.route), 'expected some calls inside route handlers');
  assert.ok(calls.some((c) => !c.route), 'expected some calls in shared helpers');
});

test('state-changing routes authorise with write access', () => {
  const offenders = collectAccessCalls()
    .filter((c) => c.route && c.route.method !== 'GET' && !/^['"]write['"]$/.test(c.args[4] ?? ''))
    .map((c) => `${c.file}: ${c.route!.method} ${c.route!.path}`);
  assert.deepEqual(offenders, []);
});

test('canAccessResource calls in shared helpers always state the access level they need', () => {
  const offenders = collectAccessCalls()
    .filter((c) => !c.route && !/^(['"](read|write)['"]|accessActionForRequest\(\w+\)|action)$/.test(c.args[4] ?? ''))
    .map((c) => `${c.file}: canAccessResource(${c.args.join(', ').slice(0, 70)})`);
  assert.deepEqual(offenders, []);
});
