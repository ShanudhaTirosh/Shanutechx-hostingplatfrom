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
}: {
  userId: string;
  reason: string;
  detectedBy?: string;
}): Promise<{ ok: boolean; stoppedDeploymentsCount: number }> {
  try {
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
      if (dep.node) {
        try {
          await stopDeployment(dep.node, dep.id);
        } catch (err: any) {
          logger.error({ err, deploymentId: dep.id }, 'Failed to stop deployment container during user ban');
        }
      }
      await prisma.deployment.update({
        where: { id: dep.id },
        data: { status: 'stopped' },
      });
      stoppedCount++;
    }

    // 4. Log Audit Log event
    await prisma.auditLog.create({
      data: {
        adminId: userId,
        action: 'USER_SUSPENDED_ABUSE',
        target: `User:${updatedUser.email} (Stopped:${stoppedCount}, Reason:${reason})`,
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
