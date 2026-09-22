import { env } from '../env';
import { logger } from './logger';
import { GithubApiError, getGithubBackupClient, backupTag, componentAssetName, type GithubBackupClient } from './githubBackup';
import * as agentClient from './nodeAgentClient';

/**
 * Deployment backups: node agent produces archives -> API streams them to GitHub (Releases API) and records them.
 * Restore is the reverse. See docs/GITHUB_BACKUPS.md for the design, limits and required GitHub permissions.
 *
 * Everything here talks to the outside world through `BackupDeps`, so the flows (including failure cleanup) are
 * unit-testable with fakes; `createDefaultDeps()` wires the real Prisma store, node agent and GitHub client.
 */

// ───────────────────────────── types ─────────────────────────────

export type BackupTrigger = 'manual' | 'schedule' | 'pre-restore';
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface BackupComponent {
  kind: 'workspace' | 'volume';
  name: string;
  assetId: string;
  assetName: string;
  sizeBytes: number;
  sha256: string;
}

export interface BackupRow {
  id: string;
  deploymentId: string;
  trigger: BackupTrigger;
  status: BackupStatus;
  phase: string | null;
  repoFullName: string | null;
  releaseId: string | null;
  releaseTag: string | null;
  releaseUrl: string | null;
  components: BackupComponent[] | null;
  sizeBytes: number | null;
  error: string | null;
  createdById: string | null;
  createdAt: Date;
  completedAt: Date | null;
  restoreStatus: 'in_progress' | 'completed' | 'failed' | null;
  restorePhase: string | null;
  restoreError: string | null;
  restoreStartedAt: Date | null;
  restoredAt: Date | null;
}

export interface PolicyRow {
  deploymentId: string;
  enabled: boolean;
  intervalHours: number;
  retention: number;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastStatus: string | null;
  consecutiveFailures: number;
}

export interface DeploymentForBackup {
  id: string;
  userId: string;
  subdomain: string | null;
  status: string;
  containerId: string | null;
  sourceType: string | null;
  node: { id: string; ip: string };
  volumes: { name: string; hostPath: string }[];
}

export interface Actor {
  adminId: string | null;
  role: string | null;
}

export type BackupErrorCode =
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'not_configured'
  | 'unsupported_agent'
  | 'node_unreachable'
  | 'nothing_to_backup'
  | 'too_large'
  | 'github'
  | 'agent'
  | 'safety_backup_failed'
  | 'internal';

export class BackupFlowError extends Error {
  constructor(message: string, public readonly code: BackupErrorCode, public readonly status: number = 500) {
    super(message);
    this.name = 'BackupFlowError';
  }
}

export interface BackupStore {
  loadDeployment(id: string): Promise<DeploymentForBackup | null>;
  createBackup(data: { deploymentId: string; trigger: BackupTrigger; createdById: string | null }): Promise<BackupRow>;
  updateBackup(id: string, data: Partial<Omit<BackupRow, 'id' | 'deploymentId' | 'createdAt'>>): Promise<BackupRow>;
  getBackup(id: string): Promise<BackupRow | null>;
  listBackups(deploymentId: string, limit: number): Promise<BackupRow[]>;
  /** A backup or restore for this deployment that started after `since` and has not finished. */
  findActive(deploymentId: string, since: Date, ignoreId?: string): Promise<BackupRow | null>;
  listCompleted(deploymentId: string, trigger: BackupTrigger): Promise<BackupRow[]>; // newest first
  listFailed(deploymentId: string): Promise<BackupRow[]>; // newest first
  /** Backups whose deployment has been deleted, oldest first (for the purge sweep). */
  listBackupsOfDeletedDeployments(limit: number): Promise<BackupRow[]>;
  deleteBackup(id: string): Promise<void>;
  reapStale(cutoff: Date): Promise<number>;
  getPolicy(deploymentId: string): Promise<PolicyRow | null>;
  upsertPolicy(deploymentId: string, data: Partial<Omit<PolicyRow, 'deploymentId'>>): Promise<PolicyRow>;
  dueBackupPolicies(now: Date, limit: number): Promise<PolicyRow[]>;
  audit(action: string, target: string, actor: Actor): Promise<void>;
}

export interface BackupAgentPort {
  supportsBackups(node: { id: string; ip: string }): Promise<boolean>;
  createBackup: typeof agentClient.agentCreateBackup;
  openFile: typeof agentClient.agentOpenBackupFile;
  deleteBackup: typeof agentClient.agentDeleteBackup;
  restoreComponent: typeof agentClient.agentRestoreComponent;
  stop(node: { id: string; ip: string }, containerId: string): Promise<void>;
  start(node: { id: string; ip: string }, containerId: string): Promise<void>;
}

