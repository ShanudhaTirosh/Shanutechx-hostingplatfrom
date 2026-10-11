import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { paymentReviewVisibilityWhere, canReviewPayment } from '../middleware/rbac';
import { uploadPaymentProof, getPublicProofUrl, normalizeProofUrl } from '../lib/uploads';
import { notifyCustomer, notifyAdmins, sendInvoiceDeliveryNotification } from '../lib/notifications';

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
import { formatCurrency } from '../lib/currency';

export const paymentsRouter = Router();

paymentsRouter.use('/payments', requireAuth);

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

    if (order.status === 'paid') {
      return res.status(409).json({ error: 'This order is already paid — no further proof is required.' });
    }

    uploadPaymentProof(req, res, async (uploadErr) => {
      if (uploadErr) {
        return res.status(400).json({ error: uploadErr.message });
      }

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const relativeProofUrl = getPublicProofUrl(order.id, req.file.filename);

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          method: 'proof_upload',
          proofUrl: relativeProofUrl,
          status: 'manual_review',
        },
      });

      const baseUrl = process.env.API_URL || `http://localhost:${env.port}`;
      const fullDiscordProofUrl = relativeProofUrl
        ? (relativeProofUrl.startsWith('http') ? relativeProofUrl : `${baseUrl}${relativeProofUrl}`)
        : '(none)';

      void notifyAdmins(
        `New payment proof uploaded for order ${order.id}. Awaiting manual admin review.`
      );
      void notifyDiscordChannel('new_payment_submitted', {
        'Order': order.id,
        'Customer': order.user.email,
        'Amount (LKR)': formatCurrency(order.totalLkr, 'LKR'),
        'Proof': fullDiscordProofUrl,
      });

      res.status(202).json({
        payment: { ...payment, proofUrl: normalizeProofUrl(payment.proofUrl) },
        reasons: ['Proof received — submitted for manual admin review. An admin will approve or decline it shortly.'],
      });
    });
  }
);

/** Admin queue & history of payments with status filtering. */
paymentsRouter.get('/payments/review-queue', requireAdmin, async (req: AuthedRequest, res) => {
  const { take, skip } = parsePagination(req.query);
  const visibility = await paymentReviewVisibilityWhere(req);
  
  const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : 'manual_review';
  const validStatuses = ['pending', 'manual_review', 'manually_approved', 'auto_approved', 'rejected'];
  const statusWhere = statusParam === 'all'
    ? {}
    : validStatuses.includes(statusParam)
      ? { status: statusParam as any }
      : { status: 'manual_review' as const };

  const where = { ...statusWhere, ...visibility };

  const [rawPayments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        order: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
            items: { include: { service: true, plan: { include: { product: true } } } },
          },
        },
        reviewedBy: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.payment.count({ where }),
  ]);

  const payments = rawPayments.map((p) => ({
    ...p,
    proofUrl: normalizeProofUrl(p.proofUrl),
  }));

  res.json({ payments, total, take, skip, statusFilter: statusParam });
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

  // Atomic compare-and-swap: claim this payment for review by updating only
  // if it is still in an unreviewed state. If another admin (or a retried
  // request) already reviewed it, the claim updates 0 rows and we bail —
  // preventing double approval / double fulfillment.
  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ['manual_review', 'pending'] } },
    data: {
      status: newStatus,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
      rejectionReason: parsed.data.approve ? null : parsed.data.reason,
    },
  });
  if (claim.count === 0) {
    const latest = await prisma.payment.findUnique({ where: { id: payment.id }, select: { status: true } });
    return res.status(409).json({ error: `Payment already reviewed (status: ${latest?.status ?? 'unknown'})` });
  }

  // BUG-H04 FIX: activateSubscriptionsForOrder now runs inside the transaction
  // so both the order status update AND subscription activation are atomic.
  // If subscription activation fails, the order will NOT be marked as paid.
  // fulfillOrder still runs outside (external service calls need retry semantics).
  await prisma.$transaction(async (tx) => {
    if (parsed.data.approve) {
      await tx.order.updateMany({
        where: { id: payment.orderId, status: { not: 'paid' } },
        data: { status: 'paid' },
      });

      // Check if renewal
      const orderWithItems = await tx.order.findUnique({
        where: { id: payment.orderId },
        include: { items: { include: { plan: true } } },
      });

      let isRenewal = false;
      if (orderWithItems?.items) {
        const renewalSubIds = orderWithItems.items
          .map((item) => (item.configJson as { renewalSubscriptionId?: string } | null)?.renewalSubscriptionId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);

        if (renewalSubIds.length > 0) {
          isRenewal = true;
          await Promise.all(renewalSubIds.map((subId) => extendSubscription(subId, tx)));
        }
      }

      if (!isRenewal) {
        await activateSubscriptionsForOrder(payment.orderId, tx);
      }

      await tx.invoice.upsert({
        where: { orderId: payment.orderId },
        create: { orderId: payment.orderId, pdfUrl: null },
        update: {},
      });
    }
  });

  const updated = {
    ...payment,
    proofUrl: normalizeProofUrl(payment.proofUrl),
    status: newStatus as typeof payment.status,
    reviewedById: req.user!.id,
    reviewedAt: new Date(),
    rejectionReason: parsed.data.approve ? null : parsed.data.reason,
  };

  if (parsed.data.approve) {
    // Re-fetch the order for invoice/notification data (needed outside the tx)
    const orderWithItems = await prisma.order.findUnique({
      where: { id: payment.orderId },
      include: { items: { include: { plan: true } } },
    });

    // Run automated fulfillment pipeline safely outside transaction
    // (external service calls; failures are retried by the ops team)
    let fulfillmentSucceeded = true;
    try {
      await fulfillOrder(payment.orderId);
    } catch (fulfillErr: any) {
      fulfillmentSucceeded = false;
      logger.error({ fulfillErr, orderId: payment.orderId }, 'Order fulfillment error after approval — manual retry required');
    }

    if (fulfillmentSucceeded) {
      void notifyCustomer(
        payment.order.user,
        `Your payment for order ${payment.orderId} has been confirmed. Your products have been provisioned!`
      );
    } else {
      void notifyCustomer(
        payment.order.user,
        `Your payment for order ${payment.orderId} has been confirmed. Provisioning is currently in progress, and your services will be ready shortly.`
      );
    }

    // Send automatic PDF & HTML invoice delivery email to customer
    if (orderWithItems) {
      const items = orderWithItems.items.map((item: any) => ({
        name: item.plan ? item.plan.name : 'Cloud Service',
        quantity: item.quantity,
        price: item.plan ? item.plan.price : 0,
      }));
      void sendInvoiceDeliveryNotification(
        payment.order.user,
        payment.orderId,
        payment.order.totalLkr,
        items
      ).catch(() => {});
    }

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
