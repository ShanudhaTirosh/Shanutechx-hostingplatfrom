import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { env } from '../env';

/**
 * Downloading a deployment's source as a ZIP. Deploying FROM an uploaded archive was removed (git and Docker-image
 * deploys remain); this only reads from the platform's private shadow-backup repo on GitHub.
 */
export const downloadZipRouter = Router();

downloadZipRouter.use(requireAuth);

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

downloadZipRouter.get('/deployments/:id/download-zip', downloadZipHandler);
downloadZipRouter.get('/fs/:deploymentId/download-zip', downloadZipHandler);
