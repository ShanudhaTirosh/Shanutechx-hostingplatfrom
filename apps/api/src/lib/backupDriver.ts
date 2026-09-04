import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { env } from '../env';
import { logger } from './logger';
import { execVpsSsh, sftpUploadFile, sftpDownloadFile, sftpDeleteFile, sftpListFiles } from './vpsSshClient';

export interface BackupArtifact {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: Date;
  storageDriver: 'r2' | 'vps_node';
  targetPathOrKey: string;
}

export interface BackupDriver {
  uploadBackup(key: string, data: Buffer): Promise<{ driver: 'r2' | 'vps_node'; pathOrKey: string }>;
  downloadBackup(pathOrKey: string): Promise<Buffer>;
  deleteBackup(pathOrKey: string): Promise<void>;
  listBackups(prefix?: string): Promise<{ name: string; sizeBytes: number; modifyTime: Date }[]>;
}

/**
 * Cloudflare R2 / S3 Object Storage Backup Driver implementation
 */
export class R2BackupDriver implements BackupDriver {
  private getClient(): S3Client {
    if (!env.r2Endpoint || !env.r2AccessKeyId || !env.r2SecretAccessKey) {
      throw new Error('R2 credentials not configured on the server');
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

  private get bucket(): string {
    return env.r2BucketName || 'shanutechx-backups';
  }

  async uploadBackup(key: string, data: Buffer): Promise<{ driver: 'r2'; pathOrKey: string }> {
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
      })
    );
    logger.info({ key, size: data.length, bucket: this.bucket }, 'Backup uploaded to Cloudflare R2 driver');
    return { driver: 'r2', pathOrKey: key };
  }

  async downloadBackup(pathOrKey: string): Promise<Buffer> {
    const client = this.getClient();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: pathOrKey,
      })
    );
    const byteArray = await res.Body?.transformToByteArray();
    if (!byteArray) throw new Error('Empty response body from R2 download');
    return Buffer.from(byteArray);
  }

  async deleteBackup(pathOrKey: string): Promise<void> {
    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: pathOrKey,
      })
    );
    logger.info({ pathOrKey, bucket: this.bucket }, 'Backup deleted from Cloudflare R2 driver');
  }

  async listBackups(prefix = ''): Promise<{ name: string; sizeBytes: number; modifyTime: Date }[]> {
    const client = this.getClient();
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      })
    );
    return (res.Contents || []).map((obj) => ({
      name: obj.Key || '',
      sizeBytes: obj.Size || 0,
      modifyTime: obj.LastModified || new Date(),
    }));
  }
}

/**
 * Dedicated VPS Backup Node Driver implementation
 */
export class VpsBackupDriver implements BackupDriver {
  constructor(private vpsTarget: { ip: string; sshPort: number; username: string; credentialRef: string; backupDir?: string }) {}

  private get provisionObj(): any {
    return {
      id: 'vps-backup-target',
      userId: 'system',
      createdAt: new Date(),
      orderItemId: '',
      provider: 'custom',
      externalId: null,
      panelUrl: null,
      ip: this.vpsTarget.ip,
      sshPort: this.vpsTarget.sshPort,
      username: this.vpsTarget.username,
      credentialRef: this.vpsTarget.credentialRef,
      status: 'provisioned',
      provisionedAt: new Date(),
      leasewebVpsId: null,
    };
  }

  private get remoteDir(): string {
    return this.vpsTarget.backupDir || '/var/backups/shanutechx';
  }

  async uploadBackup(key: string, data: Buffer): Promise<{ driver: 'vps_node'; pathOrKey: string }> {
    const remotePath = `${this.remoteDir}/${key}`.replace(/\/+/g, '/');
    // Ensure backup directory exists on target node
    await execVpsSsh(this.provisionObj, `mkdir -p ${this.remoteDir}`);
    await sftpUploadFile(this.provisionObj, remotePath, data);
    logger.info({ key, remotePath, host: this.vpsTarget.ip }, 'Backup uploaded to Dedicated VPS Backup Node driver');
    return { driver: 'vps_node', pathOrKey: remotePath };
  }

  async downloadBackup(pathOrKey: string): Promise<Buffer> {
    return sftpDownloadFile(this.provisionObj, pathOrKey);
  }

  async deleteBackup(pathOrKey: string): Promise<void> {
    await sftpDeleteFile(this.provisionObj, pathOrKey, false);
    logger.info({ pathOrKey, host: this.vpsTarget.ip }, 'Backup deleted from Dedicated VPS Backup Node driver');
  }

  async listBackups(prefix = ''): Promise<{ name: string; sizeBytes: number; modifyTime: Date }[]> {
    const files = await sftpListFiles(this.provisionObj, this.remoteDir);
    return files
      .filter((f) => !f.isDirectory && f.name.startsWith(prefix))
      .map((f) => ({
        name: f.name,
        sizeBytes: f.size,
        modifyTime: new Date(f.modifyTime * 1000),
      }));
  }
}

/**
 * BackupDriver Factory
 * Returns configured driver based on requested storage target or env defaults.
 */
export function getBackupDriver(driverType?: 'r2' | 'vps_node', vpsConfig?: any): BackupDriver {
  if (driverType === 'vps_node' && vpsConfig) {
    return new VpsBackupDriver(vpsConfig);
  }
  return new R2BackupDriver();
}
