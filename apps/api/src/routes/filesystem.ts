import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { env } from '../env';

export const filesystemRouter = Router();

filesystemRouter.use(requireAuth);

async function getNodeForDeployment(deploymentId: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { node: { select: { ip: true } } },
  });
  return deployment ? { deployment, node: deployment.node } : null;
}

/** RBAC: owner or staff can access own deployment workspace. */
async function canAccessFs(req: AuthedRequest, deploymentId: string): Promise<boolean> {
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
  if (!deployment) return false;
  return canAccessResource(deployment.userId, req);
}

function agentUrl(nodeIp: string, path: string) {
  return `http://${nodeIp}:${env.nodeAgentPort}${path}`;
}

function agentHeaders() {
  return { 'x-agent-secret': env.nodeAgentSecret, 'Content-Type': 'application/json' };
}

// ── List directory ─────────────────────────────────────────────────────────

filesystemRouter.get('/fs/:deploymentId/list', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/list?path=${encodeURIComponent(String(req.query.path ?? ''))}`);
  const r = await fetch(url, { headers: agentHeaders() });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Read file ──────────────────────────────────────────────────────────────

filesystemRouter.get('/fs/:deploymentId/read', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/read?path=${encodeURIComponent(String(req.query.path ?? ''))}`);
  const r = await fetch(url, { headers: agentHeaders() });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Write file ─────────────────────────────────────────────────────────────

filesystemRouter.put('/fs/:deploymentId/write', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/write`);
  const r = await fetch(url, { method: 'PUT', headers: agentHeaders(), body: JSON.stringify(req.body) });
  const data = await r.json();

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'fs.write',
      target: `${req.params.deploymentId}:${req.body.path ?? 'unknown'}`,
    },
  });

  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Make directory ─────────────────────────────────────────────────────────

filesystemRouter.post('/fs/:deploymentId/mkdir', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/mkdir`);
  const r = await fetch(url, { method: 'POST', headers: agentHeaders(), body: JSON.stringify(req.body) });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Delete file / directory ────────────────────────────────────────────────

filesystemRouter.delete('/fs/:deploymentId/delete', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/delete`);
  const r = await fetch(url, { method: 'DELETE', headers: agentHeaders(), body: JSON.stringify(req.body) });
  const data = await r.json();

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'fs.delete',
      target: `${req.params.deploymentId}:${req.body.path ?? 'unknown'}`,
    },
  });

  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Rename / move ──────────────────────────────────────────────────────────

filesystemRouter.post('/fs/:deploymentId/rename', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/rename`);
  const r = await fetch(url, { method: 'POST', headers: agentHeaders(), body: JSON.stringify(req.body) });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Upload binary file ──────────────────────────────────────────────────────

filesystemRouter.post('/fs/:deploymentId/upload-binary', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/upload-binary`);
  const r = await fetch(url, { method: 'POST', headers: agentHeaders(), body: JSON.stringify(req.body) });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Extract archive (zip / tar.gz / tar) ───────────────────────────────────

filesystemRouter.post('/fs/:deploymentId/extract', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node) return res.status(404).json({ error: 'No node assigned' });

  const url = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/extract`);
  const r = await fetch(url, { method: 'POST', headers: agentHeaders(), body: JSON.stringify(req.body) });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
});

// ── Git Commit & Push ──────────────────────────────────────────────────────
/**
 * POST /fs/:deploymentId/git-commit-push
 * Saves a file on the node workspace AND pushes the change back to
 * GitHub / GitLab using the user's connected Git account token.
 *
 * Body: { filePath: string, content: string, commitMessage?: string, accountId?: string }
 *
 * The handler:
 * 1. Writes the updated file to the node workspace.
 * 2. Resolves the user's connected Git account token (from gitConnect store).
 * 3. Detects provider from the deployment's repoUrl.
 * 4. Calls GitHub/GitLab API to create/update the file and commit.
 */

// Audit findings H7/H8/H10 rewrite: previously resolved via an
// unpersisted, in-memory `gitUserAccounts` map shared between this module
// and gitConnect.ts, populated only by manually-pasted PATs. Now uses the
// real, persisted GitHub App / GitLab OAuth provider adapters -- no PATs
// are stored anywhere, and tokens are minted fresh (GitHub) or refreshed
// on demand (GitLab) rather than read from a long-lived stored secret.
import { getProvider } from '../lib/gitProviders';

