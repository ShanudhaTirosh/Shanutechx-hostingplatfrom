import { prisma } from './prisma';
import { env } from '../env';
import { logger } from './logger';

const GITHUB_API = 'https://api.github.com';

/** Helper to construct authorization headers for dedicated backup account */
function getBackupHeaders(): Record<string, string> {
  const token = env.backupGithubToken;
  if (!token) {
    throw new Error('BACKUP_GITHUB_TOKEN is not configured on the platform');
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ShanuTechX-Platform-BackupManager',
  };
}

/**
 * Ensures a dedicated private shadow repository exists for a non-Git deployment.
 * Created under the dedicated platform backup account / organization.
 */
export async function ensureShadowRepo(deploymentId: string): Promise<string> {
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
  if (!deployment) throw new Error('Deployment not found');

  if (deployment.backupRepoFullName) {
    return deployment.backupRepoFullName;
  }

  const repoName = `deploy-${deploymentId.toLowerCase()}`;
  const org = env.backupGithubOrg || 'shanutechx-deploy-backups';
  let fullName = `${org}/${repoName}`;

  try {
    // Attempt creation under org
    let createRes = await fetch(`${GITHUB_API}/orgs/${org}/repos`, {
      method: 'POST',
      headers: { ...getBackupHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: repoName,
        private: true,
        description: `Dedicated platform backup repository for deployment ${deploymentId}`,
        auto_init: true,
      }),
    });

    // If org endpoint fails (e.g. user token rather than org token), fallback to user repos endpoint
    if (!createRes.ok && createRes.status === 404) {
      createRes = await fetch(`${GITHUB_API}/user/repos`, {
        method: 'POST',
        headers: { ...getBackupHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          private: true,
          description: `Dedicated platform backup repository for deployment ${deploymentId}`,
          auto_init: true,
        }),
      });
    }

    if (createRes.ok) {
      const data: any = await createRes.json();
      fullName = data.full_name;
    } else if (createRes.status === 422) {
      // Repository already exists
      logger.info({ repoName, fullName }, 'Shadow backup repo already exists on GitHub');
    } else {
      const errText = await createRes.text().catch(() => '');
      logger.warn({ status: createRes.status, errText }, 'Shadow repo creation warning - proceeding');
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { backupRepoFullName: fullName },
    });

    return fullName;
  } catch (err: any) {
    logger.error({ err, deploymentId }, 'Failed to ensure shadow backup repository');
    throw err;
  }
}

/**
 * Pushes the current workspace state on the node to the shadow backup repository.
 */
export async function pushWorkspaceToShadowRepo(deploymentId: string): Promise<boolean> {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { node: true },
    });

    if (!deployment) return false;

    // Do NOT create shadow repos for deployments with a real client Git repo origin
    if (deployment.repoUrl && !deployment.repoUrl.startsWith('zip://') && !deployment.repoUrl.startsWith('upload://')) {
      return false;
    }

    const backupRepoFullName = await ensureShadowRepo(deploymentId);
    const token = env.backupGithubToken;

    if (!token) {
      logger.warn({ deploymentId }, 'BACKUP_GITHUB_TOKEN not configured - skipping shadow push');
      return false;
    }

    const remoteUrl = `https://x-access-token:${token}@github.com/${backupRepoFullName}.git`;
    const agentUrl = `http://${deployment.node.ip}:${env.nodeAgentPort}/agent/fs/${deploymentId}/git-commit-push`;

    const res = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'x-agent-secret': env.nodeAgentSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        remoteUrl,
        commitMessage: `Platform auto-backup sync (${new Date().toISOString()})`,
        authorName: 'ShanuTechX Platform',
        authorEmail: 'platform@shanutechx.com',
      }),
    });

    if (res.ok) {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { backupLastPushedAt: new Date() },
      });
      logger.info({ deploymentId, backupRepoFullName }, 'Successfully pushed workspace backup to shadow repo');
      return true;
    } else {
      const err = await res.json().catch(() => ({}));
      logger.warn({ deploymentId, err }, 'Failed node-agent shadow repo push execution');
      return false;
    }
  } catch (err: any) {
    logger.error({ err, deploymentId }, 'Error in pushWorkspaceToShadowRepo');
    return false;
  }
}

/**
 * Deletes the private shadow backup repository on GitHub when deployment is deleted.
 */
export async function deleteShadowRepo(deploymentId: string): Promise<boolean> {
  try {
    const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
    if (!deployment?.backupRepoFullName) return true;

    const res = await fetch(`${GITHUB_API}/repos/${deployment.backupRepoFullName}`, {
      method: 'DELETE',
      headers: getBackupHeaders(),
    });

    if (res.ok || res.status === 404) {
      logger.info({ backupRepoFullName: deployment.backupRepoFullName }, 'Shadow repo deleted from GitHub');
      return true;
    } else {
      logger.warn({ status: res.status, backupRepoFullName: deployment.backupRepoFullName }, 'Shadow repo delete returned non-200');
      return false;
    }
  } catch (err: any) {
    logger.error({ err, deploymentId }, 'Failed to delete shadow repository');
    return false;
  }
}
