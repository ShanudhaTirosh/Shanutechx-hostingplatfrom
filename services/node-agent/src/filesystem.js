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

const fsSync = require('fs');

/**
 * Resolve realpath for path or deepest existing parent directory.
 */
function getRealPathSafe(targetPath) {
  try {
    return fsSync.realpathSync(targetPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const parent = path.dirname(targetPath);
      if (parent === targetPath) return targetPath;
      return path.join(getRealPathSafe(parent), path.basename(targetPath));
    }
    throw err;
  }
}

/**
 * Resolve a path relative to the deployment workspace and validate it doesn't
 * escape the workspace root — protection against directory & symlink traversal.
 */
function resolveSafe(deploymentId, relPath = '') {
  const safeDepId = path.basename(String(deploymentId || ''));
  if (!safeDepId || safeDepId === '.' || safeDepId === '..') {
    throw Object.assign(new Error('Invalid deployment ID'), { statusCode: 400 });
  }

  const rootResolved = getRealPathSafe(path.resolve(WORKSPACE_ROOT));
  const base = getRealPathSafe(path.resolve(rootResolved, safeDepId));

  if (base !== rootResolved && !base.startsWith(rootResolved + path.sep)) {
    throw Object.assign(new Error('Path escape detected'), { statusCode: 400 });
  }

  const cleanRel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const lexicalTarget = path.resolve(base, cleanRel);
  if (lexicalTarget !== base && !lexicalTarget.startsWith(base + path.sep)) {
    throw Object.assign(new Error('Path escape detected'), { statusCode: 400 });
  }

  const realTarget = getRealPathSafe(lexicalTarget);
  if (realTarget !== base && !realTarget.startsWith(base + path.sep)) {
    throw Object.assign(new Error('Path escape detected via symlink'), { statusCode: 400 });
  }

  return realTarget;
}

