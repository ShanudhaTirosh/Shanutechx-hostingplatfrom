import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { env } from '../env';
import { prisma } from '../lib/prisma';
import { deployService } from '../lib/deployPipeline';
import { stopDeployment } from '../lib/nodeAgentClient';

export const prWebhooksRouter = Router();

/**
 * POST /api/webhooks/pr-deploy
 * Webhook handler for GitHub pull_request and GitLab merge_request events.
 * Enforces X-Hub-Signature-256 (GitHub) and X-Gitlab-Token (GitLab) signature verification.
 */
prWebhooksRouter.post('/webhooks/pr-deploy', async (req: Request, res: Response) => {
  const eventType = req.headers['x-github-event'] || req.headers['x-gitlab-event'];
  const payload = req.body || {};

  const githubSignature = req.headers['x-hub-signature-256'] as string | undefined;
  const gitlabToken = req.headers['x-gitlab-token'] as string | undefined;
  const webhookSecret = env.prWebhookSecret;

  if (!webhookSecret) {
    logger.warn({ eventType }, 'PR webhook secret not configured on server');
    return res.status(500).json({ error: 'PR Webhook secret is not configured' });
  }

  let verified = false;
  if (githubSignature) {
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      logger.warn({ eventType }, 'PR webhook rawBody unavailable for signature verification');
      return res.status(400).json({ error: 'Raw body required for HMAC signature verification' });
    }
    const expected = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    try {
      verified =
        expected.length === githubSignature.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(githubSignature));
    } catch {
      verified = false;
    }
  } else if (gitlabToken) {
    verified =
      gitlabToken.length === webhookSecret.length &&
      crypto.timingSafeEqual(Buffer.from(gitlabToken), Buffer.from(webhookSecret));
  }

  if (!verified) {
    logger.warn({ eventType }, 'PR webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid webhook signature or token' });
  }

  logger.info({ eventType }, 'Received PR preview deployment webhook payload');

  try {
    // 1. Handle GitHub Pull Request
    if (eventType === 'pull_request') {
      const action = payload.action;
      const prNumber = payload.number;
      const repoFullName = payload.repository?.full_name;
      const headBranch = payload.pull_request?.head?.ref;
      const cloneUrl = payload.repository?.clone_url || payload.repository?.html_url;

      if (!repoFullName || !prNumber) {
        return res.status(400).json({ error: 'Invalid pull request payload' });
      }

      if (['opened', 'synchronize', 'reopened'].includes(action)) {
        logger.info({ repoFullName, prNumber, headBranch }, 'Triggering automated PR preview deployment');

        const parent = await prisma.deployment.findFirst({
          where: {
            repoUrl: { contains: repoFullName },
            isPreview: false,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!parent) {
          return res.status(404).json({ error: `No parent deployment registered for repository ${repoFullName}` });
        }

        const previewSubdomain = `${parent.subdomain || 'pr'}-pr-${prNumber}`.slice(0, 40);

        const { deployment, subdomain } = await deployService({
          userId: parent.userId,
          serviceType: parent.webHostingType || 'node_hosting',
          repoUrl: cloneUrl || parent.repoUrl || '',
          branch: headBranch || `pr-${prNumber}`,
          preferredName: previewSubdomain,
          internalPort: parent.internalPort || 3000,
          isPreview: true,
          parentDeploymentId: parent.id,
          gitAccountId: parent.gitAccountId ?? undefined,
          gitProvider: parent.gitProvider ?? undefined,
          gitTokenEncrypted: parent.githubTokenEncrypted ?? undefined,
          startCommand: parent.startCommand ?? undefined,
          entryFile: parent.entryFile ?? undefined,
          frameworkPreset: parent.frameworkPreset ?? undefined,
          exposureMode: parent.exposureMode ?? undefined,
        });

        return res.status(201).json({
          ok: true,
          message: `Automated PR preview deployment triggered for PR #${prNumber}`,
          deploymentId: deployment.id,
          subdomain,
        });
      }

      if (action === 'closed') {
        logger.info({ repoFullName, prNumber }, 'Triggering automated PR preview teardown');

        const previews = await prisma.deployment.findMany({
          where: {
            isPreview: true,
            repoUrl: { contains: repoFullName },
            branch: headBranch || `pr-${prNumber}`,
          },
          include: { node: true },
        });

        for (const prev of previews) {
          if (prev.containerId && prev.node) {
            await stopDeployment(prev.node, prev.containerId).catch((err) => {
              logger.warn({ err, deploymentId: prev.id }, 'Failed to stop container on PR preview teardown');
            });
          }
          await prisma.deployment.update({
            where: { id: prev.id },
            data: { status: 'deleted' },
          });
        }

        return res.json({ ok: true, message: `PR #${prNumber} preview environment cleaned up` });
      }
    }

    // 2. Handle GitLab Merge Request
    if (eventType === 'Merge Request Hook' || payload.object_kind === 'merge_request') {
      const action = payload.object_attributes?.action;
      const mrIid = payload.object_attributes?.iid;
      const repoFullName = payload.project?.path_with_namespace;
      const headBranch = payload.object_attributes?.source_branch;
      const cloneUrl = payload.project?.http_url;

      if (['open', 'update', 'reopen'].includes(action)) {
        logger.info({ repoFullName, mrIid, headBranch }, 'Triggering automated MR preview deployment');

        const parent = await prisma.deployment.findFirst({
          where: {
            repoUrl: { contains: repoFullName || '' },
            isPreview: false,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!parent) {
          return res.status(404).json({ error: `No parent deployment registered for project ${repoFullName}` });
        }

        const previewSubdomain = `${parent.subdomain || 'mr'}-mr-${mrIid}`.slice(0, 40);

        const { deployment, subdomain } = await deployService({
          userId: parent.userId,
          serviceType: parent.webHostingType || 'node_hosting',
          repoUrl: cloneUrl || parent.repoUrl || '',
          branch: headBranch || `mr-${mrIid}`,
          preferredName: previewSubdomain,
          internalPort: parent.internalPort || 3000,
          isPreview: true,
          parentDeploymentId: parent.id,
          gitAccountId: parent.gitAccountId ?? undefined,
          gitProvider: parent.gitProvider ?? undefined,
          gitTokenEncrypted: parent.githubTokenEncrypted ?? undefined,
          startCommand: parent.startCommand ?? undefined,
          entryFile: parent.entryFile ?? undefined,
          frameworkPreset: parent.frameworkPreset ?? undefined,
          exposureMode: parent.exposureMode ?? undefined,
        });

        return res.status(201).json({
          ok: true,
          message: `Automated MR preview deployment triggered for MR !${mrIid}`,
          deploymentId: deployment.id,
          subdomain,
        });
      }

      if (action === 'close' || action === 'merge') {
        logger.info({ repoFullName, mrIid }, 'Triggering automated MR preview teardown');

        const previews = await prisma.deployment.findMany({
          where: {
            isPreview: true,
            repoUrl: { contains: repoFullName || '' },
            branch: headBranch || `mr-${mrIid}`,
          },
          include: { node: true },
        });

        for (const prev of previews) {
          if (prev.containerId && prev.node) {
            await stopDeployment(prev.node, prev.containerId).catch((err) => {
              logger.warn({ err, deploymentId: prev.id }, 'Failed to stop container on MR preview teardown');
            });
          }
          await prisma.deployment.update({
            where: { id: prev.id },
            data: { status: 'deleted' },
          });
        }

        return res.json({ ok: true, message: `MR !${mrIid} preview environment cleaned up` });
      }
    }

    res.json({ ok: true, message: 'Webhook received, no action required' });
  } catch (err: any) {
    logger.error({ err }, 'Error processing PR preview webhook');
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
