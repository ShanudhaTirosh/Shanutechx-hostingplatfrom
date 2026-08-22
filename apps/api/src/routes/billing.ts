import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere } from '../middleware/rbac';
import { runBillingChecks } from '../lib/billing';
import { notifyAdmins } from '../lib/notifications';
import { notifyDiscordChannel } from '../lib/discordWebhooks';

export const billingRouter = Router();

billingRouter.get('/subscriptions', requireAuth, async (req: AuthedRequest, res) => {
  // Phase 15: admin scoped to assigned customers' subscriptions; dev sees
  // all (previously dev wasn't special-cased here at all and would have
  // incorrectly fallen into the customer-only branch — fixed as part of
  // this pass too).
  const where = await ownedResourceWhere(req);
  const subscriptions = await prisma.subscription.findMany({
    where,
    include: { orderItem: { include: { service: true, plan: { include: { product: true } } } }, user: true },
    orderBy: { currentPeriodEnd: 'asc' },
  });
  res.json({ subscriptions });
});

/**
 * Runs the daily past_due/cancel sweep. Two ways to trigger it, both valid:
 * an admin clicking a button in the dashboard (Firebase-authed, requires
 * admin role), or a scheduled job hitting this with a shared secret instead
 * — see .github/workflows/billing-cron.yml, which is what actually calls
 * this in production on a schedule. Neither path requires the other.
 */
billingRouter.post('/billing/run-checks', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'];
  const isCronAuthed = (() => {
    if (typeof cronSecret !== 'string') return false;
    const submitted = crypto.createHmac('sha256', 'shanutechx-cron-gate').update(cronSecret).digest();
    const expected = crypto.createHmac('sha256', 'shanutechx-cron-gate').update(env.billingCronSecret).digest();
    return crypto.timingSafeEqual(submitted, expected);
  })();

  if (!isCronAuthed) {
    // Fall back to normal Firebase admin auth rather than just rejecting —
    // lets a human trigger this from the dashboard too.
    return requireAuth(req as AuthedRequest, res, async () => {
      if ((req as AuthedRequest).user?.role !== 'admin' && (req as AuthedRequest).user?.role !== 'dev') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const result = await runBillingChecks();
      res.json(result);
    });
  }

  const result = await runBillingChecks();
  res.json(result);
});

/**
 * POST /api/subscriptions/:id/renew
 * Customer submits a renewal request for an active or past_due subscription.
 * Creates a draft renewal Order + a Payment record in manual_review for admin approval.
 * Admin approves via /payments/:paymentId/review — on approval, activateSubscriptionsForOrder
 * detects subscription.orderItemId overlap and calls extendSubscription() instead of creating a new sub.
 */
billingRouter.post('/subscriptions/:id/renew', requireAuth, async (req: AuthedRequest, res) => {
  const where = await ownedResourceWhere(req);
  const subscription = await prisma.subscription.findFirst({
    where: { id: req.params.id, ...where },
    include: {
      orderItem: { include: { plan: { include: { product: true } }, service: true } },
      user: true,
    },
  });

  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
  if (subscription.status === 'cancelled') {
    return res.status(409).json({ error: 'Cannot renew a cancelled subscription' });
  }

  // Determine renewal amount from original plan price
  const planPrice = subscription.orderItem.plan?.price ?? 0;
  const currency = subscription.orderItem.plan?.currency ?? 'LKR';

  // Create a renewal Order
  const renewalOrder = await prisma.order.create({
    data: {
      userId: subscription.userId,
      status: 'awaiting_payment',
      total: planPrice,
      currency,
      totalLkr: planPrice, // currency conversion can be added here if needed
      items: {
        create: {
          planId: subscription.orderItem.planId,
          serviceId: subscription.orderItem.serviceId,
          quantity: 1,
        },
      },
    },
    include: { user: true },
  });

  // Create a Payment record in manual_review
  const payment = await prisma.payment.create({
    data: {
      orderId: renewalOrder.id,
      method: 'proof_upload',
      status: 'manual_review',
      proofUrl: (req as any).file?.path ?? null,
    },
  });

  // Notify admin team to review this renewal payment
  void notifyAdmins(
    `Renewal payment submitted for subscription ${subscription.id} by ${subscription.user.email}. Order: ${renewalOrder.id}. Awaiting manual admin review.`
  );
  void notifyDiscordChannel('new_payment_submitted', {
    'Renewal Order': renewalOrder.id,
    'Subscription': subscription.id,
    'Customer': subscription.user.email,
    'Plan': subscription.orderItem.plan?.name ?? 'Unknown Plan',
    'Amount (LKR)': renewalOrder.totalLkr,
  });

  res.status(202).json({
    ok: true,
    renewalOrderId: renewalOrder.id,
    paymentId: payment.id,
    message: 'Renewal order created. Please upload your payment proof to complete the renewal process. An admin will review and activate your subscription.',
  });
});

/**
 * Extend a subscription's currentPeriodEnd by its billing period.
 * Called from payments.ts when a renewal payment is approved.
 */
export async function extendSubscription(subscriptionId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { orderItem: { include: { plan: true } } },
  });
  if (!sub) return;

  const billingType = sub.orderItem.plan?.billingType ?? 'monthly';
  const daysToAdd: Record<string, number> = {
    one_time: 0,
    monthly: 30,
    quarterly: 90,
    semiannual: 180,
    yearly: 365,
  };
  const days = daysToAdd[billingType] ?? 30;
  const base = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
  const newEnd = new Date(base.getTime() + days * 86400000);

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { currentPeriodEnd: newEnd, status: 'active', pastDueAt: null },
  });
}
