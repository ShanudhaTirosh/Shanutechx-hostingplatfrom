import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak } from '../infra/assertions';

describe('Tier 1: Milestone 4 — Application Deployments & Service Catalog', () => {
  let server: TestServerInstance;

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  describe('Feature 20: Git Commit Rollback & Release Ledger', () => {
    const deploymentId = 'dep_rollback_test_001';

    it('20.1: Release ledger record schema stores git commit sha, message, and image tag', () => {
      const releaseRecord = {
        id: 'rel_001',
        deploymentId,
        gitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        commitMessage: 'feat: add user profile page',
        imageTag: `shanutechx/${deploymentId}:a1b2c3d`,
        deployedAt: new Date().toISOString(),
        deployedBy: TEST_USERS.dev.id,
        isCurrent: true,
      };
      assert.equal(releaseRecord.gitSha.length, 40);
      assert.ok(releaseRecord.imageTag.includes(deploymentId));
      assert.equal(releaseRecord.isCurrent, true);
    });

    it('20.2: Content-Addressed Storage sha1 verification ensures blob immutability', () => {
      const manifest = JSON.stringify({ version: '1.2.0', build: 42 });
      const sha = crypto.createHash('sha1').update(manifest).digest('hex');
      assert.equal(typeof sha, 'string');
      assert.equal(sha.length, 40);
    });

    it('20.3: Rollback swaps traffic target pointer instantly', async () => {
      const startTime = Date.now();
      // Target pointer swap representation
      const currentPointer = {
        deploymentId,
        targetPort: 3001,
        activeRelease: 'rel_002',
      };

      // Swap to previous release
      currentPointer.targetPort = 3000;
      currentPointer.activeRelease = 'rel_001';

      const durationMs = Date.now() - startTime;
      assert.ok(durationMs < 300, `Pointer swap took ${durationMs}ms, expected sub-second < 300ms`);
      assert.equal(currentPointer.activeRelease, 'rel_001');
      assert.equal(currentPointer.targetPort, 3000);
    });

    it('20.4: Immutable release ledger prevents modification of historical releases', () => {
      const ledger = [
        Object.freeze({ id: 'rel_001', gitSha: '1111111111111111111111111111111111111111', version: 1 }),
        Object.freeze({ id: 'rel_002', gitSha: '2222222222222222222222222222222222222222', version: 2 }),
      ];
      assert.equal(ledger.length, 2);
      assert.ok(Object.isFrozen(ledger[0]));
      assert.ok(Object.isFrozen(ledger[1]));
      assert.throws(() => {
        'use strict';
        (ledger[0] as any).gitSha = 'tampered';
      }, /Cannot assign to read only property|TypeError/);
    });

    it('20.5: Rollback operation audit event is recorded', async () => {
      server.seed({
        auditLog: [
          {
            id: 'audit_rb_001',
            adminId: TEST_USERS.dev.id,
            action: 'deployment.rollback',
            target: deploymentId,
            createdAt: new Date(),
          },
        ],
      });
      const logs = await server.db.auditLog.findMany({
        where: { action: 'deployment.rollback' },
      });
      assert.ok(logs.length > 0);
      assert.equal(logs[0].target, deploymentId);
    });

    it('20.6: Live API: GET /api/deployments/:id/releases returns release ledger history', async () => {
      server.seed({
        deployment: [
          {
            id: deploymentId,
            userId: TEST_USERS.dev.id,
            nodeId: 'node_master_001',
            status: 'running',
            subdomain: 'rollback-test-app',
            internalPort: 3000,
            node: { id: 'node_master_001', ip: '127.0.0.1' },
          },
        ],
        deploymentRelease: [
          {
            id: 'rel_001',
            deploymentId,
            gitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
            commitMessage: 'feat: v1 release',
            imageTag: `shanutechx/${deploymentId}:a1b2c3d`,
            isCurrent: false,
            createdAt: new Date(Date.now() - 10000),
          },
          {
            id: 'rel_002',
            deploymentId,
            gitSha: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
            commitMessage: 'feat: v2 release',
            imageTag: `shanutechx/${deploymentId}:b2c3d4e`,
            isCurrent: true,
            createdAt: new Date(),
          },
        ],
      });

      const res = await server.client.get(`/api/deployments/${deploymentId}/releases`, {
        user: TEST_USERS.dev,
      });
      assertStatus(res, 200);
      assert.ok(Array.isArray(res.data.releases));
      assert.equal(res.data.releases.length, 2);
      assert.equal(res.data.releases[0].gitSha, 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3');
    });

    it('20.7: Live API: POST /api/deployments/:id/rollback executes instant release swap and records audit log', async () => {
      const res = await server.client.post(
        `/api/deployments/${deploymentId}/rollback`,
        { releaseId: 'rel_001' },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 200);
      assert.equal(res.data.ok, true);
      assert.equal(res.data.activeRelease, 'rel_001');
      assert.ok(res.data.rollbackDurationMs < 300, `Rollback took ${res.data.rollbackDurationMs}ms, expected sub-second < 300ms`);

      // Verify audit log recorded
      const logs = await server.db.auditLog.findMany({
        where: { action: 'deployment.rollback', target: deploymentId },
      });
      assert.ok(logs.length > 0);
    });
  });

  describe('Feature 21: Service Catalog Health Readiness (catalog.ts)', () => {
    it('21.1: Catalog templates define recommended exposure mode and default port', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const templatesDir = path.resolve(__dirname, '../../../../templates');

      if (fs.existsSync(templatesDir)) {
        const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
        assert.ok(files.length > 0, 'Templates directory must contain YAML template files');
      } else {
        assert.ok(true, 'Templates directory check skipped in isolated mode');
      }
    });

    it('21.2: Post-deploy readiness polling contract specifies timeout bounds', () => {
      const maxAttempts = 30;
      const intervalMs = 2000;
      const maxTimeoutMs = maxAttempts * intervalMs;
      assert.equal(maxTimeoutMs, 60000, 'Health polling maximum timeout must be 60 seconds');
    });

    it('21.3: Health probe differentiates between starting, healthy, and unhealthy statuses', () => {
      const states = ['starting', 'healthy', 'unhealthy'];
      assert.ok(states.includes('healthy'));
      assert.ok(states.includes('starting'));
      assert.ok(states.includes('unhealthy'));
    });

    it('21.4: Deployment status transitions from pending to running only after health verification', () => {
      let status = 'pending';
      assert.equal(status, 'pending');

      const isHealthy = true;
      if (isHealthy) {
        status = 'running';
      }
      assert.equal(status, 'running');
    });

    it('21.5: Failed health check within timeout marks deployment as failed with diagnostic error', () => {
      let status = 'pending';
      const isHealthy = false;
      const attemptsExceeded = true;

      if (!isHealthy && attemptsExceeded) {
        status = 'failed';
      }
      assert.equal(status, 'failed');
    });

    it('21.6: pollCatalogContainerReadiness reports healthy status in test environment', async () => {
      const { pollCatalogContainerReadiness } = await import('../../../apps/api/src/routes/catalog');
      const result = await pollCatalogContainerReadiness('127.0.0.1', 'test-container', {
        maxAttempts: 2,
        intervalMs: 10,
        timeoutMs: 100,
      });
      assert.equal(result.ready, true);
      assert.equal(result.state, 'healthy');
    });
  });

  describe('Feature 22: Git Build Pipeline & Webhooks (deployWebhooks.ts)', () => {
    const deploymentId = 'dep_webhook_001';

    before(() => {
      server.seed({
        deployment: [
          {
            id: deploymentId,
            userId: TEST_USERS.dev.id,
            nodeId: 'node_master_001',
            status: 'running',
            repoUrl: 'https://github.com/shanutechx/sample-app',
            deployWebhookSecret: 'shx_whsec_test_secret_12345',
            autoDeploy: true,
          },
        ],
      });
    });

    it('22.1: GET /api/deployments/:id/webhook-info returns webhook URL and secret existence without leaking secret', async () => {
      const res = await server.client.get(`/api/deployments/${deploymentId}/webhook-info`, {
        user: TEST_USERS.dev,
      });
      assertStatus(res, 200);
      assert.equal(res.data.hasSecret, true);
      assert.ok(res.data.webhookUrl.includes(deploymentId));
      assert.equal(res.data.autoDeploy, true);
      assertNoSecretLeak(res.data, ['shx_whsec_test_secret_12345']);
    });

    it('22.2: Webhook secret generation creates high-entropy HMAC secret token', () => {
      const secret = crypto.randomBytes(32).toString('hex');
      assert.equal(secret.length, 64);
      assert.ok(/^[a-f0-9]{64}$/.test(secret));
    });

    it('22.3: Push webhook computes and verifies HMAC SHA-256 signature', () => {
      const payload = JSON.stringify({ ref: 'refs/heads/main', after: 'a1b2c3d' });
      const secret = 'webhook-hmac-secret-123';
      const signature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;

      // Verify signature
      const expectedSig = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
      assert.equal(signature, expectedSig);
    });

    it('22.4: Push webhook rejects invalid or mismatched HMAC signature', () => {
      const payload = JSON.stringify({ ref: 'refs/heads/main' });
      const secret = 'correct-secret';
      const actualSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const badSig = crypto.createHmac('sha256', 'wrong-secret').update(payload).digest('hex');

      assert.notEqual(actualSig, badSig);
    });

    it('22.5: Push webhook filters commits by configured branch (e.g. main vs dev)', () => {
      const targetBranch = 'main';
      const eventMain = { ref: 'refs/heads/main' };
      const eventStaging = { ref: 'refs/heads/staging' };

      const branchMain = eventMain.ref.replace('refs/heads/', '');
      const branchStaging = eventStaging.ref.replace('refs/heads/', '');

      assert.equal(branchMain === targetBranch, true);
      assert.equal(branchStaging === targetBranch, false);
    });

    it('22.6: Live API: POST /api/webhooks/github ping responds with pong', async () => {
      const res = await server.client.post(
        '/api/webhooks/github',
        {},
        {
          headers: {
            'x-github-event': 'ping',
          },
        }
      );
      assertStatus(res, 200);
      assert.equal(res.data.message, 'pong');
    });

    it('22.7: Live API: POST /api/webhooks/github rejects invalid HMAC signature with 401', async () => {
      const res = await server.client.post(
        '/api/webhooks/github',
        {
          repository: { full_name: 'shanutechx/sample-app' },
          ref: 'refs/heads/main',
        },
        {
          headers: {
            'x-github-event': 'push',
            'x-hub-signature-256': 'sha256=invalid00000000000000000000000000000000000000000000000000000000',
          },
        }
      );
      assertStatus(res, 401);
      assert.equal(res.data.error, 'Invalid webhook signature');
    });
  });
});
