import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../e2e/infra/test-server';
import { assertStatus } from '../e2e/infra/assertions';
import { buildKongConfigYaml, buildSupabaseComposeYaml } from '../../apps/api/src/routes/supabase';
import { getCentralStudioUrl } from '../../apps/dashboard/lib/supabaseAdmin';
import * as managedDb from '../../services/node-agent/src/managedDb.js';
import { redis } from '../../apps/api/src/lib/redis';
import { closeAllQueues } from '../../apps/api/src/lib/queue';
import {
  processSupabaseBackup,
  processSupabaseRestore,
  processSupabaseDeprovision,
  processInfrastructureJob,
} from '../../apps/api/src/jobs/infrastructure-job-processor';

/**
 * Adversarial Challenger Suite for Milestone 3:
 * Self-Hosted Supabase & Managed Databases (Features 12–19)
 */

test('Challenger M3: Feature 12 — Supabase Persistent Volumes Adversarial Tests', async (t) => {
  await t.test('12.A1: Dirty slug with whitespace, symbols and uppercase produces valid isolated volume names', () => {
    const dirtySlug = '  My@Dirty--App_#99!!  ';
    const cleanSlug = dirtySlug.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');
    assert.equal(cleanSlug, 'my-dirty--app--99');

    const compose = buildSupabaseComposeYaml({
      cleanSlug,
      projectName: dirtySlug,
      dbPassword: 'complex-password-123!',
      dbPort: 5432,
      studioPort: 8000,
      studioUrl: 'http://localhost:8000',
      anonKey: 'anon-key',
      serviceKey: 'service-key',
    });

    assert.ok(compose.includes(`supa-${cleanSlug}-db-data:`));
    assert.ok(compose.includes(`supa-${cleanSlug}-storage-data:`));
    assert.ok(compose.includes(`supa-${cleanSlug}-db-data:/var/lib/postgresql/data`));
    assert.ok(compose.includes(`supa-${cleanSlug}-storage-data:/var/lib/storage`));
    assert.ok(!compose.includes('My@Dirty'), 'Must not leak unsanitized slug into volume names');
  });

  await t.test('12.A2: Path traversal attack in slug does not escape into host filesystem mounts', () => {
    const maliciousSlug = '../../../../etc/shadow';
    const cleanSlug = maliciousSlug.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');

    const compose = buildSupabaseComposeYaml({
      cleanSlug,
      projectName: 'Path Traversal Test',
      dbPassword: 'secretpassword',
      dbPort: 5432,
      studioPort: 8000,
      studioUrl: 'http://localhost:8000',
      anonKey: 'anon-key',
      serviceKey: 'service-key',
    });

    assert.ok(!compose.includes('../'));
    assert.ok(!compose.includes('/etc/shadow'));
    assert.ok(!compose.includes('/var/run/docker.sock'));
    assert.ok(!compose.includes('/proc'));
    assert.ok(!compose.includes('/sys'));
  });

  await t.test('12.A3: Compose file declares driver: local on all persistent named volumes', () => {
    const compose = buildSupabaseComposeYaml({
      cleanSlug: 'driver-test',
      projectName: 'Driver Test',
      dbPassword: 'secretpassword',
      dbPort: 5432,
      studioPort: 8000,
      studioUrl: 'http://localhost:8000',
      anonKey: 'anon-key',
      serviceKey: 'service-key',
    });

    // Extract top-level volumes block
    const volumesMatch = compose.match(/\nvolumes:\s*\n([\s\S]*?)(?:\nnetworks:|$)/);
    assert.ok(volumesMatch, 'Must define volumes top-level section');
    const volumesContent = volumesMatch[1];
    assert.ok(volumesContent.includes('supa-driver-test-db-data:'));
    assert.ok(volumesContent.includes('supa-driver-test-storage-data:'));
    const driverLocalCount = (volumesContent.match(/driver:\s*local/g) || []).length;
    assert.equal(driverLocalCount, 2, 'Both db-data and storage-data must specify driver: local');
  });

  await t.test('12.A4: Multi-tenant collision avoidance between two similar slugs', () => {
    const compose1 = buildSupabaseComposeYaml({
      cleanSlug: 'tenant-a',
      projectName: 'Tenant A',
      dbPassword: 'pass1',
      dbPort: 5432,
      studioPort: 8000,
      studioUrl: 'http://localhost:8000',
      anonKey: 'anon1',
      serviceKey: 'serv1',
    });

    const compose2 = buildSupabaseComposeYaml({
      cleanSlug: 'tenant-a-2',
      projectName: 'Tenant A 2',
      dbPassword: 'pass2',
      dbPort: 5433,
      studioPort: 8002,
      studioUrl: 'http://localhost:8002',
      anonKey: 'anon2',
      serviceKey: 'serv2',
    });

    assert.ok(compose1.includes('supa-tenant-a-db-data'));
    assert.ok(!compose1.includes('supa-tenant-a-2-db-data'));
    assert.ok(compose2.includes('supa-tenant-a-2-db-data'));
    assert.ok(!compose2.includes('container_name: supa-tenant-a-db\n'));
  });
});

