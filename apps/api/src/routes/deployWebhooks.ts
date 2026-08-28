import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { buildAndRun } from '../lib/nodeAgentClient';
import { logger } from '../lib/logger';
import { notifyDiscordChannel } from '../lib/discordWebhooks';

/**
 * Deliberate scoping decision (see architecture plan / delivery notes):
 * standing up a real Woodpecker/GitLab CI/Jenkins instance isn't something
 * to fabricate in this codebase — that's an infra choice for you to make
 * and configure separately. What a PaaS actually needs CI/CD *for*, in
 * practice, is "redeploy automatically when I push to my repo" — that's
 * exactly what this is: a real, working git-push-triggered redeploy,
 * supporting the two most common webhook shapes (GitHub, GitLab).
 */
export const deployWebhooksRouter = Router();

/**
 * GET /deployments/:id/webhook-info
 * Returns webhook URL and whether a secret has been set, without exposing
 * the secret itself. Used by the DeployWebhookPanel UI.
 */
deployWebhooksRouter.get('/deployments/:id/webhook-info', requireAuth, async (req: AuthedRequest, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!(await canAccessResource(deployment.userId, req))) {
    return res.status(404).json({ error: 'Deployment not found' });
  }

  const webhookUrl = `/api/deploy-webhooks/${deployment.id}`;
  res.json({
    webhookUrl,
    hasSecret: Boolean(deployment.deployWebhookSecret),
    repoUrl: deployment.repoUrl,
    instructions: {
      github: `In your GitHub repo → Settings → Webhooks → Add webhook: Payload URL = <your API base>${webhookUrl}, Content type = application/json, Secret = (generated below), Events = "Just the push event".`,
      gitlab: `In your GitLab repo → Settings → Webhooks: URL = <your API base>${webhookUrl}, Secret Token = (generated below), Trigger = "Push events".`,
    },
  });
});

/**
 * Owner or staff only — generates (or rotates) the webhook secret and
 * returns it once, same reveal-once pattern as VPS/SMTP credentials. The
 * caller pastes this into their GitHub/GitLab repo's webhook settings.
 */
deployWebhooksRouter.post('/deployments/:id/webhook-secret', requireAuth, async (req: AuthedRequest, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  if (!(await canAccessResource(deployment.userId, req))) {
    return res.status(404).json({ error: 'Deployment not found' });
  }
  if (!deployment.repoUrl) {
    return res.status(409).json({ error: 'This deployment has no repo to redeploy from' });
  }

  const secret = crypto.randomBytes(32).toString('hex');
  await prisma.deployment.update({ where: { id: deployment.id }, data: { deployWebhookSecret: secret } });

  const webhookUrl = `/api/deploy-webhooks/${deployment.id}`;
  res.json({
    secret,
    webhookUrl,
    instructions: {
      github: `Add a webhook in your repo's Settings -> Webhooks: Payload URL = <your API base>${webhookUrl}, Content type = application/json, Secret = the value above, event = "Just the push event".`,
      gitlab: `Add a webhook in your repo's Settings -> Webhooks: URL = <your API base>${webhookUrl}, Secret Token = the value above, trigger = "Push events".`,
    },
  });
});

deployWebhooksRouter.delete('/deployments/:id/webhook-secret', requireAuth, async (req: AuthedRequest, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!(await canAccessResource(deployment.userId, req))) return res.status(404).json({ error: 'Deployment not found' });

  await prisma.deployment.update({ where: { id: deployment.id }, data: { deployWebhookSecret: null } });
  res.json({ ok: true });
});

/**
 * The actual webhook receiver — no platform auth, this is called by
 * GitHub/GitLab's servers, not a logged-in dashboard user. Authenticity is
 * verified via the provider's own signature scheme against the stored
 * per-deployment secret, not a bearer token.
 */
deployWebhooksRouter.post('/deploy-webhooks/:deploymentId', async (req, res) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id: req.params.deploymentId },
    include: { node: true },
  });
  if (!deployment || !deployment.deployWebhookSecret) {
    return res.status(404).json({ error: 'Deploy webhook not enabled for this deployment' });
  }
  if (!deployment.repoUrl || !deployment.internalPort) {
    return res.status(409).json({ error: 'Deployment has no repo/port to rebuild from' });
  }

  const githubSignature = req.headers['x-hub-signature-256'] as string | undefined;
  const gitlabToken = req.headers['x-gitlab-token'] as string | undefined;

  let verified = false;

  if (githubSignature) {
    const rawPayload = (req as any).rawBody
      ? (Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody : String((req as any).rawBody))
      : JSON.stringify(req.body || {});
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', deployment.deployWebhookSecret).update(rawPayload).digest('hex');
    try {
      verified =
        expected.length === githubSignature.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(githubSignature));
    } catch {
      verified = false;
    }
  } else if (gitlabToken) {
    // GitLab: a plain shared-secret header, not HMAC — compare directly.
    verified =
      gitlabToken.length === deployment.deployWebhookSecret.length &&
      crypto.timingSafeEqual(Buffer.from(gitlabToken), Buffer.from(deployment.deployWebhookSecret));
  }

  if (!verified) {
    logger.warn({ deploymentId: deployment.id }, 'Deploy webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Only redeploy on a push to the branch this deployment actually tracks
  // (or any branch if none is recorded) — a push to an unrelated branch in
  // the same repo shouldn't trigger a rebuild.
  const ref = typeof req.body?.ref === 'string' ? req.body.ref : undefined; // e.g. "refs/heads/main"
  const pushedBranch = ref?.replace('refs/heads/', '');

  if (deployment.branch && pushedBranch && pushedBranch !== deployment.branch) {
    logger.info({ deploymentId: deployment.id, trackedBranch: deployment.branch, pushedBranch }, 'Ignoring webhook push to untracked branch');
    return res.status(200).json({ accepted: false, reason: `Ignored push to branch '${pushedBranch}'; deployment tracks '${deployment.branch}'` });
  }

  // Ack immediately — GitHub/GitLab expect a fast 2xx and will retry/flag
  // the webhook as failing if the build (which can take a while) blocks
  // the response.
  res.status(202).json({ accepted: true, branch: pushedBranch ?? '(default)' });

  // Fire the actual rebuild in the background.
  void (async () => {
    await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'building' } });
    try {
      const result = await buildAndRun(
        deployment.node,
        {
          deploymentId: deployment.id,
          repoUrl: deployment.repoUrl!,
          branch: pushedBranch,
          subdomain: deployment.subdomain ?? undefined,
          internalPort: deployment.internalPort!,
        },
        () => {} // no streaming listener for a background webhook-triggered build
      );

      if (result.phase === 'error') {
        await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'failed' } });
        void notifyDiscordChannel('deployment_failed', {
          Deployment: deployment.id,
          Branch: pushedBranch ?? '(default)',
          Error: result.message,
        });
        return;
      }

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'running', containerId: result.containerId, lastDeployAt: new Date() },
      });
    } catch (err: any) {
      logger.error({ err, deploymentId: deployment.id }, 'Webhook-triggered redeploy failed');
      await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'failed' } });
      void notifyDiscordChannel('deployment_failed', {
        Deployment: deployment.id,
        Branch: pushedBranch ?? '(default)',
        Error: err.message,
      });
    }
  })();
});
