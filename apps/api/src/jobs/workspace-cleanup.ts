import { prisma } from '../lib/prisma';
import { env } from '../env';
import { logger } from '../lib/logger';

const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours retention period

export async function executeWorkspaceCleanupJob(): Promise<{ cleanedCount: number }> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  let cleanedCount = 0;

  try {
    const candidates = await prisma.deployment.findMany({
      where: {
        backupLastPushedAt: { lte: cutoff },
        OR: [
          { workspaceCleanedAt: null },
          { workspaceCleanedAt: { lt: prisma.deployment.fields.backupLastPushedAt } },
        ],
      },
      include: { node: true },
    });

    logger.info({ candidateCount: candidates.length }, 'Running 24h workspace retention cleanup sweep');

    for (const deployment of candidates) {
      // Only clean up non-Git deployments (those backed up to shadow repos)
      const isNonGit = !deployment.repoUrl || deployment.repoUrl.startsWith('zip://') || deployment.repoUrl.startsWith('upload://');
      if (!isNonGit) continue;

      try {
        const url = `http://${deployment.node.ip}:${env.nodeAgentPort}/agent/fs/${deployment.id}/cleanup`;
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
