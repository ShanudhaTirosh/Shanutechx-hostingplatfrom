'use strict';

/**
 * Deployment backup / restore primitives for the node agent.
 *
 * The API owns GitHub credentials and orchestration; this module only does the
 * on-node file work, and never talks to GitHub:
 *
 *   createBackup()      -> one tar.gz per component (workspace, each volume) under BACKUPS_DIR/<backupId>/
 *   openBackupFile()    -> read stream + size, so the API can stream it to GitHub
 *   removeBackup()      -> delete the spool directory
 *   restoreComponent()  -> spool an uploaded tar.gz, verify its SHA-256, extract it into a staging
 *                          directory with hostile-archive protections, then swap it in.
 *
 * SECURITY MODEL. A customer fully controls what is inside their workspace/volumes (symlinks, odd
 * filenames, device nodes). Restore runs with the agent's privileges, so an archive must never be
 * able to write outside its target directory:
 *   - tar.x runs with preservePaths:false and treats every warning as fatal unless known-benign, so ".."
 *     segments and absolute member paths are rejected,
 *   - node-tar refuses to extract *through* a symlink created earlier in the same archive,
 *   - symlinks whose target is absolute or climbs out of the restored directory are skipped (and reported),
 *   - device nodes / FIFOs are rejected outright (a workspace never legitimately contains them),
 *   - extraction happens in a staging dir INSIDE the target (same filesystem, so rename never hits
 *     EXDEV, and bind mounts keep pointing at the same directory inode),
 *   - creation never dereferences symlinks (follow:false), so a symlink to /etc/shadow is archived
 *     as a symlink and never leaks file contents into a backup.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const tar = require('tar');

const WORKSPACES_DIR = process.env.AGENT_WORKSPACES_DIR || '/var/lib/shanutechx/workspaces';
// Fixed to match apps/api/src/routes/volumes.ts, which generates /var/lib/shanutechx/volumes/<deploymentId>/<name>.
// The env override exists for tests; changing it in production would make every volume path "outside the root".
const VOLUMES_ROOT = process.env.AGENT_VOLUMES_DIR || '/var/lib/shanutechx/volumes';
const BACKUPS_DIR = process.env.AGENT_BACKUPS_DIR || '/var/lib/shanutechx/backups';

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const VOLUME_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FILE_NAME_RE = /^(workspace|volume-[A-Za-z0-9_-]{1,64})\.tar\.gz$/;
const ALLOWED_ENTRY_TYPES = new Set(['File', 'OldFile', 'ContiguousFile', 'Directory', 'SymbolicLink', 'Link']);
const MAX_WARNINGS_KEPT = 10;

class BackupError extends Error {
  constructor(message, code, status = 500) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
    this.status = status;
  }
}

function assertId(value, label) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new BackupError(`Invalid ${label}`, 'invalid_id', 400);
  }
}

/** Directories that add size but no value to a backup: they are rebuilt by the next deploy. */
function isExcludedWorkspacePath(p) {
  const parts = String(p).split('/').filter((s) => s && s !== '.');
  if (parts.includes('node_modules') || parts.includes('.git')) return true;
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === '.next' && parts[i + 1] === 'cache') return true;
  }
  return false;
}

/**
 * A symlink is restored only if its target stays inside the restored directory. node-tar cannot restore
 * absolute targets faithfully (it rewrites "/etc/x" to "etc/x", silently corrupting the link) and refuses
 * targets that climb out, so we skip those explicitly and report them instead of failing the whole restore.
 */
