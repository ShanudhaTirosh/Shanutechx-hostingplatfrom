/**
 * filesystem.js — Secure filesystem operations for the browser-based File Manager / IDE.
 *
 * All paths are jailed to `/opt/shanutechx/workspaces/<deploymentId>/` so
 * no request can escape outside that container's workspace directory.
 */
const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACES_DIR || process.env.WORKSPACE_ROOT || '/var/lib/shanutechx/workspaces';

/**
 * Resolve a path relative to the deployment workspace and validate it doesn't
 * escape the workspace root — protection against directory traversal.
 */
function resolveSafe(deploymentId, relPath = '') {
  const base = path.resolve(WORKSPACE_ROOT, deploymentId);
  const target = path.resolve(base, relPath.replace(/^\/+/, ''));
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw Object.assign(new Error('Path escape detected'), { statusCode: 400 });
  }
  return target;
}

/** List directory entries (shallow, with type/size). */
async function listDir(deploymentId, relPath = '') {
  const target = resolveSafe(deploymentId, relPath);
  const entries = await fs.readdir(target, { withFileTypes: true });
  const items = await Promise.all(
    entries.map(async (e) => {
      const stats = await fs.stat(path.join(target, e.name)).catch(() => null);
      return {
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        size: stats && !e.isDirectory() ? stats.size : null,
        mtime: stats?.mtimeMs ?? null,
      };
    })
  );
  return items.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Read file content as UTF-8 string. Max 2 MB. */
async function readFile(deploymentId, relPath) {
  const target = resolveSafe(deploymentId, relPath);
  const stats = await fs.stat(target);
  if (stats.size > 2 * 1024 * 1024) {
    throw Object.assign(new Error('File too large (max 2 MB)'), { statusCode: 413 });
  }
  return fs.readFile(target, 'utf8');
}

/** Write (overwrite) a text file. Creates parent directories if needed. */
async function writeFile(deploymentId, relPath, content) {
  const target = resolveSafe(deploymentId, relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

/** Write binary file from base64 string. */
async function writeBinaryFile(deploymentId, relPath, base64Content) {
  const target = resolveSafe(deploymentId, relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const buffer = Buffer.from(base64Content, 'base64');
  await fs.writeFile(target, buffer);
}

/** Extract zip / tar.gz / tar archive. */
async function extractArchive(deploymentId, relPath) {
  const archive = resolveSafe(deploymentId, relPath);
  const targetDir = path.dirname(archive);

  // Inspect entries before extracting to prevent Zip-Slip path traversal
  let entries = [];
  if (archive.endsWith('.zip')) {
    const { stdout } = await execFileAsync('unzip', ['-Z1', archive]);
    entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
  } else if (archive.endsWith('.tar.gz') || archive.endsWith('.tgz')) {
    const { stdout } = await execFileAsync('tar', ['-tzf', archive]);
    entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
  } else if (archive.endsWith('.tar')) {
    const { stdout } = await execFileAsync('tar', ['-tf', archive]);
    entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
  } else {
    throw new Error('Unsupported archive format. Supported formats: .zip, .tar.gz, .tgz, .tar');
  }

  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('../') || entry.includes('..\\')) {
      throw Object.assign(new Error('Path escape detected in archive entry: ' + entry), { statusCode: 400 });
    }
  }

  if (archive.endsWith('.zip')) {
    await execFileAsync('unzip', ['-o', archive, '-d', targetDir]);
  } else if (archive.endsWith('.tar.gz') || archive.endsWith('.tgz')) {
    await execFileAsync('tar', ['-xzf', archive, '-C', targetDir]);
  } else if (archive.endsWith('.tar')) {
    await execFileAsync('tar', ['-xf', archive, '-C', targetDir]);
  }
}

/** Create an empty directory. */
async function makeDir(deploymentId, relPath) {
  const target = resolveSafe(deploymentId, relPath);
  await fs.mkdir(target, { recursive: true });
}

/** Delete a file or directory (recursive). */
async function remove(deploymentId, relPath) {
  const target = resolveSafe(deploymentId, relPath);
  await fs.rm(target, { recursive: true, force: true });
}

/** Rename / move a path inside the same workspace. */
async function rename(deploymentId, fromPath, toPath) {
  const from = resolveSafe(deploymentId, fromPath);
  const to = resolveSafe(deploymentId, toPath);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
}

module.exports = { listDir, readFile, writeFile, writeBinaryFile, extractArchive, makeDir, remove, rename };
