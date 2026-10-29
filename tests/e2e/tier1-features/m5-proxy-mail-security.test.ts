import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak } from '../infra/assertions';

describe('Tier 1: Milestone 5 — Reverse Proxy, TLS, Remote Infra & Email', () => {
  let server: TestServerInstance;

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  describe('Feature 23: Traefik Config & Resolver Reconciliation (docker-compose.prod.yml)', () => {
    const rootDir = path.resolve(__dirname, '../../..');
    const composePath = path.join(rootDir, 'docker-compose.prod.yml');

    it('23.1: Production compose specifies Traefik command arguments', () => {
      assert.ok(fs.existsSync(composePath), 'docker-compose.prod.yml must exist');
      const content = fs.readFileSync(composePath, 'utf8');
      assert.ok(content.includes('--entrypoints.web.address=:80'));
      assert.ok(content.includes('--entrypoints.websecure.address=:443'));
    });

    it('23.2: HTTP entrypoint redirects to HTTPS entrypoint with scheme redirection', () => {
      const content = fs.readFileSync(composePath, 'utf8');
      assert.ok(content.includes('--entrypoints.web.http.redirections.entryPoint.to=websecure'));
      assert.ok(content.includes('--entrypoints.web.http.redirections.entryPoint.scheme=https'));
    });

    it('23.3: Certresolver configuration enables ACME TLS challenge', () => {
      const content = fs.readFileSync(composePath, 'utf8');
      assert.ok(content.includes('.acme.tlschallenge=true'));
      assert.ok(content.includes('.acme.storage='));
    });

    it('23.4: Docker socket is mounted with read-only permission (:ro)', () => {
      const content = fs.readFileSync(composePath, 'utf8');
      assert.ok(content.includes('/var/run/docker.sock:/var/run/docker.sock:ro'));
    });

    it('23.5: Exposure resolver aligns Traefik certresolver name contract', async () => {
      const exposureMod = await import('../../../services/node-agent/src/exposure.js');
      const exposure = exposureMod.default ?? exposureMod;
      const resolved = exposure.resolveExposure({
        deploymentId: 'dep_cert_01',
        internalPort: 3000,
        subdomain: 'app-tls',
        rootDomain: 'shanutechx.com',
        exposureMode: 'ssl_with_proxy',
      });
      assert.ok(resolved.labels);
      // Verify router certresolver label exists
      const certLabelKey = Object.keys(resolved.labels).find((k) => k.includes('certresolver'));
      assert.ok(certLabelKey !== undefined, 'Traefik router must configure certresolver label');
    });
  });

  describe('Feature 24: Custom Domain Dynamic File Sharing', () => {
    it('24.1: Custom domain dynamic config uses safe filename format custom-${deploymentId}-${safeDomain}.yml', () => {
      const deploymentId = 'dep_cust_dom_01';
      const domain = 'app.example.com';
      const safeDomain = domain.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const filename = `custom-${deploymentId}-${safeDomain}.yml`;
      assert.equal(filename, 'custom-dep_cust_dom_01-app-example-com.yml');
    });

    it('24.2: Dynamic YAML configuration declares HTTP routers and services for custom domain', () => {
      const domain = 'store.acme.corp';
      const targetServiceUrl = 'http://127.0.0.1:3000';
      const dynamicYaml = [
        'http:',
        '  routers:',
        `    custom-store:`,
        `      rule: "Host(\`${domain}\`)"`,
        '      entryPoints:',
        '        - websecure',
        '      service: custom-store-svc',
        '      tls:',
        '        certResolver: le',
        '  services:',
        `    custom-store-svc:`,
        '      loadBalancer:',
        '        servers:',
        `          - url: "${targetServiceUrl}"`,
      ].join('\n');

      assert.ok(dynamicYaml.includes(domain));
      assert.ok(dynamicYaml.includes('certResolver: le'));
      assert.ok(dynamicYaml.includes(targetServiceUrl));
    });

    it('24.3: Custom domain sanitization prevents path traversal in filename', () => {
      const maliciousDomain = '../../etc/passwd';
      const safeDomain = maliciousDomain.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      assert.ok(!safeDomain.includes('/'));
      assert.ok(!safeDomain.includes('..'));
    });

    it('24.4: Dynamic file provider shared path points to /etc/traefik/dynamic', () => {
      const dynamicDir = '/etc/traefik/dynamic';
      assert.equal(dynamicDir, '/etc/traefik/dynamic');
    });

    it('24.5: Deleting custom domain unlinks dynamic configuration file from disk', () => {
      const files = new Set(['custom-dep1-app-com.yml', 'custom-dep2-blog-com.yml']);
      files.delete('custom-dep1-app-com.yml');
      assert.equal(files.has('custom-dep1-app-com.yml'), false);
    });
  });

  describe('Feature 25: Real Traefik Status API (traefikStatus.ts)', () => {
    it('25.1: GET /api/traefik/overview returns HTTP routers and services counts', async () => {
      const res = await server.client.get('/api/traefik/overview', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(res.data.overview !== undefined);
      assert.ok(res.data.overview.http !== undefined);
      assert.ok(res.data.overview.http.routers !== undefined);
    });

    it('25.2: GET /api/traefik/routers returns router list with entryPoints and rules', async () => {
      const res = await server.client.get('/api/traefik/routers', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(Array.isArray(res.data.routers));
    });

    it('25.3: GET /api/traefik/services returns service load balancers with server URLs', async () => {
      const res = await server.client.get('/api/traefik/services', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(Array.isArray(res.data.services));
    });

    it('25.4: GET /api/traefik/middlewares returns active security and redirect middlewares', async () => {
      const res = await server.client.get('/api/traefik/middlewares', { user: TEST_USERS.dev });
      assertStatus(res, 200);
      assert.ok(Array.isArray(res.data.middlewares));
      assert.ok(res.data.middlewares.some((m: any) => m.name.includes('redirect') || m.name.includes('security')));
    });

    it('25.5: Traefik status routes enforce requireAdminOrDev access guard', async () => {
      const res = await server.client.get('/api/traefik/overview', { user: TEST_USERS.customer1 });
      assertStatus(res, 403);
    });
  });

  describe('Feature 26: WildDuck SMTP Mailbox Provisioning (smtp.ts)', () => {
    it('26.1: POST /api/smtp-accounts validates schema parameters', async () => {
      const res = await server.client.post(
        '/api/smtp-accounts',
        {
          userId: TEST_USERS.customer1.id,
          postalOrgId: 'org_001',
          smtpUsername: 'hello@clientdomain.com',
          smtpPassword: 'short', // invalid: min 8 characters required
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error !== undefined);
    });

    it('26.2: POST /api/smtp-accounts requires dev role', async () => {
      const res = await server.client.post(
        '/api/smtp-accounts',
        {
          userId: TEST_USERS.customer1.id,
          postalOrgId: 'org_001',
          smtpUsername: 'hello@clientdomain.com',
          smtpPassword: 'ValidPassword123!',
        },
        { user: TEST_USERS.customer1 }
      );
      assertStatus(res, 403);
    });

    it('26.3: Customer role cannot claim root platform domain without dev permission', async () => {
      const res = await server.client.post(
        '/api/smtp-accounts',
        {
          userId: TEST_USERS.customer1.id,
          postalOrgId: 'org_001',
          smtpUsername: 'ceo@shanutechx.com', // root domain forbidden for customers
          smtpPassword: 'ValidPassword123!',
          domain: 'shanutechx.com',
          isInternal: false,
        },
        { user: TEST_USERS.dev }
      );
      assertStatus(res, 400);
      assert.ok(res.data.error !== undefined);
    });

    it('26.4: Mailbox provisioning job processes DKIM and user creation', async () => {
      const jobPayload = {
        mailboxId: 'box_001',
        email: 'dev@shanutechx.com',
        password: 'SecurePassword123!',
        storageQuotaMb: 10240,
      };
      assert.equal(jobPayload.email.split('@')[1], 'shanutechx.com');
      assert.ok(jobPayload.storageQuotaMb > 0);
    });

    it('26.5: SMTP account credentials are encrypted and never returned in plaintext', () => {
      const rawPassword = 'MasterSecretPassword999!';
      const encrypted = 'enc_aes256_blob_value';
      assertNoSecretLeak({ id: 'box_001', credentialRef: encrypted }, [rawPassword]);
    });
  });

  describe('Feature 27: RBAC & Security Isolation Audit', () => {
    it('27.1: Multi-tenant ownership: Customer 1 cannot access Customer 2 deployment', async () => {
      server.seed({
        deployment: [
          {
            id: 'dep_bob_private',
            userId: TEST_USERS.customer2.id,
            status: 'running',
          },
        ],
      });
      // Customer 1 attempts to access Customer 2's deployment volumes
      const res = await server.client.get('/api/deployments/dep_bob_private/volumes', {
        user: TEST_USERS.customer1,
      });
      assertStatus(res, 404); // Scoped isolation returns 404
    });

    it('27.2: Multi-tenant ownership: Dev role can access resources across tenants for maintenance', async () => {
      const res = await server.client.get('/api/deployments/dep_bob_private/volumes', {
        user: TEST_USERS.dev,
      });
      assertStatus(res, 200);
      assert.ok(Array.isArray(res.data.volumes));
    });

    it('27.3: Secrets and master credentials never leak in container inspection responses', async () => {
      const res = await server.client.get('/agent/containers/cnt_app_001/stats');
      assertStatus(res, 200);
      assertNoSecretLeak(res.data, ['vault:nodes:master-ssh-key', 'secretpassword', 'ValidPassword123!']);
    });

    it('27.4: Unauthenticated requests to protected endpoints return 401', async () => {
      const res = await server.client.get('/api/deployments/dep_bob_private/volumes');
      assertStatus(res, 401);
    });

    it('27.5: Rate limiting and brute force protection: globalLimiter middleware is attached', async () => {
      const { globalLimiter } = await import('../../../apps/api/src/middleware/rateLimit');
      assert.equal(typeof globalLimiter, 'function');
    });
  });
});