function isEscapingSymlink(entryPath, linkpath) {
  if (!linkpath || String(linkpath).startsWith('/')) return true;
  const dir = path.posix.dirname(String(entryPath).replace(/^\.\//, ''));
  const resolved = path.posix.normalize(path.posix.join(dir, String(linkpath)));
  return resolved === '..' || resolved.startsWith('../');
}

async function isNonEmptyDir(dir) {
  try {
    const entries = await fsp.readdir(dir);
    return entries.length > 0;
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return false;
    throw err;
  }
}

/** A volume may only live under VOLUMES_ROOT/<deploymentId>/. Refuses anything that resolves elsewhere. */
function resolveVolumeDir(deploymentId, hostPath) {
  const allowedRoot = path.resolve(VOLUMES_ROOT, deploymentId) + path.sep;
  const resolved = path.resolve(String(hostPath || ''));
  if (!(resolved + path.sep).startsWith(allowedRoot) || resolved + path.sep === allowedRoot) {
    throw new BackupError('Volume path is outside the allowed volumes directory', 'volume_path_denied', 400);
  }
  return resolved;
}

function workspaceDir(deploymentId) {
  return path.join(WORKSPACES_DIR, deploymentId);
}

/** Counts bytes, hashes them, and aborts the pipeline the moment a ceiling is crossed. */
function meter(maxBytes) {
  const hash = crypto.createHash('sha256');
  let size = 0;
  const stream = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      if (maxBytes && size > maxBytes) {
        return cb(new BackupError(`Archive exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`, 'too_large', 413));
      }
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  return { stream, digest: () => hash.digest('hex'), size: () => size };
}

async function archiveDir({ kind, name, srcDir, outDir, file, maxBytes, filter, warnings }) {
  const outPath = path.join(outDir, file);
  const m = meter(maxBytes);
  const pack = tar.c(
    {
      gzip: true,
      cwd: srcDir,
      follow: false, // never dereference symlinks: see SECURITY MODEL
      filter,
      // Files vanishing/changing while a live app runs is normal; keep going and report it.
      onwarn: (code, message) => {
        if (warnings.length < MAX_WARNINGS_KEPT) warnings.push(`${kind}${name && name !== kind ? `:${name}` : ''}: ${code} ${message}`);
      },
    },
    ['.']
  );
  await pipeline(pack, m.stream, fs.createWriteStream(outPath, { mode: 0o600 }));
  return { kind, name, file, sizeBytes: m.size(), sha256: m.digest() };
}

/**
 * @param {{deploymentId:string, backupId:string, volumes?:{name:string,hostPath:string}[], includeWorkspace?:boolean, maxBytes?:number}} p
 */
async function createBackup({ deploymentId, backupId, volumes = [], includeWorkspace = true, maxBytes }) {
  assertId(deploymentId, 'deploymentId');
  assertId(backupId, 'backupId');

  const outDir = path.join(BACKUPS_DIR, backupId);
  await fsp.mkdir(outDir, { recursive: true, mode: 0o700 });

  const components = [];
  const skipped = [];
  const warnings = [];
  try {
    if (includeWorkspace) {
      const dir = workspaceDir(deploymentId);
      if (await isNonEmptyDir(dir)) {
        components.push(
          await archiveDir({
            kind: 'workspace',
            name: 'workspace',
            srcDir: dir,
            outDir,
            file: 'workspace.tar.gz',
            maxBytes,
            filter: (p) => !isExcludedWorkspacePath(p),
            warnings,
          })
        );
      } else {
        skipped.push({ kind: 'workspace', name: 'workspace', reason: 'workspace is empty or was already cleaned up' });
      }
    }

    for (const v of volumes) {
      if (!v || !VOLUME_NAME_RE.test(String(v.name))) {
        skipped.push({ kind: 'volume', name: String(v && v.name), reason: 'invalid volume name' });
        continue;
      }
      let dir;
      try {
        dir = resolveVolumeDir(deploymentId, v.hostPath);
      } catch (err) {
        skipped.push({ kind: 'volume', name: v.name, reason: err.message });
        continue;
      }
      if (!(await isNonEmptyDir(dir))) {
        skipped.push({ kind: 'volume', name: v.name, reason: 'volume is empty or does not exist on this node' });
        continue;
      }
      components.push(
        await archiveDir({ kind: 'volume', name: v.name, srcDir: dir, outDir, file: `volume-${v.name}.tar.gz`, maxBytes, warnings })
      );
    }
  } catch (err) {
    await removeBackup(backupId).catch(() => {});
    throw err;
  }

  if (components.length === 0) {
    await removeBackup(backupId).catch(() => {});
    throw new BackupError('Nothing to back up: no workspace files or volume data were found on this node', 'nothing_to_backup', 422);
  }
  return { components, skipped, warnings };
}

async function openBackupFile(backupId, file) {
  assertId(backupId, 'backupId');
  if (!FILE_NAME_RE.test(file)) throw new BackupError('Invalid backup file name', 'invalid_file', 400);
  const p = path.join(BACKUPS_DIR, backupId, file);
  let st;
  try {
    st = await fsp.stat(p);
  } catch (err) {
    if (err.code === 'ENOENT') throw new BackupError('Backup file not found (it may have been cleaned up)', 'not_found', 404);
    throw err;
  }
  return { stream: fs.createReadStream(p), size: st.size };
}

async function removeBackup(backupId) {
  assertId(backupId, 'backupId');
  await fsp.rm(path.join(BACKUPS_DIR, backupId), { recursive: true, force: true });
}

/** Removes spool directories whose API-side job died and never cleaned up. Safe to run repeatedly. */
async function pruneStaleSpool(maxAgeMs = 6 * 60 * 60 * 1000) {
  let removed = 0;
  let entries = [];
  try {
    entries = await fsp.readdir(BACKUPS_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  const cutoff = Date.now() - maxAgeMs;
  for (const e of entries) {
    const p = path.join(BACKUPS_DIR, e.name);
    try {
      const st = await fsp.stat(p);
      if (st.mtimeMs < cutoff) {
        await fsp.rm(p, { recursive: true, force: true });
        removed++;
      }
    } catch {
      /* raced with another cleanup */
    }
  }
  return removed;
}

async function moveChildren(fromDir, toDir, skipNames = new Set()) {
  const names = (await fsp.readdir(fromDir)).filter((n) => !skipNames.has(n));
  const moved = [];
  for (const n of names) {
    await fsp.rename(path.join(fromDir, n), path.join(toDir, n));
    moved.push(n);
  }
  return moved;
}

/**
 * Extract `sourceFile` into `target`, replacing what is there. All-or-nothing: on any failure the previous
 * contents are put back.
 */
async function extractAndSwap(sourceFile, target, warnings) {
  await fsp.mkdir(target, { recursive: true });
  const tag = crypto.randomBytes(6).toString('hex');
  const stagingName = `.restore-staging-${tag}`;
  const oldName = `.pre-restore-${tag}`;
  const staging = path.join(target, stagingName);
  const oldDir = path.join(target, oldName);
  const skip = new Set([stagingName, oldName]);
  await fsp.mkdir(staging, { mode: 0o700 });

  let unsafe = null; // set by the filter for entries we refuse on sight
  let fatal = null; // set by onwarn for anything node-tar itself refuses (path escapes, symlink write-through, ...)
  let skippedLinks = 0;
  try {
    await tar.x({
      file: sourceFile,
      cwd: staging,
      // Not strict on purpose: strict turns node-tar's harmless informational notices into errors. Instead
      // every warning is FATAL unless explicitly known to be benign (see onwarn), so unknown = rejected.
      strict: false,
      preservePaths: false,
      // Only a root agent can (and needs to) restore uid/gid; a non-root agent keeps its own ownership.
      preserveOwner: typeof process.getuid === 'function' && process.getuid() === 0,
      filter: (p, entry) => {
        const type = entry && entry.type;
        if (String(p).startsWith('/')) {
          unsafe = unsafe || `absolute path ${p}`;
          return false;
        }
        if (type && !ALLOWED_ENTRY_TYPES.has(type)) {
          unsafe = unsafe || `unsupported entry type ${type} at ${p}`;
          return false;
        }
        if (type === 'SymbolicLink' && isEscapingSymlink(p, entry.linkpath)) {
          skippedLinks++;
          if (warnings.length < MAX_WARNINGS_KEPT) {
            warnings.push(`skipped symlink ${p} -> ${entry.linkpath} (absolute or points outside the restored directory)`);
          }
          return false;
        }
        return true;
      },
      onwarn: (code, message) => {
        if (code === 'TAR_ENTRY_INFO') {
          if (warnings.length < MAX_WARNINGS_KEPT) warnings.push(`${code} ${message}`);
          return;
        }
        fatal = fatal || `${code}: ${message}`;
      },
    });
    if (unsafe) throw new BackupError(`Archive rejected: ${unsafe}`, 'unsafe_archive', 422);
    if (fatal) throw new BackupError(`Archive rejected: ${fatal}`, 'unsafe_archive', 422);
    if (skippedLinks > MAX_WARNINGS_KEPT) warnings.push(`...and ${skippedLinks - MAX_WARNINGS_KEPT} more symlinks skipped`);
  } catch (err) {
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    if (err instanceof BackupError) throw err;
    throw new BackupError(`Archive rejected: ${err.message}`, 'unsafe_archive', 422);
  }

  // Swap. Everything stays on the target's own filesystem, so these are cheap renames.
  await fsp.mkdir(oldDir, { mode: 0o700 });
  let movedAway = [];
  try {
    movedAway = await moveChildren(target, oldDir, skip);
    await moveChildren(staging, target);
  } catch (err) {
    // Roll back: clear anything half-moved in, then put the old contents back.
    try {
      const partial = (await fsp.readdir(target)).filter((n) => !skip.has(n));
      for (const n of partial) await fsp.rm(path.join(target, n), { recursive: true, force: true });
      for (const n of movedAway) await fsp.rename(path.join(oldDir, n), path.join(target, n));
    } catch (rollbackErr) {
      throw new BackupError(`Restore failed and rollback was incomplete: ${rollbackErr.message}. Previous data is preserved in ${oldDir}`, 'rollback_failed', 500);
    }
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    await fsp.rm(oldDir, { recursive: true, force: true }).catch(() => {});
    throw new BackupError(`Restore failed and was rolled back: ${err.message}`, 'restore_failed', 500);
  }
  await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
  await fsp.rm(oldDir, { recursive: true, force: true }).catch(() => {});
}

/**
 * @param {{deploymentId:string, kind:'workspace'|'volume', name?:string, hostPath?:string, stream:NodeJS.ReadableStream, sha256:string, maxBytes?:number}} p
 */
async function restoreComponent({ deploymentId, kind, name, hostPath, stream, sha256, maxBytes }) {
  assertId(deploymentId, 'deploymentId');
  if (kind !== 'workspace' && kind !== 'volume') throw new BackupError('kind must be "workspace" or "volume"', 'invalid_kind', 400);
  if (!/^[a-f0-9]{64}$/.test(String(sha256 || ''))) throw new BackupError('A sha256 checksum is required to restore', 'checksum_required', 400);

  let target;
  if (kind === 'workspace') {
    target = workspaceDir(deploymentId);
  } else {
    if (!VOLUME_NAME_RE.test(String(name))) throw new BackupError('Invalid volume name', 'invalid_name', 400);
    target = resolveVolumeDir(deploymentId, hostPath);
  }

  await fsp.mkdir(BACKUPS_DIR, { recursive: true, mode: 0o700 });
  const spool = path.join(BACKUPS_DIR, `restore-${crypto.randomBytes(8).toString('hex')}.tar.gz`);
  const warnings = [];
  try {
    const m = meter(maxBytes);
    await pipeline(stream, m.stream, fs.createWriteStream(spool, { mode: 0o600 }));
    const actual = m.digest();
    if (actual !== sha256) {
      throw new BackupError('Checksum mismatch: the downloaded archive is not the one that was backed up. Nothing was changed.', 'checksum_mismatch', 422);
    }
    await extractAndSwap(spool, target, warnings);
    return { ok: true, kind, name: name || kind, sizeBytes: m.size(), warnings };
  } finally {
    await fsp.rm(spool, { force: true }).catch(() => {});
  }
}

module.exports = {
  BackupError,
  createBackup,
  openBackupFile,
  removeBackup,
  restoreComponent,
  pruneStaleSpool,
  // exported for tests
  resolveVolumeDir,
  isExcludedWorkspacePath,
  isEscapingSymlink,
  BACKUPS_DIR,
  VOLUMES_ROOT,
  WORKSPACES_DIR,
};