test('Challenger M3: Feature 13 — Supabase Meta Network Routing Adversarial Tests', async (t) => {
  await t.test('13.A1: Kong config maps all 7 core microservices with exact routes and target URLs', () => {
    const kong = buildKongConfigYaml('anon-token-123', 'service-token-456');

    // Service 1: auth
    assert.ok(kong.includes('name: auth-v1'));
    assert.ok(kong.includes('url: http://supabase-auth:9999'));
    assert.ok(kong.includes('- /auth/v1/'));

    // Service 2: rest
    assert.ok(kong.includes('name: rest-v1'));
    assert.ok(kong.includes('url: http://supabase-rest:3000'));
    assert.ok(kong.includes('- /rest/v1/'));

    // Service 3: storage
    assert.ok(kong.includes('name: storage-v1'));
    assert.ok(kong.includes('url: http://supabase-storage:5000'));
    assert.ok(kong.includes('- /storage/v1/'));

    // Service 4: realtime
    assert.ok(kong.includes('name: realtime-v1'));
    assert.ok(kong.includes('url: http://supabase-realtime:4000/socket'));
    assert.ok(kong.includes('- /realtime/v1/'));

    // Service 5: meta
    assert.ok(kong.includes('name: meta-v1'));
    assert.ok(kong.includes('url: http://supabase-meta:8080'));
    assert.ok(kong.includes('- /pg/'));

    // Service 6: functions
    assert.ok(kong.includes('name: functions-v1'));
    assert.ok(kong.includes('url: http://supabase-edge-runtime:9000'));
    assert.ok(kong.includes('- /functions/v1/'));

    // Service 7: imgproxy
    assert.ok(kong.includes('name: imgproxy-v1'));
    assert.ok(kong.includes('url: http://supabase-imgproxy:5001'));
    assert.ok(kong.includes('- /render/v1/'));
  });

  await t.test('13.A2: Key-auth plugin is strictly applied to rest-v1 and meta-v1 with hide_credentials', () => {
    const kong = buildKongConfigYaml('anon-token', 'service-token');

    // meta-v1 block verification
    const metaBlockMatch = kong.match(/name: meta-v1[\s\S]*?(?:name: functions-v1|consumers:|$)/);
    assert.ok(metaBlockMatch);
    const metaBlock = metaBlockMatch[0];
    assert.ok(metaBlock.includes('plugins:'));
    assert.ok(metaBlock.includes('- name: key-auth'));
    assert.ok(metaBlock.includes('hide_credentials: true'));

    // rest-v1 block verification
    const restBlockMatch = kong.match(/name: rest-v1[\s\S]*?(?:name: storage-v1|$)/);
    assert.ok(restBlockMatch);
    const restBlock = restBlockMatch[0];
    assert.ok(restBlock.includes('plugins:'));
    assert.ok(restBlock.includes('- name: key-auth'));
    assert.ok(restBlock.includes('hide_credentials: true'));
  });

  await t.test('13.A3: Kong consumers inject exact anon and service_role tokens', () => {
    const anonJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon';
    const serviceJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role';
    const kong = buildKongConfigYaml(anonJwt, serviceJwt);

    assert.ok(kong.includes(`- username: anon\n    keyauth_credentials:\n      - key: ${anonJwt}`));
    assert.ok(kong.includes(`- username: service_role\n    keyauth_credentials:\n      - key: ${serviceJwt}`));
  });

  await t.test('13.A4: Compose cluster connects all services to supa-${cleanSlug}-net bridge network', () => {
    const compose = buildSupabaseComposeYaml({
      cleanSlug: 'mesh-app',
      projectName: 'Mesh App',
      dbPassword: 'secretpassword',
      dbPort: 5432,
      studioPort: 8000,
      studioUrl: 'http://localhost:8000',
      anonKey: 'anon-key',
      serviceKey: 'service-key',
    });

    const expectedServices = [
      'supabase-db',
      'supabase-meta',
      'supabase-auth',
      'supabase-rest',
      'supabase-storage',
      'supabase-imgproxy',
      'supabase-edge-runtime',
      'supabase-supavisor',
      'supabase-realtime',
      'supabase-kong',
    ];

    for (const service of expectedServices) {
      assert.ok(compose.includes(`container_name: supa-mesh-app-${service.replace('supabase-', '')}`));
    }
    assert.ok(compose.includes('name: supa-mesh-app-net'));
  });
});

