import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';

/**
 * Real git, real HTTP. A local server plays "GitHub" and records what git actually sends, which is the only honest
 * way to prove that credentials arrive via the Authorization header and never touch argv, .git/config or error text.
 */

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-repo-auth-'));
process.env.AGENT_WORKSPACES_DIR = path.join(ROOT, 'workspaces');
fs.mkdirSync(process.env.AGENT_WORKSPACES_DIR, { recursive: true });

const SECRET = 'ghs_SUPERSECRETTOKEN123';
const b64 = (s: string) => Buffer.from(s).toString('base64');

async function loadRepo() {
  const mod: any = await import('../../services/node-agent/src/repo.js');
  return mod.default ?? mod;
}

function fakeGithub() {
  const seen: Array<{ url: string; authorization?: string }> = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url || '', authorization: req.headers.authorization });
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="fake"' });
    res.end('nope');
  });
  return new Promise<{ base: string; seen: typeof seen; close: () => Promise<void> }>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ base: `127.0.0.1:${(server.address() as AddressInfo).port}`, seen, close: () => new Promise((r) => server.close(() => r())) })
    )
  );
}

const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
function allFilesText(dir: string): string {
  let out = '';
  const walk = (d: string) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      const st = fs.lstatSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile() && st.size < 1_000_000) out += fs.readFileSync(p, 'latin1');
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

