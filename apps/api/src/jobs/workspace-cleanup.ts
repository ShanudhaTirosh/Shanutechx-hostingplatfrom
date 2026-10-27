import { prisma } from '../lib/prisma';
import { env } from '../env';
import { logger } from '../lib/logger';
import { agentUrl } from '../lib/nodeAgentClient';

const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours retention period

export async function executeWorkspaceCleanupJob(): Promise<{ cleanedCount: number }> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  let cleanedCount = 0;

  try {
    const candidates = await prisma.deployment.findMany({
      where: {
        OR: [
          { backupLastPushedAt: { lte: cutoff } },
          { lastDeployAt: { lte: cutoff } },
          { createdAt: { lte: cutoff } },
        ],
        status: { in: ['running', 'stopped', 'failed', 'deleted'] },
      },
      include: { node: true },
    });

    const validCandidates = candidates.filter((d) => {
      if (d.workspaceCleanedAt) {
        if (d.backupLastPushedAt && d.workspaceCleanedAt < d.backupLastPushedAt) {
          return true;
        }
        if (d.lastDeployAt && d.workspaceCleanedAt < d.lastDeployAt) {
          return true;
        }
        return false;
      }
      return true;
    });

    logger.info({ candidateCount: validCandidates.length }, 'Running 24h workspace retention cleanup sweep');

    for (const deployment of validCandidates) {

      try {
        const url = agentUrl(deployment.node.ip, `/agent/fs/${deployment.id}/cleanup`);
        const res = await fetch(url, {
          method: 'DELETE',
          headers: {
            'x-agent-secret': env.nodeAgentSecret,
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          await prisma.deployment.update({
            where: { id: deployment.id },
            data: { workspaceCleanedAt: new Date() },
          });
          cleanedCount++;
          logger.info({ deploymentId: deployment.id }, 'Purged 24h node workspace after confirmed backup push');
        } else {
          logger.warn({ deploymentId: deployment.id, status: res.status }, 'Node workspace cleanup endpoint returned error');
        }
      } catch (err: any) {
        logger.error({ deploymentId: deployment.id, err }, 'Failed node workspace cleanup execution');
      }
    }

    return { cleanedCount };
  } catch (err: any) {
    logger.error({ err }, 'Workspace retention cleanup sweep failed');
    return { cleanedCount: 0 };
  }
}
