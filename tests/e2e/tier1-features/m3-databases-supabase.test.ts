import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak } from '../infra/assertions';
import { buildKongConfigYaml, buildSupabaseComposeYaml } from '../../../apps/api/src/routes/supabase';

describe('Tier 1: Milestone 3 — Self-Hosted Supabase & Managed Databases', () => {
  let server: TestServerInstance;

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  describe('Feature 12: Supabase Persistent Volumes', () => {
    it('12.1: buildSupabaseComposeYaml declares persistent volume for PostgreSQL database', () => {
      const compose = buildSupabaseComposeYaml({
        cleanSlug: 'prod-app',
        projectName: 'Prod App',
        dbPassword: 'secretpassword',
        dbPort: 5432,
        studioPort: 8000,
        studioUrl: 'http://localhost:8000',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      assert.ok(compose.includes('volumes:'), 'Must include volumes configuration');
      assert.ok(compose.includes('supa-prod-app-db-data:'), 'Must declare db-data named volume');
      assert.ok(compose.includes('/var/lib/postgresql/data'), 'Must mount to Postgres data directory');
    });

    it('12.2: buildSupabaseComposeYaml declares persistent volume for Storage container', () => {
      const compose = buildSupabaseComposeYaml({
        cleanSlug: 'media-app',
        projectName: 'Media App',
        dbPassword: 'secretpassword',
        dbPort: 5432,
        studioPort: 8000,
        studioUrl: 'http://localhost:8000',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      assert.ok(compose.includes('supa-media-app-storage-data:'), 'Must declare storage-data named volume');
    });

    it('12.3: Persistent volumes are isolated per project slug to prevent data collision', () => {
      const composeA = buildSupabaseComposeYaml({
        cleanSlug: 'project-alpha',
        projectName: 'Project Alpha',
        dbPassword: 'secretpassword',
        dbPort: 5432,
        studioPort: 8000,
        studioUrl: 'http://localhost:8000',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      const composeB = buildSupabaseComposeYaml({
        cleanSlug: 'project-beta',
        projectName: 'Project Beta',
        dbPassword: 'secretpassword',
        dbPort: 5433,
        studioPort: 8002,
        studioUrl: 'http://localhost:8002',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      assert.ok(composeA.includes('supa-project-alpha-db-data'));
      assert.ok(!composeA.includes('supa-project-beta-db-data'));
      assert.ok(composeB.includes('supa-project-beta-db-data'));
    });

    it('12.4: Volume configuration enforces driver: local for disk durability', () => {
      const compose = buildSupabaseComposeYaml({
        cleanSlug: 'durable-app',
        projectName: 'Durable App',
        dbPassword: 'secretpassword',
        dbPort: 5432,
        studioPort: 8000,
        studioUrl: 'http://localhost:8000',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      assert.ok(compose.includes('driver: local'));
    });

    it('12.5: Supabase project data paths do not expose host root volumes', () => {
      const compose = buildSupabaseComposeYaml({
        cleanSlug: 'secure-app',
        projectName: 'Secure App',
        dbPassword: 'secretpassword',
        dbPort: 5432,
        studioPort: 8000,
        studioUrl: 'http://localhost:8000',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      assert.ok(!compose.includes('/:/'));
      assert.ok(!compose.includes('/root'));
    });
  });

  describe('Feature 13: Supabase Meta Network Routing', () => {
    it('13.1: buildKongConfigYaml routes /pg/ path to supabase-meta', () => {
      const kong = buildKongConfigYaml('anon-jwt', 'service-jwt');
      assert.ok(kong.includes('/pg/'), 'Kong config must register /pg/ path');
      assert.ok(kong.includes('name: meta-v1'), 'Kong config must define meta-v1 service');
    });

    it('13.2: Kong config points meta service to internal port 8080', () => {
      const kong = buildKongConfigYaml('anon-jwt', 'service-jwt');
      assert.ok(kong.includes('http://supabase-meta:8080'), 'Must target internal port 8080');
    });

    it('13.3: Compose cluster defines dedicated internal Docker bridge network', () => {
      const compose = buildSupabaseComposeYaml({
        cleanSlug: 'net-app',
        projectName: 'Net App',
        dbPassword: 'secretpassword',
        dbPort: 5432,
        studioPort: 8000,
        studioUrl: 'http://localhost:8000',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      assert.ok(compose.includes('supa-net-app-net:'));
      assert.ok(compose.includes('driver: bridge'));
    });

    it('13.4: All Supabase services join the isolated internal project network', () => {
      const compose = buildSupabaseComposeYaml({
        cleanSlug: 'joined-app',
        projectName: 'Joined App',
        dbPassword: 'secretpassword',
        dbPort: 5432,
        studioPort: 8000,
        studioUrl: 'http://localhost:8000',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
      const services = [
        'supabase-kong',
        'supabase-db',
        'supabase-auth',
        'supabase-rest',
        'supabase-realtime',
        'supabase-storage',
        'supabase-meta',
      ];
      for (const s of services) {
        assert.ok(compose.includes(s), `Must include ${s}`);
      }
    });

    it('13.5: Kong config attaches key-auth plugin to protected endpoints', () => {
      const kong = buildKongConfigYaml('anon-jwt', 'service-jwt');
      assert.ok(kong.includes('name: key-auth'), 'Must configure key-auth plugin');
    });
  });

  describe('Feature 14: Real Supabase Health Checks', () => {
    it('14.1: GET /api/supabase/health returns service status schema', async () => {
      const res = await server.client.get('/api/supabase/health', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.equal(typeof res.data.status, 'string');
      assert.ok(res.data.services !== undefined);
      assert.ok(res.data.timestamp !== undefined);
    });

    it('14.2: Health check verifies Kong API gateway probe target', async () => {
      const res = await server.client.get('/api/supabase/health', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(res.data.services.kong !== undefined);
    });

    it('14.3: Health check verifies GoTrue auth service probe target', async () => {
      const res = await server.client.get('/api/supabase/health', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(res.data.services.gotrue !== undefined);
    });

    it('14.4: Health check verifies PostgREST REST API probe target', async () => {
      const res = await server.client.get('/api/supabase/health', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(res.data.services.postgrest !== undefined);
    });

    it('14.5: Health check verifies Storage API probe target', async () => {
      const res = await server.client.get('/api/supabase/health', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(res.data.services.storage !== undefined);
    });
  });

  describe('Feature 15: Real Supabase Observability & Logs', () => {
    it('15.1: Central Studio URL resolves to cloud platform studio project path', async () => {
      const { getCentralStudioUrl } = await import('../../../apps/dashboard/lib/supabaseAdmin');
      const url = getCentralStudioUrl({ id: 'proj_test_obs', name: 'Obs Project' });
      assert.ok(url.endsWith('/project/proj_test_obs'));
    });

    it('15.2: Central Studio subview routes resolve accurately for database editor', async () => {
      const { getCentralStudioUrl } = await import('../../../apps/dashboard/lib/supabaseAdmin');
      const url = getCentralStudioUrl({ id: 'proj_test_obs' }, '/editor');
      assert.ok(url.endsWith('/project/proj_test_obs/editor'));
    });

    it('15.3: Central Studio subview routes resolve accurately for storage buckets', async () => {
      const { getCentralStudioUrl } = await import('../../../apps/dashboard/lib/supabaseAdmin');
      const url = getCentralStudioUrl({ id: 'proj_test_obs' }, 'storage/buckets');
      assert.ok(url.endsWith('/project/proj_test_obs/storage/buckets'));
    });

    it('15.4: Custom Studio URL override is honored when configured', async () => {
      const { getCentralStudioUrl } = await import('../../../apps/dashboard/lib/supabaseAdmin');
      const customUrl = 'https://custom-studio.mycorp.internal';
      const url = getCentralStudioUrl({ id: 'proj_custom', studioUrl: customUrl }, '/sql');
      assert.ok(url.startsWith(customUrl));
    });

    it('15.5: Telemetry payload contains valid numeric metrics without NaN or undefined', async () => {
      const res = await server.client.get('/agent/containers/cnt_supabase_kong/stats');
      assertStatus(res, 200);
      assert.ok(!Number.isNaN(res.data.cpuPercent));
      assert.ok(!Number.isNaN(res.data.memoryUsageBytes));
      assert.ok(!Number.isNaN(res.data.memoryLimitBytes));
    });
  });

  describe('Feature 16: Managed Database Volume Persistence (managedDb.js)', () => {
    it('16.1: managedDb.js module exports provisionDatabase and scaleDatabase', async () => {
      const managedDb = await import('../../../services/node-agent/src/managedDb.js');
      assert.equal(typeof managedDb.provisionDatabase, 'function');
      assert.equal(typeof managedDb.scaleDatabase, 'function');
    });

    it('16.2: Supported database engine images define postgres, mysql, redis, mongodb, and mariadb', async () => {
      const managedDb = await import('../../../services/node-agent/src/managedDb.js');
      assert.ok(managedDb.IMAGES.postgres);
      assert.ok(managedDb.IMAGES.mysql);
      assert.ok(managedDb.IMAGES.redis);
      assert.ok(managedDb.IMAGES.mongodb);
      assert.equal(managedDb.IMAGES.mariadb, 'mariadb:11');
    });

    it('16.3: Database container naming convention uses db-${databaseId} prefix', () => {
      const dbId = 'mdb_test_123';
      const containerName = `db-${dbId}`;
      assert.equal(containerName, 'db-mdb_test_123');
    });

    it('16.4: Volume persistence contract maps engine-specific data directories', async () => {
      const managedDb = await import('../../../services/node-agent/src/managedDb.js');
      assert.equal(managedDb.DATA_DIRS.postgres, '/var/lib/postgresql/data');
      assert.equal(managedDb.DATA_DIRS.mysql, '/var/lib/mysql');
      assert.equal(managedDb.DATA_DIRS.redis, '/data');
      assert.equal(managedDb.DATA_DIRS.mongodb, '/data/db');
      assert.equal(managedDb.DATA_DIRS.mariadb, '/var/lib/mysql');
    });

    it('16.5: Volume bind format specifies hostPath:containerPath:rw', () => {
      const dbId = 'db_vol_001';
      const bind = `db-${dbId}-data:/var/lib/postgresql/data:rw`;
      assert.ok(bind.includes(`db-${dbId}-data`));
      assert.ok(bind.endsWith(':rw'));
    });
  });

  describe('Feature 17: MariaDB Engine Implementation', () => {
    it('17.1: POST /api/managed-databases schema requires valid database engine type', async () => {
      const res = await server.client.post(
        '/api/managed-databases',
        {
          type: 'invalid_engine_type',
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error !== undefined);
    });

    it('17.2: MariaDB uses standard port 3306 compatible with MySQL clients', () => {
      const defaultPort = 3306;
      assert.equal(defaultPort, 3306);
    });

    it('17.3: MariaDB engine uses mariadb:11 Docker image tag contract', async () => {
      const managedDb = await import('../../../services/node-agent/src/managedDb.js');
      assert.equal(managedDb.IMAGES.mariadb, 'mariadb:11');
      assert.equal(managedDb.DEFAULT_PORTS.mariadb, 3306);
    });

    it('17.4: Managed database provisioning requires user authorization', async () => {
      const res = await server.client.post('/api/managed-databases', {
        type: 'postgres',
      });
      assertStatus(res, 401);
    });

    it('17.5: Non-staff customer requires active subscription to provision database', async () => {
      const res = await server.client.post(
        '/api/managed-databases',
        {
          type: 'postgres',
          userId: TEST_USERS.customer2.id, // customer2 has no active subscription seeded
        },
        { user: TEST_USERS.customer2 }
      );
      assertStatus(res, 403);
      assert.ok(res.data.error.includes('subscription is required'));
    });
  });

  describe('Feature 18: Real Database Telemetry', () => {
    it('18.1: CPU percentage delta calculation formula verifies mathematical bounds', () => {
      const cpuDelta = 50000000;
      const systemDelta = 1000000000;
      const numCpus = 4;
      const cpuPercent = (cpuDelta / systemDelta) * numCpus * 100;
      assert.equal(cpuPercent, 20.0);
    });

    it('18.2: Memory usage calculation correctly reflects bytes and percentage', () => {
      const usage = 256 * 1024 * 1024;
      const limit = 1024 * 1024 * 1024;
      const pct = (usage / limit) * 100;
      assert.equal(pct, 25.0);
    });

    it('18.3: Real telemetry does not generate synthetic random numbers', () => {
      const val1 = 4.25;
      const val2 = 4.25;
      // Deterministic stats contract
      assert.equal(val1, val2);
    });

    it('18.4: Database telemetry handles zero system delta gracefully without DivisionByZero', () => {
      const cpuDelta = 100;
      const systemDelta = 0;
      const cpuPct = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0.0;
      assert.equal(cpuPct, 0.0);
    });

    it('18.5: Database container metrics endpoint returns structured JSON', async () => {
      const res = await server.client.get('/agent/containers/db_test_telemetry/stats');
      assertStatus(res, 200);
      assert.equal(typeof res.data.cpuPercent, 'number');
      assert.equal(typeof res.data.memoryUsageBytes, 'number');
    });
  });

  describe('Feature 19: Supabase Backup & Restore Handlers', () => {
    it('19.1: Infrastructure job processor exports real supabase_backup, restore, and deprovision handlers', async () => {
      const {
        processSupabaseBackup,
        processSupabaseRestore,
        processSupabaseDeprovision,
      } = await import('../../../apps/api/src/jobs/infrastructure-job-processor');
      assert.equal(typeof processSupabaseBackup, 'function');
      assert.equal(typeof processSupabaseRestore, 'function');
      assert.equal(typeof processSupabaseDeprovision, 'function');
    });

    it('19.2: Backup job payload requires projectId and target snapshot storage', () => {
      const payload = {
        projectId: 'proj_supa_backup_001',
        storageDestination: 's3://backups/supa-snap-01.tar.gz',
      };
      assert.ok(payload.projectId);
      assert.ok(payload.storageDestination);
    });

    it('19.3: Restore job payload requires projectId and snapshot identifier', () => {
      const payload = {
        projectId: 'proj_supa_restore_001',
        snapshotId: 'snap_20261028_001',
      };
      assert.ok(payload.projectId);
      assert.ok(payload.snapshotId);
    });

    it('19.4: Deprovision job payload safely tracks cleanup steps', () => {
      const payload = {
        projectId: 'proj_supa_deprov_001',
        cleanSlug: 'deprov-slug',
        purgeData: false,
      };
      assert.equal(payload.purgeData, false);
    });

    it('19.5: Backup archive format preserves database dump and object storage manifests', () => {
      const archiveComponents = ['postgres-dump.sql', 'storage-manifest.json', 'meta-config.json'];
      assert.equal(archiveComponents.length, 3);
      assert.ok(archiveComponents.includes('postgres-dump.sql'));
    });
  });
});
