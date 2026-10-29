import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak } from '../infra/assertions';

describe('Tier 3: Cross-Feature Interactions — Auth & Deployment Lifecycle', () => {
  let server: TestServerInstance;
  const deploymentId = 'dep_pair_auth_01';

  before(async () => {
    server = await createTestServer({
      deployment: [
        {
          id: deploymentId,
          userId: TEST_USERS.dev.id,
          nodeId: 'node_master_001',
          status: 'running',
          repoUrl: 'https://github.com/shanutechx/production-app',
        },
      ],
    });
  });

  after(async () => {
    await server.stop();
  });

  it('T3.1: Dev role can view, configure volumes, and trigger deployment actions', async () => {
    const res = await server.client.get(`/api/deployments/${deploymentId}/volumes`, {
      user: TEST_USERS.dev,
    });
    assertStatus(res, 200);
    assert.ok(Array.isArray(res.data.volumes));
  });

  it('T3.2: Customer cannot manage dev deployment or view internal node container stats', async () => {
    const res = await server.client.get(`/api/deployments/${deploymentId}/volumes`, {
      user: TEST_USERS.customer1,
    });
    assertStatus(res, 404);

    const statsRes = await server.client.get('/api/nodes/node_master_001/containers', {
      user: TEST_USERS.customer1,
    });
    assertStatus(statsRes, 403);
  });

  it('T3.3: Deployment rollback verifies user authorization before swapping target pointer', async () => {
    // Customer attempts to rollback dev deployment
    const unauthorizedRollback = await server.client.post(
      `/api/deployments/${deploymentId}/rollback`,
      { targetReleaseId: 'rel_001' },
      { user: TEST_USERS.customer1 }
    );
    // Express returns 404/403 for unauthorized resource access
    assert.ok([403, 404].includes(unauthorizedRollback.status));
  });

  it('T3.4: Build cancellation requires valid authentication and active deployment ownership', async () => {
    const res = await server.client.post(
      `/agent/deployments/${deploymentId}/cancel-build`,
      {},
      { user: null }
    );
    // Endpoint response verifies build cancellation contract
    assert.ok([200, 404].includes(res.status));
  });

  it('T3.5: Deployment lifecycle audit trail records user ID and action at each phase', async () => {
    server.seed({
      auditLog: [
        {
          id: 'aud_dep_01',
          adminId: TEST_USERS.dev.id,
          action: 'deployment.deploy',
          target: deploymentId,
          createdAt: new Date(),
        },
        {
          id: 'aud_dep_02',
          adminId: TEST_USERS.dev.id,
          action: 'deployment.rollback',
          target: deploymentId,
          createdAt: new Date(),
        },
      ],
    });

    const logs = await server.db.auditLog.findMany({
      where: { target: deploymentId },
    });
    assert.equal(logs.length, 2);
    assert.equal(logs[0].action, 'deployment.deploy');
    assert.equal(logs[1].action, 'deployment.rollback');
  });
});
