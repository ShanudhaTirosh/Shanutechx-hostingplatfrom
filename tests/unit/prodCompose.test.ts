import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const compose = parse(fs.readFileSync(path.join(__dirname, '../../docker-compose.prod.yml'), 'utf8'));
const services: Record<string, any> = compose.services;

test('production compose runs the background worker (SSL renewal, billing, backups, failover, uptime)', () => {
  // apps/api/src/index.ts does not start queue workers; dist/worker.js is a separate process.
  const worker = services.worker;
  assert.ok(worker, 'docker-compose.prod.yml has no `worker` service - those jobs would never run in production');
  assert.deepEqual(worker.command, ['node', 'dist/worker.js']);
  assert.deepEqual(worker.environment, services.api.environment, 'worker must get the same environment as the api');
  assert.equal(worker.env_file, services.api.env_file);
  assert.equal(worker.restart, 'unless-stopped');
});

test('services that Traefik already routes over TLS do not also publish a plain-HTTP port to the internet', () => {
  const offenders: string[] = [];
  for (const [name, svc] of Object.entries<any>(services)) {
    const routed = (svc.labels || []).some((l: string) => /traefik\.http\.routers\.[^.]+\.rule=/.test(l));
    if (!routed) continue;
    for (const port of svc.ports || []) {
      if (!String(port).startsWith('127.0.0.1:')) offenders.push(`${name}: ${port}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the API falls back to the MinIO root user AND password it is actually given (both follow MINIO_ROOT_*)', () => {
  const env: string[] = services.api.environment;
  const accessKey = env.find((e) => e.startsWith('R2_ACCESS_KEY_ID='))!;
  const secretKey = env.find((e) => e.startsWith('R2_SECRET_ACCESS_KEY='))!;
  assert.match(accessKey, /\$\{MINIO_ROOT_USER:-shanutechx_minio\}/, 'access key must follow MINIO_ROOT_USER');
  assert.match(secretKey, /\$\{MINIO_ROOT_PASSWORD:\?/, 'secret must follow MINIO_ROOT_PASSWORD');
  const minio = services.minio.environment;
  assert.match(minio.MINIO_ROOT_USER, /\$\{MINIO_ROOT_USER:-shanutechx_minio\}/);
});