test('node agent git auth', async (t) => {
  const repo = await loadRepo();
  t.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

  await t.test('splitCredentials / redact', () => {
    assert.deepEqual(repo.splitCredentials('https://x-access-token:abc@github.com/o/r.git'), { cleanUrl: 'https://github.com/o/r.git', auth: { username: 'x-access-token', password: 'abc' } });
    assert.deepEqual(repo.splitCredentials('https://tok@github.com/o/r.git').auth, { username: 'tok', password: '' });
    assert.equal(repo.splitCredentials('https://github.com/o/r.git').auth, null);
    assert.equal(repo.splitCredentials('file:///tmp/x.git').auth, null);
    assert.equal(repo.splitCredentials('zip://abc').cleanUrl, 'zip://abc');
    assert.ok(!repo.redact('fatal: https://x-access-token:abc123@github.com/o/r.git 401').includes('abc123'));
    assert.ok(!repo.redact('Authorization: Basic eC1hY2Nlc3M6c2VjcmV0').includes('eC1hY2Nlc3M6c2VjcmV0'));
    assert.ok(!repo.redact('token is hunter2hunter2 here', ['hunter2hunter2']).includes('hunter2'));
  });

  await t.test('clone sends the credential as a Basic header, and it never reaches disk or the error message', async () => {
    const gh = await fakeGithub();
    t.after(() => gh.close());
    const dep = 'cdepauth00001';
    const err = await repo.prepareWorkspace(dep, `http://x-access-token:${SECRET}@${gh.base}/o/r.git`, 'main').then(() => null, (e: Error) => e);

    assert.ok(err, 'the fake server rejects, so the clone must fail');
    const first = gh.seen.find((r) => r.authorization);
    assert.equal(first?.authorization, `Basic ${b64(`x-access-token:${SECRET}`)}`, 'credential was sent as a header');
    assert.ok(!gh.seen.some((r) => r.url.includes(SECRET)), 'credential never appears in the URL git requested');
    assert.ok(!err!.message.includes(SECRET), `error message leaked the token: ${err!.message}`);
    assert.ok(!err!.message.includes(b64(`x-access-token:${SECRET}`)), 'nor its base64 form');
    assert.ok(!allFilesText(path.join(process.env.AGENT_WORKSPACES_DIR!, dep)).includes(SECRET), 'token not written anywhere in the workspace');
  });

  await t.test('a token-as-username URL (the shadow-backup style) is handled the same way', async () => {
    const gh = await fakeGithub();
    t.after(() => gh.close());
    const err = await repo.prepareWorkspace('cdepauth00002', `http://${SECRET}@${gh.base}/o/r.git`, 'main').then(() => null, (e: Error) => e);
    assert.equal(gh.seen.find((r) => r.authorization)?.authorization, `Basic ${b64(`${SECRET}:`)}`);
    assert.ok(err && !err.message.includes(SECRET));
  });

  await t.test('pushWorkspaceToRemote keeps the platform backup token out of the customer workspace .git/config', async () => {
    const gh = await fakeGithub();
    t.after(() => gh.close());
    const dep = 'cdepauth00003';
    fs.mkdirSync(path.join(process.env.AGENT_WORKSPACES_DIR!, dep), { recursive: true });
    fs.writeFileSync(path.join(process.env.AGENT_WORKSPACES_DIR!, dep, 'app.js'), 'console.log(1)');
    const err = await repo.pushWorkspaceToRemote(dep, `http://${SECRET}@${gh.base}/o/backup.git`).then(() => null, (e: Error) => e);

    assert.ok(err, 'fake server rejects the push');
    assert.equal(gh.seen.find((r) => r.authorization)?.authorization, `Basic ${b64(`${SECRET}:`)}`);
    const wsDir = path.join(process.env.AGENT_WORKSPACES_DIR!, dep);
    assert.ok(!err!.message.includes(SECRET));
    assert.ok(!allFilesText(wsDir).includes(SECRET), 'the token must not be persisted in the workspace (it is also the Docker build context)');
    assert.match(read(path.join(wsDir, '.git', 'config')), new RegExp(`url = http://${gh.base}/o/backup.git`), 'remote is registered with the clean URL');
  });

  await t.test('a workspace whose .git/config still holds a token from an older agent is scrubbed on the next deploy', async () => {
    const dep = 'cdepauth00004';
    const wsDir = path.join(process.env.AGENT_WORKSPACES_DIR!, dep);
    fs.mkdirSync(wsDir, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: wsDir });
    execFileSync('git', ['remote', 'add', 'origin', `https://x-access-token:OLDLEAKEDTOKEN@127.0.0.1:1/o/r.git`], { cwd: wsDir });
    assert.ok(read(path.join(wsDir, '.git', 'config')).includes('OLDLEAKEDTOKEN'), 'precondition: the leaked token is on disk');

    await repo.prepareWorkspace(dep, 'https://127.0.0.1:1/o/r.git', 'main').catch(() => {});
    assert.ok(!read(path.join(wsDir, '.git', 'config')).includes('OLDLEAKEDTOKEN'), 'token scrubbed from .git/config');
  });

  await t.test('REGRESSION: a failed fetch fails the deploy instead of silently rebuilding old code', async () => {
    // A real local remote with one commit.
    const origin = path.join(ROOT, 'origin.git');
    const seed = path.join(ROOT, 'seed');
    fs.mkdirSync(seed, { recursive: true });
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: seed });
    execFileSync('git', ['config', 'user.email', 't@t'], { cwd: seed });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: seed });
    fs.writeFileSync(path.join(seed, 'v.txt'), 'v1');
    execFileSync('git', ['add', '-A'], { cwd: seed });
    execFileSync('git', ['commit', '-q', '-m', 'v1'], { cwd: seed });
    execFileSync('git', ['clone', '-q', '--bare', seed, origin]);
    const url = `file://${origin}`;

    const dep = 'cdepauth00005';
    const wsDir = await repo.prepareWorkspace(dep, url, 'main');
    assert.equal(fs.readFileSync(path.join(wsDir, 'v.txt'), 'utf8'), 'v1', 'first deploy clones');

    // Remote becomes unreachable (expired token / outage / deleted repo behave the same way for the fetch).
    fs.renameSync(origin, origin + '.gone');
    const err = await repo.prepareWorkspace(dep, url, 'main').then(() => null, (e: Error) => e);
    assert.ok(err, 'must reject');
    assert.match(err!.message, /Could not fetch the latest code for branch "main"/);

    // (Verified during development: the pre-fix agent resolved successfully here, i.e. it silently rebuilt old code.)
  });
});
