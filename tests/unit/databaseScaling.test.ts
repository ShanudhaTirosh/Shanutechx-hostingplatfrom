import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface DatabaseScalingParams {
  cpuLimit?: number;
  memoryLimitMb?: number;
  maxConnections?: number;
}

function validateAndSanitizeScaleParams(params: DatabaseScalingParams) {
  const cpu = params.cpuLimit !== undefined ? Math.min(Math.max(params.cpuLimit, 0.1), 32) : undefined;
  const memory = params.memoryLimitMb !== undefined ? Math.min(Math.max(params.memoryLimitMb, 64), 128000) : undefined;
  const maxConn = params.maxConnections !== undefined ? Math.min(Math.max(params.maxConnections, 5), 10000) : undefined;

  return { cpuLimit: cpu, memoryLimitMb: memory, maxConnections: maxConn };
}

function generateConnectionUri(type: 'postgres' | 'mysql' | 'redis' | 'mongodb', host: string, port: number, pass: string, dbName = 'admin') {
  const encPass = encodeURIComponent(pass);
  switch (type) {
    case 'postgres':
      return `postgresql://postgres:${encPass}@${host}:${port}/${dbName}`;
    case 'mysql':
      return `mysql://root:${encPass}@${host}:${port}/${dbName}`;
    case 'redis':
      return `redis://:${encPass}@${host}:${port}`;
    case 'mongodb':
      return `mongodb://root:${encPass}@${host}:${port}/${dbName}?authSource=admin`;
  }
}

describe('validateAndSanitizeScaleParams', () => {
  it('clamps CPU limit between 0.1 and 32 cores', () => {
    assert.equal(validateAndSanitizeScaleParams({ cpuLimit: 0.05 }).cpuLimit, 0.1);
    assert.equal(validateAndSanitizeScaleParams({ cpuLimit: 64 }).cpuLimit, 32);
    assert.equal(validateAndSanitizeScaleParams({ cpuLimit: 4 }).cpuLimit, 4);
  });

  it('clamps Memory MB between 64MB and 128GB', () => {
    assert.equal(validateAndSanitizeScaleParams({ memoryLimitMb: 16 }).memoryLimitMb, 64);
    assert.equal(validateAndSanitizeScaleParams({ memoryLimitMb: 200000 }).memoryLimitMb, 128000);
    assert.equal(validateAndSanitizeScaleParams({ memoryLimitMb: 2048 }).memoryLimitMb, 2048);
  });

  it('clamps Max Connections between 5 and 10000', () => {
    assert.equal(validateAndSanitizeScaleParams({ maxConnections: 1 }).maxConnections, 5);
    assert.equal(validateAndSanitizeScaleParams({ maxConnections: 50000 }).maxConnections, 10000);
    assert.equal(validateAndSanitizeScaleParams({ maxConnections: 500 }).maxConnections, 500);
  });
});

describe('generateConnectionUri', () => {
  it('formats PostgreSQL DSN correctly with encoded password', () => {
    const uri = generateConnectionUri('postgres', '10.0.0.5', 5432, 'p@ss#word!', 'production');
    assert.equal(uri, 'postgresql://postgres:p%40ss%23word!@10.0.0.5:5432/production');
  });

  it('formats Redis URI correctly with password auth', () => {
    const uri = generateConnectionUri('redis', 'redis-node', 6379, 'secret123');
    assert.equal(uri, 'redis://:secret123@redis-node:6379');
  });

  it('formats MongoDB URI with authSource parameter', () => {
    const uri = generateConnectionUri('mongodb', 'mongo-host', 27017, 'secretPass', 'app');
    assert.equal(uri, 'mongodb://root:secretPass@mongo-host:27017/app?authSource=admin');
  });
});
