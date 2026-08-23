import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import { smtpRouter } from './smtp';
import { prisma } from '../lib/prisma';

/**
 * Locks in that 'dev' gets the same full SMTP visibility as 'admin'. Found
 * during Phase 5: the list and reveal-password routes checked
 * `role === 'admin'` directly instead of using the isStaff pattern used
 * elsewhere, silently excluding the dev/owner account from seeing every
 * customer's SMTP accounts even though dev is supposed to have full access.
 */

vi.mock('../lib/prisma', () => ({
  prisma: {
    smtpAccount: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('../lib/secretsVault', () => ({
  encryptSecret: (s: string) => `enc:${s}`,
  decryptSecret: (s: string) => s.replace('enc:', ''),
}));

vi.mock('../lib/notifications', () => ({ notifyCustomer: vi.fn() }));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'dev')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
  requireDev: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'dev') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
  requireAdminOrDev: (req: any, res: any, next: any) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'dev')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
  AuthedRequest: {},
}));

const DEV = { id: 'dev-1', email: 'owner@shanutechx.com', role: 'dev' };
const CUSTOMER = { id: 'cust-1', email: 'customer@example.com', role: 'customer' };
const OTHER_CUSTOMER_ACCOUNT = { id: 'smtp-1', userId: 'someone-else', credentialRef: 'enc:secret-pass' };

function buildApp(user: typeof DEV | typeof CUSTOMER) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api', smtpRouter);
  return app;
}

describe('SMTP — dev has the same full access as admin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets dev list every customer SMTP account, not just their own', async () => {
    (prisma.smtpAccount.findMany as any).mockResolvedValue([OTHER_CUSTOMER_ACCOUNT]);
    const app = buildApp(DEV);

    const res = await request(app).get('/api/smtp-accounts');

    expect(res.status).toBe(200);
    expect(prisma.smtpAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }) // no userId filter for staff
    );
  });

  it('lets dev reveal a password on an account that is not theirs', async () => {
    (prisma.smtpAccount.findUnique as any).mockResolvedValue(OTHER_CUSTOMER_ACCOUNT);
    const app = buildApp(DEV);

    const res = await request(app).get('/api/smtp-accounts/smtp-1/reveal-password');

    expect(res.status).toBe(200);
    expect(res.body.password).toBe('secret-pass');
    expect(prisma.auditLog.create).toHaveBeenCalled(); // staff revealing someone else's is audited
  });

  it('still blocks a regular customer from revealing someone else account', async () => {
    (prisma.smtpAccount.findUnique as any).mockResolvedValue(OTHER_CUSTOMER_ACCOUNT);
    const app = buildApp(CUSTOMER);

    const res = await request(app).get('/api/smtp-accounts/smtp-1/reveal-password');

    expect(res.status).toBe(404);
  });

  it('scopes the list to only their own accounts for a regular customer', async () => {
    (prisma.smtpAccount.findMany as any).mockResolvedValue([]);
    const app = buildApp(CUSTOMER);

    await request(app).get('/api/smtp-accounts');

    expect(prisma.smtpAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: CUSTOMER.id } })
    );
  });
});
