const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACES_DIR = process.env.AGENT_WORKSPACES_DIR || '/var/lib/shanutechx/workspaces';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Clones a repo fresh into a per-deployment workspace dir, or pulls if it
 * already exists (redeploys reuse the same directory by deploymentId).
 * Workspace is intentionally keyed by deploymentId, not repo URL, so two
 * customers can't collide even if they point at forks of the same repo.
 */
async function prepareWorkspace(deploymentId, repoUrl, branch = 'main', remoteBackupUrl = null) {
  const dir = path.join(WORKSPACES_DIR, deploymentId);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const files = fs.readdirSync(dir);
  const isEmpty = files.length === 0;

  // Handle Pull-to-Restore if local workspace was cleaned up after 24h
  if (isEmpty && remoteBackupUrl) {
    try {
      await run('git', ['clone', '--depth', '1', remoteBackupUrl, dir]);
      return dir;
    } catch (err) {
      console.warn('[node-agent:repo] Remote backup clone failed, falling back to primary source:', err.message || err);
    }
  }

  const isArchive = repoUrl && (
    repoUrl.startsWith('zip://') ||
    repoUrl.startsWith('upload://') ||
    repoUrl.startsWith('tar://') ||
    repoUrl.startsWith('archive://')
  );

  // Handle uploaded zip/folder/tar archive sources
  if (isArchive) {
    const filesAfterRestore = fs.readdirSync(dir);
    if (filesAfterRestore.length === 0) {
      throw new Error(`Workspace directory for archive deployment ${deploymentId} is empty and shadow backup repository could not be restored.`);
    }
    return dir;
  }

  if (fs.existsSync(path.join(dir, '.git'))) {
    if (repoUrl && !isArchive) {
      await run('git', ['remote', 'set-url', 'origin', repoUrl], { cwd: dir }).catch(() => {});
    }
    await run('git', ['fetch', '--depth', '1', 'origin', branch], { cwd: dir }).catch(() => {});
    await run('git', ['reset', '--hard', `origin/${branch}`], { cwd: dir }).catch(() => {});
  } else if (repoUrl && !isArchive) {
    await run('git', ['clone', '--depth', '1', '--branch', branch, repoUrl, dir]);
  }

  return dir;
}

/**
 * Commits workspace files and pushes to a remote git backup repository.
 */
async function pushWorkspaceToRemote(
  deploymentId,
  remoteUrl,
  commitMessage = 'Platform auto-backup sync',
  authorName = 'ShanuTechX Platform',
  authorEmail = 'platform@shanutechx.com'
) {
  const dir = path.join(WORKSPACES_DIR, deploymentId);
  if (!fs.existsSync(dir)) {
    throw new Error(`Workspace directory for deployment ${deploymentId} does not exist`);
  }

  if (!fs.existsSync(path.join(dir, '.git'))) {
    await run('git', ['init'], { cwd: dir });
  }

  await run('git', ['config', 'user.name', authorName], { cwd: dir });
  await run('git', ['config', 'user.email', authorEmail], { cwd: dir });

  await run('git', ['add', '-A'], { cwd: dir });
  
  // Check if there are changes to commit
  const status = await run('git', ['status', '--porcelain'], { cwd: dir }).catch(() => ({ stdout: '' }));
  if (status.stdout.trim().length > 0) {
    await run('git', ['commit', '-m', commitMessage], { cwd: dir }).catch(() => {});
  }

  // Ensure remote 'backup' points to remoteUrl
  await run('git', ['remote', 'remove', 'backup'], { cwd: dir }).catch(() => {});
  await run('git', ['remote', 'add', 'backup', remoteUrl], { cwd: dir });

  // Push main branch to remote
  await run('git', ['push', '-u', 'backup', 'HEAD:main', '--force'], { cwd: dir });
  return true;
}

module.exports = { prepareWorkspace, pushWorkspaceToRemote, WORKSPACES_DIR };
