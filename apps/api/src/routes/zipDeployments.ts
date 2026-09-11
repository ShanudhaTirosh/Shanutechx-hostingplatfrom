import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { env } from '../env';
import { buildAndRun } from '../lib/nodeAgentClient';
import { decryptSecret } from '../lib/secretsVault';

const execFileAsync = promisify(execFile);

export const uploadDeploymentsRouter = Router();

uploadDeploymentsRouter.use(requireAuth);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max ZIP upload
});

function getDecryptedEnvVars(deployment: any): Record<string, string> | undefined {
  if (!deployment.envVarsEncrypted) return undefined;
  try {
    const rawJson = decryptSecret(deployment.envVarsEncrypted, env.secretsEncryptionKey);
    return JSON.parse(rawJson);
  } catch (err) {
    logger.error({ err }, 'Failed to decrypt deployment envVarsEncrypted');
    return undefined;
  }
}

/**
 * POST /api/deployments/:id/upload-zip
 * Accepts a ZIP archive containing project source code and deploys it to the deployment container.
 */
uploadDeploymentsRouter.post(
  '/deployments/:id/upload-zip',
  upload.single('zipFile'),
  async (req: AuthedRequest, res) => {
    const deploymentId = req.params.id;
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { node: true },
    });

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment instance not found' });
    }

    if (!(await canAccessResource(deployment.userId, req))) {
      return res.status(403).json({ error: 'Access denied to this deployment instance' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No ZIP archive file uploaded. Field name must be "zipFile".' });
    }

    const filename = req.file.originalname.toLowerCase();
    const isZip = filename.endsWith('.zip');
    const isTar = filename.endsWith('.tar') || filename.endsWith('.tar.gz') || filename.endsWith('.tgz');

    if (!isZip && !isTar) {
      return res.status(400).json({ error: 'Invalid file format. Uploaded file must be a .zip, .tar, .tar.gz, or .tgz archive.' });
    }

    res.setHeader('Content-Type', 'application/x-ndjson');

    try {
      res.write(JSON.stringify({ phase: 'fetch', message: `Receiving source archive "${req.file.originalname}" (${Math.round(req.file.size / 1024)} KB)...` }) + '\n');

      // Determine local workspace directory
      const workspacesDir = process.env.AGENT_WORKSPACES_DIR || '/var/lib/shanutechx/workspaces';
      const targetDir = path.join(workspacesDir, deployment.id);

      await fs.mkdir(targetDir, { recursive: true });

      const ext = isZip ? '.zip' : filename.endsWith('.tar.gz') ? '.tar.gz' : filename.endsWith('.tgz') ? '.tgz' : '.tar';
      const tempArchivePath = path.join(targetDir, `__upload_source${ext}`);
      await fs.writeFile(tempArchivePath, req.file.buffer);

      res.write(JSON.stringify({ phase: 'fetch', message: 'Extracting source archive files into container workspace...' }) + '\n');

      // Extract archive depending on format and platform
      if (isZip) {
        if (process.platform === 'win32') {
          const psCommand = `Expand-Archive -Path "${tempArchivePath}" -DestinationPath "${targetDir}" -Force`;
          await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand]);
        } else {
          await execFileAsync('unzip', ['-o', tempArchivePath, '-d', targetDir]);
        }
      } else {
        await execFileAsync('tar', ['-xf', tempArchivePath, '-C', targetDir]);
      }

      // Remove temp archive file after extraction
      await fs.unlink(tempArchivePath).catch(() => {});

      // Upload ZIP archive to R2 object storage for multi-node node-agent accessibility
      const { uploadDeploymentZip } = await import('../lib/r2Storage');
      const r2ObjectUrl = await uploadDeploymentZip(deployment.id, req.file.buffer, filename);

      res.write(JSON.stringify({ phase: 'fetch', message: 'ZIP archive extracted successfully and saved to object storage. Creating automated platform shadow Git backup repository...' }) + '\n');

      const archiveType = isZip ? 'zip' : 'tar';
      const archiveScheme = isZip ? `zip://${filename}` : `tar://${filename}`;

      // Sync workspace to platform shadow backup repo on GitHub if token configured
      const { syncWorkspaceToShadowBackup } = await import('../lib/shadowBackup');
      void syncWorkspaceToShadowBackup(deployment.id, `Uploaded ${archiveType.toUpperCase()} project archive "${filename}"`).catch((err) => {
        logger.warn({ err, deploymentId: deployment.id }, `Shadow backup sync failed after ${archiveType.toUpperCase()} extract (non-fatal)`);
      });

      // Update deployment model in DB
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          sourceType: archiveType,
          zipSourceUrl: r2ObjectUrl || filename,
          repoUrl: archiveScheme,
          status: 'building',
        } as any,
      });

      res.write(JSON.stringify({ phase: 'build', message: 'Triggering Railpack container build pipeline...' }) + '\n');

      // Trigger Railpack container build & execution on node
      const buildResult = await buildAndRun(
        deployment.node,
        {
          deploymentId: deployment.id,
          repoUrl: archiveScheme,
          subdomain: deployment.subdomain ?? undefined,
          internalPort: deployment.internalPort || 3000,
          envVars: getDecryptedEnvVars(deployment),
          startCommand: deployment.startCommand ?? undefined,
          entryFile: deployment.entryFile ?? undefined,
          frameworkPreset: deployment.frameworkPreset ?? 'auto',
          exposureMode: deployment.exposureMode ?? 'ssl_with_proxy',
        },
        (event) => res.write(JSON.stringify(event) + '\n')
      );

      if (buildResult.phase === 'error') {
        await prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: 'failed' },
        });
        res.write(JSON.stringify({ phase: 'error', message: buildResult.message || 'Build failed' }) + '\n');
        return res.end();
      }

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'running',
          containerId: buildResult.containerId,
          lastDeployAt: new Date(),
        },
      });

      res.write(JSON.stringify({ phase: 'done', message: 'ZIP application deployment complete & live!', deploymentId: deployment.id }) + '\n');
      res.end();
    } catch (err: any) {
      logger.error({ err, deploymentId: deployment.id }, 'ZIP upload deployment failed');
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'failed' },
      }).catch(() => {});

      res.write(JSON.stringify({ phase: 'error', message: err.message || 'ZIP deployment failed' }) + '\n');
      res.end();
    }
  }
);

