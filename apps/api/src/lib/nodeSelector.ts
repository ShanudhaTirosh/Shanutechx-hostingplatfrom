import { prisma } from './prisma';

export class NodeSelectionError extends Error {}

interface SelectNodeOptions {
  /** e.g. "web-hosting", "python-hosting", "discordbot-node", "livekit" */
  requiredTag: string;
  /**
   * Only true for deployments created from the admin dashboard for the
   * admin's own infra. Customer-facing routes must never set this.
   */
  isAdminDeployment?: boolean;
  /**
   * Only honored when isAdminDeployment is true. A customer-facing call
   * passing this is a bug in the caller, not a valid request — see the
   * assertion below.
   */
  explicitNodeId?: string;
}

/**
 * Decides which Node a new deployment lands on.
 *
 * - Customer deployments (isAdminDeployment !== true): always auto-selected.
 *   explicitNodeId is ignored even if present — there is no customer-facing
 *   way to choose a node, by design.
 * - Admin deployments (isAdminDeployment === true): explicitNodeId is honored
 *   if provided and valid; otherwise falls back to the same auto-selection.
 *
 * Auto-selection picks the active node carrying `requiredTag` with the most
 * estimated free capacity, weighting CPU and RAM headroom evenly. Nodes with
 * no recent stats (lastSeenAt older than 5 minutes, or never reported) are
 * deprioritized rather than excluded, so a brand-new node can still be picked.
 */
export async function selectNodeForDeployment(opts: SelectNodeOptions) {
  const { requiredTag, isAdminDeployment, explicitNodeId } = opts;

  if (explicitNodeId && !isAdminDeployment) {
    // Defensive: a customer-facing caller should never reach this branch,
    // but if it does, fail loudly instead of silently honoring the override.
    throw new NodeSelectionError(
      'explicitNodeId is only valid for admin deployments'
    );
  }

  if (isAdminDeployment && explicitNodeId) {
    const node = await prisma.node.findUnique({ where: { id: explicitNodeId } });
    if (!node || !node.isActive) {
      throw new NodeSelectionError('Selected node is invalid or inactive');
    }
    if (!node.roleTags.includes(requiredTag)) {
      throw new NodeSelectionError(
        `Node "${node.label}" does not support "${requiredTag}"`
      );
    }
    return node;
  }

  const candidates = await prisma.node.findMany({
    where: { isActive: true, roleTags: { has: requiredTag } },
  });

  if (candidates.length === 0) {
    throw new NodeSelectionError(
      `No active node supports "${requiredTag}" yet`
    );
  }

  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  type Candidate = (typeof candidates)[number];
  type Scored = { node: Candidate; score: number };

  const scored: Scored[] = candidates.map((node: Candidate) => {
    const stale = !node.lastSeenAt || node.lastSeenAt.getTime() < fiveMinutesAgo;

    const cpuFreePct = 100 - (node.cpuUsedPct ?? 0);
    const ramFreePct = node.ramMb
      ? 100 - ((node.ramUsedMb ?? 0) / node.ramMb) * 100
      : 100;

    // Higher score = more headroom = better candidate.
    let score = (cpuFreePct + ramFreePct) / 2;

    // Don't exclude stale nodes (e.g. brand new, never reported stats yet),
    // just don't let them outrank nodes we actually have fresh data for.
    if (stale) score -= 5;

    return { node, score };
  });

  scored.sort((a: Scored, b: Scored) => b.score - a.score);

  return scored[0].node;
}

/**
 * Automatic Node Failover & Container Migration Routine.
 * Triggered when a node goes offline/unhealthy or is deactivated.
 * Migrates all deployments from the dead node to healthy nodes in the cluster.
 */
export async function failoverDeadNode(failedNodeId: string): Promise<{ migrated: number; failed: number }> {
  const failedNode = await prisma.node.findUnique({ where: { id: failedNodeId } });
  if (!failedNode) {
    throw new NodeSelectionError(`Node "${failedNodeId}" not found`);
  }

  // Mark node inactive
  await prisma.node.update({
    where: { id: failedNodeId },
    data: { isActive: false },
  });

  const deployments = await prisma.deployment.findMany({
    where: { nodeId: failedNodeId },
  });

  let migrated = 0;
  let failed = 0;

  for (const dep of deployments) {
    try {
      const requiredTag = dep.runtime?.includes('python') ? 'python-hosting' : 'web-hosting';
      const targetNode = await selectNodeForDeployment({ requiredTag });

      await prisma.deployment.update({
        where: { id: dep.id },
        data: { nodeId: targetNode.id, status: 'pending' },
      });

      migrated++;
    } catch {
      failed++;
    }
  }

  return { migrated, failed };
}
