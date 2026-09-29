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
 * POST /api/deployments/:id/upload-zip & POST /api/deployments/:id/upload-archive
 * Accepts a ZIP, RAR, 7z, TAR, or compressed archive containing project source code
 * and deploys it to the deployment container.
 */
const handleArchiveUpload = async (req: AuthedRequest, res: any) => {
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

  const file = (req.files && Array.isArray(req.files) && req.files.length > 0)
    ? req.files[0]
    : (req as any).file;

  if (!file) {
    return res.status(400).json({ error: 'No archive file uploaded. Field name can be "zipFile", "archive", or "file".' });
  }

  const filename = file.originalname.toLowerCase();
  const isZip = filename.endsWith('.zip');
  const isTar = filename.endsWith('.tar') || filename.endsWith('.tar.gz') || filename.endsWith('.tgz') || filename.endsWith('.tar.bz2') || filename.endsWith('.tbz2') || filename.endsWith('.tar.xz') || filename.endsWith('.txz');
  const isRar = filename.endsWith('.rar');
  const is7z = filename.endsWith('.7z');
  const isSingleCompressed = filename.endsWith('.gz') || filename.endsWith('.bz2') || filename.endsWith('.xz');

  if (!isZip && !isTar && !isRar && !is7z && !isSingleCompressed) {
    return res.status(400).json({
      error: 'Invalid file format. Uploaded file must be a .zip, .tar, .tar.gz, .tgz, .tar.bz2, .tar.xz, .rar, .7z, .gz, .bz2, or .xz archive.',
    });
  }

  res.setHeader('Content-Type', 'application/x-ndjson');

  try {
    res.write(JSON.stringify({ phase: 'fetch', message: `Receiving source archive "${file.originalname}" (${Math.round(file.size / 1024)} KB)...` }) + '\n');

    // Determine local workspace directory
    const workspacesDir = process.env.AGENT_WORKSPACES_DIR || '/var/lib/shanutechx/workspaces';
    const targetDir = path.join(workspacesDir, deployment.id);

    await fs.mkdir(targetDir, { recursive: true });

    const ext = path.extname(filename) || '.archive';
    const tempArchivePath = path.join(targetDir, `__upload_source${ext}`);
    await fs.writeFile(tempArchivePath, file.buffer);

    res.write(JSON.stringify({ phase: 'fetch', message: 'Extracting source archive files into container workspace...' }) + '\n');

    const execOpts = { timeout: 60000, maxBuffer: 10 * 1024 * 1024 };

    try {
      // Multi-utility extraction logic with timeout protections
      if (isZip) {
        if (process.platform === 'win32') {
          try {
            await execFileAsync('powershell', [
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              'param($src, $dst) Expand-Archive -LiteralPath $src -DestinationPath $dst -Force',
              tempArchivePath,
              targetDir,
            ], execOpts);
          } catch {
            await execFileAsync('unzip', ['-o', tempArchivePath, '-d', targetDir], execOpts).catch(() =>
              execFileAsync('7z', ['x', '-y', `-o${targetDir}`, tempArchivePath], execOpts)
            );
          }
        } else {
          try {
            await execFileAsync('unzip', ['-o', tempArchivePath, '-d', targetDir], execOpts);
          } catch {
            await execFileAsync('7z', ['x', '-y', `-o${targetDir}`, tempArchivePath], execOpts);
          }
        }
      } else if (isTar || isSingleCompressed) {
        try {
          await execFileAsync('tar', ['-xf', tempArchivePath, '-C', targetDir], execOpts);
        } catch {
          if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
            await execFileAsync('tar', ['-xzf', tempArchivePath, '-C', targetDir], execOpts);
          } else if (filename.endsWith('.tar.bz2') || filename.endsWith('.tbz2')) {
            await execFileAsync('tar', ['-xjf', tempArchivePath, '-C', targetDir], execOpts);
          } else if (filename.endsWith('.tar.xz') || filename.endsWith('.txz')) {
            await execFileAsync('tar', ['-xJf', tempArchivePath, '-C', targetDir], execOpts);
          }
        }
      } else if (isRar) {
        try {
          await execFileAsync('unrar', ['x', '-o+', tempArchivePath, targetDir + path.sep], execOpts);
        } catch {
          try {
            await execFileAsync('7z', ['x', '-y', `-o${targetDir}`, tempArchivePath], execOpts);
          } catch {
            try {
              await execFileAsync('bsdtar', ['-xf', tempArchivePath, '-C', targetDir], execOpts);
            } catch {
              await execFileAsync('unar', ['-o', targetDir, '-f', tempArchivePath], execOpts);
            }
          }
        }
      } else if (is7z) {
        try {
          await execFileAsync('7z', ['x', '-y', `-o${targetDir}`, tempArchivePath], execOpts);
        } catch {
          try {
            await execFileAsync('7za', ['x', '-y', `-o${targetDir}`, tempArchivePath], execOpts);
          } catch {
            await execFileAsync('bsdtar', ['-xf', tempArchivePath, '-C', targetDir], execOpts);
          }
        }
      } else if (isSingleCompressed) {
        try {
          if (filename.endsWith('.gz')) {
            await execFileAsync('gzip', ['-d', '-c', tempArchivePath], execOpts);
          } else if (filename.endsWith('.bz2')) {
            await execFileAsync('bzip2', ['-d', '-c', tempArchivePath], execOpts);
          } else if (filename.endsWith('.xz')) {
            await execFileAsync('xz', ['-d', '-c', tempArchivePath], execOpts);
          }
        } catch {
          // Non-fatal fallback
        }
      }
    } finally {
      // Immediately remove temporary upload file regardless of outcome
      await fs.unlink(tempArchivePath).catch(() => {});
    }

    const archiveType = isZip ? 'zip' : isRar ? 'rar' : is7z ? '7z' : 'tar';
    res.write(JSON.stringify({ phase: 'fetch', message: `${archiveType.toUpperCase()} archive extracted successfully. Creating automated GitHub shadow backup repository...` }) + '\n');

    const archiveScheme = `${archiveType}://${filename}`;

    // Sync workspace to platform private shadow backup repo on GitHub (Primary Backup Engine)
    const { syncWorkspaceToShadowBackup } = await import('../lib/shadowBackup');
    let githubBackupUrl: string | null = null;
    try {
      const synced = await syncWorkspaceToShadowBackup(deployment.id, `Uploaded ${archiveType.toUpperCase()} project archive "${filename}"`);
      if (synced) {
        githubBackupUrl = `github://backup-${deployment.id}`;
        res.write(JSON.stringify({ phase: 'fetch', message: 'Successfully backed up project workspace to private GitHub repository!' }) + '\n');
      }
    } catch (err) {
      logger.warn({ err, deploymentId: deployment.id }, `GitHub shadow backup sync failed after ${archiveType.toUpperCase()} extract (non-fatal)`);
    }

    // Update deployment model in DB
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        sourceType: archiveType,
        zipSourceUrl: githubBackupUrl || filename,
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

    res.write(JSON.stringify({ phase: 'done', message: `${archiveType.toUpperCase()} application deployment complete & live!`, deploymentId: deployment.id }) + '\n');
    res.end();
  } catch (err: any) {
    logger.error({ err, deploymentId: deployment.id }, 'Archive upload deployment failed');
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'failed' },
    }).catch(() => {});

    res.write(JSON.stringify({ phase: 'error', message: err.message || 'Archive deployment failed' }) + '\n');
    res.end();
  }
};

uploadDeploymentsRouter.post('/deployments/:id/upload-zip', upload.any(), handleArchiveUpload);
uploadDeploymentsRouter.post('/deployments/:id/upload-archive', upload.any(), handleArchiveUpload);

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
      if (res.headersSent) {
        return res.end();
      }
    }
  }

  // Fallback: If GitHub token not set or repo not synced yet, check node workspace
  return res.status(503).json({
    error: 'Project ZIP download is currently preparing or unavailable. Try editing or deploying your project to generate the initial snapshot.',
  });
};

uploadDeploymentsRouter.get('/deployments/:id/download-zip', downloadZipHandler);
uploadDeploymentsRouter.get('/fs/:deploymentId/download-zip', downloadZipHandler);

