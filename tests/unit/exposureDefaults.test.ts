import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExposureForBuild } from '../../apps/api/src/lib/exposureDefaults';

const deps = (row: { exposureMode: string | null; publishedPort: number | null } | null, fail = false) => {
  const calls: string[] = [];
  return { calls, d: { async load(id: string) { calls.push(id); if (fail) throw new Error('db down'); return row; } } };
};

test('a rebuild that passes neither keeps the deployment\'s stored mode and published port (the redeploy bug)', async () => {
  const { d } = deps({ exposureMode: 'no_ssl', publishedPort: 25565 });
  assert.deepEqual(await resolveExposureForBuild('dep', {}, d), { exposureMode: 'no_ssl', publishedPort: 25565 });
});
test('the redeploy route passes exposureMode but not publishedPort: the port is filled in', async () => {
  const { d } = deps({ exposureMode: 'no_ssl', publishedPort: 25565 });
  assert.deepEqual(await resolveExposureForBuild('dep', { exposureMode: 'no_ssl' }, d), { exposureMode: 'no_ssl', publishedPort: 25565 });
});
test('explicit values always win over stored ones', async () => {
  const { d } = deps({ exposureMode: 'no_ssl', publishedPort: 25565 });
  assert.deepEqual(await resolveExposureForBuild('dep', { exposureMode: 'ssl_with_proxy', publishedPort: 8080 }, d), { exposureMode: 'ssl_with_proxy', publishedPort: 8080 });
  assert.deepEqual(await resolveExposureForBuild('dep', { exposureMode: 'internal_only' }, d), { exposureMode: 'internal_only', publishedPort: 25565 });
});
test('no lookup when the caller supplied everything', async () => {
  const { d, calls } = deps({ exposureMode: 'no_ssl', publishedPort: 1 });
  await resolveExposureForBuild('dep', { exposureMode: 'ssl_with_proxy', publishedPort: 8080 }, d);
  assert.equal(calls.length, 0);
});
test('unknown deployment / null columns / lookup failure never block or invent values', async () => {
  assert.deepEqual(await resolveExposureForBuild('dep', { exposureMode: 'x' }, deps(null).d), { exposureMode: 'x' });
  assert.deepEqual(await resolveExposureForBuild('dep', {}, deps({ exposureMode: null, publishedPort: null }).d), { exposureMode: undefined, publishedPort: undefined });
  assert.deepEqual(await resolveExposureForBuild('dep', { publishedPort: 9 }, deps(null, true).d), { publishedPort: 9 });
});
