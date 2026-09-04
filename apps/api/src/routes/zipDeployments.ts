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

    const filename = req.file.originalname;
    if (!filename.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({ error: 'Invalid file format. Uploaded file must be a .zip archive.' });
    }

    res.setHeader('Content-Type', 'application/x-ndjson');

    try {
      res.write(JSON.stringify({ phase: 'fetch', message: `Receiving source archive "${filename}" (${Math.round(req.file.size / 1024)} KB)...` }) + '\n');

      // Determine local workspace directory
      const workspacesDir = process.env.AGENT_WORKSPACES_DIR || '/var/lib/shanutechx/workspaces';
      const targetDir = path.join(workspacesDir, deployment.id);

      await fs.mkdir(targetDir, { recursive: true });

      // Save uploaded buffer to a temp zip file
      const tempZipPath = path.join(targetDir, '__upload_source.zip');
      await fs.writeFile(tempZipPath, req.file.buffer);

      res.write(JSON.stringify({ phase: 'fetch', message: 'Extracting source archive files into container workspace...' }) + '\n');

      // Extract ZIP file depending on platform (PowerShell on Windows, unzip on Linux)
      if (process.platform === 'win32') {
        const psCommand = `Expand-Archive -Path "${tempZipPath}" -DestinationPath "${targetDir}" -Force`;
        await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand]);
      } else {
        await execFileAsync('unzip', ['-o', tempZipPath, '-d', targetDir]);
      }

      // Remove temp zip file after extraction
      await fs.unlink(tempZipPath).catch(() => {});

      res.write(JSON.stringify({ phase: 'fetch', message: 'ZIP archive extracted successfully. Creating automated platform shadow Git backup repository...' }) + '\n');

      // Sync workspace to platform shadow backup repo on GitHub if token configured
      const { syncWorkspaceToShadowBackup } = await import('../lib/shadowBackup');
      void syncWorkspaceToShadowBackup(deployment.id, `Uploaded ZIP project archive "${filename}"`).catch((err) => {
        logger.warn({ err, deploymentId: deployment.id }, 'Shadow backup sync failed after ZIP extract (non-fatal)');
      });

      // Update deployment model in DB
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          sourceType: 'zip',
          zipSourceUrl: filename,
          repoUrl: `zip://${filename}`,
          status: 'building',
        } as any,
      });

      res.write(JSON.stringify({ phase: 'build', message: 'Triggering Railpack container build pipeline...' }) + '\n');

      // Trigger Railpack container build & execution on node
      const buildResult = await buildAndRun(
        deployment.node,
        {
          deploymentId: deployment.id,
          repoUrl: `zip://${filename}`,
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
