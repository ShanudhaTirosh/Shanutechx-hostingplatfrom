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
async function prepareWorkspace(deploymentId, repoUrl, branch = 'main') {
  const dir = path.join(WORKSPACES_DIR, deploymentId);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Handle uploaded zip/folder archive sources
  if (repoUrl && (repoUrl.startsWith('zip://') || repoUrl.startsWith('upload://'))) {
    // Workspace directory populated from uploaded source payload
    return dir;
  }

  if (fs.existsSync(path.join(dir, '.git'))) {
    await run('git', ['fetch', '--depth', '1', 'origin', branch], { cwd: dir }).catch(() => {});
    await run('git', ['reset', '--hard', `origin/${branch}`], { cwd: dir }).catch(() => {});
  } else {
    await run('git', ['clone', '--depth', '1', '--branch', branch, repoUrl, dir]);
  }

  return dir;
}

module.exports = { prepareWorkspace, WORKSPACES_DIR };
