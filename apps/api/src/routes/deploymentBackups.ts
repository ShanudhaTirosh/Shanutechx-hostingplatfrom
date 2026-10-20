import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { getGithubBackupClient, GithubApiError, resolveBackupRepo } from '../lib/githubBackup';
import { env } from '../env';
import {
  BackupDeps,
  BackupFlowError,
  Actor,
  createDefaultDeps,
  startBackup,
  executeBackup,
  startRestore,
  executeRestore,
  deleteBackup,
  setBackupPolicy,
  toPublicBackup,
  toFlowError,
} from '../lib/deploymentBackup';

import { useForOwnRoutes } from '../lib/routerGuard';
/**
 * Per-deployment backups to GitHub, plus restore and schedule.
 *
 *   GET    /deployments/:id/backups                     list + schedule + whether backups are configured
 *   POST   /deployments/:id/backups                     "Back up now"            -> 202, poll the backup
 *   GET    /deployments/:id/backups/:backupId           poll one backup (also carries restore progress)
 *   POST   /deployments/:id/backups/:backupId/restore   restore (typed confirmation required) -> 202
 *   DELETE /deployments/:id/backups/:backupId           delete backup + its GitHub release
 *   PUT    /deployments/:id/backup-policy               schedule + retention
 *   GET    /admin/backups/github-status                 admin/dev: is the token/repo usable?
 *
 * Backups and restores run in the background because they can take minutes (longer than proxy request limits);
 * the dashboard polls. See docs/GITHUB_BACKUPS.md.
 */
export const deploymentBackupsRouter = Router();
useForOwnRoutes(deploymentBackupsRouter, requireAuth);

const MANUAL_COOLDOWN_MS = 60_000;

let depsPromise: Promise<BackupDeps> | null = null;
const getDeps = (): Promise<BackupDeps> => (depsPromise ??= createDefaultDeps());

function actorFor(req: AuthedRequest): Actor {
  const role = req.user?.role;
  // AuditLog convention: staff actions carry adminId; customer self-service is marked by actorRole.
  return role === 'customer' || !req.user ? { adminId: null, role: 'customer' } : { adminId: req.user.id, role: null };
}

function sendError(res: Response, err: unknown, ctx: Record<string, unknown>) {
  if (err instanceof GithubApiError || err instanceof BackupFlowError) {
    const f = toFlowError(err);
    if (f.status >= 500) logger.error({ err, ...ctx }, 'Backup request failed');
    return res.status(f.status).json({ error: f.message, code: f.code });
  }
  logger.error({ err, ...ctx }, 'Unexpected error handling a backup request');
  return res.status(500).json({ error: 'Something went wrong while handling the backup request.', code: 'internal' });
}

/** Loads the deployment and enforces ownership / team permissions. Sends the response itself on failure. */
async function authorize(req: AuthedRequest, res: Response, action: 'read' | 'write') {
  const deployment = await prisma.deployment.findUnique({
    where: { id: req.params.id },
    select: { id: true, userId: true, subdomain: true, status: true },
  });
  if (!deployment || deployment.status === 'deleted') {
    res.status(404).json({ error: 'Deployment not found', code: 'not_found' });
    return null;
  }
  if (!(await canAccessResource(deployment.userId, req, 'deployment', deployment.id, action))) {
    // Same status/body as "not found" so ids cannot be probed.
    res.status(404).json({ error: 'Deployment not found', code: 'not_found' });
    return null;
  }
  return deployment;
}

const policyBody = z.object({
  enabled: z.boolean(),
  intervalHours: z.number().int().min(1).max(168),
  retention: z.number().int().min(1).max(30),
});

const restoreBody = z.object({
  /** Must equal the deployment's subdomain (or id when it has none). Server-side guard against mistaken/scripted calls. */
  confirm: z.string().min(1),
  components: z.array(z.string().max(80)).max(60).optional(),
  skipSafetyBackup: z.boolean().optional(),
});

function policyJson(p: Awaited<ReturnType<BackupDeps['store']['getPolicy']>>) {
  if (!p) return { enabled: false, intervalHours: 24, retention: 7, lastRunAt: null, nextRunAt: null, lastStatus: null, consecutiveFailures: 0 };
  return {
    enabled: p.enabled,
    intervalHours: p.intervalHours,
    retention: p.retention,
    lastRunAt: p.lastRunAt ? p.lastRunAt.toISOString() : null,
    nextRunAt: p.nextRunAt ? p.nextRunAt.toISOString() : null,
    lastStatus: p.lastStatus,
    consecutiveFailures: p.consecutiveFailures,
  };
}

deploymentBackupsRouter.get('/deployments/:id/backups', async (req: AuthedRequest, res) => {
  try {
    const dep = await authorize(req, res, 'read');
    if (!dep) return;
    const deps = await getDeps();
    const [rows, policy] = await Promise.all([deps.store.listBackups(dep.id, 50), deps.store.getPolicy(dep.id)]);
    res.json({
      configured: deps.isConfigured(),
      maxComponentMb: env.backupMaxSizeMb,
      policy: policyJson(policy),
      backups: rows.map(toPublicBackup),
    });
  } catch (err) {
    sendError(res, err, { route: 'list', deploymentId: req.params.id });
  }
});