/** List directory entries (shallow, with type/size). */
async function listDir(deploymentId, relPath = '') {
  const target = resolveSafe(deploymentId, relPath);
  const entries = await fs.readdir(target, { withFileTypes: true });
  const items = await Promise.all(
    entries.map(async (e) => {
      const stats = await fs.stat(path.join(target, e.name)).catch(() => null);
      const isDir = stats ? stats.isDirectory() : e.isDirectory();
      return {
        name: e.name,
        type: isDir ? 'dir' : 'file',
        size: stats && !isDir ? stats.size : null,
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

/** Extract zip / tar / tar.gz / tar.bz2 / tar.xz / rar / 7z archive. */
async function extractArchive(deploymentId, relPath) {
  const archive = resolveSafe(deploymentId, relPath);
  const targetDir = path.dirname(archive);
  const lower = archive.toLowerCase();

  // Inspect entries before extracting to prevent Zip-Slip path traversal
  let entries = [];
  try {
    if (lower.endsWith('.zip')) {
      try {
        const { stdout } = await execFileAsync('unzip', ['-Z1', '--', archive]);
        entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
      } catch {
        const { stdout } = await execFileAsync('7z', ['l', '-ba', '--', archive]);
        entries = stdout.split('\n').map((l) => l.trim().split(/\s+/).pop()).filter(Boolean);
      }
    } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      const { stdout } = await execFileAsync('tar', ['-tzf', archive]);
      entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
    } else if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) {
      const { stdout } = await execFileAsync('tar', ['-tjf', archive]);
      entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
    } else if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) {
      const { stdout } = await execFileAsync('tar', ['-tJf', archive]);
      entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
    } else if (lower.endsWith('.tar')) {
      const { stdout } = await execFileAsync('tar', ['-tf', archive]);
      entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
    } else if (lower.endsWith('.rar')) {
      try {
        const { stdout } = await execFileAsync('unrar', ['l', '-bare', '--', archive]);
        entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
      } catch {
        try {
          const { stdout } = await execFileAsync('7z', ['l', '-ba', '--', archive]);
          entries = stdout.split('\n').map((l) => l.trim().split(/\s+/).pop()).filter(Boolean);
        } catch {
          const { stdout } = await execFileAsync('bsdtar', ['-tf', archive]);
          entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
        }
      }
    } else if (lower.endsWith('.7z')) {
      try {
        const { stdout } = await execFileAsync('7z', ['l', '-ba', '--', archive]);
        entries = stdout.split('\n').map((l) => l.trim().split(/\s+/).pop()).filter(Boolean);
      } catch {
        const { stdout } = await execFileAsync('bsdtar', ['-tf', archive]);
        entries = stdout.split('\n').map((e) => e.trim()).filter(Boolean);
      }
    } else if (lower.endsWith('.gz') || lower.endsWith('.bz2') || lower.endsWith('.xz')) {
      entries = [path.basename(archive).replace(/\.(gz|bz2|xz)$/i, '')];
    } else {
      throw Object.assign(
        new Error('Unsupported archive format. Supported formats: .zip, .tar, .tar.gz, .tgz, .tar.bz2, .tbz2, .tar.xz, .txz, .rar, .7z, .gz, .bz2, .xz'),
        { statusCode: 400 }
      );
    }
  } catch (err) {
    if (err.statusCode === 400) throw err;
    entries = [];
  }

  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('../') || entry.includes('..\\')) {
      throw Object.assign(new Error('Path escape detected in archive entry: ' + entry), { statusCode: 400 });
    }
  }

  if (lower.endsWith('.zip')) {
    if (process.platform === 'win32') {
      try {
        await execFileAsync(
          'powershell',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '[System.IO.Compression.ZipFile]::ExtractToDirectory($env:STX_ARCHIVE, $env:STX_TARGET, $true)',
          ],
          {
            env: { ...process.env, STX_ARCHIVE: archive, STX_TARGET: targetDir },
          }
        );
        return;
      } catch {}
    }
    try {
      await execFileAsync('unzip', ['-o', '--', archive, '-d', targetDir]);
    } catch {
      await execFileAsync('7z', ['x', '-y', `-o${targetDir}`, '--', archive]);
    }
  } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    await execFileAsync('tar', ['-C', targetDir, '-xzf', archive]);
  } else if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) {
    await execFileAsync('tar', ['-C', targetDir, '-xjf', archive]);
  } else if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) {
    await execFileAsync('tar', ['-C', targetDir, '-xJf', archive]);
  } else if (lower.endsWith('.tar')) {
    await execFileAsync('tar', ['-C', targetDir, '-xf', archive]);
  } else if (lower.endsWith('.rar')) {
    try {
      await execFileAsync('unrar', ['x', '-o+', '--', archive, targetDir + path.sep]);
    } catch {
      try {
        await execFileAsync('7z', ['x', '-y', `-o${targetDir}`, '--', archive]);
      } catch {
        try {
          await execFileAsync('bsdtar', ['-C', targetDir, '-xf', archive]);
        } catch {
          await execFileAsync('unar', ['-o', targetDir, '-f', '--', archive]);
        }
      }
    }
  } else if (lower.endsWith('.7z')) {
    try {
      await execFileAsync('7z', ['x', '-y', `-o${targetDir}`, '--', archive]);
    } catch {
      try {
        await execFileAsync('7za', ['x', '-y', `-o${targetDir}`, '--', archive]);
      } catch {
        await execFileAsync('bsdtar', ['-C', targetDir, '-xf', archive]);
      }
    }
  } else if (lower.endsWith('.gz')) {
    try {
      await execFileAsync('tar', ['-C', targetDir, '-xzf', archive]);
    } catch {
      await execFileAsync('gzip', ['-d', '-k', '-f', '--', archive]);
    }
  } else if (lower.endsWith('.bz2')) {
    try {
      await execFileAsync('tar', ['-C', targetDir, '-xjf', archive]);
    } catch {
      await execFileAsync('bzip2', ['-d', '-k', '-f', '--', archive]);
    }
  } else if (lower.endsWith('.xz')) {
    try {
      await execFileAsync('tar', ['-C', targetDir, '-xJf', archive]);
    } catch {
      await execFileAsync('xz', ['-d', '-k', '-f', '--', archive]);
    }
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