/**
 * GET /api/deployments/:id/download-zip & GET /api/fs/:deploymentId/download-zip
 * Allows customers to download a clean ZIP archive of their project workspace.
 * Streams directly from the private platform shadow backup repo on GitHub using the
 * internal BACKUP_GITHUB_TOKEN, keeping the repository name and token 100% private.
 */
const downloadZipHandler = async (req: AuthedRequest, res: any) => {
  const deploymentId = req.params.id || req.params.deploymentId;
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { node: true },
  });

  if (!deployment) {
    return res.status(404).json({ error: 'Deployment instance not found' });
  }

  if (!(await canAccessResource(deployment.userId, req))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const token = env.backupGithubToken;
  const backupRepo = deployment.backupRepoFullName;

  if (token && backupRepo) {
    try {
      const githubZipUrl = `https://api.github.com/repos/${backupRepo}/zipball/main`;
      const ghRes = await fetch(githubZipUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ShanuTechX-Platform',
        },
      });

      if (ghRes.ok && ghRes.body) {
        const filename = `${deployment.subdomain || `project-${deployment.id.slice(0, 8)}`}-source.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const reader = ghRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        return res.end();
      }
    } catch (err: any) {
      logger.warn({ err, deploymentId }, 'Failed to stream zipball from GitHub shadow repo');
    }
  }

  // Fallback: If GitHub token not set or repo not synced yet, check node workspace
  return res.status(503).json({
    error: 'Project ZIP download is currently preparing or unavailable. Try editing or deploying your project to generate the initial snapshot.',
  });
};

uploadDeploymentsRouter.get('/deployments/:id/download-zip', downloadZipHandler);
uploadDeploymentsRouter.get('/fs/:deploymentId/download-zip', downloadZipHandler);

