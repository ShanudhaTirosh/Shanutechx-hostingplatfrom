import { prisma } from './prisma';
import { selectNodeForDeployment } from './nodeSelector';
import { buildAndRun, provisionDatabaseContainer, registerLiveKitKey } from './nodeAgentClient';
import { createSubdomainRecord } from './cloudflare';
import { decryptSecret } from './secretsVault';
import { env } from '../env';
import { logger } from './logger';
import { fireWebhook } from './webhooks';

export interface FailoverResult {
  failedNodeId: string;
  deploymentsMigrated: number;
  deploymentsFailed: number;
  databasesMigrated: number;
  databasesFailed: number;
  liveKitMigrated: number;
  portsMigrated: number;
  errors: string[];
}

/**
 * Executes a full real-time evacuation and failover for a dead or deactivated compute node.
 * Automatically migrates Deployments, Managed Databases, LiveKit Projects, and Node Port Exposures.
 */
export async function evacuateNodeWorkloads(failedNodeId: string): Promise<FailoverResult> {
  const result: FailoverResult = {
    failedNodeId,
    deploymentsMigrated: 0,
    deploymentsFailed: 0,
    databasesMigrated: 0,
    databasesFailed: 0,
    liveKitMigrated: 0,
    portsMigrated: 0,
    errors: [],
  };

  const failedNode = await prisma.node.findUnique({ where: { id: failedNodeId } });
  if (!failedNode) {
    throw new Error(`Node "${failedNodeId}" not found`);
  }

  logger.warn({ nodeId: failedNodeId, label: failedNode.label }, 'Starting real-time node evacuation & service failover sweep');

  // Mark node as inactive to prevent new deployments from choosing it
  await prisma.node.update({
    where: { id: failedNodeId },
    data: { isActive: false },
  }).catch((err) => {
    logger.error({ err, failedNodeId }, 'Failed to mark node inactive');
  });

  // 1. MIGRATE APPLICATION DEPLOYMENTS
  const deployments = await prisma.deployment.findMany({
    where: {
      nodeId: failedNodeId,
      status: { in: ['running', 'pending', 'building'] },
    },
  });

  for (const dep of deployments) {
    try {
      const requiredTag = dep.runtime?.includes('python') ? 'python-hosting' : 'web-hosting';

      // Pick healthy target candidate node (excluding the dead node)
      let targetNode;
      try {
        targetNode = await selectNodeForDeployment({ requiredTag });
      } catch (err: any) {
        // Fallback to any active hosting node
        targetNode = await prisma.node.findFirst({
          where: { isActive: true, id: { not: failedNodeId } },
        });
      }

      if (!targetNode || targetNode.id === failedNodeId) {
        throw new Error(`No healthy target node available for deployment ${dep.id}`);
      }

      logger.info({ deploymentId: dep.id, targetNodeId: targetNode.id }, 'Migrating deployment to target node');

      // Update deployment target node & status
      await prisma.deployment.update({
        where: { id: dep.id },
        data: { nodeId: targetNode.id, status: 'building' },
      });

      // Decrypt env vars if set
      let envVars: Record<string, string> | undefined;
      if (dep.envVarsEncrypted) {
        try {
          const raw = decryptSecret(dep.envVarsEncrypted, env.secretsEncryptionKey);
          envVars = JSON.parse(raw);
        } catch (decErr) {
          logger.warn({ decErr, deploymentId: dep.id }, 'Could not decrypt envVarsEncrypted during failover');
        }
      }

      // Update Cloudflare DNS record if subdomain exists
      if (dep.subdomain) {
        const isProxied = dep.exposureMode === 'ssl_with_proxy';
        await createSubdomainRecord(dep.subdomain, targetNode.ip, isProxied).catch((dnsErr) => {
          logger.warn({ dnsErr, subdomain: dep.subdomain }, 'Cloudflare DNS record update warning during failover');
        });
      }

      // Source URL fallback (Git repo or backup archive)
      const sourceRepo = dep.repoUrl || (dep.backupRepoFullName ? `https://github.com/${dep.backupRepoFullName}.git` : undefined);

      if (!sourceRepo) {
        throw new Error(`Deployment ${dep.id} has no source repository or shadow backup repository URL`);
      }

      // Re-trigger build and container launch on target node
      const buildResult = await buildAndRun(
        targetNode,
        {
          deploymentId: dep.id,
          repoUrl: sourceRepo,
          branch: dep.branch ?? undefined,
          subdomain: dep.subdomain ?? undefined,
          internalPort: dep.internalPort ?? 3000,
          envVars,
          cpuLimit: dep.cpuLimit ?? undefined,
          memoryLimit: dep.memoryLimit ?? undefined,
          storageLimit: dep.storageLimit ?? undefined,
          startCommand: dep.startCommand ?? undefined,
          entryFile: dep.entryFile ?? undefined,
          frameworkPreset: dep.frameworkPreset ?? 'auto',
          exposureMode: dep.exposureMode ?? 'ssl_with_proxy',
          publishedPort: dep.publishedPort ?? undefined,
        },
        (event) => {
          logger.debug({ deploymentId: dep.id, phase: event.phase }, 'Failover build event');
        }
      );

      if (buildResult.phase === 'error') {
        throw new Error(buildResult.message || 'Build and run failed on target node');
      }

      await prisma.deployment.update({
        where: { id: dep.id },
        data: {
          status: 'running',
          containerId: buildResult.containerId,
          lastDeployAt: new Date(),
        },
      });

      void fireWebhook(dep.userId, 'deployment_status_changed', {
        deploymentId: dep.id,
        status: 'running',
        migratedToNodeId: targetNode.id,
      });

      result.deploymentsMigrated++;
    } catch (err: any) {
      logger.error({ err, deploymentId: dep.id }, 'Deployment failover failed');
      await prisma.deployment.update({
        where: { id: dep.id },
        data: { status: 'failed' },
      }).catch(() => {});
      result.deploymentsFailed++;
      result.errors.push(`Deployment ${dep.id}: ${err.message}`);
    }
  }

  // 2. MIGRATE MANAGED DATABASES
  const databases = await prisma.managedDatabase.findMany({
    where: {
      nodeId: failedNodeId,
      status: { in: ['running', 'pending'] },
    },
  });

  for (const db of databases) {
    try {
      const targetDbNode = await selectNodeForDeployment({ requiredTag: 'database-hosting' }).catch(() =>
        prisma.node.findFirst({ where: { isActive: true, id: { not: failedNodeId } } })
      );

      if (!targetDbNode || targetDbNode.id === failedNodeId) {
        throw new Error(`No healthy target database node available for database ${db.id}`);
      }

      let password = 'db_password_default';
      if (db.credentialRef) {
        try {
          password = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
        } catch { /* fallback default */ }
      }

      const containerInfo = await provisionDatabaseContainer(targetDbNode, {
        databaseId: db.id,
        type: db.type as any,
        password,
      });

      await prisma.managedDatabase.update({
        where: { id: db.id },
        data: {
          nodeId: targetDbNode.id,
          containerId: containerInfo.containerId,
          status: 'running',
        },
      });

      result.databasesMigrated++;
    } catch (err: any) {
      logger.error({ err, databaseId: db.id }, 'Managed Database failover failed');
      await prisma.managedDatabase.update({
        where: { id: db.id },
        data: { status: 'failed' },
      }).catch(() => {});
      result.databasesFailed++;
      result.errors.push(`Database ${db.id}: ${err.message}`);
    }
  }

  // 3. MIGRATE LIVEKIT PROJECTS
  const liveKitProjs = await prisma.liveKitProject.findMany({
    where: { nodeId: failedNodeId, isActive: true },
  });

  for (const lk of liveKitProjs) {
    try {
      const targetLkNode = await selectNodeForDeployment({ requiredTag: 'livekit' }).catch(() =>
        prisma.node.findFirst({ where: { isActive: true, id: { not: failedNodeId } } })
      );

      if (targetLkNode && targetLkNode.id !== failedNodeId) {
        let apiSecret = '';
        if (lk.apiSecretRef) {
          try {
            apiSecret = decryptSecret(lk.apiSecretRef, env.secretsEncryptionKey);
          } catch { /* skip */ }
        }

        if (apiSecret) {
          await registerLiveKitKey(targetLkNode, { apiKey: lk.apiKey, apiSecret });
        }

        await prisma.liveKitProject.update({
          where: { id: lk.id },
          data: { nodeId: targetLkNode.id },
        });

        result.liveKitMigrated++;
      }
    } catch (err: any) {
      logger.error({ err, liveKitId: lk.id }, 'LiveKit failover failed');
    }
  }

  // 4. MIGRATE NODE PORT EXPOSURES
  const exposures = await prisma.nodePortExposure.findMany({
    where: { nodeId: failedNodeId },
  });

  for (const exp of exposures) {
    try {
      const targetPortNode = await prisma.node.findFirst({
        where: { isActive: true, id: { not: failedNodeId } },
      });

      if (targetPortNode && exp.subdomain) {
        await createSubdomainRecord(exp.subdomain, targetPortNode.ip).catch(() => {});
        await prisma.nodePortExposure.update({
          where: { id: exp.id },
          data: { nodeId: targetPortNode.id },
        });
        result.portsMigrated++;
      }
    } catch (err: any) {
      logger.error({ err, exposureId: exp.id }, 'Port exposure failover failed');
    }
  }

  // Log audit trail for node failover
  const adminUser = await prisma.user.findFirst({ where: { role: { in: ['admin', 'dev'] } } });
  if (adminUser) {
    await prisma.auditLog.create({
      data: {
        adminId: adminUser.id,
        action: 'node.auto_failover',
        target: `${failedNodeId}: ${JSON.stringify(result)}`,
        actorRole: 'system',
      },
    }).catch(() => {});
  }


  logger.info(
    {
      failedNodeId,
      deploymentsMigrated: result.deploymentsMigrated,
      databasesMigrated: result.databasesMigrated,
    },
    'Node failover evacuation completed successfully'
  );

  return result;
}
