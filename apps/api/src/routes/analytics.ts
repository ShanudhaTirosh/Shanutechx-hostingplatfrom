import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireAdmin);

/**
 * Aggregates data across Orders, Subscriptions, Containers, Users, and Nodes.
 * Supports ?range=7d | 30d | 90d | 1y | all
 */
analyticsRouter.get('/admin/analytics', async (req, res) => {
  const rangeParam = typeof req.query.range === 'string' ? req.query.range.toLowerCase() : '30d';

  const now = new Date();
  let days = 30;
  if (rangeParam === '7d') days = 7;
  else if (rangeParam === '90d') days = 90;
  else if (rangeParam === '1y') days = 365;
  else if (rangeParam === 'all') days = 3650; // 10 years

  const timeframeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [
    paidOrdersRange,
    allPaidOrders,
    paidOrdersLast12mo,
    activeSubscriptionsList,
    cancelledSubscriptionsRange,
    totalCustomers,
    newCustomersRange,
    deploymentsList,
    nodes,
    servicesByType,
    orderStatusCounts,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalLkr: true },
      _count: { id: true },
      where: { status: 'paid', createdAt: { gte: timeframeStart } },
    }),
    prisma.order.aggregate({
      _sum: { totalLkr: true },
      where: { status: 'paid' },
    }),
    prisma.order.findMany({
      where: { status: 'paid', createdAt: { gte: twelveMonthsAgo } },
      select: { totalLkr: true, createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        orderItem: {
          select: {
            priceLkr: true,
            plan: { select: { price: true } },
          },
        },
      },
    }),
    prisma.subscription.count({
      where: { status: 'cancelled', cancelledAt: { gte: timeframeStart } },
    }),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.user.count({ where: { role: 'customer', createdAt: { gte: timeframeStart } } }),
    prisma.deployment.findMany({
      select: { id: true, status: true },
    }),
    prisma.node.findMany({
      select: { label: true, cpuUsedPct: true, ramUsedMb: true, ramMb: true, diskUsedGb: true, diskGb: true },
    }),
    prisma.orderItem.groupBy({ by: ['planId', 'serviceId'], _count: true }),
    prisma.order.groupBy({ by: ['status'], _count: true }),
  ]);

  const revenueRangeLkr = paidOrdersRange._sum.totalLkr ?? 0;
  const revenueRangeUsd = Math.round(revenueRangeLkr / 300); // approximate conversion
  const orderCountRange = paidOrdersRange._count.id ?? 0;
  const averageOrderValueLkr = orderCountRange > 0 ? Math.round(revenueRangeLkr / orderCountRange) : 0;
  const averageOrderValueUsd = Math.round(averageOrderValueLkr / 300);

  // Calculate Monthly Recurring Revenue (MRR) from active subscriptions
  const mrrLkr = activeSubscriptionsList.reduce((sum, s) => {
    const p = s.orderItem?.priceLkr ?? s.orderItem?.plan?.price ?? 0;
    return sum + p;
  }, 0);
  const mrrUsd = Math.round(mrrLkr / 300);

  // Churn Rate
  const activeSubsCount = activeSubscriptionsList.length;
  const totalSubsBase = activeSubsCount + cancelledSubscriptionsRange;
  const churnRatePct = totalSubsBase > 0 ? Math.min(100, Math.round((cancelledSubscriptionsRange / totalSubsBase) * 1000) / 10) : 0;

  // Monthly Revenue Map for Bar Chart
  const revenueByMonth: Record<string, number> = {};
  for (const order of paidOrdersLast12mo) {
    const key = order.createdAt.toISOString().slice(0, 7); // YYYY-MM
    revenueByMonth[key] = (revenueByMonth[key] ?? 0) + order.totalLkr;
  }

  // Order Status Map
  const ordersByStatus: Record<string, number> = {};
  for (const s of orderStatusCounts) {
    ordersByStatus[s.status.toUpperCase()] = s._count;
  }

  // Top Services Leaderboard
  const planIds = servicesByType.map((s) => s.planId).filter((id): id is string => id !== null);
  const serviceIds = servicesByType.map((s) => s.serviceId).filter((id): id is string => id !== null);

  const [plans, services] = await Promise.all([
    prisma.plan.findMany({
      where: { id: { in: planIds } },
      select: {
        id: true,
        name: true,
        price: true,
        product: { select: { category: true, name: true } },
      },
    }),
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, type: true },
    }),
  ]);

  const planMap = new Map(plans.map((p) => [p.id, p]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const topServices = servicesByType
    .sort((a, b) => b._count - a._count)
    .slice(0, 10)
    .map((item) => {
      const p = item.planId ? planMap.get(item.planId) : undefined;
      const s = item.serviceId ? serviceMap.get(item.serviceId) : undefined;
      return {
        title: p ? `${p.product.name} — ${p.name}` : (s?.name ?? 'Standard Container Service'),
        category: p?.product.category ?? s?.type ?? 'General',
        ordersCount: item._count,
        revenueLkr: p ? p.price * item._count : 0,
      };
    });

  // Node Utilization & Health Status
  const nodeUtilization = nodes.map((n: any) => {
    const cpu = n.cpuUsedPct ?? 0;
    const ram = n.ramMb ? Math.round(((n.ramUsedMb ?? 0) / n.ramMb) * 100) : 0;
    const disk = n.diskGb ? Math.round(((n.diskUsedGb ?? 0) / n.diskGb) * 100) : 0;
    const maxUsage = Math.max(cpu, ram, disk);
    const status = maxUsage > 85 ? 'critical' : maxUsage > 65 ? 'warning' : 'healthy';

    return {
      label: n.label,
      status,
      cpuUsedPct: cpu,
      ramUsedPct: ram,
      diskUsedPct: disk,
    };
  });

  // Container Deployment stats
  const totalContainersCount = deploymentsList.length;
  const activeContainersCount = deploymentsList.filter((d) => d.status === 'running').length;

  res.json({
    range: rangeParam,
    revenueInWindowLkr: revenueRangeLkr,
    revenueInWindowUsd: revenueRangeUsd,
    revenueLast30dLkr: revenueRangeLkr,
    mrrLkr,
    mrrUsd,
    averageOrderValueLkr,
    averageOrderValueUsd,
    churnRatePct,
    activeSubscriptions: activeSubsCount,
    cancelledSubscriptions: cancelledSubscriptionsRange,
    totalSubscriptions: totalSubsBase,
    totalCustomers,
    activeContainersCount,
    totalContainersCount,
    orderCountInWindow: orderCountRange,
    ordersByStatus,
    topServices,
    revenueByMonth,
    nodeUtilization,
  });
});

