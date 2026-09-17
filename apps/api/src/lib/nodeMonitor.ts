import { prisma } from './prisma';
import { evacuateNodeWorkloads, FailoverResult } from './failoverEngine';
import { env } from '../env';
import { logger } from './logger';
import { notifyDiscordChannel } from './discordWebhooks';

const NODE_OFFLINE_THRESHOLD_MS = 2.5 * 60 * 1000; // 2.5 minutes missing heartbeat

export interface NodeHealthStatus {
  id: string;
  label: string;
  ip: string;
  isActive: boolean;
  isOnline: boolean;
  lastSeenAt: Date | null;
  secondsSinceHeartbeat: number | null;
}

/**
 * Periodically executed watchdog routine to audit node health.
 * Identifies offline nodes missing heartbeats and triggers real-time workload failover.
 */
export async function checkNodeHealthAndFailover(): Promise<{ audited: number; failedOver: number }> {
  const activeNodes = await prisma.node.findMany({
    where: { isActive: true },
  });

  if (activeNodes.length === 0) {
    return { audited: 0, failedOver: 0 };
  }

  let audited = 0;
  let failedOver = 0;
  const now = Date.now();
  const nodesToEvacuate: typeof activeNodes = [];

  for (const node of activeNodes) {
    audited++;
    const lastSeen = node.lastSeenAt ? new Date(node.lastSeenAt).getTime() : 0;
    const timeDiff = now - lastSeen;

    if (!node.lastSeenAt || timeDiff > NODE_OFFLINE_THRESHOLD_MS) {
      logger.warn({ nodeId: node.id, label: node.label, timeDiffMs: timeDiff }, 'Node heartbeat stale, probing agent ping');
      const pingSuccessful = await probeNodeAgent(node.ip);
      if (!pingSuccessful) {
        nodesToEvacuate.push(node);
      }
    }
  }

  // Circuit Breaker: If ALL active nodes in a multi-node cluster are unreachable simultaneously,
  // it indicates a network partition or central API connectivity issue, not individual node hardware failures.
  // Suppress automated evacuation to prevent cascade-deactivating all nodes in the cluster.
  if (nodesToEvacuate.length > 0 && nodesToEvacuate.length >= activeNodes.length && activeNodes.length > 1) {
    logger.error(
      { unreachableCount: nodesToEvacuate.length, totalNodes: activeNodes.length },
      'Circuit Breaker Tripped: All compute nodes are unreachable simultaneously. Suppressing automated failover to prevent total cluster cascade.'
    );
    return { audited, failedOver: 0 };
  }

  for (const node of nodesToEvacuate) {
    logger.error({ nodeId: node.id, label: node.label }, 'Node is OFFLINE and unreachable. Executing automated failover evacuation.');

    void notifyDiscordChannel('deployment_failed', {
      alert: 'COMPUTE NODE OFFLINE ALERT',
      nodeLabel: node.label,
      nodeIp: node.ip,
      lastSeenAt: node.lastSeenAt ? node.lastSeenAt.toISOString() : 'Never',
      action: 'Autonomous failover & container evacuation triggered',
    }).catch(() => {});

    try {
      await evacuateNodeWorkloads(node.id);
      failedOver++;
    } catch (err: any) {
      logger.error({ err, nodeId: node.id }, 'Failed during node failover evacuation sweep');
    }
  }

  return { audited, failedOver };
}

/**
 * Probes the Node Agent API on port 5000 with a short 3-second timeout.
 */
async function probeNodeAgent(ip: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`http://${ip}:${env.nodeAgentPort}/agent/stats`, {
      method: 'GET',
      headers: { 'x-agent-secret': env.nodeAgentSecret },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}
