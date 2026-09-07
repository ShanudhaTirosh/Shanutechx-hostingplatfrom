import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { encryptSecret, decryptSecret } from './secretsVault';
import { env } from '../env';
import { logger } from './logger';

export interface WebmailClusterConfig {
  mailNodeId?: string;
  s3Endpoint?: string;
  s3BucketName?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKeyEncrypted?: string;
  autoSyncAttachments?: boolean;
}

let activeMailConfig: WebmailClusterConfig = {
  s3Endpoint: env.r2Endpoint || undefined,
  s3BucketName: env.r2BucketName || 'shanutechx-webmail-spool',
  s3Region: 'auto',
  s3AccessKeyId: env.r2AccessKeyId || undefined,
  s3SecretAccessKeyEncrypted: env.r2SecretAccessKey ? encryptSecret(env.r2SecretAccessKey, env.secretsEncryptionKey) : undefined,
  autoSyncAttachments: true,
};

export function getWebmailClusterConfig(): WebmailClusterConfig {
  return { ...activeMailConfig };
}

export function updateWebmailClusterConfig(newConfig: Partial<WebmailClusterConfig> & { s3SecretAccessKey?: string }) {
  const { s3SecretAccessKey, ...rest } = newConfig;
  activeMailConfig = {
    ...activeMailConfig,
    ...rest,
  };
  if (s3SecretAccessKey) {
    activeMailConfig.s3SecretAccessKeyEncrypted = encryptSecret(s3SecretAccessKey, env.secretsEncryptionKey);
  }
  return activeMailConfig;
}

export async function verifyS3StorageConnection(config?: {
  s3Endpoint?: string;
  s3BucketName?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
}): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const endpoint = config?.s3Endpoint || activeMailConfig.s3Endpoint || env.r2Endpoint;
  const bucket = config?.s3BucketName || activeMailConfig.s3BucketName || env.r2BucketName;
  const region = config?.s3Region || activeMailConfig.s3Region || 'auto';
  const accessKeyId = config?.s3AccessKeyId || activeMailConfig.s3AccessKeyId || env.r2AccessKeyId;
  
  let secretAccessKey = config?.s3SecretAccessKey;
  if (!secretAccessKey && activeMailConfig.s3SecretAccessKeyEncrypted) {
    try {
      secretAccessKey = decryptSecret(activeMailConfig.s3SecretAccessKeyEncrypted, env.secretsEncryptionKey);
    } catch {}
  }
  if (!secretAccessKey) secretAccessKey = env.r2SecretAccessKey;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return {
      ok: false,
      message: 'Missing S3/R2 storage credentials (Endpoint, Bucket, Access Key ID, or Secret Access Key).',
    };
  }

  const startTime = Date.now();
  try {
    const client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const testKey = `test-ping-${Date.now()}.json`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from(JSON.stringify({ ping: true, time: new Date().toISOString() })),
        ContentType: 'application/json',
      })
    );

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));

    const latencyMs = Date.now() - startTime;
    return {
      ok: true,
      message: `Successfully connected to S3/R2 Bucket "${bucket}"! Read/Write latency: ${latencyMs}ms.`,
      latencyMs,
    };
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed S3 storage handshake test');
    return {
      ok: false,
      message: `S3 connection failed: ${err.message}`,
    };
  }
}