export type GithubPort = Pick<GithubBackupClient, 'ensureRepo' | 'createDraftRelease' | 'uploadAsset' | 'publishRelease' | 'deleteRelease' | 'downloadAsset' | 'fullName'>;

export interface BackupDeps {
  store: BackupStore;
  agent: BackupAgentPort;
  github: () => GithubPort;
  isConfigured: () => boolean;
  now: () => Date;
  maxComponentBytes: number;
}

// ───────────────────────────── constants ─────────────────────────────

/** A backup/restore "in progress" for longer than this is assumed dead (API restarted mid-job). */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const PRE_RESTORE_KEEP = 3;
const FAILED_KEEP = 5;
const DEFAULT_RETENTION = 7;
const MAX_CONSECUTIVE_FAILURES = 5;

// ───────────────────────────── helpers ─────────────────────────────

export const componentKey = (c: { kind: string; name: string }): string => (c.kind === 'workspace' ? 'workspace' : `volume:${c.name}`);
const componentLabel = (c: { kind: string; name: string }): string => (c.kind === 'workspace' ? 'workspace files' : `volume "${c.name}"`);

/** Maps anything thrown by the agent client, GitHub client or network layer to a stable, user-presentable error. */
export function toFlowError(e: unknown): BackupFlowError {
  if (e instanceof BackupFlowError) return e;
  if (e instanceof GithubApiError) return new BackupFlowError(e.message, 'github', 502);
  if (e instanceof agentClient.AgentBackupError) {
    if (e.code === 'nothing_to_backup') return new BackupFlowError(e.message, 'nothing_to_backup', 422);
    if (e.code === 'too_large') return new BackupFlowError(e.message, 'too_large', 413);
    return new BackupFlowError(e.message, 'agent', e.status >= 400 && e.status < 500 ? 422 : 502);
  }
  const err = e as Error & { cause?: { message?: string; code?: string } };
  const msg = err?.message ?? 'Unknown error';
  if (err instanceof TypeError || /fetch failed|ECONNREFUSED|ETIMEDOUT|timed out|aborted/i.test(msg)) {
    const cause = err.cause?.message || err.cause?.code;
    return new BackupFlowError(`Could not reach the node agent${cause ? ` (${cause})` : ''}. Check that the node is online.`, 'node_unreachable', 502);
  }
  return new BackupFlowError(msg, 'internal', 500);
}

async function safely(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn({ err, label }, 'Non-fatal backup housekeeping step failed');
  }
}

export function toPublicBackup(row: BackupRow) {
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    phase: row.phase,
    repoFullName: row.repoFullName,
    releaseUrl: row.releaseUrl,
    releaseTag: row.releaseTag,
    components: (row.components ?? []).map((c) => ({ kind: c.kind, name: c.name, sizeBytes: c.sizeBytes })),
    sizeBytes: row.sizeBytes,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    restore: row.restoreStatus
      ? {
          status: row.restoreStatus,
          phase: row.restorePhase,
          error: row.restoreError,
          startedAt: row.restoreStartedAt ? row.restoreStartedAt.toISOString() : null,
          finishedAt: row.restoredAt ? row.restoredAt.toISOString() : null,
        }
      : null,
  };
}

// ───────────────────────────── backup ─────────────────────────────

export async function startBackup(
  deploymentId: string,
  opts: { trigger: BackupTrigger; userId?: string | null; ignoreActiveId?: string },
  deps: BackupDeps
): Promise<BackupRow> {
  const dep = await deps.store.loadDeployment(deploymentId);
  if (!dep || dep.status === 'deleted') throw new BackupFlowError('Deployment not found', 'not_found', 404);
  if (!deps.isConfigured()) {
    throw new BackupFlowError('Backups are not configured on this platform yet (the GitHub backup token is missing). Ask an administrator.', 'not_configured', 503);
  }
  const since = new Date(deps.now().getTime() - STALE_AFTER_MS);
  const active = await deps.store.findActive(deploymentId, since, opts.ignoreActiveId);
  if (active) {
    const msg = active.restoreStatus === 'in_progress' ? 'A restore is running for this deployment. Wait for it to finish.' : 'A backup is already running for this deployment.';
    throw new BackupFlowError(msg, 'conflict', 409);
  }
  return deps.store.createBackup({ deploymentId, trigger: opts.trigger, createdById: opts.userId ?? null });
}

/**
 * Runs a backup that startBackup() created. Never throws for job failures: they are recorded on the row and
 * returned as `failure`, so it is safe to call fire-and-forget.
 */
