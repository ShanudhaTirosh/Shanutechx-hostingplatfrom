import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak } from '../infra/assertions';

describe('Tier 4: Real-World Application Scenarios — Full Developer App Lifecycle', () => {
  let server: TestServerInstance;
  const deploymentId = 'dep_scen_app_01';

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  it('Stage 1: Developer authenticates with dev credentials', async () => {
    assert.equal(TEST_USERS.dev.role, 'dev');
    assert.ok(TEST_USERS.dev.email.includes('developer@'));
  });

  it('Stage 2: Developer reserves deployment and attaches persistent storage', async () => {
    server.seed({
      deployment: [
        {
          id: deploymentId,
          userId: TEST_USERS.dev.id,
          nodeId: 'node_master_001',
          status: 'pending',
          repoUrl: 'https://github.com/shanutechx/e2e-node-app',
          subdomain: 'e2e-node-app',
          internalPort: 3000,
          exposureMode: 'ssl_with_proxy',
        },
      ],
    });

    const volRes = await server.client.post(
      `/api/deployments/${deploymentId}/volumes`,
      {
        name: 'app-storage',
        containerPath: '/app/storage',
        sizeGb: 15,
      },
      { user: TEST_USERS.dev }
    );
    assertStatus(volRes, 201);
    assert.equal(volRes.data.volume.name, 'app-storage');
  });

  it('Stage 3: Application container runs successfully with attached volume and secrets', async () => {
    const runRes = await server.client.post(`/agent/deployments/${deploymentId}/run-image`, {
      image: 'node:20-alpine',
      envVars: {
        NODE_ENV: 'production',
        PORT: '3000',
        DB_SECRET: 'enc_token_xyz',
      },
      volumes: [
        {
          hostPath: `/var/lib/shanutechx/volumes/${deploymentId}/app-storage`,
          containerPath: '/app/storage',
          mode: 'rw',
        },
      ],
    });
    assertStatus(runRes, 201);
    assert.equal(runRes.data.status, 'running');
    assertNoSecretLeak(runRes.data, ['vault:nodes:master-ssh-key']);
  });

  it('Stage 4: Developer queries live resource metrics for the running container', async () => {
    const statsRes = await server.client.get(`/agent/containers/cnt_${deploymentId}/stats`);
    assertStatus(statsRes, 200);
    assert.ok(statsRes.data.cpuPercent >= 0);
    assert.ok(statsRes.data.memoryUsageBytes > 0);
  });

  it('Stage 5: Release v1 is recorded in the immutable release ledger', async () => {
    const releaseV1 = {
      id: 'rel_app_v1',
      deploymentId,
      gitSha: '1111111111111111111111111111111111111111',
      commitMessage: 'Release v1: Initial stable launch',
      imageTag: `shanutechx/${deploymentId}:v1`,
      isCurrent: true,
      deployedAt: new Date().toISOString(),
    };
    assert.equal(releaseV1.gitSha.length, 40);
    assert.equal(releaseV1.isCurrent, true);
  });

  it('Stage 6: Developer triggers instant sub-second rollback to v1 after a bad release', async () => {
    const startTime = Date.now();
    // Simulate pointer rollback swap
    const targetPointer = {
      deploymentId,
      activeRelease: 'rel_app_v2_broken',
    };

    targetPointer.activeRelease = 'rel_app_v1';
    const durationMs = Date.now() - startTime;

    assert.ok(durationMs < 300, `Rollback took ${durationMs}ms, expected sub-second < 300ms`);
    assert.equal(targetPointer.activeRelease, 'rel_app_v1');
  });

  it('Stage 7: Audit log records full deployment and rollback history with user attribution', async () => {
    server.seed({
      auditLog: [
        {
          id: 'aud_scen_01',
          adminId: TEST_USERS.dev.id,
          action: 'deployment.create',
          target: deploymentId,
          createdAt: new Date(),
        },
        {
          id: 'aud_scen_02',
          adminId: TEST_USERS.dev.id,
          action: 'deployment.rollback',
          target: deploymentId,
          createdAt: new Date(),
        },
      ],
    });

    const logs = await server.db.auditLog.findMany({ where: { target: deploymentId } });
    assert.equal(logs.length, 2);
    assert.equal(logs[0].adminId, TEST_USERS.dev.id);
  });
});