filesystemRouter.post('/fs/:deploymentId/git-commit-push', async (req: AuthedRequest, res) => {
  if (!(await canAccessFs(req, req.params.deploymentId))) return res.status(404).json({ error: 'Deployment not found' });
  const result = await getNodeForDeployment(req.params.deploymentId);
  if (!result?.node || !result.deployment) return res.status(404).json({ error: 'No node assigned' });

  const { filePath, content, commitMessage = 'Update via ShanuTechX', accountId } = req.body as {
    filePath: string;
    content: string;
    commitMessage?: string;
    accountId?: string;
  };

  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'filePath and content are required' });
  }

  // Step 1: Write file to node workspace
  const writeUrl = agentUrl(result.node.ip, `/agent/fs/${req.params.deploymentId}/write`);
  const writeRes = await fetch(writeUrl, {
    method: 'PUT',
    headers: agentHeaders(),
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!writeRes.ok) {
    return res.status(502).json({ error: 'Failed to write file to node workspace' });
  }

  // Step 2: Resolve which connected account + provider to push through.
  const userId = req.user!.id;
  const repoUrlForDetect = result.deployment.repoUrl ?? '';
  const detectedProvider = accountId
    ? undefined // resolved below once we know which account owns accountId
    : repoUrlForDetect.includes('github.com')
      ? 'github'
      : repoUrlForDetect.includes('gitlab.com')
        ? 'gitlab'
        : undefined;

  let matchedProvider: 'github' | 'gitlab' | undefined;
  let matchedAccountId: string | undefined;

  for (const providerName of ['github', 'gitlab'] as const) {
    if (detectedProvider && providerName !== detectedProvider && !accountId) continue;
    const adapter = getProvider(providerName);
    if (!adapter) continue;
    const accounts = await adapter.listConnectedAccounts(userId);
    const match = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];
    if (match) {
      matchedProvider = providerName;
      matchedAccountId = match.id;
      break;
    }
  }

  if (!matchedProvider || !matchedAccountId) {
    return res.status(400).json({
      error: 'No connected Git account found. Connect your GitHub or GitLab account in the Deployments page first.',
    });
  }

  const repoUrl = result.deployment.repoUrl ?? '';
  const branch = result.deployment.branch ?? 'main';
  const token = await getProvider(matchedProvider)!.getScopedToken(matchedAccountId, repoUrl);

  try {
    if (matchedProvider === 'github') {
      // Parse owner/repo from repoUrl
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
      if (!match) return res.status(400).json({ error: 'Cannot parse GitHub repo from deployment repoUrl' });
      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '');

      // Get current file SHA (required for updates)
      const getUrl = `https://api.github.com/repos/${owner}/${cleanRepo}/contents/${filePath}?ref=${branch}`;
      const getRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ShanuTechX-Platform', Accept: 'application/vnd.github+json' },
      });
      const existing = getRes.ok ? await getRes.json() : null;

      // Create or update file
      const putRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ShanuTechX-Platform', 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
        body: JSON.stringify({
          message: commitMessage,
          content: Buffer.from(content, 'utf-8').toString('base64'),
          branch,
          sha: existing?.sha,
          committer: { name: 'ShanuTechX Platform', email: 'platform@shanutechx.com' },
        }),
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        return res.status(502).json({ error: `GitHub push failed: ${(err as any).message ?? putRes.status}` });
      }

      const pushData = await putRes.json();
      return res.json({ ok: true, provider: 'github', commitSha: pushData.commit?.sha, commitUrl: pushData.commit?.html_url });
    }

    if (matchedProvider === 'gitlab') {
      // Parse namespace/project from repoUrl
      const match = repoUrl.match(/gitlab\.com\/(.+?)(?:\.git)?$/);
      if (!match) return res.status(400).json({ error: 'Cannot parse GitLab project from deployment repoUrl' });
      const projectPath = encodeURIComponent(match[1]);

      // Get current file to check if it exists
      const getRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(filePath)}?ref=${branch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fileExists = getRes.ok;

      const method = fileExists ? 'PUT' : 'POST';
      const glRes = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(filePath)}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch,
          content,
          commit_message: commitMessage,
          encoding: 'text',
        }),
      });

      if (!glRes.ok) {
        const err = await glRes.json().catch(() => ({}));
        return res.status(502).json({ error: `GitLab push failed: ${(err as any).message ?? glRes.status}` });
      }

      return res.json({ ok: true, provider: 'gitlab' });
    }

    res.status(400).json({ error: 'Unsupported provider' });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Git push failed' });
  }
});
