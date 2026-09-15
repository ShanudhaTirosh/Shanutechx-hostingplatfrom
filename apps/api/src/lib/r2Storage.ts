import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from '../env';
import { logger } from './logger';

/**
 * Per-project object storage on Cloudflare R2. Confirmed against Cloudflare's
 * own docs (developers.cloudflare.com/r2/reference/data-location/) that R2's
 * S3-compatible API supports CreateBucketCommand via @aws-sdk/client-s3,
 * same package already used for platform DB backups in lib/backup.ts.
 *
 * Honest limitation: this reuses the platform's single, shared R2 access
 * key (env.r2AccessKeyId/r2SecretAccessKey) scoped to a bucket name per
 * project — it does NOT create a separate, bucket-scoped API token per
 * project. Cloudflare does support scoped tokens, but that's a different,
 * account-level Cloudflare API (not the S3-compatible one), and wiring that
 * up is future work, not something to fake here. In practice this means:
 * any code holding the platform's R2 credentials could reach any project's
 * bucket, not just its own — acceptable for now since only the Node Agent
 * and API server hold these credentials, not customers directly, but worth
 * revisiting before this is a customer self-service feature rather than a
 * dev-only one.
 */

function getR2Client(): S3Client | null {
  if (!env.r2Endpoint || !env.r2AccessKeyId || !env.r2SecretAccessKey) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: env.r2Endpoint,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });
}

function bucketNameFor(projectId: string): string {
  // R2/S3 bucket names: lowercase, hyphens only, 3-63 chars.
  return `shanutechx-project-${projectId}`.toLowerCase().slice(0, 63);
}

export async function provisionProjectBucket(projectId: string): Promise<{ bucketName: string; endpoint: string }> {
  const client = getR2Client();
  if (!client) {
    throw new Error('R2 credentials not configured on the server (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT)');
  }

  const bucketName = bucketNameFor(projectId);

  // Idempotent: if it already exists (e.g. a retry after a partial
  // failure), don't error — just confirm and move on.
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    logger.info({ bucketName }, 'R2 bucket already exists for project, reusing');
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    logger.info({ bucketName }, 'R2 bucket created for project');
  }

  return { bucketName, endpoint: env.r2Endpoint };
}

export async function uploadDeploymentZip(deploymentId: string, buffer: Buffer, filename: string): Promise<string | null> {
  const client = getR2Client();
  const bucketName = env.r2BucketName || 'shanutechx-deployments';
  const objectKey = `zips/${deploymentId}/${Date.now()}-${filename}`;

  if (client) {
    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: 'application/zip',
        })
      );
      logger.info({ deploymentId, objectKey, bucketName }, 'ZIP archive uploaded to R2 object storage successfully');
      return `${env.r2Endpoint}/${bucketName}/${objectKey}`;
    } catch (err) {
      logger.error({ err, deploymentId }, 'Failed to upload ZIP archive to R2 object storage');
      throw err;
    }
  }
  return null;
}