export async function executeBackup(backupId: string, deps: BackupDeps, actor: Actor = { adminId: null, role: 'system' }): Promise<{ row: BackupRow; failure?: BackupFlowError }> {
  const { store, agent } = deps;
  const initial = await store.getBackup(backupId);
  if (!initial) throw new BackupFlowError('Backup record not found', 'not_found', 404);
  const dep = await store.loadDeployment(initial.deploymentId);
  if (!dep) {
    const row = await store.updateBackup(backupId, { status: 'failed', error: 'Deployment no longer exists', phase: null, completedAt: deps.now() });
    return { row, failure: new BackupFlowError('Deployment no longer exists', 'not_found', 404) };
  }

  const setPhase = (phase: string) => safely('phase', () => store.updateBackup(backupId, { phase }));
  let releaseId: string | undefined;
  let releaseTag: string | undefined;
  let spooled = false;

  try {
    await setPhase('Checking the node');
    if (!(await agent.supportsBackups(dep.node))) {
      throw new BackupFlowError('This node is running an older agent that does not support backups. Update the node agent and try again.', 'unsupported_agent', 409);
    }

    await setPhase('Checking the GitHub repository');
    const gh = deps.github();
    const repo = await gh.ensureRepo();

    await setPhase('Archiving files on the node');
    spooled = true; // even a failed create may leave a partial spool dir; always ask the agent to clean up
    const created = await agent.createBackup(dep.node, dep.id, {
      backupId,
      volumes: dep.volumes.map((v) => ({ name: v.name, hostPath: v.hostPath })),
      includeWorkspace: true,
      maxBytes: deps.maxComponentBytes,
    });

    const label = dep.subdomain ?? dep.id;
    const stamp = initial.createdAt;
    const release = await gh.createDraftRelease({
      tag: backupTag(dep.id, stamp),
      name: `${label} - ${stamp.toISOString()}`,
      body: `Automated backup created by the ShanuTechX platform.\n\nDeployment: ${dep.id}\nTrigger: ${initial.trigger}\n\nRestore it from the dashboard. Do not edit or delete this release by hand.`,
    });
    releaseId = release.id;
    releaseTag = release.tagName;

    const uploaded: BackupComponent[] = [];
    let index = 0;
    for (const comp of created.components) {
      index++;
      await setPhase(`Uploading ${componentLabel(comp)} to GitHub (${index}/${created.components.length})`);
      const { body, size } = await agent.openFile(dep.node, backupId, comp.file);
      if (size !== comp.sizeBytes) {
        throw new BackupFlowError(`Archive size changed between creation and upload for ${componentLabel(comp)}`, 'agent', 502);
      }
      const assetName = componentAssetName(comp.kind, comp.name);
      const asset = await gh.uploadAsset(release.id, assetName, body, size);
      uploaded.push({ kind: comp.kind, name: comp.name, assetId: asset.id, assetName: asset.name, sizeBytes: asset.size, sha256: comp.sha256 });
    }

    // The manifest travels with the release so a backup stays self-describing even if this database is lost.
    const manifest = Buffer.from(
      JSON.stringify(
        {
          version: 1,
          platform: 'shanutechx',
          deploymentId: dep.id,
          subdomain: dep.subdomain,
          sourceType: dep.sourceType,
          trigger: initial.trigger,
          createdAt: stamp.toISOString(),
          components: uploaded.map((c) => ({ kind: c.kind, name: c.name, asset: c.assetName, sizeBytes: c.sizeBytes, sha256: c.sha256 })),
          skipped: created.skipped,
          warnings: created.warnings,
        },
        null,
        2
      )
    );
    await gh.uploadAsset(release.id, 'manifest.json', manifest, manifest.length, 'application/json');

    await setPhase('Publishing the backup');
    const published = await gh.publishRelease(release.id);

    const total = uploaded.reduce((n, c) => n + c.sizeBytes, 0);
    const warningNote = created.skipped.length || created.warnings.length ? [...created.skipped.map((s) => `${s.kind} ${s.name}: skipped (${s.reason})`), ...created.warnings].slice(0, 5).join('; ') : null;
    const row = await store.updateBackup(backupId, {
      status: 'completed',
      phase: warningNote ? `Completed with notes: ${warningNote}` : null,
      repoFullName: repo.repoFullName,
      releaseId: release.id,
      releaseTag: published.tagName,
      releaseUrl: published.htmlUrl,
      components: uploaded,
      sizeBytes: total,
      error: null,
      completedAt: deps.now(),
    });
    await safely('audit', () => store.audit('deployment.backup.completed', `${dep.id}:${backupId}:${initial.trigger}`, actor));
    await safely('retention', async () => {
      const policy = await store.getPolicy(dep.id);
      await pruneOldBackups(dep.id, policy?.retention ?? DEFAULT_RETENTION, deps);
    });
    return { row };
  } catch (e) {
    const failure = toFlowError(e);
    logger.error({ err: e, deploymentId: dep.id, backupId, code: failure.code }, 'Deployment backup failed');
    // A draft release that never got published is an incomplete backup: remove it so it cannot be mistaken for one.
    if (releaseId) await safely('delete draft release', () => deps.github().deleteRelease(releaseId!, releaseTag));
    const row = await store.updateBackup(backupId, { status: 'failed', phase: null, error: failure.message, completedAt: deps.now() });
    await safely('audit', () => store.audit('deployment.backup.failed', `${dep.id}:${backupId}:${failure.code}`, actor));
    return { row, failure };
  } finally {
    if (spooled) await safely('agent spool cleanup', () => agent.deleteBackup(dep.node, backupId));
  }
}