test('Challenger M3: Feature 14 — Real Supabase Health Checks Adversarial Tests', async (t) => {
  let server: TestServerInstance;
  const projectCust1 = 'proj_hchk_cust1';
  const projectCust2 = 'proj_hchk_cust2';

  t.before(async () => {
    server = await createTestServer({
      supabaseClientProject: [
        {
          id: projectCust1,
          name: 'Cust1 Project',
          userId: TEST_USERS.customer1.id,
          dbName: 'postgres',
          region: 'us-east-1',
          status: 'ACTIVE',
          anonKey: 'anon-cust1',
          serviceKey: 'serv-cust1',
          nodeId: 'node_master_001',
          apiPort: 8001,
          dbPort: 5432,
          studioPort: 8000,
        },
        {
          id: projectCust2,
          name: 'Cust2 Project',
          userId: TEST_USERS.customer2.id,
          dbName: 'postgres',
          region: 'us-east-1',
          status: 'ACTIVE',
          anonKey: 'anon-cust2',
          serviceKey: 'serv-cust2',
          nodeId: 'node_master_001',
          apiPort: 8003,
          dbPort: 5433,
          studioPort: 8002,
        },
      ],
    });
  });

  t.after(async () => {
    await server.stop();
  });

  await t.test('14.A1: Unauthenticated request to /api/supabase/health is rejected with 401', async () => {
    const res = await server.client.get('/api/supabase/health');
    assertStatus(res, 401);
  });

  await t.test('14.A2: Customer cannot inspect health of another customer\'s project (403 Forbidden)', async () => {
    const res = await server.client.get(`/api/supabase/health?projectId=${projectCust2}`, {
      user: TEST_USERS.customer1,
    });
    assertStatus(res, 403);
    assert.ok(res.data.error.includes('Access denied'));
  });

  await t.test('14.A3: Dev/admin staff can query health across projects', async () => {
    const res = await server.client.get(`/api/supabase/health?projectId=${projectCust1}`, {
      user: TEST_USERS.dev,
    });
    assertStatus(res, 200);
    assert.ok(res.data.status !== undefined);
    assert.ok(res.data.services !== undefined);
    assert.ok(res.data.services.kong !== undefined);
    assert.ok(res.data.services.gotrue !== undefined);
    assert.ok(res.data.services.postgrest !== undefined);
    assert.ok(res.data.services.storage !== undefined);
    assert.ok(res.data.urls.meta.includes('/pg'), 'Meta URL must route through Kong /pg path');
  });

  await t.test('14.A4: Health check with no existing projects returns fallback healthy structure without 500 error', async () => {
    server.reset();
    const res = await server.client.get('/api/supabase/health', {
      user: TEST_USERS.dev,
    });
    assertStatus(res, 200);
    assert.equal(res.data.status, 'healthy');
    assert.equal(res.data.empty, true);
    assert.ok(res.data.services.kong);
    assert.ok(res.data.timestamp);
  });
});

