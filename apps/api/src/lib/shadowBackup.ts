import { prisma } from './prisma';
import { env } from '../env';
import { logger } from './logger';
import { callNodeAgent } from './nodeAgentClient';

const GITHUB_API = 'https://api.github.com';

export interface ShadowRepoInfo {
  repoFullName: string;
  cloneUrl: string;
  htmlUrl: string;
  isShadow: boolean;
}

/**
 * Creates or retrieves a dedicated platform shadow backup repository on GitHub for a deployment instance.
 * Enables version control and contribution tracking for ZIP uploads and Web IDE file creations.
 */
export async function createOrGetShadowRepo(deploymentId: string): Promise<ShadowRepoInfo | null> {
  const token = env.backupGithubToken;
  if (!token) {
    logger.info({ deploymentId }, 'No BACKUP_GITHUB_TOKEN set — skipping automated GitHub shadow repo creation');
    return null;
  }

  const repoName = `deploy-${deploymentId}`;

  try {
    // 1. Try to fetch existing repository details
    let owner = env.backupGithubOrg;
    if (!owner) {
      const userRes = await fetch(`${GITHUB_API}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ShanuTechX-Platform',
        },
      });
      if (userRes.ok) {
        const u: any = await userRes.json();
        owner = u.login;
      }
    }

    const checkRes = await fetch(`${GITHUB_API}/repos/${owner || 'user'}/${repoName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ShanuTechX-Platform',
      },
    });

    if (checkRes.ok) {
      const data: any = await checkRes.json();
      const authenticatedUrl = `https://x-access-token:${token}@github.com/${data.full_name}.git`;
      return {
        repoFullName: data.full_name,
        cloneUrl: authenticatedUrl,
        htmlUrl: data.html_url,
        isShadow: true,
      };
    }

    // 2. If repo doesn't exist, create a new private repo
    const createUrl = env.backupGithubOrg
      ? `${GITHUB_API}/orgs/${env.backupGithubOrg}/repos`
      : `${GITHUB_API}/user/repos`;

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'ShanuTechX-Platform',
      },
      body: JSON.stringify({
        name: repoName,
        description: `Automated platform backup repository for ShanuTechX deployment ${deploymentId}`,
        private: true,
        auto_init: false,
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text().catch(() => '');
      logger.warn({ deploymentId, status: createRes.status, errorText }, 'Failed to create GitHub shadow backup repository');
      return null;
    }

    const newRepo: any = await createRes.json();
    const authenticatedUrl = `https://x-access-token:${token}@github.com/${newRepo.full_name}.git`;

    logger.info({ deploymentId, repoFullName: newRepo.full_name }, 'Successfully created platform shadow backup repository on GitHub');

    return {
      repoFullName: newRepo.full_name,
      cloneUrl: authenticatedUrl,
      htmlUrl: newRepo.html_url,
      isShadow: true,
    };
  } catch (err: any) {
    logger.error({ err, deploymentId }, 'Error in createOrGetShadowRepo');
    return null;
  }
}

/**
 * Triggers the node-agent to initialize local git workspace, commit all files, and push to the shadow backup remote.
 */
export async function syncWorkspaceToShadowBackup(deploymentId: string, commitMessage?: string): Promise<boolean> {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { node: true },
    });

    if (!deployment || !deployment.node) return false;

    const shadowRepo = await createOrGetShadowRepo(deploymentId);
    if (!shadowRepo) return false;

    // Trigger node-agent git sync
    await callNodeAgent(deployment.node, `/agent/deployments/${deploymentId}/git-backup-push`, 'POST', {
      remoteUrl: shadowRepo.cloneUrl,
      commitMessage: commitMessage || `Automated backup commit (${new Date().toISOString()})`,
    });

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        backupRepoFullName: shadowRepo.repoFullName,
        backupLastPushedAt: new Date(),
        repoUrl: deployment.repoUrl || shadowRepo.htmlUrl,
      },
    });

    logger.info({ deploymentId, shadowRepo: shadowRepo.repoFullName }, 'Successfully synced workspace to shadow backup repository');
    return true;
  } catch (err: any) {
    logger.error({ err, deploymentId }, 'Failed to sync workspace to shadow backup repository');
    return false;
  }
}

export const pushWorkspaceToShadowRepo = syncWorkspaceToShadowBackup;

/**
 * Deletes a platform shadow backup repository on GitHub when a deployment instance is deleted.
 */
export async function deleteShadowRepo(deploymentId: string): Promise<boolean> {
  const token = env.backupGithubToken;
  if (!token) return false;

  const repoName = `deploy-${deploymentId}`;

  try {
    let owner = env.backupGithubOrg;
    if (!owner) {
      const userRes = await fetch(`${GITHUB_API}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ShanuTechX-Platform',
        },
      });
      if (userRes.ok) {
        const u: any = await userRes.json();
        owner = u.login;
      }
    }

    const deleteUrl = `${GITHUB_API}/repos/${owner || 'user'}/${repoName}`;

    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ShanuTechX-Platform',
      },
    });

    if (res.ok) {
      logger.info({ deploymentId, repoName }, 'Successfully deleted shadow backup repository on GitHub');
      return true;
    }
    return false;
  } catch (err: any) {
    logger.error({ err, deploymentId }, 'Failed to delete shadow backup repository on GitHub');
    return false;
  }
}