// ───────────────────────────── restore ─────────────────────────────

export async function startRestore(
  deploymentId: string,
  backupId: string,
  opts: { components?: string[] },
  deps: BackupDeps
): Promise<{ row: BackupRow; selected: BackupComponent[] }> {
  const dep = await deps.store.loadDeployment(deploymentId);
  const backup = await deps.store.getBackup(backupId);
  if (!dep || dep.status === 'deleted' || !backup || backup.deploymentId !== deploymentId) {
    throw new BackupFlowError('Backup not found', 'not_found', 404);
  }
  if (backup.status !== 'completed' || !backup.components || backup.components.length === 0 || !backup.releaseId) {
    throw new BackupFlowError('Only completed backups can be restored', 'invalid', 409);
  }
  if (!deps.isConfigured()) {
    throw new BackupFlowError('Backups are not configured on this platform yet (the GitHub backup token is missing). Ask an administrator.', 'not_configured', 503);
  }

  let selected = backup.components;
  if (opts.components && opts.components.length > 0) {
    const wanted = new Set(opts.components);
    const known = new Set(backup.components.map(componentKey));
    const unknown = [...wanted].filter((k) => !known.has(k));
    if (unknown.length) throw new BackupFlowError(`This backup does not contain: ${unknown.join(', ')}`, 'invalid', 400);
    selected = backup.components.filter((c) => wanted.has(componentKey(c)));
  }
  // Refuse up front if a selected volume no longer exists on the deployment: better than failing half-way.
  for (const c of selected) {
    if (c.kind === 'volume' && !dep.volumes.some((v) => v.name === c.name)) {
      throw new BackupFlowError(`Volume "${c.name}" no longer exists on this deployment, so it cannot be restored. Recreate it first or deselect it.`, 'invalid', 409);
    }
  }

  const since = new Date(deps.now().getTime() - STALE_AFTER_MS);
  const active = await deps.store.findActive(deploymentId, since);
  if (active) throw new BackupFlowError(active.restoreStatus === 'in_progress' ? 'A restore is already running for this deployment.' : 'A backup is running for this deployment. Wait for it to finish.', 'conflict', 409);

  const row = await deps.store.updateBackup(backupId, { restoreStatus: 'in_progress', restorePhase: 'Queued', restoreError: null, restoreStartedAt: deps.now(), restoredAt: null });
  return { row, selected };
}

