import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import { paymentsRouter } from './payments';
import { prisma } from '../lib/prisma';

/**
 * These tests lock in the product requirement that payment review is
 * 100% human — no AI extraction, no auto-approval, and every decline must
 * carry a reason. If someone re-wires an auto-verify path back into
 * POST /payments/:id/review in the future, these should fail.
 */

vi.mock('../lib/prisma', () => ({
  prisma: {
    payment: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('../lib/notifications', () => ({
  notifyCustomer: vi.fn(),
  notifyAdmins: vi.fn(),
}));

vi.mock('../lib/discordWebhooks', () => ({
  notifyDiscordChannel: vi.fn(),
}));

vi.mock('../lib/billing', () => ({
  activateSubscriptionsForOrder: vi.fn(),
}));

vi.mock('../lib/uploads', () => ({ uploadPaymentProof: vi.fn() }));
vi.mock('../lib/pagination', () => ({ parsePagination: () => ({ take: 20, skip: 0 }) }));
vi.mock('../middleware/rateLimit', () => ({ paymentUploadLimiter: (_req: any, _res: any, next: any) => next() }));
vi.mock('../middleware/idempotent', () => ({ idempotent: () => (_req: any, _res: any, next: any) => next() }));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'dev')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
  AuthedRequest: {},
}));

const ADMIN_USER = { id: 'admin-1', email: 'admin@shanutechx.com', role: 'admin' };

const BASE_PAYMENT = {
  id: 'pay-1',
  orderId: 'order-1',
  status: 'manual_review',
  order: { id: 'order-1', user: { id: 'cust-1', email: 'customer@example.com' } },
};

describe('POST /payments/:id/review — manual-only review', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = ADMIN_USER;
      next();
    });
    app.use('/api', paymentsRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a decline with no reason', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(BASE_PAYMENT);

    const res = await request(app).post('/api/payments/pay-1/review').send({ approve: false });

    expect(res.status).toBe(400);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('accepts a decline with a reason, records the reviewer, and never auto-approves', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(BASE_PAYMENT);
    (prisma.payment.update as any).mockResolvedValue({ ...BASE_PAYMENT, status: 'rejected' });

    const res = await request(app)
      .post('/api/payments/pay-1/review')
      .send({ approve: false, reason: 'Slip amount does not match order total' });

    expect(res.status).toBe(200);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'rejected',
          reviewedById: ADMIN_USER.id,
          rejectionReason: 'Slip amount does not match order total',
        }),
      })
    );
  });

  it('approves only on an explicit human call, recording the reviewer', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(BASE_PAYMENT);
    (prisma.payment.update as any).mockResolvedValue({ ...BASE_PAYMENT, status: 'manually_approved' });

    const res = await request(app).post('/api/payments/pay-1/review').send({ approve: true });

    expect(res.status).toBe(200);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'manually_approved',
          reviewedById: ADMIN_USER.id,
          rejectionReason: null,
        }),
      })
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'paid' } })
    );
  });

  it('refuses to re-review a payment that already has a decision', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({ ...BASE_PAYMENT, status: 'rejected' });

    const res = await request(app).post('/api/payments/pay-1/review').send({ approve: true });

    expect(res.status).toBe(409);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('blocks non-admin/dev roles from reviewing at all', async () => {
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'cust-1', email: 'customer@example.com', role: 'customer' };
      next();
    });
    app.use('/api', paymentsRouter);

    const res = await request(app).post('/api/payments/pay-1/review').send({ approve: true });
    expect(res.status).toBe(403);
  });
});
