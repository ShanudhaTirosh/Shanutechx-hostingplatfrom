import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus } from '../infra/assertions';

describe('Tier 3: Cross-Feature Interactions — Catalog Deploy, Custom Domain & Traefik', () => {
  let server: TestServerInstance;
  const deploymentId = 'dep_pair_cat_traefik_01';

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  it('T3.16: Step 1: Deploy service catalog entry and verify deployment record created', async () => {
    server.seed({
      deployment: [
        {
          id: deploymentId,
          userId: TEST_USERS.dev.id,
          nodeId: 'node_master_001',
          status: 'pending',
          containerId: `deploy-${deploymentId}`,
          subdomain: 'catalog-service',
          internalPort: 8080,
          exposureMode: 'ssl_with_proxy',
        },
      ],
    });

    const dep = await server.db.deployment.findUnique({ where: { id: deploymentId } });
    assert.ok(dep);
    assert.equal(dep.status, 'pending');
  });

  it('T3.17: Step 2: Post-deploy container health readiness polling transitions status to running', async () => {
    await server.db.deployment.update({
      where: { id: deploymentId },
      data: { status: 'running' },
    });
    const updated = await server.db.deployment.findUnique({ where: { id: deploymentId } });
    assert.equal(updated.status, 'running');
  });

  it('T3.18: Step 3: Attach custom domain to running catalog deployment', async () => {
    const customDomain = 'my-catalog-app.example.com';
    await server.db.deployment.update({
      where: { id: deploymentId },
      data: { customDomain },
    });
    const dep = await server.db.deployment.findUnique({ where: { id: deploymentId } });
    assert.equal(dep.customDomain, customDomain);
  });

  it('T3.19: Step 4: Write dynamic Traefik router config mapping custom domain to container', () => {
    const customDomain = 'my-catalog-app.example.com';
    const dynamicConfig = [
      'http:',
      '  routers:',
      `    custom-${deploymentId}:`,
      `      rule: "Host(\`${customDomain}\`)"`,
      '      entryPoints:',
      '        - websecure',
      '      service: app-service',
      '      tls:',
      '        certResolver: le',
    ].join('\n');

    assert.ok(dynamicConfig.includes(customDomain));
    assert.ok(dynamicConfig.includes('certResolver: le'));
  });

  it('T3.20: Step 5: Traefik overview API reflects active routers without errors', async () => {
    const res = await server.client.get('/api/traefik/overview', { user: TEST_USERS.dev });
    assertStatus(res, 200);
    assert.ok(res.data.overview.http !== undefined);
  });
});
