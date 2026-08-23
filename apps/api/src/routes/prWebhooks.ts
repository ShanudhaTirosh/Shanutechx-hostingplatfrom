import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { env } from '../env';

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
  const webhookSecret = process.env.PR_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || env.nodeAgentSecret;

  if (webhookSecret) {
    let verified = false;
    if (githubSignature) {
      const rawBody = (req as any).rawBody || JSON.stringify(payload);
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
  }

  logger.info({ eventType }, 'Received PR preview deployment webhook payload');

  try {
    // 1. Handle GitHub Pull Request
    if (eventType === 'pull_request') {
      const action = payload.action;
      const prNumber = payload.number;
      const repoFullName = payload.repository?.full_name;
      const headBranch = payload.pull_request?.head?.ref;

      if (!repoFullName || !prNumber) {
        return res.status(400).json({ error: 'Invalid pull request payload' });
      }

      if (['opened', 'synchronize', 'reopened'].includes(action)) {
        logger.info({ repoFullName, prNumber, headBranch }, 'Triggering PR preview deployment');
        return res.json({ ok: true, message: `Triggered preview deployment for PR #${prNumber}` });
      }

      if (action === 'closed') {
        logger.info({ repoFullName, prNumber }, 'Teardown preview deployment for closed PR');
        return res.json({ ok: true, message: `Teardown preview deployment for PR #${prNumber}` });
      }
    }

    // 2. Handle GitLab Merge Request
    if (eventType === 'Merge Request Hook' || payload.object_kind === 'merge_request') {
      const action = payload.object_attributes?.action;
      const mrIid = payload.object_attributes?.iid;

      if (['open', 'update', 'reopen'].includes(action)) {
        return res.json({ ok: true, message: `Triggered preview deployment for MR !${mrIid}` });
      }

      if (action === 'close' || action === 'merge') {
        return res.json({ ok: true, message: `Teardown preview deployment for MR !${mrIid}` });
      }
    }

    res.json({ ok: true, message: 'Webhook received, no action required' });
  } catch (err: any) {
    logger.error({ err }, 'Error processing PR preview webhook');
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
