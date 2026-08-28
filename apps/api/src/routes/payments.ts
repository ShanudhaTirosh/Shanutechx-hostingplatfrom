import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { paymentReviewVisibilityWhere, canReviewPayment } from '../middleware/rbac';
import { uploadPaymentProof } from '../lib/uploads';
import { notifyCustomer, notifyAdmins } from '../lib/notifications';
import { notifyDiscordChannel } from '../lib/discordWebhooks';
import { parsePagination } from '../lib/pagination';
import { paymentUploadLimiter } from '../middleware/rateLimit';
import { activateSubscriptionsForOrder } from '../lib/billing';
import { idempotent } from '../middleware/idempotent';
import { logger } from '../lib/logger';

import { env } from '../env';
import { encryptSecret } from '../lib/secretsVault';
import { sendSmtpReleaseEmail, getTierFromPlanName, generateDefaultAliases } from '../lib/smtpProvisioner';
import { extendSubscription } from './billing';
import { fulfillOrder } from '../lib/orderFulfillment';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

async function loadOwnedOrder(req: AuthedRequest, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });
  if (!order) return null;
  if (req.user!.role !== 'admin' && req.user!.role !== 'dev' && order.userId !== req.user!.id) return null;
  return order;
}

/**
 * Customer uploads a payment proof screenshot for an order.
 */
paymentsRouter.post(
  '/orders/:orderId/payments/proof',
  paymentUploadLimiter,
  idempotent,
  async (req: AuthedRequest, res) => {
    const { orderId } = req.params;
    if (!orderId || typeof orderId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId format' });
    }

    const order = await loadOwnedOrder(req, orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    uploadPaymentProof(req, res, async (uploadErr) => {
      if (uploadErr) {
        return res.status(400).json({ error: uploadErr.message });
      }

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          method: 'proof_upload',
          proofUrl: req.file.path,
          status: 'manual_review',
        },
      });

      void notifyAdmins(
        `New payment proof uploaded for order ${order.id}. Awaiting manual admin review.`
      );
      void notifyDiscordChannel('new_payment_submitted', {
        'Order': order.id,
        'Customer': order.user.email,
        'Amount (LKR)': order.totalLkr,
        'Proof': payment.proofUrl ?? '(none)',
      });

      res.status(202).json({
        payment,
        reasons: ['Proof received — submitted for manual admin review. An admin will approve or decline it shortly.'],
      });
    });
  }
);

/** Admin queue of payments awaiting human review. */
paymentsRouter.get('/payments/review-queue', requireAdmin, async (req: AuthedRequest, res) => {
  const { take, skip } = parsePagination(req.query);
  const visibility = await paymentReviewVisibilityWhere(req);
  const where = { status: 'manual_review' as const, ...visibility };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { order: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    }),
    prisma.payment.count({ where }),
  ]);

  res.json({ payments, total, take, skip });
});

const reviewSchema = z
  .object({ approve: z.boolean(), reason: z.string().trim().min(1).max(2000).optional() })
  .refine((data) => data.approve || !!data.reason, {
    message: 'A reason is required when declining a payment',
    path: ['reason'],
  });

paymentsRouter.post('/payments/:id/review', requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: { order: { include: { user: true } } },
  });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (!(await canReviewPayment(payment.order.userId, req))) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  if (payment.status !== 'manual_review' && payment.status !== 'pending') {
    return res.status(409).json({ error: `Payment already reviewed (status: ${payment.status})` });
  }

  const newStatus = parsed.data.approve ? 'manually_approved' : 'rejected';

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        rejectionReason: parsed.data.approve ? null : parsed.data.reason,
      },
    });

    if (parsed.data.approve) {
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'paid' } });
    }

    return updatedPayment;
  });

  if (parsed.data.approve) {
    // Check if renewal
    const orderWithItems = await prisma.order.findUnique({
      where: { id: payment.orderId },
      include: { items: { include: { plan: true } } },
    });

    let isRenewal = false;
    if (orderWithItems?.items) {
      for (const item of orderWithItems.items) {
        const config = item.configJson as { renewalSubscriptionId?: string } | null;
        if (config?.renewalSubscriptionId) {
          isRenewal = true;
          await extendSubscription(config.renewalSubscriptionId);
        }
      }
    }

    if (!isRenewal) {
      await activateSubscriptionsForOrder(payment.orderId);
    }

    // Run automated fulfillment pipeline safely
    try {
      await fulfillOrder(payment.orderId);
    } catch (fulfillErr: any) {
      logger.error({ fulfillErr, orderId: payment.orderId }, 'Order fulfillment error after approval');
    }

    void notifyCustomer(
      payment.order.user,
      `Your payment for order ${payment.orderId} has been confirmed. Your products have been provisioned!`
    );
  } else {
    void notifyCustomer(
      payment.order.user,
      `Your payment proof for order ${payment.orderId} was reviewed and could not be confirmed. Reason: ${parsed.data.reason}`
    );
    void notifyDiscordChannel('payment_rejected', {
      'Order': payment.orderId,
      'Customer': payment.order.user.email,
      'Reason': parsed.data.reason ?? '',
      'Reviewed by': req.user!.email,
    });
  }

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: parsed.data.approve ? 'payment.manual_approve' : 'payment.manual_reject',
      target: payment.id,
    },
  });

  res.json({ payment: updated });
});
