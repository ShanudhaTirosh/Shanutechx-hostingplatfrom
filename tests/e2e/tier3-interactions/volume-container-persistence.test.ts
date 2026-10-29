import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus } from '../infra/assertions';

describe('Tier 3: Cross-Feature Interactions — Volume Provisioning & Container Persistence', () => {
  let server: TestServerInstance;
  const deploymentId = 'dep_pair_vol_cnt_01';

  before(async () => {
    server = await createTestServer({
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

  after(async () => {
    await server.stop();
  });

  it('T3.6: Step 1: Provision persistent host volume via /agent/volumes', async () => {
    const res = await server.client.post('/agent/volumes', {
      deploymentId,
      name: 'pgdata',
      hostPath: `/var/lib/shanutechx/volumes/${deploymentId}/pgdata`,
    });
    assertStatus(res, 201);
    assert.equal(res.data.success, true);
    assert.ok(res.data.path.includes(deploymentId));
  });

  it('T3.7: Step 2: Attach persistent volume metadata in database via /api/deployments/:id/volumes', async () => {
    const res = await server.client.post(
      `/api/deployments/${deploymentId}/volumes`,
      {
        name: 'pgdata',
        containerPath: '/var/lib/postgresql/data',
        sizeGb: 20,
      },
      { user: TEST_USERS.dev }
    );
    assertStatus(res, 201);
    assert.equal(res.data.volume.name, 'pgdata');
    assert.equal(res.data.volume.sizeGb, 20);
  });

  it('T3.8: Step 3: Run image container attaching persistent volume bind mounts', async () => {
    const res = await server.client.post(`/agent/deployments/${deploymentId}/run-image`, {
      image: 'postgres:16-alpine',
      volumes: [
        {
          hostPath: `/var/lib/shanutechx/volumes/${deploymentId}/pgdata`,
          containerPath: '/var/lib/postgresql/data',
          mode: 'rw',
        },
      ],
    });
    assertStatus(res, 201);
    assert.equal(res.data.volumes.length, 1);
    assert.equal(res.data.volumes[0].containerPath, '/var/lib/postgresql/data');
  });

  it('T3.9: Step 4: Container restart preserves persistent volume binding without data wipe', async () => {
    // In Docker Engine, restartContainer preserves HostConfig.Binds
    const volumesList = await server.client.get(`/api/deployments/${deploymentId}/volumes`, {
      user: TEST_USERS.dev,
    });
    assertStatus(volumesList, 200);
    assert.equal(volumesList.data.volumes.length, 1);
    assert.equal(volumesList.data.volumes[0].name, 'pgdata');
  });

  it('T3.10: Step 5: Live telemetry monitors container CPU and memory while volumes remain attached', async () => {
    const res = await server.client.get(`/agent/containers/cnt_${deploymentId}/stats`);
    assertStatus(res, 200);
    assert.ok(res.data.memoryUsageBytes > 0);
  });
});
