import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { buildAndRun } from '../lib/nodeAgentClient';
import { logger } from '../lib/logger';
import { notifyDiscordChannel } from '../lib/discordWebhooks';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { env } from '../env';

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

function getDecryptedEnvVars(deployment: any): Record<string, string> | undefined {
  if (!deployment.envVarsEncrypted) return undefined;
  try {
    const json = decryptSecret(deployment.envVarsEncrypted, env.secretsEncryptionKey);
    return JSON.parse(json);
  } catch (err) {
    logger.error({ deploymentId: deployment.id, err }, 'Failed to decrypt deployment envVars');
    return undefined;
  }
}

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
    hasSecret: !!deployment.deployWebhookSecret,
    webhookUrl,
    autoDeploy: deployment.autoDeploy !== false,
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
  const encSecret = encryptSecret(secret, env.secretsEncryptionKey);
  await prisma.deployment.update({ where: { id: deployment.id }, data: { deployWebhookSecret: encSecret, autoDeploy: true } });

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

/**
 * POST /deployments/:id/webhook-auto-register
 * Automatically registers a GitHub Webhook via the GitHub REST API using the
 * user's connected GitHub OAuth token or saved repo access token.
 */
deployWebhooksRouter.post('/deployments/:id/webhook-auto-register', requireAuth, async (req: AuthedRequest, res) => {
  const deployment = await prisma.deployment.findUnique({ where: { id: req.params.id } });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!(await canAccessResource(deployment.userId, req))) return res.status(404).json({ error: 'Deployment not found' });
  if (!deployment.repoUrl) return res.status(409).json({ error: 'Deployment has no git repository' });

  // Parse GitHub owner/repo from repoUrl (e.g., https://github.com/owner/repo)
  const ghMatch = deployment.repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\s\.]+)/i);
  if (!ghMatch) {
    return res.status(400).json({ error: 'Automatic webhook registration is only supported for GitHub repositories' });
  }

  const [, owner, repo] = ghMatch;

  // Resolve secret
  let rawSecret: string;
  if (deployment.deployWebhookSecret) {
    try {
      rawSecret = decryptSecret(deployment.deployWebhookSecret, env.secretsEncryptionKey);
    } catch {
      rawSecret = deployment.deployWebhookSecret;
    }
  } else {
    rawSecret = crypto.randomBytes(32).toString('hex');
    const encSecret = encryptSecret(rawSecret, env.secretsEncryptionKey);
    await prisma.deployment.update({ where: { id: deployment.id }, data: { deployWebhookSecret: encSecret, autoDeploy: true } });
  }

  // Resolve fresh token for this repo/account
  const { resolveRepoUrlForBuild, extractEmbeddedToken } = await import('../lib/gitAuth');
  const authedUrl = await resolveRepoUrlForBuild(deployment.id, deployment.repoUrl);
  const token = extractEmbeddedToken(authedUrl);

  if (!token) {
    return res.status(400).json({
      error: 'No connected GitHub account or token found for this repository. Please connect your GitHub account or supply a PAT.',
    });
  }

  const host = req.get('host') || 'localhost:4000';
  const protocol = req.protocol || 'https';
  const payloadUrl = `${protocol}://${host}/api/deploy-webhooks/${deployment.id}`;

  try {
    const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ShanuTechX-Platform',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: payloadUrl,
          content_type: 'json',
          secret: rawSecret,
          insecure_ssl: '0',
        },
      }),
    });

    if (!ghRes.ok) {
      const errText = await ghRes.text().catch(() => '');
      if (ghRes.status === 422 && errText.includes('already exists')) {
        return res.json({ ok: true, message: 'GitHub webhook is already configured and active for this repository!' });
      }
      return res.status(ghRes.status).json({ error: `GitHub API error (${ghRes.status}): ${errText || 'Failed to register webhook'}` });
    }

    res.json({ ok: true, message: `GitHub Webhook successfully registered for ${owner}/${repo}!` });
  } catch (err: any) {
    logger.error({ err, deploymentId: deployment.id }, 'Failed to auto-register GitHub webhook');
    res.status(500).json({ error: err.message || 'Failed to register GitHub webhook' });
  }
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

  let rawSecret = deployment.deployWebhookSecret;
  try {
    rawSecret = decryptSecret(deployment.deployWebhookSecret, env.secretsEncryptionKey);
  } catch {
    // Fallback for existing plaintext secrets
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
      crypto.createHmac('sha256', rawSecret).update(rawPayload).digest('hex');
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
      gitlabToken.length === rawSecret.length &&
      crypto.timingSafeEqual(Buffer.from(gitlabToken), Buffer.from(rawSecret));
  }

  if (!verified) {
    logger.warn({ deploymentId: deployment.id }, 'Deploy webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  if (deployment.autoDeploy === false) {
    logger.info({ deploymentId: deployment.id }, 'Auto-deploy disabled for this deployment');
    return res.status(200).json({ accepted: false, reason: 'Auto-deploy on push is disabled for this deployment' });
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

  // Extract commit details from payload
  const headCommit = req.body?.head_commit || (Array.isArray(req.body?.commits) ? req.body.commits[0] : null);
  const commitHash = headCommit?.id ? String(headCommit.id).slice(0, 7) : undefined;
  const commitMessage = headCommit?.message ? String(headCommit.message).split('\n')[0].slice(0, 255) : undefined;

  // Ack immediately — GitHub/GitLab expect a fast 2xx and will retry/flag
  // the webhook as failing if the build (which can take a while) blocks
  // the response.
  res.status(202).json({ accepted: true, branch: pushedBranch ?? '(default)', commitHash });

  // Fire the actual rebuild in the background.
  void (async () => {
    try {
      await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'building' } });
      const result = await buildAndRun(
        deployment.node,
        {
          deploymentId: deployment.id,
          repoUrl: deployment.repoUrl!,
          branch: pushedBranch || deployment.branch || undefined,
          subdomain: deployment.subdomain ?? undefined,
          internalPort: deployment.internalPort!,
          envVars: getDecryptedEnvVars(deployment),
          startCommand: deployment.startCommand ?? undefined,
          entryFile: deployment.entryFile ?? undefined,
          frameworkPreset: deployment.frameworkPreset ?? undefined,
          cpuLimit: deployment.cpuLimit ?? undefined,
          memoryLimit: deployment.memoryLimit ?? undefined,
          storageLimit: deployment.storageLimit ?? undefined,
          exposureMode: deployment.exposureMode ?? undefined,
          publishedPort: deployment.publishedPort ?? undefined,
          backupRepoUrl: deployment.backupRepoFullName ?? undefined,
        },
        () => {} // no streaming listener for a background webhook-triggered build
      );

      if (result.phase === 'error') {
        await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'failed' } });
        void notifyDiscordChannel('deployment_failed', {
          Deployment: deployment.id,
          Branch: pushedBranch ?? '(default)',
          Commit: commitHash ?? 'N/A',
          Error: result.message,
        });
        return;
      }

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'running',
          containerId: result.containerId,
          lastDeployAt: new Date(),
          ...(commitHash ? { gitCommitHash: commitHash } : {}),
          ...(commitMessage ? { gitCommitMessage: commitMessage } : {}),
        },
      });
    } catch (err: any) {
      logger.error({ err, deploymentId: deployment.id }, 'Webhook-triggered redeploy failed');
      await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'failed' } }).catch(() => null);
      void notifyDiscordChannel('deployment_failed', {
        Deployment: deployment.id,
        Branch: pushedBranch ?? '(default)',
        Error: err.message,
      });
    }
  })();
});
