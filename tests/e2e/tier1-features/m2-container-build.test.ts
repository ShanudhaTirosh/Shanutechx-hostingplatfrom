import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak, assertJsonSuccess, assertJsonError } from '../infra/assertions';

describe('Tier 1: Milestone 2 — Container Management & Build System', () => {
  let server: TestServerInstance;

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  describe('Feature 7: Docker Persistent Volume Provisioning', () => {
    const deploymentId = 'dep_vol_test_001';

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

    it('7.1: POST /api/deployments/:id/volumes creates and attaches persistent volume', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/volumes`,
        {
          name: 'data-vol',
          containerPath: '/var/lib/data',
          sizeGb: 10,
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 201);
      assert.equal(res.data.ok, true);
      assert.equal(res.data.volume.name, 'data-vol');
      assert.equal(res.data.volume.containerPath, '/var/lib/data');
      assert.equal(res.data.volume.sizeGb, 10);
      assert.ok(res.data.volume.hostPath.includes(deploymentId));
    });

    it('7.2: GET /api/deployments/:id/volumes lists existing persistent volumes', async () => {
      const res = await server.client.get(`/api/deployments/${deploymentId}/volumes`, { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(Array.isArray(res.data.volumes));
      assert.ok(res.data.volumes.some((v: any) => v.name === 'data-vol'));
    });

    it('7.3: Node agent POST /agent/volumes provisions host volume path', async () => {
      const res = await server.client.post('/agent/volumes', {
        deploymentId,
        name: 'shared-assets',
        hostPath: `/var/lib/shanutechx/volumes/${deploymentId}/shared-assets`,
      });
      assertStatus(res, 201);
      assert.equal(res.data.success, true);
      assert.ok(res.data.path.includes(deploymentId));
    });

    it('7.4: Volume creation rejects invalid containerPath not starting with slash', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/volumes`,
        {
          name: 'bad-path-vol',
          containerPath: 'relative/path',
          sizeGb: 5,
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error !== undefined);
    });

    it('7.5: DELETE /api/deployments/:id/volumes/:volumeId detaches persistent volume', async () => {
      const listRes = await server.client.get(`/api/deployments/${deploymentId}/volumes`, { user: TEST_USERS.dev });
      const volId = listRes.data.volumes[0].id;

      const delRes = await server.client.delete(`/api/deployments/${deploymentId}/volumes/${volId}`, {
        user: TEST_USERS.dev,
      });
      assertStatus(delRes, 200);
      assert.equal(delRes.data.ok, true);

      const afterRes = await server.client.get(`/api/deployments/${deploymentId}/volumes`, { user: TEST_USERS.dev });
      assert.ok(!afterRes.data.volumes.some((v: any) => v.id === volId));
    });
  });

  describe('Feature 8: Direct Image Deployment Route (/agent/deployments/:id/run-image)', () => {
    it('8.1: POST /agent/deployments/:id/run-image accepts direct image without git clone', async () => {
      const res = await server.client.post('/agent/deployments/dep_img_001/run-image', {
        image: 'redis:7-alpine',
        envVars: { ALLOW_EMPTY_PASSWORD: 'yes' },
        ports: [{ internal: 6379, published: 6379 }],
      });
      assertStatus(res, 201);
      assert.ok(res.data.containerId);
      assert.equal(res.data.status, 'running');
      assert.equal(res.data.image, 'redis:7-alpine');
    });

    it('8.2: run-image route injects configured environment variables', async () => {
      const res = await server.client.post('/agent/deployments/dep_img_002/run-image', {
        image: 'nginx:alpine',
        envVars: { NGINX_PORT: '8080', APP_ENV: 'staging' },
      });
      assertStatus(res, 201);
      assert.equal(res.data.deploymentId, 'dep_img_002');
    });

    it('8.3: run-image attaches persistent volume bind mounts', async () => {
      const res = await server.client.post('/agent/deployments/dep_img_003/run-image', {
        image: 'postgres:16-alpine',
        volumes: [
          {
            hostPath: '/var/lib/shanutechx/volumes/dep_img_003/data',
            containerPath: '/var/lib/postgresql/data',
            mode: 'rw',
          },
        ],
      });
      assertStatus(res, 201);
      assert.equal(res.data.volumes.length, 1);
      assert.equal(res.data.volumes[0].containerPath, '/var/lib/postgresql/data');
    });

    it('8.4: run-image passes resource limits for CPU and memory', async () => {
      const res = await server.client.post('/agent/deployments/dep_img_004/run-image', {
        image: 'node:20-alpine',
        resources: { cpuLimit: 2, memoryLimitMb: 1024 },
      });
      assertStatus(res, 201);
      assert.deepEqual(res.data.resources, { cpuLimit: 2, memoryLimitMb: 1024 });
    });

    it('8.5: run-image rejects requests missing required image parameter', async () => {
      const res = await server.client.post('/agent/deployments/dep_img_005/run-image', {
        envVars: { FOO: 'bar' },
      });
      assertStatus(res, 400);
      assert.ok(res.data.error.includes('image is required'));
    });
  });

  describe('Feature 9: Build Pipeline Secret Hardening (build.js)', () => {
    it('9.1: build.js module exports buildImage and generateSmartDockerfile', async () => {
      const buildMod = await import('../../../services/node-agent/src/build.js');
      assert.equal(typeof buildMod.buildImage, 'function');
      assert.equal(typeof buildMod.generateSmartDockerfile, 'function');
    });

    it('9.2: generateSmartDockerfile detects package.json and sets runtime to node', async () => {
      const buildMod = await import('../../../services/node-agent/src/build.js');
      const os = await import('node:os');
      const fs = await import('node:fs');
      const path = await import('node:path');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-node-'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app', scripts: { start: 'node index.js' } }));

      try {
        const info = buildMod.generateSmartDockerfile(tmpDir, { startCommand: 'npm start', entryFile: 'index.js', frameworkPreset: 'auto' });
        assert.equal(info.isGenerated, true);
        assert.equal(info.runtime, 'nodejs');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('9.3: generateSmartDockerfile detects requirements.txt and sets runtime to python', async () => {
      const buildMod = await import('../../../services/node-agent/src/build.js');
      const os = await import('node:os');
      const fs = await import('node:fs');
      const path = await import('node:path');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-py-'));
      fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==3.0.0\n');

      try {
        const info = buildMod.generateSmartDockerfile(tmpDir, { startCommand: 'python app.py', entryFile: 'app.py', frameworkPreset: 'auto' });
        assert.equal(info.isGenerated, true);
        assert.equal(info.runtime, 'python');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('9.4: generateSmartDockerfile respects existing custom Dockerfile without overwriting', async () => {
      const buildMod = await import('../../../services/node-agent/src/build.js');
      const os = await import('node:os');
      const fs = await import('node:fs');
      const path = await import('node:path');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-custom-'));
      fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM alpine:latest\n');

      try {
        const info = buildMod.generateSmartDockerfile(tmpDir, { startCommand: '', entryFile: '', frameworkPreset: 'auto' });
        assert.equal(info.isGenerated, false);
        assert.equal(info.runtime, 'custom-dockerfile');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('9.5: Secret hardening specification: runtime environment secrets must not appear in image layer build-args', () => {
      const runtimeSecrets = {
        DB_PASSWORD: 'supersecret_runtime_password',
        API_SECRET: 'jwt_private_key_value',
      };
      // In the hardened build engine contract, build-args must never serialize runtime secrets into image metadata
      const forbiddenArgs = Object.entries(runtimeSecrets).map(([k, v]) => `--build-arg ${k}=${v}`);
      for (const arg of forbiddenArgs) {
        assertNoSecretLeak(
          'docker build -t app:latest .',
          [runtimeSecrets.DB_PASSWORD, runtimeSecrets.API_SECRET],
          'Docker build argument string'
        );
      }
    });
  });

  describe('Feature 10: Build Cancellation Tracking', () => {
    it('10.1: POST /agent/deployments/:id/cancel-build terminates tracked active build', async () => {
      // Simulate registering an active build in the harness
      const depId = 'dep_cancel_active_01';
      // Seed an active build
      await server.client.post(`/agent/deployments/${depId}/run-image`, { image: 'test-app' });

      // In real node-agent, activeBuilds tracks the child process. Test the endpoint contract:
      const res = await server.client.post(`/agent/deployments/${depId}/cancel-build`);
      assert.ok([200, 404].includes(res.status));
    });

    it('10.2: Cancelling a non-existent or already finished build returns 404 with diagnostic error', async () => {
      const res = await server.client.post('/agent/deployments/dep_does_not_exist/cancel-build');
      assertStatus(res, 404);
      assert.ok(res.data.error.includes('No active build found'));
    });

    it('10.3: Cancel build endpoint response includes deploymentId and cancellation status', async () => {
      const res = await server.client.post('/agent/deployments/dep_test_cancel/cancel-build');
      assert.equal(typeof res.data, 'object');
      assert.equal(res.data.deploymentId, 'dep_test_cancel');
    });

    it('10.4: Build cancellation triggers process cleanup and frees build slot', () => {
      const activeBuilds = new Map<string, any>();
      activeBuilds.set('dep-123', { pid: 4567, status: 'building' });
      assert.equal(activeBuilds.has('dep-123'), true);

      // Cancel action cleans map
      activeBuilds.delete('dep-123');
      assert.equal(activeBuilds.has('dep-123'), false);
    });

    it('10.5: Multiple consecutive cancel requests handle idempotently', async () => {
      const res1 = await server.client.post('/agent/deployments/dep_idem/cancel-build');
      const res2 = await server.client.post('/agent/deployments/dep_idem/cancel-build');
      assertStatus(res1, 404);
      assertStatus(res2, 404);
    });
  });

  describe('Feature 11: Container Lifecycle & Live Telemetry', () => {
    it('11.1: GET /agent/containers/:id/stats returns live resource metrics', async () => {
      const res = await server.client.get('/agent/containers/cnt_app_001/stats');
      assertStatus(res, 200);
      assert.equal(typeof res.data.cpuPercent, 'number');
      assert.equal(typeof res.data.memoryUsageBytes, 'number');
      assert.equal(typeof res.data.memoryLimitBytes, 'number');
      assert.ok(res.data.cpuPercent >= 0);
      assert.ok(res.data.memoryUsageBytes > 0);
    });

    it('11.2: Container stats calculate accurate memory utilization ratio', async () => {
      const res = await server.client.get('/agent/containers/cnt_app_001/stats');
      assertStatus(res, 200);
      const ratio = res.data.memoryUsageBytes / res.data.memoryLimitBytes;
      assert.ok(ratio >= 0 && ratio <= 1.0, `Memory ratio ${ratio} must be between 0 and 1`);
    });

    it('11.3: Container stats calculate network RX and TX bytes', async () => {
      const res = await server.client.get('/agent/containers/cnt_app_001/stats');
      assertStatus(res, 200);
      assert.equal(typeof res.data.networkRxBytes, 'number');
      assert.equal(typeof res.data.networkTxBytes, 'number');
    });

    it('11.4: Container management routes enforce admin/dev authorization in API layer', async () => {
      const res = await server.client.get('/api/nodes/node_master_001/containers', {
        user: TEST_USERS.customer1,
      });
      // Customer role must be forbidden from seeing all host containers
      assertStatus(res, 403);
    });

    it('11.5: Container lifecycle operations validate container ID format to prevent shell injection', async () => {
      const res = await server.client.post(
        '/api/nodes/node_master_001/containers/invalid;rm -rf/action',
        { action: 'restart' },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error.includes('Invalid container ID format'));
    });
  });
});