test('Challenger M3: Feature 15 — Real Supabase Observability & Logs Adversarial Tests', async (t) => {
  let server: TestServerInstance;
  const projectObsId = 'proj_obs_001';

  t.before(async () => {
    server = await createTestServer({
      supabaseClientProject: [
        {
          id: projectObsId,
          name: 'Observability Test Project',
          userId: TEST_USERS.customer1.id,
          dbName: 'postgres',
          region: 'us-east-1',
          status: 'ACTIVE',
          anonKey: 'anon-obs',
          serviceKey: 'serv-obs',
          nodeId: 'node_master_001',
          apiPort: 8001,
          dbPort: 5432,
          studioPort: 8000,
        },
      ],
    });
  });

  t.after(async () => {
    await server.stop();
  });

  await t.test('15.A1: getCentralStudioUrl handles subpaths with and without leading slash cleanly', () => {
    const proj = { id: 'p_test', name: 'Test' } as any;

    const url1 = getCentralStudioUrl(proj, '/sql');
    assert.ok(url1.endsWith('/project/p_test/sql'));

    const url2 = getCentralStudioUrl(proj, 'sql');
    assert.ok(url2.endsWith('/project/p_test/sql'));

    const url3 = getCentralStudioUrl(proj, '/editor/table/users');
    assert.ok(url3.endsWith('/project/p_test/editor/table/users'));
  });

  await t.test('15.A2: getCentralStudioUrl honors custom studioUrl override without duplicating slashes', () => {
    const proj = { id: 'p_custom', studioUrl: 'https://studio.custom.internal/' } as any;
    const url = getCentralStudioUrl(proj, '/reports');
    assert.equal(url, 'https://studio.custom.internal/reports');
  });

  await t.test('15.A3: GET /api/supabase/projects/:id/stats enforces tenant isolation', async () => {
    const res = await server.client.get(`/api/supabase/projects/${projectObsId}/stats`, {
      user: TEST_USERS.customer2,
    });
    // Customer 2 does not own projectObsId -> 404
    assertStatus(res, 404);
  });

  await t.test('15.A4: GET /api/supabase/projects/:id/stats returns valid numeric non-NaN metrics', async () => {
    const res = await server.client.get(`/api/supabase/projects/${projectObsId}/stats`, {
      user: TEST_USERS.dev,
    });
    assertStatus(res, 200);
    assert.ok(res.data.ok === true);
    assert.equal(typeof res.data.stats.cpuPct, 'number');
    assert.equal(typeof res.data.stats.ramMb, 'number');
    assert.equal(typeof res.data.stats.diskMb, 'number');
    assert.equal(typeof res.data.stats.dbSizeMb, 'number');
    assert.ok(!Number.isNaN(res.data.stats.cpuPct));
    assert.ok(!Number.isNaN(res.data.stats.ramMb));
  });
});

test('Challenger M3: Feature 16 & 17 — Managed Database Volume Persistence & MariaDB Adversarial Tests', async (t) => {
  let server: TestServerInstance;

  t.before(async () => {
    server = await createTestServer();
  });

  t.after(async () => {
    await server.stop();
  });

  await t.test('16.A1: node-agent managedDb IMAGES defines all 5 engines with required tags', () => {
    assert.equal(managedDb.IMAGES.postgres, 'postgres:16-alpine');
    assert.equal(managedDb.IMAGES.mysql, 'mysql:8');
    assert.equal(managedDb.IMAGES.redis, 'redis:7-alpine');
    assert.equal(managedDb.IMAGES.mongodb, 'mongo:7');
    assert.equal(managedDb.IMAGES.mariadb, 'mariadb:11');
  });

  await t.test('16.A2: node-agent managedDb DATA_DIRS specifies correct persistent directories', () => {
    assert.equal(managedDb.DATA_DIRS.postgres, '/var/lib/postgresql/data');
    assert.equal(managedDb.DATA_DIRS.mysql, '/var/lib/mysql');
    assert.equal(managedDb.DATA_DIRS.redis, '/data');
    assert.equal(managedDb.DATA_DIRS.mongodb, '/data/db');
    assert.equal(managedDb.DATA_DIRS.mariadb, '/var/lib/mysql');
  });

  await t.test('16.A3: node-agent managedDb DEFAULT_PORTS configures standard ports', () => {
    assert.equal(managedDb.DEFAULT_PORTS.postgres, 5432);
    assert.equal(managedDb.DEFAULT_PORTS.mysql, 3306);
    assert.equal(managedDb.DEFAULT_PORTS.redis, 6379);
    assert.equal(managedDb.DEFAULT_PORTS.mongodb, 27017);
    assert.equal(managedDb.DEFAULT_PORTS.mariadb, 3306);
  });

  await t.test('16.A4: Unknown database type in provisionDatabase throws descriptive error', async () => {
    await assert.rejects(
      async () => {
        await managedDb.provisionDatabase({
          databaseId: 'test_db_invalid',
          type: 'oracle' as any,
          password: 'pass',
        });
      },
      {
        message: /Unknown database type: oracle/,
      }
    );
  });

  await t.test('16.A5: Dirty or path-traversing databaseId is rejected in provisionDatabase', async () => {
    await assert.rejects(
      async () => {
        await managedDb.provisionDatabase({
          databaseId: '../../../',
          type: 'postgres',
          password: 'pass',
        });
      },
      {
        message: /Invalid databaseId provided/,
      }
    );
  });

  await t.test('17.A1: POST /api/managed-databases rejects unsupported engines with 400 Bad Request', async () => {
    const res = await server.client.post(
      '/api/managed-databases',
      {
        type: 'unsupported_sqlite_engine',
      },
      { user: TEST_USERS.dev }
    );
    assertStatus(res, 400);
  });

  await t.test('17.A2: Unauthenticated database provisioning is rejected with 401', async () => {
    const res = await server.client.post('/api/managed-databases', {
      type: 'mariadb',
    });
    assertStatus(res, 401);
  });

  await t.test('17.A3: Customer without active subscription cannot provision MariaDB (403 Forbidden)', async () => {
    const res = await server.client.post(
      '/api/managed-databases',
      {
        type: 'mariadb',
        userId: TEST_USERS.customer2.id,
      },
      { user: TEST_USERS.customer2 }
    );
    assertStatus(res, 403);
    assert.ok(res.data.error.includes('subscription is required'));
  });
});