export async function executeRestore(
  backupId: string,
  selected: BackupComponent[],
  opts: { skipSafetyBackup?: boolean; userId?: string | null },
  deps: BackupDeps,
  actor: Actor = { adminId: null, role: 'system' }
): Promise<{ ok: boolean; warnings: string[]; needsRedeploy: boolean; error?: string }> {
  const { store, agent } = deps;
  const backup = await store.getBackup(backupId);
  if (!backup) throw new BackupFlowError('Backup record not found', 'not_found', 404);
  const dep = await store.loadDeployment(backup.deploymentId);

  const setPhase = (restorePhase: string) => safely('restore phase', () => store.updateBackup(backupId, { restorePhase }));
  const warnings: string[] = [];
  const restored: string[] = [];
  let wasRunning = false;
  let stopped = false;

  try {
    if (!dep) throw new BackupFlowError('Deployment no longer exists', 'not_found', 404);
    if (!(await agent.supportsBackups(dep.node))) {
      throw new BackupFlowError('This node is running an older agent that does not support backups. Update the node agent and try again.', 'unsupported_agent', 409);
    }

    // 1. Safety net: snapshot what is there now, so a bad restore can itself be undone.
    if (!opts.skipSafetyBackup) {
      await setPhase('Saving a safety backup of the current state');
      try {
        const started = await startBackup(dep.id, { trigger: 'pre-restore', userId: opts.userId ?? null, ignoreActiveId: backupId }, deps);
        const { failure } = await executeBackup(started.id, deps, actor);
        // "Nothing to back up" is legitimate here: restoring into a cleaned-up workspace is the classic disaster-recovery case.
        if (failure && failure.code !== 'nothing_to_backup') throw failure;
        if (failure) warnings.push('No safety backup was taken because there is currently nothing on the node to back up.');
      } catch (e) {
        const f = toFlowError(e);
        throw new BackupFlowError(`Restore cancelled: the safety backup of the current state failed, so nothing was changed. (${f.message})`, 'safety_backup_failed', 502);
      }
    }

    // 2. Stop the app so files are not being written while they are replaced.
    if (dep.status === 'running' && dep.containerId) {
      await setPhase('Stopping the app');
      await agent.stop(dep.node, dep.containerId);
      wasRunning = true;
      stopped = true;
    }

    // 3. Stream each component GitHub -> API -> node. The node verifies the recorded SHA-256 before touching anything.
    const gh = deps.github();
    let i = 0;
    for (const c of selected) {
      i++;
      await setPhase(`Restoring ${componentLabel(c)} (${i}/${selected.length})`);
      const { body, size } = await gh.downloadAsset(c.assetId);
      if (size !== null && size !== c.sizeBytes) {
        throw new BackupFlowError(`The archive on GitHub for ${componentLabel(c)} has a different size than recorded (${size} vs ${c.sizeBytes} bytes). Refusing to restore it.`, 'github', 502);
      }
      const vol = c.kind === 'volume' ? dep.volumes.find((v) => v.name === c.name) : undefined;
      if (c.kind === 'volume' && !vol) throw new BackupFlowError(`Volume "${c.name}" no longer exists on this deployment`, 'invalid', 409);
      const res = await agent.restoreComponent(dep.node, dep.id, { kind: c.kind, name: c.name, hostPath: vol?.hostPath, sha256: c.sha256, sizeBytes: c.sizeBytes, maxBytes: deps.maxComponentBytes }, body);
      warnings.push(...res.warnings.map((w) => `${componentLabel(c)}: ${w}`));
      restored.push(componentLabel(c));
    }

    // 4. Bring the app back if it was running.
    if (wasRunning && dep.containerId) {
      await setPhase('Starting the app');
      await agent.start(dep.node, dep.containerId);
      stopped = false;
    }

    const needsRedeploy = selected.some((c) => c.kind === 'workspace');
    await store.updateBackup(backupId, {
      restoreStatus: 'completed',
      restorePhase: needsRedeploy ? 'Done. Workspace files were restored; redeploy to rebuild the app from them.' : 'Done',
      restoreError: null,
      restoredAt: deps.now(),
    });
    await safely('audit', () => store.audit('deployment.backup.restored', `${dep.id}:${backupId}:${restored.join(',')}`, actor));
    return { ok: true, warnings, needsRedeploy };
  } catch (e) {
    const failure = toFlowError(e);
    logger.error({ err: e, backupId, code: failure.code }, 'Deployment restore failed');
    // Do not leave a customer's app down because a restore failed.
    if (stopped && dep?.containerId) await safely('restart after failed restore', () => agent.start(dep.node, dep.containerId!));
    const partial = restored.length ? ` Already restored before the failure: ${restored.join(', ')}. The pre-restore safety backup can bring back the previous state.` : '';
    const message = `${failure.message}${partial}`;
    await safely('mark restore failed', () => store.updateBackup(backupId, { restoreStatus: 'failed', restorePhase: null, restoreError: message, restoredAt: deps.now() }));
    await safely('audit', () => store.audit('deployment.backup.restore_failed', `${backupId}:${failure.code}`, actor));
    return { ok: false, warnings, needsRedeploy: false, error: message };
  }
}

// ───────────────────────────── delete / retention ─────────────────────────────

/** Removes the GitHub release first; the DB row is only dropped once GitHub confirms, so a failure can be retried. */
async function removeBackupArtifacts(row: BackupRow, deps: BackupDeps): Promise<void> {
  if (row.releaseId) await deps.github().deleteRelease(row.releaseId, row.releaseTag ?? undefined);
  await deps.store.deleteBackup(row.id);
}

export async function deleteBackup(deploymentId: string, backupId: string, deps: BackupDeps, actor: Actor): Promise<void> {
  const row = await deps.store.getBackup(backupId);
  if (!row || row.deploymentId !== deploymentId) throw new BackupFlowError('Backup not found', 'not_found', 404);
  if (row.status === 'in_progress' || row.restoreStatus === 'in_progress') {
    const startedAt = row.restoreStatus === 'in_progress' ? row.restoreStartedAt ?? row.createdAt : row.createdAt;
    if (deps.now().getTime() - startedAt.getTime() < STALE_AFTER_MS) throw new BackupFlowError('This backup is in use right now. Wait for it to finish.', 'conflict', 409);
  }
  try {
    await removeBackupArtifacts(row, deps);
  } catch (e) {
    throw toFlowError(e);
  }
  await safely('audit', () => deps.store.audit('deployment.backup.deleted', `${deploymentId}:${backupId}`, actor));
}