deploymentBackupsRouter.post('/deployments/:id/backups', async (req: AuthedRequest, res) => {
  try {
    const dep = await authorize(req, res, 'write');
    if (!dep) return;
    const deps = await getDeps();

    const [latest] = await deps.store.listBackups(dep.id, 1);
    if (latest && deps.now().getTime() - latest.createdAt.getTime() < MANUAL_COOLDOWN_MS) {
      return res.status(429).json({ error: 'A backup was started a moment ago. Wait a minute before starting another.', code: 'cooldown' });
    }

    const actor = actorFor(req);
    const row = await startBackup(dep.id, { trigger: 'manual', userId: req.user!.id }, deps);
    // Fire and forget: executeBackup records success/failure on the row itself and only throws for programming errors.
    setImmediate(() => {
      executeBackup(row.id, deps, actor).catch((err) => logger.error({ err, backupId: row.id }, 'Backup job crashed'));
    });
    res.status(202).json({ backup: toPublicBackup(row) });
  } catch (err) {
    sendError(res, err, { route: 'create', deploymentId: req.params.id });
  }
});

deploymentBackupsRouter.get('/deployments/:id/backups/:backupId', async (req: AuthedRequest, res) => {
  try {
    const dep = await authorize(req, res, 'read');
    if (!dep) return;
    const row = await (await getDeps()).store.getBackup(req.params.backupId);
    if (!row || row.deploymentId !== dep.id) return res.status(404).json({ error: 'Backup not found', code: 'not_found' });
    res.json({ backup: toPublicBackup(row) });
  } catch (err) {
    sendError(res, err, { route: 'get', deploymentId: req.params.id });
  }
});

deploymentBackupsRouter.post('/deployments/:id/backups/:backupId/restore', async (req: AuthedRequest, res) => {
  try {
    const dep = await authorize(req, res, 'write');
    if (!dep) return;
    const parsed = restoreBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Type the deployment name to confirm the restore.', code: 'invalid' });
    }
    const expected = dep.subdomain ?? dep.id;
    if (parsed.data.confirm.trim() !== expected) {
      return res.status(400).json({ error: `Confirmation does not match. Type "${expected}" to confirm the restore.`, code: 'confirmation_mismatch' });
    }

    const deps = await getDeps();
    const actor = actorFor(req);
    const { row, selected } = await startRestore(dep.id, req.params.backupId, { components: parsed.data.components }, deps);
    setImmediate(() => {
      executeRestore(row.id, selected, { skipSafetyBackup: parsed.data.skipSafetyBackup, userId: req.user!.id }, deps, actor).catch((err) =>
        logger.error({ err, backupId: row.id }, 'Restore job crashed')
      );
    });
    res.status(202).json({ backup: toPublicBackup(row) });
  } catch (err) {
    sendError(res, err, { route: 'restore', deploymentId: req.params.id });
  }
});

deploymentBackupsRouter.delete('/deployments/:id/backups/:backupId', async (req: AuthedRequest, res) => {
  try {
    const dep = await authorize(req, res, 'write');
    if (!dep) return;
    await deleteBackup(dep.id, req.params.backupId, await getDeps(), actorFor(req));
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, { route: 'delete', deploymentId: req.params.id });
  }
});

deploymentBackupsRouter.put('/deployments/:id/backup-policy', async (req: AuthedRequest, res) => {
  try {
    const dep = await authorize(req, res, 'write');
    if (!dep) return;
    const parsed = policyBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Interval must be 1-168 hours and retention 1-30 backups.', code: 'invalid' });
    }
    const deps = await getDeps();
    if (parsed.data.enabled && !deps.isConfigured()) {
      return res.status(503).json({ error: 'Backups are not configured on this platform yet. Ask an administrator.', code: 'not_configured' });
    }
    const policy = await setBackupPolicy(dep.id, parsed.data, deps, actorFor(req));
    res.json({ policy: policyJson(policy) });
  } catch (err) {
    sendError(res, err, { route: 'policy', deploymentId: req.params.id });
  }
});

/** Lets an operator verify the token and repo without waiting for a customer backup to fail. Never returns the token. */
deploymentBackupsRouter.get('/admin/backups/github-status', async (req: AuthedRequest, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'dev')) {
      return res.status(403).json({ error: 'Admin access required', code: 'forbidden' });
    }
    const { owner, repo } = resolveBackupRepo();
    if (!env.backupGithubToken) {
      return res.json({ configured: false, repo: `${owner}/${repo}`, message: 'BACKUP_GITHUB_TOKEN is not set.' });
    }
    try {
      const access = await getGithubBackupClient().checkAccess();
      const problems: string[] = [];
      if (!access.exists) problems.push('The repository does not exist yet. It will be created (private) on the first backup if the token is allowed to create repositories.');
      else {
        if (!access.private) problems.push('The repository is PUBLIC. Backups will refuse to use it. Make it private.');
        if (!access.canPush) problems.push('The token cannot write to the repository. Grant "Contents: Read and write".');
      }
      res.json({ configured: true, repo: access.repoFullName, exists: access.exists, private: access.private, canPush: access.canPush, ok: access.exists && access.private && access.canPush, problems });
    } catch (e) {
      const f = toFlowError(e);
      res.json({ configured: true, repo: `${owner}/${repo}`, ok: false, problems: [f.message] });
    }
  } catch (err) {
    sendError(res, err, { route: 'github-status' });
  }
});
