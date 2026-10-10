import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere } from '../middleware/rbac';
import { runBillingChecks } from '../lib/billing';
import { convertToLkr, formatCurrency, Currency } from '../lib/currency';
import { notifyAdmins } from '../lib/notifications';
import { notifyDiscordChannel } from '../lib/discordWebhooks';
import { verifySharedSecret } from '../lib/gateAuth';

export const billingRouter = Router();

billingRouter.get('/subscriptions', requireAuth, async (req: AuthedRequest, res) => {
  // Admin scoped to assigned customers' subscriptions; dev sees all.
  const where = await ownedResourceWhere(req);
  const subscriptions = await prisma.subscription.findMany({
    where,
    include: { orderItem: { include: { service: true, plan: { include: { product: true } } } }, user: true },
    orderBy: { currentPeriodEnd: 'asc' },
  });
  res.json({ subscriptions });
});

let isBillingCheckRunning = false;
let lastBillingCheckCompletedAt = 0;

/**
 * Runs the daily past_due/cancel sweep. Two ways to trigger it, both valid:
 * an admin clicking a button in the dashboard (Firebase-authed, requires
 * admin role), or a scheduled job hitting this with a shared secret instead
 * — see .github/workflows/billing-cron.yml, which is what actually calls
 * this in production on a schedule. Neither path requires the other.
 */
billingRouter.post('/billing/run-checks', async (req, res) => {
  const isCronAuthed = verifySharedSecret(req.headers['x-cron-secret'], env.billingCronSecret);

  if (!isCronAuthed) {
    // Fall back to normal Firebase admin auth rather than just rejecting —
    // lets a human trigger this from the dashboard too.
    return requireAuth(req as AuthedRequest, res, async () => {
      if ((req as AuthedRequest).user?.role !== 'admin' && (req as AuthedRequest).user?.role !== 'dev') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (isBillingCheckRunning) {
        return res.status(409).json({ error: 'Billing checks are currently already in progress' });
      }
      if (Date.now() - lastBillingCheckCompletedAt < 60_000) {
        return res.status(429).json({ error: 'Billing checks were run recently. Please wait at least 60 seconds.' });
      }

      isBillingCheckRunning = true;
      try {
        const result = await runBillingChecks();
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: 'Billing check failed', detail: err?.message });
      } finally {
        isBillingCheckRunning = false;
        lastBillingCheckCompletedAt = Date.now();
      }
    });
  }

  if (isBillingCheckRunning) {
    return res.status(409).json({ error: 'Billing checks are currently in progress' });
  }

  isBillingCheckRunning = true;
  try {
    const result = await runBillingChecks();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Billing check failed', detail: err?.message });
  } finally {
    isBillingCheckRunning = false;
    lastBillingCheckCompletedAt = Date.now();
  }
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

  // BUG-03 FIX: Prevent renewal of one-time (non-recurring) plans
  const billingType = subscription.orderItem.plan?.billingType ?? 'one_time';
  if (billingType === 'one_time') {
    return res.status(400).json({ error: 'One-time plans cannot be renewed. Please place a new order instead.' });
  }

  // BUG-07 FIX: Ensure at least planId or serviceId is present for the renewal order
  if (!subscription.orderItem.planId && !subscription.orderItem.serviceId) {
    return res.status(400).json({ error: 'Subscription has no associated plan or service. Cannot create renewal order.' });
  }

  // Determine renewal amount from original plan or legacy service price
  const planPrice = subscription.orderItem.plan?.price ?? subscription.orderItem.service?.price ?? 0;
  const currency = (subscription.orderItem.plan?.currency ?? subscription.orderItem.service?.currency ?? 'LKR') as Currency;
  const totalLkr = convertToLkr(planPrice, currency);

  // Create a renewal Order
  const renewalOrder = await prisma.order.create({
    data: {
      userId: subscription.userId,
      status: 'awaiting_payment',
      total: planPrice,
      currency,
      totalLkr,
      items: {
        create: {
          planId: subscription.orderItem.planId,
          serviceId: subscription.orderItem.serviceId,
          quantity: 1,
          configJson: { renewalSubscriptionId: subscription.id },
        },
      },
    },
    include: { user: true },
  });

  // Create a Payment record in manual_review
  // BUG-14 FIX: Removed dead `req.file?.path` reference — this route has no
  // multer middleware, so req.file is always undefined. Payment proof is
  // submitted separately via the payment proof upload endpoint.
  const payment = await prisma.payment.create({
    data: {
      orderId: renewalOrder.id,
      method: 'proof_upload',
      status: 'manual_review',
      proofUrl: null,
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
    'Amount (LKR)': formatCurrency(renewalOrder.totalLkr, 'LKR'),
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
export async function extendSubscription(subscriptionId: string, db: any = prisma): Promise<void> {
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { orderItem: { include: { plan: true } } },
  });
  if (!sub) return;

  // BUG-09 FIX: Do not re-activate a cancelled subscription via extension
  if (sub.status === 'cancelled') {
    return;
  }

  const billingType = sub.orderItem.plan?.billingType ?? 'monthly';

  // BUG-03 FIX: Do not extend one-time subscriptions — they don't recur
  if (billingType === 'one_time') {
    return;
  }

  // BUG-23 FIX: Use calendar-accurate offsets instead of fixed-day approximations.
  // addCalendarMonths(date, n) correctly handles month-length differences.
  const base = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
  const monthsToAdd: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    yearly: 12,
  };
  const months = monthsToAdd[billingType] ?? 1;
  const newEnd = addCalendarMonths(base, months);

  await db.subscription.update({
    where: { id: subscriptionId },
    data: { currentPeriodEnd: newEnd, status: 'active', pastDueAt: null },
  });
}

/** Calendar-accurate month addition (handles Feb, varying month lengths). */
function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // If the day overflowed (e.g. Jan 31 + 1 month → Mar 3), clamp to last day of target month
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // sets to last day of previous month
  }
  return result;
}
