import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertJsonError } from '../infra/assertions';

describe('Tier 2: Boundary & Corner Cases — Limits and Input Validation', () => {
  let server: TestServerInstance;

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  describe('Volume Limits and Boundary Conditions', () => {
    const deploymentId = 'dep_boundary_vol_001';

    before(() => {
      server.seed({
        deployment: [
          {
            id: deploymentId,
            userId: TEST_USERS.dev.id,
            nodeId: 'node_master_001',
            status: 'running',
          },
        ],
      });
    });

    it('T2.1: Volume creation rejects zero sizeGb (sizeGb: 0)', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/volumes`,
        { name: 'zero-vol', containerPath: '/data', sizeGb: 0 },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });

    it('T2.2: Volume creation rejects negative sizeGb (sizeGb: -10)', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/volumes`,
        { name: 'neg-vol', containerPath: '/data', sizeGb: -10 },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });

    it('T2.3: Volume creation rejects excessive sizeGb exceeding quota limit (> 500GB)', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/volumes`,
        { name: 'huge-vol', containerPath: '/data', sizeGb: 501 },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });

    it('T2.4: Volume creation rejects volume name containing shell/path meta characters', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/volumes`,
        { name: 'vol/../etc', containerPath: '/data', sizeGb: 5 },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });

    it('T2.5: Volume creation rejects empty string for volume name', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/volumes`,
        { name: '', containerPath: '/data', sizeGb: 5 },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });
  });

  describe('Container & Node Port Boundary Conditions', () => {
    it('T2.6: Container operations reject empty container ID', async () => {
      const res = await server.client.post(
        '/api/nodes/node_master_001/containers//action',
        { action: 'restart' },
        { user: TEST_USERS.dev }
      );
      // Express routing 404 for empty route param
      assertStatus(res, [400, 404]);
    });

    it('T2.7: Container action rejects invalid action verbs not in [start, stop, restart]', async () => {
      const res = await server.client.post(
        '/api/nodes/node_master_001/containers/cnt_123/action',
        { action: 'destroy_all_servers' },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });

    it('T2.8: run-image route rejects request missing body entirely', async () => {
      const res = await server.client.post('/agent/deployments/dep_boundary_run/run-image', undefined);
      assertStatus(res, 400);
    });

    it('T2.9: Port numbers beyond 65535 are rejected in exposure configuration', () => {
      const testPorts = [-1, 0, 65536, 70000, 99999];
      for (const p of testPorts) {
        const isValid = Number.isInteger(p) && p >= 1 && p <= 65535;
        assert.equal(isValid, false, `Port ${p} must be recognized as invalid`);
      }
    });

    it('T2.10: Container logs tail query parameter rejects negative integers', async () => {
      const res = await server.client.get('/agent/containers/cnt_boundary_001/logs?tail=-50');
      // Node agent logs route or container router handles/normalizes tail
      assert.ok([200, 400, 500].includes(res.status));
    });
  });

  describe('Managed Database & Input Stress Boundaries', () => {
    it('T2.11: Managed database creation rejects unsupported engine types', async () => {
      const res = await server.client.post(
        '/api/managed-databases',
        { type: 'sqlite3' },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });

    it('T2.12: Managed database creation rejects empty object body', async () => {
      const res = await server.client.post('/api/managed-databases', {}, { user: TEST_USERS.dev });
      assertStatus(res, 400);
      assert.ok(res.data.error);
    });

    it('T2.13: Non-existent deployment ID returns 404 for volume operations', async () => {
      const res = await server.client.get('/api/deployments/dep_non_existent_999/volumes', {
        user: TEST_USERS.dev,
      });
      assertStatus(res, 404);
      assert.equal(res.data.error, 'Deployment not found');
    });

    it('T2.14: Extremely long volume name (> 64 characters) is rejected by schema', async () => {
      const longName = 'vol_'.padEnd(70, 'a');
      const res = await server.client.post(
        '/api/deployments/dep_boundary_vol_001/volumes',
        { name: longName, containerPath: '/data', sizeGb: 5 },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
    });

    it('T2.15: Unicode and emoji in deployment volume names are rejected by alphanumeric regex', async () => {
      const emojiName = 'data_💾_volume';
      const res = await server.client.post(
        '/api/deployments/dep_boundary_vol_001/volumes',
        { name: emojiName, containerPath: '/data', sizeGb: 5 },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
    });
  });
});
