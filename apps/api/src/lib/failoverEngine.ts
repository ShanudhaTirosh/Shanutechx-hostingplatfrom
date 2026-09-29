import crypto from 'node:crypto';
import { prisma } from './prisma';
import { selectNodeForDeployment } from './nodeSelector';
import { buildAndRun, provisionDatabaseContainer, registerLiveKitKey } from './nodeAgentClient';
import { createSubdomainRecord } from './cloudflare';
import { createExposureDeps, moveExposureToNode } from './nodePortExposure';
import { decryptSecret, encryptSecret } from './secretsVault';
import { env } from '../env';
import { logger } from './logger';
import { fireWebhook } from './webhooks';
import { resolveRepoUrlForBuild } from './gitAuth';

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
      status: { in: ['running', 'pending', 'building', 'stopped'] },
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

      // Source URL: credential-free stored URL → fresh token resolved at build time (S06 fix).
      // resolveRepoUrlForBuild mints a fresh short-lived OAuth token (or decrypts the stored PAT)
      // so expired GitHub App installation tokens no longer cause failover rebuilds to 401-fail.
      const sourceRepo = dep.repoUrl || (dep.backupRepoFullName ? `https://github.com/${dep.backupRepoFullName}.git` : undefined);

      if (!sourceRepo) {
        throw new Error(`Deployment ${dep.id} has no source repository or shadow backup repository URL`);
      }

      // Resolve fresh credentials — falls back to the bare URL gracefully if no git account is linked
      const authedRepoUrl = await resolveRepoUrlForBuild(dep.id, sourceRepo).catch((authErr) => {
        logger.warn({ authErr: authErr instanceof Error ? authErr.message : String(authErr), deploymentId: dep.id }, 'Git credential resolution failed during failover; using stored URL as-is');
        return sourceRepo;
      });

      // Re-trigger build and container launch on target node
      const buildResult = await buildAndRun(
        targetNode,
        {
          deploymentId: dep.id,
          repoUrl: authedRepoUrl,
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

      // BUG-H05 FIX: Never silently rotate the database password.
      // If decryption fails, halt the failover for this DB and surface the error
      // so ops can intervene rather than breaking all client connections silently.
      if (!db.credentialRef) {
        throw new Error(`Database ${db.id} has no stored credential reference — cannot failover without credentials`);
      }
      let password: string;
      try {
        password = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
      } catch (decryptErr) {
        throw new Error(
          `Database ${db.id}: credential decryption failed — failover aborted to preserve existing client connections. ` +
          `Manual credential recovery required before failover can proceed.`
        );
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
        // BUG-L03 FIX: If apiSecret decryption fails, record a failure rather than
        // silently updating the node pointer without registering the key.
        if (!lk.apiSecretRef) {
          throw new Error(`LiveKit project ${lk.id} has no stored API secret — cannot register on target node`);
        }

        let apiSecret: string;
        try {
          apiSecret = decryptSecret(lk.apiSecretRef, env.secretsEncryptionKey);
        } catch {
          throw new Error(
            `LiveKit project ${lk.id}: API secret decryption failed — node pointer not updated to prevent broken state`
          );
        }

        await registerLiveKitKey(targetLkNode, { apiKey: lk.apiKey, apiSecret });

        await prisma.liveKitProject.update({
          where: { id: lk.id },
          data: { nodeId: targetLkNode.id },
        });

        result.liveKitMigrated++;
      }
    } catch (err: any) {
      logger.error({ err, liveKitId: lk.id }, 'LiveKit failover failed');
      result.errors.push(`LiveKit ${lk.id}: ${err.message}`);
    }
  }

  // 4. MIGRATE NODE PORT EXPOSURES
  const exposures = await prisma.nodePortExposure.findMany({
    where: { nodeId: failedNodeId },
  });

  const exposureDeps = exposures.length > 0 ? await createExposureDeps() : null;
  for (const exp of exposures) {
    try {
      const targetPortNode = await prisma.node.findFirst({
        where: { isActive: true, id: { not: failedNodeId } },
      });

      if (targetPortNode && exp.subdomain && exposureDeps) {
        // Creates the record on the new node, repoints the row, and deletes the dead node's record. If DNS cannot be
        // updated the exposure stays where it is (before: it was moved in the database regardless).
        const moved = await moveExposureToNode(exp as any, { id: targetPortNode.id, label: targetPortNode.label, ip: targetPortNode.ip }, exposureDeps);
        if (moved) result.portsMigrated++;
        else result.errors.push(`Port exposure ${exp.id}: DNS could not be updated; left on the failed node`);
      } else if (!exp.subdomain) {
        // S14 FIX: Raw-TCP / no-subdomain exposures cannot be migrated automatically.
        // Previously these were silently skipped — operators had no way to know they were missed.
        const errMsg = `Port exposure ${exp.id} (port ${exp.port}): has no subdomain and cannot be migrated automatically. Manual reconfiguration required.`;
        logger.warn({ exposureId: exp.id, port: exp.port, nodeId: failedNodeId }, errMsg);
        result.errors.push(errMsg);
      } else if (!targetPortNode) {
        result.errors.push(`Port exposure ${exp.id}: no available target node for migration`);
      }
    } catch (err: any) {
      logger.error({ err, exposureId: exp.id }, 'Port exposure failover failed');
    }
  }

  // Log audit trail for node failover
  await prisma.auditLog.create({
    data: {
      adminId: null,
      action: 'node.auto_failover',
      target: `${failedNodeId}: ${JSON.stringify(result)}`,
      actorRole: 'system',
    },
  }).catch(() => {});


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