export async function pruneOldBackups(deploymentId: string, retention: number, deps: BackupDeps): Promise<number> {
  let removed = 0;
  const drop = async (rows: BackupRow[]) => {
    for (const row of rows) {
      try {
        await removeBackupArtifacts(row, deps);
        removed++;
      } catch (err) {
        logger.warn({ err, backupId: row.id }, 'Could not prune old backup (will retry on the next run)');
      }
    }
  };
  // Scheduled backups follow the policy. Manual backups are never auto-deleted; pre-restore snapshots and old
  // failures are bounded so they cannot accumulate forever.
  await drop((await deps.store.listCompleted(deploymentId, 'schedule')).slice(retention));
  await drop((await deps.store.listCompleted(deploymentId, 'pre-restore')).slice(PRE_RESTORE_KEEP));
  for (const row of (await deps.store.listFailed(deploymentId)).slice(FAILED_KEEP)) {
    await safely('drop failed row', () => deps.store.deleteBackup(row.id));
  }
  return removed;
}

// ───────────────────────────── purge for deleted deployments ─────────────────────────────

/**
 * Customer data must not outlive its deployment: deleting a deployment is a soft delete, so its backup records and, more
 * importantly, their GitHub releases would otherwise stay forever. Called right after a delete (for that deployment) and
 * by the sweep (for any deleted deployment), so a GitHub outage or a backup that was mid-flight when the deployment was
 * deleted is cleaned up on a later pass instead of being forgotten.
 *
 * A backup or restore that is still genuinely running is skipped and retried on the next pass.
 */
export async function purgeDeletedDeploymentBackups(
  deps: BackupDeps,
  opts: { deploymentId?: string; limit?: number } = {}
): Promise<{ purged: number; failed: number; skipped: number }> {
  const limit = opts.limit ?? 20;
  const rows = opts.deploymentId ? await deps.store.listBackups(opts.deploymentId, 500) : await deps.store.listBackupsOfDeletedDeployments(limit);
  const freshAfter = deps.now().getTime() - STALE_AFTER_MS;
  let purged = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    const running = (row.status === 'in_progress' && row.createdAt.getTime() > freshAfter) || (row.restoreStatus === 'in_progress' && (row.restoreStartedAt?.getTime() ?? 0) > freshAfter);
    if (running) {
      skipped++;
      continue;
    }
    try {
      await removeBackupArtifacts(row, deps);
      purged++;
    } catch (err) {
      failed++;
      logger.warn({ err, backupId: row.id, deploymentId: row.deploymentId }, 'Could not purge a deleted deployment\'s backup (will retry)');
    }
  }
  if (purged || failed) {
    await safely('audit', () => deps.store.audit('deployment.backup.purged', `${opts.deploymentId ?? 'sweep'}: purged ${purged}, failed ${failed}, skipped ${skipped}`, { adminId: null, role: 'system' }));
  }
  return { purged, failed, skipped };
}

// ───────────────────────────── policy & scheduler ─────────────────────────────

export function validatePolicyInput(input: { enabled?: unknown; intervalHours?: unknown; retention?: unknown }): { enabled: boolean; intervalHours: number; retention: number } {
  const intervalHours = Number(input.intervalHours);
  const retention = Number(input.retention);
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 168) throw new BackupFlowError('Backup interval must be a whole number of hours between 1 and 168', 'invalid', 400);
  if (!Number.isInteger(retention) || retention < 1 || retention > 30) throw new BackupFlowError('Retention must be a whole number of backups between 1 and 30', 'invalid', 400);
  return { enabled: Boolean(input.enabled), intervalHours, retention };
}

export async function setBackupPolicy(deploymentId: string, input: { enabled?: unknown; intervalHours?: unknown; retention?: unknown }, deps: BackupDeps, actor: Actor): Promise<PolicyRow> {
  const v = validatePolicyInput(input);
  const dep = await deps.store.loadDeployment(deploymentId);
  if (!dep || dep.status === 'deleted') throw new BackupFlowError('Deployment not found', 'not_found', 404);
  const existing = await deps.store.getPolicy(deploymentId);
  const now = deps.now();
  let nextRunAt: Date | null = null;
  if (v.enabled) {
    const unchanged = existing?.enabled && existing.intervalHours === v.intervalHours && existing.nextRunAt;
    // Turning it on (or changing the interval) schedules the next run; the very first one is due at the next sweep.
    nextRunAt = unchanged ? existing!.nextRunAt : existing?.lastRunAt ? new Date(Math.max(now.getTime(), existing.lastRunAt.getTime() + v.intervalHours * 3600_000)) : now;
  }
  const row = await deps.store.upsertPolicy(deploymentId, { ...v, nextRunAt, consecutiveFailures: v.enabled && !existing?.enabled ? 0 : existing?.consecutiveFailures ?? 0 });
  await safely('audit', () => deps.store.audit('deployment.backup.policy_updated', `${deploymentId}:${v.enabled ? `every ${v.intervalHours}h, keep ${v.retention}` : 'disabled'}`, actor));
  return row;
}

