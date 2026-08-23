import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { pushWorkspaceToShadowRepo } from '../lib/shadowBackup';
import { env } from '../env';

import { generateSubdomain } from '../lib/subdomain';
import { selectNodeForDeployment } from '../lib/nodeSelector';

export const uploadDeploymentsRouter = Router();

uploadDeploymentsRouter.use(requireAuth);

const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per upload
});

function getR2Client(): S3Client | null {
  if (!env.r2Endpoint || !env.r2AccessKeyId || !env.r2SecretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: env.r2Endpoint,
    credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey },
  });
}

/**
 * POST /api/deployments/upload
 * Multi-file, directory folder, and zip project deployment upload.
 */
uploadDeploymentsRouter.post('/deployments/upload', upload.array('files', 50), async (req: AuthedRequest, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded. Please upload a zip archive or project files.' });
  }

  const preferredName = req.body.preferredName || `upload-app-${Date.now()}`;
  const subdomain = await generateSubdomain(preferredName);

  try {
    const node = await selectNodeForDeployment({ requiredTag: 'web-hosting' });

    // Key storage path
    const storageKey = `source-uploads/${req.user!.id}/${subdomain}-${Date.now()}.zip`;
    const client = getR2Client();

    if (!client) {
      return res.status(503).json({ error: 'R2 object storage client is not configured on this server' });
    }

    // For single zip file uploads, upload directly. For multi-file uploads, upload all files.
    if (files.length === 1 && files[0]?.buffer) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.r2BucketName,
          Key: storageKey,
          Body: files[0].buffer,
          ContentType: files[0].mimetype || 'application/zip',
        })
      );
    } else {
      // Multi-file directory upload: upload each file under the folder key prefix
      await Promise.all(
        files.map((file, idx) => {
          const filePath = file.originalname || `file-${idx}`;
          const itemKey = `source-uploads/${req.user!.id}/${subdomain}-${Date.now()}/${filePath}`;
          return client.send(
            new PutObjectCommand({
              Bucket: env.r2BucketName,
              Key: itemKey,
              Body: file.buffer,
              ContentType: file.mimetype || 'application/octet-stream',
            })
          );
        })
      );
    }

    const deployment = await prisma.deployment.create({
      data: {
        userId: req.user!.id,
        subdomain,
        repoUrl: `zip://${storageKey}`,
        branch: 'main',
        nodeId: node.id,
      },
    });

    // Trigger shadow backup push for non-Git deployment in background
    void pushWorkspaceToShadowRepo(deployment.id);

    logger.info({ deploymentId: deployment.id, filesCount: files.length }, 'Created upload deployment');
    res.status(201).json({ ok: true, deployment, uploadedFiles: files.length });
  } catch (err: any) {
    logger.error({ err }, 'Failed to upload deployment files');
    res.status(500).json({ error: err.message || 'Failed to process file upload deployment' });
  }
});
