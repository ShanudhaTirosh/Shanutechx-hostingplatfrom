import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Node 20 reached end-of-life on 2026-04-30 (the repo's own vendored Supabase SDKs already require
 * Node 22+). Images, CI and the install docs must agree on one supported major.
 */
const ROOT = path.join(__dirname, '../..');
const MIN_MAJOR = 22;
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const dockerfiles = ['apps', 'services']
  .flatMap((dir) => fs.readdirSync(path.join(ROOT, dir)).map((name) => path.join(dir, name, 'Dockerfile')))
  .filter((f) => fs.existsSync(path.join(ROOT, f)));

const imageMajors = dockerfiles.flatMap((f) =>
  [...read(f).matchAll(/^FROM node:(\d+)[\w.-]*/gm)].map((m) => ({ file: f, major: Number(m[1]), tag: m[0] }))
);
const ciMajors = ['.github/workflows/ci.yml', '.github/workflows/publish-sdk.yml'].flatMap((f) =>
  [...read(f).matchAll(/node-version:\s*(\d+)/g)].map((m) => ({ file: f, major: Number(m[1]) }))
);

test('found the Docker base images and CI node versions (sanity)', () => {
  assert.ok(imageMajors.length >= 9, `expected >= 9 FROM node: lines, found ${imageMajors.length}`);
  assert.ok(ciMajors.length >= 2, 'expected node-version in both workflows');
});

test(`every Docker image uses Node >= ${MIN_MAJOR}`, () => {
  assert.deepEqual(imageMajors.filter((i) => i.major < MIN_MAJOR).map((i) => `${i.file}: ${i.tag}`), []);
});

test(`CI runs on Node >= ${MIN_MAJOR} and on the same major as the images (tests must run on what ships)`, () => {
  assert.deepEqual(ciMajors.filter((c) => c.major < MIN_MAJOR).map((c) => `${c.file}: ${c.major}`), []);
  const shipped = new Set(imageMajors.map((i) => i.major));
  assert.equal(shipped.size, 1, `images use different Node majors: ${[...shipped]}`);
  for (const c of ciMajors) assert.equal(c.major, [...shipped][0], `${c.file} uses Node ${c.major}, images use ${[...shipped][0]}`);
});

test('the API runtime image stays on Debian bookworm so it matches Prisma\'s debian-openssl-3.0.x binary target', () => {
  assert.match(read('apps/api/Dockerfile'), /^FROM node:\d+-bookworm-slim AS runner/m);
  assert.match(read('packages/db/prisma/schema.prisma'), /binaryTargets\s*=\s*\[[^\]]*"debian-openssl-3\.0\.x"/);
});

test('install docs do not tell people to install a Node major below the minimum', () => {
  for (const f of ['docs/complete-deployment.md', 'docs/PRODUCTION_READY.md']) {
    for (const m of read(f).matchAll(/setup_(\d+)\.x/g)) assert.ok(Number(m[1]) >= MIN_MAJOR, `${f}: setup_${m[1]}.x`);
  }
});

test('the Node version this test suite runs on is supported', () => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= MIN_MAJOR, `running on Node ${process.versions.node}`);
});