/** Called by the worker every few minutes. Runs at most `limit` due backups so a burst cannot flood GitHub or the nodes. */
export async function runDueBackups(deps: BackupDeps, limit = 3): Promise<{ ran: number; failed: number }> {
  const now = deps.now();
  await safely('reap stale', () => deps.store.reapStale(new Date(now.getTime() - STALE_AFTER_MS)));
  if (!deps.isConfigured()) return { ran: 0, failed: 0 };
  await safely('purge deleted deployments', () => purgeDeletedDeploymentBackups(deps));

  const due = await deps.store.dueBackupPolicies(now, limit);
  let ran = 0;
  let failed = 0;
  for (const policy of due) {
    const system: Actor = { adminId: null, role: 'system' };
    try {
      const started = await startBackup(policy.deploymentId, { trigger: 'schedule' }, deps);
      const { failure } = await executeBackup(started.id, deps, system);
      ran++;
      if (failure) {
        failed++;
        await recordScheduledFailure(policy, failure, deps, system);
      } else {
        await deps.store.upsertPolicy(policy.deploymentId, {
          lastRunAt: deps.now(),
          lastStatus: 'completed',
          consecutiveFailures: 0,
          nextRunAt: new Date(deps.now().getTime() + policy.intervalHours * 3600_000),
        });
      }
    } catch (e) {
      const f = toFlowError(e);
      if (f.code === 'conflict') {
        // Something else is running; try again shortly without counting it as a failure.
        await deps.store.upsertPolicy(policy.deploymentId, { nextRunAt: new Date(deps.now().getTime() + 30 * 60_000) });
        continue;
      }
      if (f.code === 'not_found') {
        // Deployment is gone: stop scheduling it.
        await deps.store.upsertPolicy(policy.deploymentId, { enabled: false, nextRunAt: null, lastStatus: 'failed' });
        continue;
      }
      failed++;
      await recordScheduledFailure(policy, f, deps, system);
    }
  }
  return { ran, failed };
}

async function recordScheduledFailure(policy: PolicyRow, failure: BackupFlowError, deps: BackupDeps, actor: Actor): Promise<void> {
  const failures = policy.consecutiveFailures + 1;
  const disable = failures >= MAX_CONSECUTIVE_FAILURES;
  // Back off (1h, 2h, 4h ...) but never wait longer than the configured interval.
  const backoffHours = Math.min(policy.intervalHours, 2 ** (failures - 1));
  await deps.store.upsertPolicy(policy.deploymentId, {
    lastRunAt: deps.now(),
    lastStatus: 'failed',
    consecutiveFailures: failures,
    enabled: disable ? false : policy.enabled,
    nextRunAt: disable ? null : new Date(deps.now().getTime() + backoffHours * 3600_000),
  });
  if (disable) {
    await safely('audit', () => deps.store.audit('deployment.backup.policy_disabled', `${policy.deploymentId}: ${failures} consecutive failures (${failure.code})`, actor));
    logger.error({ deploymentId: policy.deploymentId, failures }, 'Scheduled backups disabled after repeated failures');
  }
}

// ───────────────────────────── real wiring ─────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
// The Prisma delegate is typed `any` on purpose in this one adapter: rows are mapped to the explicit BackupRow/PolicyRow
// interfaces above (BigInt -> number, Json -> BackupComponent[]), which is the contract the rest of the code relies on.

function mapBackup(r: any): BackupRow {
  return {
    id: r.id,
    deploymentId: r.deploymentId,
    trigger: r.trigger,
    status: r.status,
    phase: r.phase ?? null,
    repoFullName: r.repoFullName ?? null,
    releaseId: r.releaseId ?? null,
    releaseTag: r.releaseTag ?? null,
    releaseUrl: r.releaseUrl ?? null,
    components: Array.isArray(r.components) ? (r.components as BackupComponent[]) : null,
    sizeBytes: r.sizeBytes === null || r.sizeBytes === undefined ? null : Number(r.sizeBytes),
    error: r.error ?? null,
    createdById: r.createdById ?? null,
    createdAt: r.createdAt,
    completedAt: r.completedAt ?? null,
    restoreStatus: r.restoreStatus ?? null,
    restorePhase: r.restorePhase ?? null,
    restoreError: r.restoreError ?? null,
    restoreStartedAt: r.restoreStartedAt ?? null,
    restoredAt: r.restoredAt ?? null,
  };
}

function toDbData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  if (typeof out.sizeBytes === 'number') out.sizeBytes = BigInt(Math.round(out.sizeBytes as number));
  return out;
}

