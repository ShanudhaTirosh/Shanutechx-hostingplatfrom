import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { deployWebhooksRouter } from './deployWebhooks';
import { prisma } from '../lib/prisma';
import { buildAndRun } from '../lib/nodeAgentClient';

vi.mock('../lib/prisma', () => ({
  prisma: {
    deployment: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../lib/nodeAgentClient', () => ({
  buildAndRun: vi.fn(),
}));

vi.mock('../lib/discordWebhooks', () => ({ notifyDiscordChannel: vi.fn() }));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
  AuthedRequest: {},
}));

const SECRET = 'a'.repeat(64);
const DEPLOYMENT = {
  id: 'dep-1',
  userId: 'cust-1',
  repoUrl: 'https://github.com/acme/app',
  internalPort: 3000,
  subdomain: 'acme-app',
  deployWebhookSecret: SECRET,
  node: { id: 'node-1', ip: '1.2.3.4' },
};

function buildApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use((req: any, _res, next) => {
    req.user = { id: 'cust-1', role: 'customer' };
    next();
  });
  app.use('/api', deployWebhooksRouter);
  return app;
}

function githubSignature(body: string, secret: string) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('Deploy webhook — signature verification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a correctly-signed GitHub payload and triggers a rebuild', async () => {
    (prisma.deployment.findUnique as any).mockResolvedValue(DEPLOYMENT);
    (buildAndRun as any).mockResolvedValue({ phase: 'complete', containerId: 'c1' });
    const app = buildApp();

    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await request(app)
      .post('/api/deploy-webhooks/dep-1')
      .set('X-Hub-Signature-256', githubSignature(body, SECRET))
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(202);
    // give the fire-and-forget async block a tick to run
    await new Promise((r) => setTimeout(r, 20));
    expect(buildAndRun).toHaveBeenCalled();
  });

  it('rejects a GitHub payload signed with the wrong secret', async () => {
    (prisma.deployment.findUnique as any).mockResolvedValue(DEPLOYMENT);
    const app = buildApp();

    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await request(app)
      .post('/api/deploy-webhooks/dep-1')
      .set('X-Hub-Signature-256', githubSignature(body, 'wrong-secret'))
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(401);
    expect(buildAndRun).not.toHaveBeenCalled();
  });

  it('accepts a correct GitLab token header', async () => {
    (prisma.deployment.findUnique as any).mockResolvedValue(DEPLOYMENT);
    (buildAndRun as any).mockResolvedValue({ phase: 'complete', containerId: 'c1' });
    const app = buildApp();

    const res = await request(app)
      .post('/api/deploy-webhooks/dep-1')
      .set('X-Gitlab-Token', SECRET)
      .send({ ref: 'refs/heads/main' });

    expect(res.status).toBe(202);
  });

  it('rejects a request with no valid signature header at all', async () => {
    (prisma.deployment.findUnique as any).mockResolvedValue(DEPLOYMENT);
    const app = buildApp();

    const res = await request(app).post('/api/deploy-webhooks/dep-1').send({ ref: 'refs/heads/main' });

    expect(res.status).toBe(401);
    expect(buildAndRun).not.toHaveBeenCalled();
  });

  it('404s if the deployment has no webhook secret configured (feature not enabled)', async () => {
    (prisma.deployment.findUnique as any).mockResolvedValue({ ...DEPLOYMENT, deployWebhookSecret: null });
    const app = buildApp();

    const res = await request(app)
      .post('/api/deploy-webhooks/dep-1')
      .set('X-Gitlab-Token', SECRET)
      .send({ ref: 'refs/heads/main' });

    expect(res.status).toBe(404);
  });
});
