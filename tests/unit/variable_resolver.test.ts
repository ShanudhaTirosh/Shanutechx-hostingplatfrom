import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariableReferences } from '../../apps/api/src/lib/variableResolver';

test('resolve local variable references', () => {
  const vars = [
    { key: 'PORT', value: '3000' },
    { key: 'HOST', value: 'localhost' },
    { key: 'API_URL', value: 'http://${{HOST}}:${{PORT}}' },
  ];

  const result = resolveVariableReferences(vars);

  assert.equal(result.resolved.PORT, '3000');
  assert.equal(result.resolved.HOST, 'localhost');
  assert.equal(result.resolved.API_URL, 'http://localhost:3000');
  assert.equal(result.hasErrors, false);
});

test('resolve cross-service and database reference variables', () => {
  const vars = [
    { key: 'PORT', value: '8080' },
    { key: 'DATABASE_URL', value: '${{Postgres.DATABASE_URL}}' },
    { key: 'REDIS_HOST', value: '${{Redis.HOST}}' },
  ];

  const contextMap = {
    Postgres: {
      DATABASE_URL: 'postgresql://postgres:secret123@postgres-host:5432/main_db',
    },
    Redis: {
      HOST: 'redis-cache-internal',
    },
  };

  const result = resolveVariableReferences(vars, contextMap);

  assert.equal(result.resolved.PORT, '8080');
  assert.equal(result.resolved.DATABASE_URL, 'postgresql://postgres:secret123@postgres-host:5432/main_db');
  assert.equal(result.resolved.REDIS_HOST, 'redis-cache-internal');
  assert.equal(result.hasErrors, false);
});

test('detect cyclic variable references', () => {
  const vars = [
    { key: 'VAR_A', value: '${{VAR_B}}' },
    { key: 'VAR_B', value: '${{VAR_A}}' },
  ];

  const result = resolveVariableReferences(vars);

  assert.equal(result.hasErrors, true);
  assert.ok(result.errors.length > 0);
});
