import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import { leasewebRouter } from './leaseweb';
import { prisma } from '../lib/prisma';
import * as leasewebClient from '../lib/leasewebClient';

/**
 * Locks in the product requirement: customers can Stop/Shutdown/Restart
 * their own VPS and reset its password, but can NEVER Terminate it —
 * that action is admin/dev only, regardless of ownership.
 */

vi.mock('../lib/prisma', () => ({
  prisma: {
    vpsProvision: { findUnique: vi.fn(), update: vi.fn() },
    node: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    leasewebApiLog: { create: vi.fn() },
  },
}));

vi.mock('../lib/leasewebClient', () => ({
  cancelVps: vi.fn(),
  resetVpsPassword: vi.fn(),
  getVps: vi.fn(),
  listVpsProducts: vi.fn(),
  listVps: vi.fn(),
  setVpsReference: vi.fn(),
  startVps: vi.fn(),
  stopVps: vi.fn(),
  rebootVps: vi.fn(),
  getConsoleUrl: vi.fn(),
  getCredentials: vi.fn(),
  listSnapshots: vi.fn(),
  createSnapshot: vi.fn(),
  getMonitoringStatus: vi.fn(),
  getDataTraffic: vi.fn(),
  LeasewebApiError: class LeasewebApiError extends Error {},
}));

vi.mock('../lib/discordWebhooks', () => ({ notifyDiscordChannel: vi.fn() }));
vi.mock('../lib/notifications', () => ({ notifyCustomer: vi.fn() }));
vi.mock('../lib/currency', () => ({ convertToLkr: (n: number) => n }));
vi.mock('../lib/secretsVault', () => ({ encryptSecret: (s: string) => s, decryptSecret: (s: string) => s }));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
  requireAdminOrDev: (req: any, res: any, next: any) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'dev')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
  AuthedRequest: {},
}));

const CUSTOMER = { id: 'cust-1', email: 'customer@example.com', role: 'customer' };
const ADMIN = { id: 'admin-1', email: 'admin@shanutechx.com', role: 'admin' };

const PROVISION = { id: 'prov-1', userId: 'cust-1', leasewebVpsId: 'lsw-vps-1' };

function buildApp(user: typeof CUSTOMER | typeof ADMIN) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api', leasewebRouter);
  return app;
}

describe('VPS terminate — admin/dev only, never the customer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks a customer from terminating their own VPS', async () => {
    (prisma.vpsProvision.findUnique as any).mockResolvedValue(PROVISION);
    const app = buildApp(CUSTOMER);

    const res = await request(app).post('/api/leaseweb/instances/provision/prov-1/terminate');

    expect(res.status).toBe(403);
    expect(leasewebClient.cancelVps).not.toHaveBeenCalled();
  });

  it('allows admin to terminate a customer VPS', async () => {
    (prisma.vpsProvision.findUnique as any).mockResolvedValue(PROVISION);
    (prisma.vpsProvision.update as any).mockResolvedValue({
      ...PROVISION,
      status: 'terminated',
      user: { email: CUSTOMER.email },
    });
    const app = buildApp(ADMIN);

    const res = await request(app).post('/api/leaseweb/instances/provision/prov-1/terminate');

    expect(res.status).toBe(200);
    expect(leasewebClient.cancelVps).toHaveBeenCalledWith('lsw-vps-1');
    expect(prisma.vpsProvision.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'terminated' } })
    );
  });
});

describe('VPS reset-password — owner or staff, never someone else', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets a customer reset the password on their own VPS', async () => {
    (prisma.vpsProvision.findUnique as any).mockResolvedValue(PROVISION);
    (leasewebClient.getVps as any).mockResolvedValue({ state: 'stopped' });
    (leasewebClient.resetVpsPassword as any).mockResolvedValue({ username: 'root', password: 'new-pass' });
    const app = buildApp(CUSTOMER);

    const res = await request(app).post('/api/leaseweb/instances/provision/prov-1/reset-password');

    expect(res.status).toBe(200);
    expect(res.body.credentials.password).toBe('new-pass');
  });

  it('blocks a customer from resetting the password on someone else VPS', async () => {
    (prisma.vpsProvision.findUnique as any).mockResolvedValue({ ...PROVISION, userId: 'someone-else' });
    const app = buildApp(CUSTOMER);

    const res = await request(app).post('/api/leaseweb/instances/provision/prov-1/reset-password');

    expect(res.status).toBe(404); // not found, not 403 — never confirms the record exists
    expect(leasewebClient.resetVpsPassword).not.toHaveBeenCalled();
  });

  it('warns when the VPS is still running', async () => {
    (prisma.vpsProvision.findUnique as any).mockResolvedValue(PROVISION);
    (leasewebClient.getVps as any).mockResolvedValue({ state: 'running' });
    (leasewebClient.resetVpsPassword as any).mockResolvedValue({ username: 'root', password: 'new-pass' });
    const app = buildApp(CUSTOMER);

    const res = await request(app).post('/api/leaseweb/instances/provision/prov-1/reset-password');

    expect(res.status).toBe(200);
    expect(res.body.warning).toMatch(/stopping it first/i);
  });
});

describe('VPS firewall/DNS — honest unsupported response, not a fake success', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports firewall as unsupported rather than fabricating a result', async () => {
    (prisma.vpsProvision.findUnique as any).mockResolvedValue(PROVISION);
    const app = buildApp(CUSTOMER);

    const res = await request(app).get('/api/leaseweb/instances/provision/prov-1/firewall');

    expect(res.status).toBe(200);
    expect(res.body.supported).toBe(false);
  });
});
