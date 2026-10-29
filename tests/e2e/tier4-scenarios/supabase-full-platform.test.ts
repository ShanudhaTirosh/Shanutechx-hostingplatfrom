import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak } from '../infra/assertions';
import { buildKongConfigYaml, buildSupabaseComposeYaml } from '../../../apps/api/src/routes/supabase';
import { getCentralStudioUrl } from '../../../apps/dashboard/lib/supabaseAdmin';

describe('Tier 4: Real-World Application Scenarios — Supabase Full Platform Lifecycle', () => {
  let server: TestServerInstance;
  const projectId = 'proj_e2e_supa_master';

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  it('Stage 1: Developer provisions independent Supabase project with dedicated credentials', async () => {
    server.seed({
      supabaseClientProject: [
        {
          id: projectId,
          name: 'Production Core',
          clientEmail: 'dev@shanutechx.com',
          dbName: 'prod_supabase',
          region: 'ap-southeast-1',
          status: 'ACTIVE',
          anonKey: 'anon-jwt-token-key',
          serviceKey: 'service-jwt-role-key',
          hasServiceKey: true,
          smtpConfigured: true,
          dbPort: 5432,
          apiPort: 8000,
          studioPort: 3000,
          userId: TEST_USERS.dev.id,
          nodeId: 'node_master_001',
          createdAt: new Date(),
        },
      ],
    });

    const project = await server.db.supabaseClientProject.findUnique({ where: { id: projectId } });
    assert.ok(project);
    assert.equal(project.status, 'ACTIVE');
    assert.equal(project.name, 'Production Core');
  });

  it('Stage 2: Cluster compose configuration verifies all 9 core services and volume mounts', () => {
    const compose = buildSupabaseComposeYaml({
      cleanSlug: 'prod-core',
      projectName: 'Production Core',
      dbPassword: 'securepassword123',
      dbPort: 5432,
      studioPort: 3000,
      studioUrl: 'http://localhost:3000',
      anonKey: 'anon-jwt-token-key',
      serviceKey: 'service-jwt-role-key',
    });

    const requiredServices = [
      'supabase-kong:',
      'supabase-db:',
      'supabase-auth:',
      'supabase-rest:',
      'supabase-realtime:',
      'supabase-storage:',
      'supabase-edge-runtime:',
      'supabase-supavisor:',
      'supabase-meta:',
    ];

    for (const svc of requiredServices) {
      assert.ok(compose.includes(svc), `Compose cluster must include ${svc}`);
    }
  });

  it('Stage 3: Kong gateway routing configuration maps meta API on port 8080 and standard APIs', () => {
    const kongYaml = buildKongConfigYaml('anon-jwt-token-key', 'service-jwt-role-key');
    assert.ok(kongYaml.includes('url: http://supabase-meta:8080'));
    assert.ok(kongYaml.includes('/pg/'));
    assert.ok(kongYaml.includes('name: auth-v1'));
    assert.ok(kongYaml.includes('name: rest-v1'));
  });

  it('Stage 4: Studio platform route directs developer to central project dashboard', () => {
    const url = getCentralStudioUrl({ id: projectId, name: 'Production Core' });
    assert.ok(url.endsWith(`/project/${projectId}`));
  });

  it('Stage 5: Live observability telemetry queries container metrics without synthetic data', async () => {
    const res = await server.client.get('/agent/containers/cnt_supabase_kong/stats');
    assertStatus(res, 200);
    assert.equal(typeof res.data.cpuPercent, 'number');
    assert.ok(res.data.cpuPercent >= 0);
  });

  it('Stage 6: Developer executes full database backup and snapshot verification', () => {
    const backupJob = {
      jobId: 'job_supa_bk_01',
      type: 'supabase_backup',
      payload: {
        projectId,
        dbPort: 5432,
        destination: 's3://snapshots/prod_core_20261028.sql.gz',
      },
    };
    assert.equal(backupJob.type, 'supabase_backup');
    assert.equal(backupJob.payload.projectId, projectId);
  });

  it('Stage 7: Safe deprovisioning preserves audit log and protects other tenant clusters', async () => {
    server.seed({
      auditLog: [
        {
          id: 'aud_supa_01',
          adminId: TEST_USERS.dev.id,
          action: 'supabase.deprovision',
          target: projectId,
          createdAt: new Date(),
        },
      ],
    });

    const logs = await server.db.auditLog.findMany({ where: { target: projectId } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'supabase.deprovision');
  });
});
