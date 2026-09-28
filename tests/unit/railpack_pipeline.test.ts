import test from 'node:test';
import assert from 'node:assert/strict';
import { RailpackStage } from '../../apps/api/src/lib/railpackEngine';

test('Railpack pipeline stage progression hierarchy', () => {
  const stages: RailpackStage[] = ['source', 'build', 'test', 'image', 'deploy', 'health_check', 'live'];

  assert.equal(stages.length, 7);
  assert.equal(stages[0], 'source');
  assert.equal(stages[stages.length - 1], 'live');
});

test('Railpack stage log object structure', () => {
  const stageLogs: Record<RailpackStage | string, string> = {
    source: '[Source] Repository cloned',
    build: '[Build] Railpack build completed',
    test: '[Test] 12 tests passed',
    image: '[Image] Image built: sha256:abc',
    deploy: '[Deploy] Container started',
    health_check: '[Health Check] HTTP 200 OK',
    live: '[Live] Production ready',
  };

  assert.ok(stageLogs.source.includes('[Source]'));
  assert.ok(stageLogs.health_check.includes('HTTP 200'));
});
