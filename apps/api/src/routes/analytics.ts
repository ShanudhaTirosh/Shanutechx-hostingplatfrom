import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../lib/logger';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireAdmin);

/**
 * Enhanced Enterprise Telemetry & Platform Analytics Engine
 * Aggregates across Financials, MRR/ARR, Customer Acquisition, Infrastructure Node Pools,
 * Container Workloads, Support Operations, and Product Category Performance.
 * Supports ?range=7d | 30d | 90d | 1y | all
 */
analyticsRouter.get('/admin/analytics', async (req, res) => {
  try {
    const rangeParam = typeof req.query.range === 'string' ? req.query.range.toLowerCase() : '30d';

    const now = new Date();
    let days = 30;
    if (rangeParam === '7d') days = 7;
    else if (rangeParam === '90d') days = 90;
    else if (rangeParam === '1y') days = 365;
    else if (rangeParam === 'all') days = 3650; // 10 years

    const timeframeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousTimeframeStart = new Date(now.getTime() - (days * 2) * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [
      paidOrdersCurrentWindow,
      paidOrdersPreviousWindow,
      paidOrdersAll,
      paidOrdersLast12mo,
      activeSubscriptionsList,
      cancelledSubscriptionsRange,
      totalCustomers,
      newCustomersCurrentWindow,
      newCustomersPreviousWindow,
      deploymentsList,
      nodes,
      servicesByType,
      orderStatusCounts,
      vpsProvisionsCount,
      smtpAccountsCount,
      livekitProjectsCount,
      supabaseProjectsCount,
      ticketsOpenCount,
      ticketsResolvedCount,
      auditEventsCount,
      uptimeChecks,
    ] = await Promise.all([
      // Current timeframe orders sum
      prisma.order.aggregate({
        _sum: { totalLkr: true },
        _count: { id: true },
        where: { status: 'paid', createdAt: { gte: timeframeStart } },
      }),
      // Previous timeframe orders sum (for trend growth comparison)
      prisma.order.aggregate({
        _sum: { totalLkr: true },
        _count: { id: true },
        where: { status: 'paid', createdAt: { gte: previousTimeframeStart, lt: timeframeStart } },
      }),
      // All time paid orders
      prisma.order.aggregate({
        _sum: { totalLkr: true },
        where: { status: 'paid' },
      }),
      // Last 12 months orders for monthly chart
      prisma.order.findMany({
        where: { status: 'paid', createdAt: { gte: twelveMonthsAgo } },
        select: { totalLkr: true, createdAt: true },
      }),
      // Active subscriptions for MRR calculation
      prisma.subscription.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          orderItem: {
            select: {
              priceLkr: true,
              plan: { select: { price: true, product: { select: { category: true } } } },
            },
          },
        },
      }),
      // Cancelled subscriptions in timeframe
      prisma.subscription.count({
        where: { status: 'cancelled', cancelledAt: { gte: timeframeStart } },
      }),
      // Customer counts
      prisma.user.count({ where: { role: 'customer' } }),
      prisma.user.count({ where: { role: 'customer', createdAt: { gte: timeframeStart } } }),
      prisma.user.count({
        where: { role: 'customer', createdAt: { gte: previousTimeframeStart, lt: timeframeStart } },
      }),
      // Deployments
      prisma.deployment.findMany({
        select: { id: true, status: true },
      }),
      // Node fleet
      prisma.node.findMany({
        select: {
          id: true,
          label: true,
          cpuCores: true,
          ramMb: true,
          diskGb: true,
          cpuUsedPct: true,
          ramUsedMb: true,
          diskUsedGb: true,
          isActive: true,
          lastSeenAt: true,
        },
      }),
      // Services count by plan and service
      prisma.orderItem.groupBy({ by: ['planId', 'serviceId'], _count: true }),
      // Order status counts
      prisma.order.groupBy({ by: ['status'], _count: true }),
      // Workload counters
      prisma.vpsProvision.count(),
      prisma.smtpAccount.count(),
      prisma.liveKitProject.count(),
      prisma.supabaseClientProject.count(),
      // Support & audit metrics
      prisma.ticket.count({ where: { status: { in: ['open', 'pending'] } } }),
      prisma.ticket.count({ where: { status: 'closed', updatedAt: { gte: timeframeStart } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: timeframeStart } } }),
      prisma.uptimeCheck.findMany({ select: { isUp: true } }),
    ]);

    // Financial Metrics
    const revenueRangeLkr = paidOrdersCurrentWindow._sum.totalLkr ?? 0;
    const revenuePrevRangeLkr = paidOrdersPreviousWindow._sum.totalLkr ?? 0;
    const revenueRangeUsd = Math.round(revenueRangeLkr / 300);
    const revenueAllTimeLkr = paidOrdersAll._sum.totalLkr ?? 0;
    const revenueAllTimeUsd = Math.round(revenueAllTimeLkr / 300);

    const orderCountRange = paidOrdersCurrentWindow._count.id ?? 0;
    const averageOrderValueLkr = orderCountRange > 0 ? Math.round(revenueRangeLkr / orderCountRange) : 0;
    const averageOrderValueUsd = Math.round(averageOrderValueLkr / 300);

    // Revenue Growth % (vs prior period of equal length)
    let revenueGrowthPct = 0;
    if (revenuePrevRangeLkr > 0) {
      revenueGrowthPct = Math.round(((revenueRangeLkr - revenuePrevRangeLkr) / revenuePrevRangeLkr) * 1000) / 10;
    } else if (revenueRangeLkr > 0) {
      revenueGrowthPct = 100;
    }

    // Monthly Recurring Revenue (MRR) & Annual Run Rate (ARR)
    const mrrLkr = activeSubscriptionsList.reduce((sum, s) => {
      const p = s.orderItem?.priceLkr ?? s.orderItem?.plan?.price ?? 0;
      return sum + p;
    }, 0);
    const mrrUsd = Math.round(mrrLkr / 300);
    const arrLkr = mrrLkr * 12;
    const arrUsd = mrrUsd * 12;

    // Average Revenue Per User (ARPU)
    const activeSubsCount = activeSubscriptionsList.length;
    const arpuLkr = activeSubsCount > 0 ? Math.round(mrrLkr / activeSubsCount) : 0;
    const arpuUsd = Math.round(arpuLkr / 300);

    // Churn Rate %
    const totalSubsBase = activeSubsCount + cancelledSubscriptionsRange;
    const churnRatePct = totalSubsBase > 0 ? Math.min(100, Math.round((cancelledSubscriptionsRange / totalSubsBase) * 1000) / 10) : 0;

    // Customer Growth %
    let customerGrowthPct = 0;
    if (newCustomersPreviousWindow > 0) {
      customerGrowthPct = Math.round(((newCustomersCurrentWindow - newCustomersPreviousWindow) / newCustomersPreviousWindow) * 1000) / 10;
    } else if (newCustomersCurrentWindow > 0) {
      customerGrowthPct = 100;
    }

    // Monthly Revenue Breakdown for Chart
    const revenueByMonth: Record<string, number> = {};
    for (const order of paidOrdersLast12mo) {
      const key = order.createdAt.toISOString().slice(0, 7); // YYYY-MM
      revenueByMonth[key] = (revenueByMonth[key] ?? 0) + order.totalLkr;
    }

    // Order Status Breakdown
    const ordersByStatus: Record<string, number> = {};
    for (const s of orderStatusCounts) {
      ordersByStatus[s.status.toUpperCase()] = s._count;
    }

    // Deployments Breakdown
    const deploymentsSummary = {
      total: deploymentsList.length,
      running: deploymentsList.filter((d) => d.status === 'running').length,
      stopped: deploymentsList.filter((d) => d.status === 'stopped').length,
      building: deploymentsList.filter((d) => d.status === 'building' || d.status === 'pending').length,
      failed: deploymentsList.filter((d) => d.status === 'failed').length,
    };

    // Node Fleet Infrastructure Aggregations
    let totalFleetCpuCores = 0;
    let totalFleetRamGb = 0;
    let totalFleetDiskGb = 0;

    const nodeUtilization = nodes.map((n) => {
      const cpu = n.cpuUsedPct ?? 0;
      const ram = n.ramMb ? Math.round(((n.ramUsedMb ?? 0) / n.ramMb) * 100) : 0;
      const disk = n.diskGb ? Math.round(((n.diskUsedGb ?? 0) / n.diskGb) * 100) : 0;
      const maxUsage = Math.max(cpu, ram, disk);
      const status = maxUsage > 85 ? 'critical' : maxUsage > 65 ? 'warning' : 'healthy';

      totalFleetCpuCores += n.cpuCores ?? 0;
      totalFleetRamGb += Math.round((n.ramMb ?? 0) / 1024);
      totalFleetDiskGb += n.diskGb ?? 0;

      return {
        id: n.id,
        label: n.label,
        status,
        cpuUsedPct: cpu,
        ramUsedPct: ram,
        diskUsedPct: disk,
        cpuCores: n.cpuCores,
        ramGb: Math.round((n.ramMb ?? 0) / 1024),
        diskGb: n.diskGb,
        isActive: n.isActive,
      };
    });

    const fleetSummary = {
      totalNodes: nodes.length,
      activeNodes: nodes.filter((n) => n.isActive).length,
      healthyNodes: nodeUtilization.filter((n) => n.status === 'healthy').length,
      warningNodes: nodeUtilization.filter((n) => n.status === 'warning').length,
      criticalNodes: nodeUtilization.filter((n) => n.status === 'critical').length,
      totalCpuCores: totalFleetCpuCores,
      totalRamGb: totalFleetRamGb,
      totalDiskGb: totalFleetDiskGb,
    };

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

    const categoryRevenueMap: Record<string, { count: number; revenueLkr: number }> = {};

    const topServices = servicesByType
      .sort((a, b) => b._count - a._count)
      .slice(0, 10)
      .map((item) => {
        const p = item.planId ? planMap.get(item.planId) : undefined;
        const s = item.serviceId ? serviceMap.get(item.serviceId) : undefined;
        const title = p ? `${p.product.name} — ${p.name}` : (s?.name ?? 'Standard Container Service');
        const category = p?.product.category ?? s?.type ?? 'General';
        const revenue = p ? p.price * item._count : 0;

        if (!categoryRevenueMap[category]) {
          categoryRevenueMap[category] = { count: 0, revenueLkr: 0 };
        }
        categoryRevenueMap[category].count += item._count;
        categoryRevenueMap[category].revenueLkr += revenue;

        return {
          title,
          category,
          ordersCount: item._count,
          revenueLkr: revenue,
        };
      });

    // Uptime Stats
    const totalUptimeChecks = uptimeChecks.length;
    const onlineUptimeChecks = uptimeChecks.filter((u) => u.isUp).length;
    const uptimePct = totalUptimeChecks > 0 ? Math.round((onlineUptimeChecks / totalUptimeChecks) * 1000) / 10 : 100;

    res.json({
      range: rangeParam,
      // Financials
      revenueInWindowLkr: revenueRangeLkr,
      revenueInWindowUsd: revenueRangeUsd,
      revenuePrevWindowLkr: revenuePrevRangeLkr,
      revenueAllTimeLkr,
      revenueAllTimeUsd,
      revenueGrowthPct,
      mrrLkr,
      mrrUsd,
      arrLkr,
      arrUsd,
      arpuLkr,
      arpuUsd,
      averageOrderValueLkr,
      averageOrderValueUsd,
      // Subscriptions & Customers
      churnRatePct,
      activeSubscriptions: activeSubsCount,
      cancelledSubscriptions: cancelledSubscriptionsRange,
      totalSubscriptions: totalSubsBase,
      totalCustomers,
      newCustomersCurrentWindow,
      newCustomersPreviousWindow,
      customerGrowthPct,
      // Workloads & Applications
      deploymentsSummary,
      vpsProvisionsCount,
      smtpAccountsCount,
      livekitProjectsCount,
      supabaseProjectsCount,
      // Operations & Health
      ticketsOpenCount,
      ticketsResolvedCount,
      auditEventsCount,
      uptimePct,
      fleetSummary,
      nodeUtilization,
      // Breakdown & Leaderboard
      orderCountInWindow: orderCountRange,
      ordersByStatus,
      topServices,
      categoryRevenueMap,
      revenueByMonth,
    });
  } catch (err: any) {
    logger.error({ err }, '[Analytics] Failed to generate analytics telemetry');
    res.status(500).json({ error: err.message || 'Failed to generate analytics telemetry' });
  }
});
