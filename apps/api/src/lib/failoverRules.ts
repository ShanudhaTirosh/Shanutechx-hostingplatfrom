/**
 * Pure functions for Node Health Watchdog & Failover calculations.
 * Used by failoverEngine.ts, nodeMonitor.ts, and unit tests (no DB required).
 */

export const DEFAULT_OFFLINE_THRESHOLD_MS = 2.5 * 60 * 1000; // 2.5 minutes

/**
 * Determines whether a compute node is considered offline based on its lastSeenAt timestamp.
 */
export function isNodeOffline(
  lastSeenAt: Date | string | null,
  now: Date | number = Date.now(),
  thresholdMs: number = DEFAULT_OFFLINE_THRESHOLD_MS
): boolean {
  if (!lastSeenAt) return true;
  const lastSeenMs = typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return nowMs - lastSeenMs > thresholdMs;
}

export interface NodeCandidateInput {
  id: string;
  label: string;
  isActive: boolean;
  cpuUsedPct: number | null;
  ramUsedMb: number | null;
  ramMb: number;
  lastSeenAt: Date | string | null;
  roleTags: string[];
}

/**
 * Scores a node for capacity-based candidate selection.
 * Higher score = more capacity available.
 */
export function calculateNodeCapacityScore(
  node: NodeCandidateInput,
  now: number = Date.now()
): number {
  if (!node.isActive) return -Infinity;

  const cpuFreePct = 100 - (node.cpuUsedPct ?? 0);
  const ramFreePct = node.ramMb ? 100 - ((node.ramUsedMb ?? 0) / node.ramMb) * 100 : 100;

  let score = (cpuFreePct + ramFreePct) / 2;

  const offline = isNodeOffline(node.lastSeenAt, now);
  if (offline) {
    score -= 50; // Heavily penalize stale/offline nodes
  }

  return score;
}

/**
 * Ranks and selects the best candidate target node for a workload migration.
 */
export function selectBestTargetNode<T extends NodeCandidateInput>(
  candidates: T[],
  requiredTag: string,
  excludeNodeId?: string,
  now: number = Date.now()
): T | null {
  const eligible = candidates.filter(
    (n) => n.isActive && n.id !== excludeNodeId && n.roleTags.includes(requiredTag)
  );

  if (eligible.length === 0) return null;

  const scored = eligible.map((node) => ({
    node,
    score: calculateNodeCapacityScore(node, now),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].node;
}
