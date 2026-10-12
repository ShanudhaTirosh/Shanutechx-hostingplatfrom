import { prisma } from './prisma';
import { computeRenewedPeriodEnd, decideSweepAction, periodLengthMs } from './billingRules';
import { notifyCustomer, notifyAdmins } from './notifications';
import { stopDeployment } from './nodeAgentClient';
import { logger } from './logger';

import type { PrismaClient } from '@prisma/client';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Activates/extends subscriptions for every item in a newly-paid order.
 *  Accepts an optional transaction client so it can participate in an atomic
 *  payment-approval transaction (BUG-H04 fix). */
export async function activateSubscriptionsForOrder(orderId: string, tx?: TxClient): Promise<void> {
  const db = (tx ?? prisma) as PrismaClient;
  const items = await db.orderItem.findMany({ where: { orderId }, select: { id: true } });
  await Promise.all(items.map((item: { id: string }) => activateOrExtendSubscription(item.id, db)));
}

/**
 * Called whenever an order item's payment is approved. If the service is
 * one_time, this is a no-op — most things (a single deployment, an SMTP
 * account) aren't subscriptions. If it's monthly/yearly, creates a new
 * Subscription or extends an existing one for the same order item (the
 * "renew by buying it again" model — see billingRules.computeRenewedPeriodEnd
 * for why renewing early stacks remaining time instead of wasting it).
 */
export async function activateOrExtendSubscription(orderItemId: string, db: PrismaClient = prisma): Promise<void> {
  const orderItem = await db.orderItem.findUnique({
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
  const existing = await db.subscription.findUnique({ where: { orderItemId } });

  if (existing) {
    const newPeriodEnd = computeRenewedPeriodEnd(existing.currentPeriodEnd, billingPeriod);
    await db.subscription.update({
      where: { id: existing.id },
      data: { currentPeriodEnd: newPeriodEnd, status: 'active', pastDueAt: null },
    });
  } else {
    await db.subscription.create({
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
  let markedPastDue = 0;
  let cancelled = 0;
  let cursor: string | undefined;

  while (true) {
    const subscriptions = await prisma.subscription.findMany({
      where: { status: { in: ['active', 'past_due'] } },
      include: {
        user: true,
        orderItem: {
          include: {
            deployment: true,
            managedDatabase: true,
            smtpAccount: true,
            vpsProvision: true,
            liveKitProject: true,
          },
        },
      },
      take: 100,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (subscriptions.length === 0) break;
    cursor = subscriptions[subscriptions.length - 1].id;

    for (const sub of subscriptions) {
      try {
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
            const deployment = sub.orderItem?.deployment;
            if (deployment?.containerId && deployment.status === 'running') {
              try {
                const node = await prisma.node.findUnique({ where: { id: deployment.nodeId } });
                if (!node) {
                  logger.warn({ deploymentId: deployment.id }, 'Cannot stop deployment: node not found (already deleted?)');
                } else {
                  await stopDeployment(node, deployment.containerId);
                }
                await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'stopped' } });
              } catch (err) {
                logger.error({ deploymentId: deployment.id, err }, 'Failed to suspend deployment for cancelled subscription');
              }
            }

            const managedDb = sub.orderItem?.managedDatabase;
            if (managedDb && managedDb.status === 'running') {
              try {
                if (managedDb.containerId && managedDb.nodeId) {
                  const node = await prisma.node.findUnique({ where: { id: managedDb.nodeId } });
                  if (node) {
                    await stopDeployment(node, managedDb.containerId).catch(() => {});
                  }
                }
                await prisma.managedDatabase.update({
                  where: { id: managedDb.id },
                  data: { status: 'failed' },
                });
              } catch (err) {
                logger.error({ managedDbId: managedDb.id, err }, 'Failed to suspend managed database for cancelled subscription');
              }
            }

            const smtp = sub.orderItem?.smtpAccount;
            if (smtp && !smtp.isSuspended) {
              await prisma.smtpAccount.update({
                where: { id: smtp.id },
                data: { isSuspended: true },
              }).catch((err) => {
                logger.error({ smtpAccountId: smtp.id, err }, 'Failed to suspend SMTP account for cancelled subscription');
              });
            }

            const vps = sub.orderItem?.vpsProvision;
            if (vps && vps.status === 'provisioned') {
              await prisma.vpsProvision.update({
                where: { id: vps.id },
                data: { status: 'terminated' },
              }).catch((err) => {
                logger.error({ vpsProvisionId: vps.id, err }, 'Failed to terminate VPS provision for cancelled subscription');
              });
            }

            const lk = sub.orderItem?.liveKitProject;
            if (lk && lk.isActive) {
              await prisma.liveKitProject.update({
                where: { id: lk.id },
                data: { isActive: false },
              }).catch((err) => {
                logger.error({ liveKitProjectId: lk.id, err }, 'Failed to deactivate LiveKit project for cancelled subscription');
              });
            }

            void notifyCustomer(sub.user, `Your subscription has been cancelled due to non-payment.`);
            void notifyAdmins(`Subscription ${sub.id} for ${sub.user.email} cancelled (non-payment).`);
            cancelled += 1;
          }
        }
      } catch (subErr) {
        logger.error({ subId: sub.id, err: subErr }, 'Failed processing subscription during billing sweep');
      }
    }
  }

  return { markedPastDue, cancelled };
}
