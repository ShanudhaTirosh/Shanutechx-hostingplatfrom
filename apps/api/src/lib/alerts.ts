import { prisma } from './prisma';
import { logger } from './logger';
import { notifyCustomer, notifyAdmins } from './notifications';

export interface MetricAlertThresholds {
  cpuPctLimit: number;
  ramPctLimit: number;
  diskPctLimit: number;
}

const DEFAULT_THRESHOLDS: MetricAlertThresholds = {
  cpuPctLimit: 85,
  ramPctLimit: 90,
  diskPctLimit: 90,
};

/**
 * Sweeps all active nodes and deployments to detect metric threshold violations
 * and triggers alerts to admins and resource owners.
 */
export async function checkMetricAlerts(thresholds: MetricAlertThresholds = DEFAULT_THRESHOLDS): Promise<{ alertsTriggered: number }> {
  let alertsTriggered = 0;

  try {
    // 1. Check Node Fleet Utilization
    const nodes = await prisma.node.findMany({ where: { isActive: true } });
    for (const node of nodes) {
      const ramUsedPct = node.ramMb ? Math.round(((node.ramUsedMb ?? 0) / node.ramMb) * 100) : 0;
      const diskUsedPct = node.diskGb ? Math.round(((node.diskUsedGb ?? 0) / node.diskGb) * 100) : 0;

      if ((node.cpuUsedPct ?? 0) >= thresholds.cpuPctLimit) {
        alertsTriggered++;
        const msg = `[WARNING] Node Alert: Host "${node.label}" (${node.ip}) CPU utilization reached ${node.cpuUsedPct}% (Threshold: ${thresholds.cpuPctLimit}%).`;
        logger.warn({ nodeId: node.id, cpu: node.cpuUsedPct }, msg);
        void notifyAdmins(msg);
      }

      if (ramUsedPct >= thresholds.ramPctLimit) {
        alertsTriggered++;
        const msg = `[WARNING] Node Alert: Host "${node.label}" (${node.ip}) RAM utilization reached ${ramUsedPct}% (Threshold: ${thresholds.ramPctLimit}%).`;
        logger.warn({ nodeId: node.id, ramUsedPct }, msg);
        void notifyAdmins(msg);
      }

      if (diskUsedPct >= thresholds.diskPctLimit) {
        alertsTriggered++;
        const msg = `[WARNING] Node Alert: Host "${node.label}" (${node.ip}) Disk utilization reached ${diskUsedPct}% (Threshold: ${thresholds.diskPctLimit}%).`;
        logger.warn({ nodeId: node.id, diskUsedPct }, msg);
        void notifyAdmins(msg);
      }
    }

    // 2. Check Failed/Crashed Deployments
    const failedDeployments = await prisma.deployment.findMany({
      where: { status: 'failed' },
      include: { user: true },
    });

    for (const dep of failedDeployments) {
      if (dep.user) {
        alertsTriggered++;
        const msg = `[ALERT] Deployment Alert: Service "${dep.subdomain || dep.id}" entered failed state. Check dashboard logs.`;
        void notifyCustomer(dep.user, msg);
      }
    }
  } catch (err: any) {
    logger.error({ err }, 'Error checking metric alerts');
  }

  return { alertsTriggered };
}
