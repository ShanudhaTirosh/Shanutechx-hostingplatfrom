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
uploadDeploymentsRouter.post('/deployments/upload', upload.array('files', 50), async (_req: AuthedRequest, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'ZIP project upload deployment runner is not currently supported. Please connect a Git repository to deploy your application.',
  });
});