export async function createPrismaStore(): Promise<BackupStore> {
  const { prisma } = await import('./prisma');
  const db = prisma as any;
  const stale = (since: Date) => ({ gt: since });
  return {
    async loadDeployment(id) {
      const d = await db.deployment.findUnique({ where: { id }, include: { node: true, volumes: true } });
      if (!d || !d.node) return null;
      return {
        id: d.id,
        userId: d.userId,
        subdomain: d.subdomain ?? null,
        status: d.status,
        containerId: d.containerId ?? null,
        sourceType: d.sourceType ?? null,
        node: { id: d.node.id, ip: d.node.ip },
        volumes: (d.volumes ?? []).map((v: any) => ({ name: v.name, hostPath: v.hostPath })),
      };
    },
    async createBackup(data) {
      return mapBackup(await db.deploymentBackup.create({ data: { ...data, status: 'in_progress', phase: 'Queued' } }));
    },
    async updateBackup(id, data) {
      return mapBackup(await db.deploymentBackup.update({ where: { id }, data: toDbData(data as Record<string, unknown>) }));
    },
    async getBackup(id) {
      const r = await db.deploymentBackup.findUnique({ where: { id } });
      return r ? mapBackup(r) : null;
    },
    async listBackups(deploymentId, limit) {
      return (await db.deploymentBackup.findMany({ where: { deploymentId }, orderBy: { createdAt: 'desc' }, take: limit })).map(mapBackup);
    },
    async findActive(deploymentId, since, ignoreId) {
      const r = await db.deploymentBackup.findFirst({
        where: {
          deploymentId,
          ...(ignoreId ? { id: { not: ignoreId } } : {}),
          OR: [
            { status: 'in_progress', createdAt: stale(since) },
            { restoreStatus: 'in_progress', restoreStartedAt: stale(since) },
          ],
        },
      });
      return r ? mapBackup(r) : null;
    },
    async listCompleted(deploymentId, trigger) {
      return (await db.deploymentBackup.findMany({ where: { deploymentId, trigger, status: 'completed' }, orderBy: { createdAt: 'desc' } })).map(mapBackup);
    },
    async listFailed(deploymentId) {
      return (await db.deploymentBackup.findMany({ where: { deploymentId, status: 'failed' }, orderBy: { createdAt: 'desc' } })).map(mapBackup);
    },
    async listBackupsOfDeletedDeployments(limit) {
      return (await db.deploymentBackup.findMany({ where: { deployment: { status: 'deleted' } }, orderBy: { createdAt: 'asc' }, take: limit })).map(mapBackup);
    },
    async deleteBackup(id) {
      await db.deploymentBackup.delete({ where: { id } });
    },
    async reapStale(cutoff) {
      const a = await db.deploymentBackup.updateMany({
        where: { status: 'in_progress', createdAt: { lt: cutoff } },
        data: { status: 'failed', phase: null, error: 'Interrupted: the job did not finish (the API may have restarted).', completedAt: new Date() },
      });
      const b = await db.deploymentBackup.updateMany({
        where: { restoreStatus: 'in_progress', restoreStartedAt: { lt: cutoff } },
        data: { restoreStatus: 'failed', restorePhase: null, restoreError: 'Interrupted: the restore did not finish (the API may have restarted). Check the app before retrying.', restoredAt: new Date() },
      });
      return (a.count ?? 0) + (b.count ?? 0);
    },
    async getPolicy(deploymentId) {
      return (await db.deploymentBackupPolicy.findUnique({ where: { deploymentId } })) ?? null;
    },
    async upsertPolicy(deploymentId, data) {
      return db.deploymentBackupPolicy.upsert({ where: { deploymentId }, create: { deploymentId, ...data }, update: data });
    },
    async dueBackupPolicies(now, limit) {
      return db.deploymentBackupPolicy.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: 'asc' }, take: limit });
    },
    async audit(action, target, actor) {
      await db.auditLog.create({ data: { adminId: actor.adminId, action, target, actorRole: actor.role } });
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function createDefaultDeps(): Promise<BackupDeps> {
  return {
    store: await createPrismaStore(),
    agent: {
      supportsBackups: agentClient.agentSupportsBackups,
      createBackup: agentClient.agentCreateBackup,
      openFile: agentClient.agentOpenBackupFile,
      deleteBackup: agentClient.agentDeleteBackup,
      restoreComponent: agentClient.agentRestoreComponent,
      stop: agentClient.stopDeployment,
      start: agentClient.startDeployment,
    },
    github: () => getGithubBackupClient(),
    isConfigured: () => Boolean(env.backupGithubToken),
    now: () => new Date(),
    maxComponentBytes: env.backupMaxSizeMb * 1024 * 1024,
  };
}
