import { prisma } from './prisma';
import { stopDeployment } from './nodeAgentClient';
import { notifyAdmins } from './notifications';
import { logger } from './logger';

const PROHIBITED_PATTERNS = [
  { pattern: /xmrig|cgminer|cpuminer|minerd|stratum\+tcp/i, reason: 'Unauthorized Cryptocurrency Mining Activity' },
  { pattern: /slowloris|masscan|hulk\.py|ddos-attack|synflood/i, reason: 'Malicious DDoS / Network Scanning Tool' },
  { pattern: /discord-token-grabber|stealer-log|pass-stealer/i, reason: 'Malicious Credential Theft / Malware' },
  { pattern: /paypal-verify-login|banking-secure-auth|phishing-clone/i, reason: 'Phishing Site Activity' },
];

/**
 * Scans text content (environment variables, build commands, repository URLs)
 * for prohibited security & abuse patterns.
 */
export function scanTextForAbuse(text: string): { flagged: boolean; reason?: string } {
  if (!text) return { flagged: false };
  for (const item of PROHIBITED_PATTERNS) {
    if (item.pattern.test(text)) {
      return { flagged: true, reason: item.reason };
    }
  }
  return { flagged: false };
}

/**
 * Executes a full account suspension / ban:
 * 1. Marks user as banned in database with reason and timestamp.
 * 2. Stops and terminates all active container deployments for this user across Node Agents.
 * 3. Revokes all active API keys.
 * 4. Logs to AuditLog and notifies staff channels.
 */
export async function banUserAndTeardownResources({
  userId,
  reason,
  detectedBy = 'Automated Abuse Detector',
  actorId,
}: {
  userId: string;
  reason: string;
  detectedBy?: string;
  actorId?: string;
}): Promise<{ ok: boolean; stoppedDeploymentsCount: number }> {
  try {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.role === 'dev') {
      logger.warn(`Attempted ban on immune dev user ${userId} aborted.`);
      return { ok: false, stoppedDeploymentsCount: 0 };
    }

    // 1. Update user ban status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        banReason: reason,
      },
    });

    // 2. Revoke all active API keys
    await prisma.apiKey.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 3. Find and stop all running deployments for this user
    const runningDeployments = await prisma.deployment.findMany({
      where: { userId, status: 'running' },
      include: { node: true },
    });

    let stoppedCount = 0;
    for (const dep of runningDeployments) {
      // FIX: dep.containerId is the Docker container ID; dep.id is the DB UUID.
      // Passing dep.id to stopDeployment always fails silently because the node-agent
      // has no container with that name. Guard against null containerId too.
      if (dep.node && dep.containerId) {
        try {
          await stopDeployment(dep.node, dep.containerId);
        } catch (err: any) {
          logger.error({ err, deploymentId: dep.id, containerId: dep.containerId }, 'Failed to stop deployment container during user ban');
        }
      } else if (dep.node && !dep.containerId) {
        logger.warn({ deploymentId: dep.id }, 'Skipping container stop during ban — no containerId recorded for this deployment');
      }
      await prisma.deployment.update({
        where: { id: dep.id },
        data: { status: 'stopped' },
      });
      stoppedCount++;
    }

    // 3b. Stop and teardown all running managed databases
    await prisma.managedDatabase.updateMany({
      where: { userId, status: 'running' },
      data: { status: 'stopped' },
    });

    // 3c. Mark all VPS provisions as terminated
    await prisma.vpsProvision.updateMany({
      where: { userId, status: 'provisioned' },
      data: { status: 'terminated' },
    });

    // 4. Log Audit Log event
    await prisma.auditLog.create({
      data: {
        adminId: actorId || null,
        action: 'USER_SUSPENDED_ABUSE',
        target: `User:${updatedUser.email} (Stopped:${stoppedCount}, Reason:${reason})`,
        actorRole: actorId ? null : 'system',
      },
    });

    // 5. Fire alert notification to staff
    void notifyAdmins(
      `🚨 USER ACCOUNT BANNED (Abuse Detected)\nUser: ${updatedUser.email} (ID: ${userId})\nReason: ${reason}\nDetected By: ${detectedBy}\nStopped Deployments: ${stoppedCount}`
    );

    return { ok: true, stoppedDeploymentsCount: stoppedCount };
  } catch (err: any) {
    logger.error({ err, userId }, 'Error executing banUserAndTeardownResources');
    throw err;
  }
}

/**
 * Unbans a user account and restores access.
 */
export async function unbanUser({
  userId,
  adminUserId,
}: {
  userId: string;
  adminUserId: string;
}): Promise<{ ok: boolean }> {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: false,
      bannedAt: null,
      banReason: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: adminUserId,
      action: 'USER_UNBANNED',
      target: `User:${updatedUser.email}`,
    },
  });

  return { ok: true };
}
