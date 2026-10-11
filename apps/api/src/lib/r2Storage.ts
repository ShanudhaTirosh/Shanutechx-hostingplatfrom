import { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env';
import { logger } from './logger';

/**
 * Per-project object storage on Cloudflare R2 / AWS S3 / Self-Hosted MinIO.
 */

export function getCustomS3Client(options?: { endpoint?: string; accessKeyId?: string; secretAccessKey?: string; region?: string }): S3Client | null {
  const endpoint = options?.endpoint || env.r2Endpoint;
  const accessKeyId = options?.accessKeyId || env.r2AccessKeyId;
  const secretAccessKey = options?.secretAccessKey || env.r2SecretAccessKey;
  const region = options?.region || 'auto';

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // required for MinIO and self-hosted S3 endpoints
  });
}

function getR2Client(): S3Client | null {
  return getCustomS3Client();
}

function bucketNameFor(projectId: string): string {
  return `shanutechx-project-${projectId}`.toLowerCase().slice(0, 63);
}

export async function provisionProjectBucket(projectId: string): Promise<{ bucketName: string; endpoint: string }> {
  const client = getR2Client();
  if (!client) {
    throw new Error('R2 credentials not configured on the server (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT)');
  }

  const bucketName = bucketNameFor(projectId);

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
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: 'application/zip',
        })
      );
      logger.info({ deploymentId, objectKey, bucketName }, 'ZIP archive uploaded to R2 object storage successfully');
      return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucketName, Key: objectKey }), {
        expiresIn: 3600,
      });
    } catch (err) {
      logger.error({ err, deploymentId }, 'Failed to upload ZIP archive to R2 object storage');
      throw err;
    }
  }
  return null;
}


