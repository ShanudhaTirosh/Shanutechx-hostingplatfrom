import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireAdmin);

/**
 * Aggregates data that already exists across Order/Subscription/Node —
 * Revenue is reported in totalLkr so multi-currency orders sum into one comparable number.
 */
analyticsRouter.get('/admin/analytics', async (_req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [
    paidOrdersLast30d,
    paidOrdersLast12mo,
    activeSubscriptions,
    cancelledSubscriptionsLast30d,
    totalCustomers,
    nodes,
    servicesByType,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'paid', createdAt: { gte: thirtyDaysAgo } },
      select: { totalLkr: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { status: 'paid', createdAt: { gte: twelveMonthsAgo } },
      select: { totalLkr: true, createdAt: true },
    }),
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.subscription.count({ where: { status: 'cancelled', cancelledAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.node.findMany({
      select: { label: true, cpuUsedPct: true, ramUsedMb: true, ramMb: true, diskUsedGb: true, diskGb: true },
    }),
    prisma.orderItem.groupBy({ by: ['serviceId'], _count: true }),
  ]);

  const revenueLast30dLkr = paidOrdersLast30d.reduce((sum: number, o: { totalLkr: number }) => sum + o.totalLkr, 0);

  const revenueByMonth: Record<string, number> = {};
  for (const order of paidOrdersLast12mo) {
    const key = order.createdAt.toISOString().slice(0, 7); // YYYY-MM
    revenueByMonth[key] = (revenueByMonth[key] ?? 0) + order.totalLkr;
  }

  const serviceIds = servicesByType.map((s) => s.serviceId).filter((id): id is string => id !== null);
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true, type: true },
  });
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const topServices = servicesByType
    .sort((a, b) => b._count - a._count)
    .slice(0, 10)
    .map((item) => {
      const s = item.serviceId ? serviceMap.get(item.serviceId) : undefined;
      return {
        serviceId: item.serviceId,
        name: s?.name ?? 'Unknown Service',
        type: s?.type ?? 'unknown',
        count: item._count,
      };
    });

  res.json({
    revenueLast30dLkr,
    revenueByMonth,
    activeSubscriptions,
    cancelledSubscriptionsLast30d,
    totalCustomers,
    nodeUtilization: nodes.map((n: any) => ({
      label: n.label,
      cpuUsedPct: n.cpuUsedPct,
      ramUsedPct: n.ramMb ? Math.round(((n.ramUsedMb ?? 0) / n.ramMb) * 100) : null,
      diskUsedPct: n.diskGb ? Math.round(((n.diskUsedGb ?? 0) / n.diskGb) * 100) : null,
    })),
    topServicesByOrderCount: topServices,
  });
});
