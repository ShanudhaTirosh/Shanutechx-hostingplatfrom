import { prisma } from './prisma';
import { computeRenewedPeriodEnd, decideSweepAction, periodLengthMs } from './billingRules';
import { notifyCustomer, notifyAdmins } from './notifications';
import { stopDeployment } from './nodeAgentClient';
import { logger } from './logger';

/** Activates/extends subscriptions for every item in a newly-paid order. */
export async function activateSubscriptionsForOrder(orderId: string): Promise<void> {
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { id: true } });
  await Promise.all(items.map((item: { id: string }) => activateOrExtendSubscription(item.id)));
}

/**
 * Called whenever an order item's payment is approved. If the service is
 * one_time, this is a no-op — most things (a single deployment, an SMTP
 * account) aren't subscriptions. If it's monthly/yearly, creates a new
 * Subscription or extends an existing one for the same order item (the
 * "renew by buying it again" model — see billingRules.computeRenewedPeriodEnd
 * for why renewing early stacks remaining time instead of wasting it).
 */
export async function activateOrExtendSubscription(orderItemId: string): Promise<void> {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { service: true, plan: true, order: true },
  });
  if (!orderItem) return;
  const isOneTime = orderItem.service
    ? orderItem.service.billingPeriod === 'one_time'
    : orderItem.plan
      ? orderItem.plan.billingType === 'one_time'
      : true;
  if (isOneTime) return;

  const billingPeriod = (orderItem.service
    ? orderItem.service.billingPeriod
    : orderItem.plan?.billingType) as 'monthly' | 'yearly';
  const existing = await prisma.subscription.findUnique({ where: { orderItemId } });

  if (existing) {
    const newPeriodEnd = computeRenewedPeriodEnd(existing.currentPeriodEnd, billingPeriod);
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { currentPeriodEnd: newPeriodEnd, status: 'active', pastDueAt: null },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: orderItem.order.userId,
        orderItemId,
        currentPeriodEnd: new Date(Date.now() + periodLengthMs(billingPeriod)),
      },
    });
  }
}

/**
 * The daily sweep: walks every non-cancelled subscription and applies
 * whatever decideSweepAction() (pure, already unit-tested) says. Suspends
 * the linked deployment, if any, once a subscription is actually cancelled
 * — not when it merely goes past_due, which is just a warning state with a
 * grace period.
 */
export async function runBillingChecks(): Promise<{ markedPastDue: number; cancelled: number }> {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: { in: ['active', 'past_due'] } },
    include: { user: true, orderItem: { include: { deployment: true } } },
  });

  let markedPastDue = 0;
  let cancelled = 0;

  for (const sub of subscriptions) {
    const action = decideSweepAction(sub.status, sub.currentPeriodEnd, sub.pastDueAt);

    if (action === 'mark_past_due') {
      const updated = await prisma.subscription.updateMany({
        where: { id: sub.id, status: sub.status },
        data: { status: 'past_due', pastDueAt: new Date() },
      });
      if (updated.count > 0) {
        void notifyCustomer(
          sub.user,
          `Your subscription payment is due. Please renew within 7 days to avoid suspension.`
        );
        markedPastDue += 1;
      }
    } else if (action === 'cancel') {
      const updated = await prisma.subscription.updateMany({
        where: { id: sub.id, status: sub.status },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });

      if (updated.count > 0) {
        const deployment = sub.orderItem.deployment;
        if (deployment?.containerId && deployment.status === 'running') {
          try {
            await stopDeployment(
              await prisma.node.findUniqueOrThrow({ where: { id: deployment.nodeId } }),
              deployment.containerId
            );
            await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'stopped' } });
          } catch (err) {
            logger.error({ deploymentId: deployment.id, err }, 'Failed to suspend deployment for cancelled subscription');
          }
        }

        void notifyCustomer(sub.user, `Your subscription has been cancelled due to non-payment.`);
        void notifyAdmins(`Subscription ${sub.id} for ${sub.user.email} cancelled (non-payment).`);
        cancelled += 1;
      }
    }
  }

  return { markedPastDue, cancelled };
}
