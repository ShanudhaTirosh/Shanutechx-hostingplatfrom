const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACES_DIR = process.env.AGENT_WORKSPACES_DIR || '/var/lib/shanutechx/workspaces';

/**
 * Splits credentials out of an http(s) git URL so they never have to live in argv, in .git/config, or in a
 * stored URL. GitHub App / PAT tokens arrive as "https://x-access-token:TOKEN@github.com/o/r.git" or
 * "https://TOKEN@github.com/o/r.git"; both are handled. Non-http(s) URLs pass through untouched.
 */
function splitCredentials(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!/^https?:$/.test(u.protocol) || (!u.username && !u.password)) return { cleanUrl: rawUrl, auth: null };
    const auth = { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
    u.username = '';
    u.password = '';
    return { cleanUrl: u.toString(), auth };
  } catch {
    return { cleanUrl: rawUrl, auth: null };
  }
}

/**
 * Credentials go to git through environment variables (git >= 2.31 reads GIT_CONFIG_COUNT/KEY_n/VALUE_n) as an
 * HTTP Basic header. Unlike a URL or a `-c` argument this is not visible in `ps`, and unlike `git remote add`
 * it is never persisted to disk. This is the same mechanism GitHub's own checkout action uses.
 */
function authEnv(auth) {
  const env = { GIT_TERMINAL_PROMPT: '0' };
  if (!auth) return env;
  const basic = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  return {
    ...env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
  };
}

/** Removes anything that looks like a credential from text that may be logged or shown to a user. */
function redact(text, secrets = []) {
  let out = String(text == null ? '' : text);
  out = out.replace(/(https?:\/\/)[^\s/@]*@/gi, '$1***@');
  out = out.replace(/(Authorization:\s*Basic\s+)[A-Za-z0-9+/=]+/gi, '$1***');
  for (const secret of secrets) {
    if (secret && String(secret).length >= 4) out = out.split(String(secret)).join('***');
  }
  return out;
}

function run(cmd, args, opts = {}) {
  const { auth, ...execOpts } = opts;
  const secrets = auth ? [auth.username, auth.password, Buffer.from(`${auth.username}:${auth.password}`).toString('base64')] : [];
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { ...execOpts, env: { ...process.env, ...authEnv(auth) }, maxBuffer: 1024 * 1024 * 20 },
      (err, stdout, stderr) => {
        if (err) {
          // execFile's default message embeds the full command line (including any URL credentials), so build our own.
          const detail = redact(String(stderr || err.message || '').trim().split('\n').slice(-4).join(' | '), secrets);
          const safe = new Error(`git ${args[0]} failed: ${detail}`);
          safe.code = err.code;
          safe.stdout = redact(stdout, secrets);
          safe.stderr = redact(stderr, secrets);
          return reject(safe);
        }
        resolve({ stdout, stderr });
      }
    );
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
      const { cleanUrl, auth } = splitCredentials(remoteBackupUrl);
      await run('git', ['clone', '--depth', '1', cleanUrl, dir], { auth });
      return dir;
    } catch (err) {
      // err.message is already redacted by run().
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
      const { cleanUrl, auth } = splitCredentials(repoUrl);
      // Always point origin at the credential-free URL. This also scrubs a token that an older agent version
      // wrote into .git/config.
      await run('git', ['remote', 'set-url', 'origin', cleanUrl], { cwd: dir }).catch(() => run('git', ['remote', 'add', 'origin', cleanUrl], { cwd: dir }));
      // These used to be `.catch(() => {})`, so a failed fetch (expired token, deleted branch, GitHub outage) silently
      // rebuilt the OLD code and reported success. Fail loudly instead: a deploy must not pretend to be current.
      try {
        await run('git', ['fetch', '--depth', '1', 'origin', branch], { cwd: dir, auth });
      } catch (err) {
        throw new Error(`Could not fetch the latest code for branch "${branch}", so the deploy was stopped instead of rebuilding old code. ${err.message}`);
      }
      try {
        await run('git', ['reset', '--hard', `origin/${branch}`], { cwd: dir });
      } catch (err) {
        throw new Error(`Fetched branch "${branch}" but could not check it out. ${err.message}`);
      }
    }
  } else if (repoUrl && !isArchive) {
    const { cleanUrl, auth } = splitCredentials(repoUrl);
    await run('git', ['clone', '--depth', '1', '--branch', branch, cleanUrl, dir], { auth });
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
  // The remote URL carries the platform-wide backup token. Register only the clean URL and hand the credential to
  // git through the environment for this one push, so the token is never written into the customer workspace's
  // .git/config (which is also the build context).
  const { cleanUrl, auth } = splitCredentials(remoteUrl);
  await run('git', ['remote', 'remove', 'backup'], { cwd: dir }).catch(() => {});
  await run('git', ['remote', 'add', 'backup', cleanUrl], { cwd: dir });

  // Push main branch to remote
  await run('git', ['push', '-u', 'backup', 'HEAD:main', '--force'], { cwd: dir, auth });
  return true;
}

module.exports = { prepareWorkspace, pushWorkspaceToRemote, WORKSPACES_DIR, splitCredentials, redact, authEnv };