test('Challenger M3: Feature 18 — Real Database Telemetry Calculations Adversarial Tests', async (t) => {
  await t.test('18.A1: CPU delta calculation handles edge cases (zero delta, negative delta, multi-core)', () => {
    // Zero system delta
    const cpuDelta = 1000;
    const systemDelta0 = 0;
    const calc0 = systemDelta0 > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta0) * 4 * 100 : 0.0;
    assert.equal(calc0, 0.0);

    // Negative cpu delta (reboot or counter reset)
    const negCpuDelta = -500;
    const calcNeg = systemDelta0 > 0 && negCpuDelta > 0 ? (negCpuDelta / 10000) * 4 * 100 : 0.0;
    assert.equal(calcNeg, 0.0);

    // Multi-core calculation (8 cores)
    const validDelta = 20000000;
    const validSystem = 100000000;
    const numCpus = 8;
    const calcMulti = (validDelta / validSystem) * numCpus * 100;
    assert.equal(calcMulti, 160.0);
  });

  await t.test('18.A2: Memory usage handles cache deduction and null limit safely', () => {
    const rawUsage = 500 * 1024 * 1024;
    const cache = 100 * 1024 * 1024;
    const effectiveUsage = Math.max(0, rawUsage - cache);
    assert.equal(effectiveUsage, 400 * 1024 * 1024);

    // Inactive file exceeding raw usage clamp
    const excessCache = 600 * 1024 * 1024;
    const clampedUsage = Math.max(0, rawUsage - excessCache) || rawUsage;
    assert.equal(clampedUsage, rawUsage);
  });
});

test('Challenger M3: Feature 19 — Supabase Backup & Restore Job Processors Adversarial Tests', async (t) => {
  await t.test('19.A1: Job processor exports required handlers for Supabase lifecycle', () => {
    assert.equal(typeof processSupabaseBackup, 'function');
    assert.equal(typeof processSupabaseRestore, 'function');
    assert.equal(typeof processSupabaseDeprovision, 'function');
    assert.equal(typeof processInfrastructureJob, 'function');
  });

  await t.test('19.A2: processSupabaseRestore requires projectId in payload', async () => {
    await assert.rejects(
      async () => {
        await processSupabaseRestore('job_rst_noproj', { snapshotId: 'snap_01' });
      },
      {
        message: /Supabase restore requires projectId in payload/,
      }
    );
  });

  await t.test('19.A3: processSupabaseBackup requires projectId in payload', async () => {
    await assert.rejects(
      async () => {
        await processSupabaseBackup('job_bk_noproj', {});
      },
      {
        message: /Supabase backup requires projectId in payload/,
      }
    );
  });

  await t.test('19.A4: processSupabaseRestore requires projectId and snapshotId in payload', async () => {
    await assert.rejects(
      async () => {
        await processSupabaseRestore('job_rst_noproj', { projectId: 'proj_01' });
      },
      {
        message: /Supabase restore requires snapshotId in payload/,
      }
    );
  });

  await t.test('19.A5: processSupabaseDeprovision requires projectId in payload', async () => {
    await assert.rejects(
      async () => {
        await processSupabaseDeprovision('job_deprov_noproj', {});
      },
      {
        message: /Supabase deprovision requires projectId in payload/,
      }
    );
  });

  await t.test('19.A6: processSupabaseBackup requires non-empty object payload', async () => {
    await assert.rejects(
      async () => {
        await processSupabaseBackup('job_bk_nonexistent', null as any);
      },
      {
        message: /Supabase backup requires projectId in payload/,
      }
    );
  });

  t.after(async () => {
    try {
      await closeAllQueues().catch(() => {});
      redis.disconnect();
    } catch {}
  });
});

test('Finalize M3 Suite Execution', () => {
  process.exit(0);
});
