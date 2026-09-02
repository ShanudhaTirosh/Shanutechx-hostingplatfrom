import { Client as SshClient, ConnectConfig } from 'ssh2';
import { VpsProvision } from '@prisma/client';
import { decryptSecret } from './secretsVault';
import { env } from '../env';
import { logger } from './logger';

export interface VpsStats {
  uptime: string;
  cpuCores: number;
  ramTotalMb: number;
  ramUsedMb: number;
  diskTotalGb: number;
  diskUsedGb: number;
}

export interface SftpItem {
  name: string;
  size: number;
  isDirectory: boolean;
  modifyTime: number;
  permissions: number;
}

/**
 * Resolves SSH connection options for a direct/manual VpsProvision.
 */
export function getVpsSshConfig(provision: VpsProvision): ConnectConfig {
  const ip = provision.ip || provision.externalId;
  if (!ip) {
    throw new Error('VPS does not have an IP address configured');
  }

  const username = provision.username || 'root';
  const port = provision.sshPort || 22;

  let password: string | undefined;
  let privateKey: string | undefined;

  if (provision.credentialRef) {
    const decrypted = decryptSecret(provision.credentialRef, env.secretsEncryptionKey);
    if (decrypted.startsWith('-----BEGIN') || decrypted.includes('PRIVATE KEY')) {
      privateKey = decrypted;
    } else {
      password = decrypted;
    }
  }

  return {
    host: ip,
    port,
    username,
    readyTimeout: 15_000,
    keepaliveInterval: 10_000,
    ...(privateKey ? { privateKey } : {}),
    ...(password && !privateKey ? { password } : {}),
  };
}

/**
 * Opens a connected SSH2 Client instance to the target VPS.
 */
export function connectVpsSsh(provision: VpsProvision): Promise<SshClient> {
  const config = getVpsSshConfig(provision);
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(new Error(`SSH connection failed (${config.host}:${config.port}): ${err.message}`)));
    conn.connect(config);
  });
}

/**
 * Executes a single command on the VPS over SSH and returns output.
 */
export async function execVpsSsh(
  provision: VpsProvision,
  command: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const conn = await connectVpsSsh(provision);
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    conn.exec(command, (err, stream) => {
      if (err) {
        conn.end();
        return reject(err);
      }
      stream.on('data', (d: Buffer) => { stdout += d.toString(); });
      stream.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      stream.on('close', (code: number) => {
        conn.end();
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  });
}

/**
 * Collects live system stats (uptime, CPU, RAM, Disk) directly over SSH.
 */
export async function getVpsSystemStats(provision: VpsProvision): Promise<VpsStats> {
  const cmd = [
    'uptime 2>/dev/null || echo "Uptime unavailable"',
    'nproc 2>/dev/null || echo 1',
    "free -m 2>/dev/null | awk '/^Mem:/{print $2\" \"$3}' || echo '0 0'",
    "df -m / 2>/dev/null | awk 'NR==2{print $2\" \"$3}' || echo '0 0'",
  ].join(' && echo "---" && ');

  const res = await execVpsSsh(provision, cmd);
  const sections = res.stdout.split('---').map((s) => s.trim());

  const uptime = sections[0] || 'Unknown';
  const cpuCores = parseInt(sections[1] || '1', 10) || 1;

  const ramParts = (sections[2] || '0 0').split(/\s+/);
  const ramTotalMb = parseInt(ramParts[0] || '0', 10);
  const ramUsedMb = parseInt(ramParts[1] || '0', 10);

  const diskParts = (sections[3] || '0 0').split(/\s+/);
  const diskTotalMb = parseInt(diskParts[0] || '0', 10);
  const diskUsedMb = parseInt(diskParts[1] || '0', 10);

  return {
    uptime,
    cpuCores,
    ramTotalMb,
    ramUsedMb,
    diskTotalGb: Math.round(diskTotalMb / 1024),
    diskUsedGb: Math.round(diskUsedMb / 1024),
  };
}

/**
 * Issues a reboot command to the target VPS over SSH.
 */
export async function rebootVpsSsh(provision: VpsProvision): Promise<{ success: boolean; message: string }> {
  try {
    // Non-blocking reboot invocation
    void execVpsSsh(provision, 'sudo /sbin/reboot || /sbin/reboot || sudo shutdown -r now || shutdown -r now').catch((err) => {
      logger.info({ err, vpsId: provision.id }, 'Reboot triggered via SSH (connection closed as expected)');
    });
    return { success: true, message: 'Reboot signal issued successfully over SSH.' };
  } catch (err: any) {
    throw new Error(`Failed to issue reboot over SSH: ${err.message}`);
  }
}

/**
 * Changes the login user password directly on the VPS over SSH.
 */
export async function changeVpsPasswordSsh(provision: VpsProvision, newPassword: string): Promise<{ success: boolean }> {
  const username = provision.username || 'root';
  // Escaped password for chpasswd stdin
  const escapedPassword = newPassword.replace(/'/g, "'\\''");
  const cmd = `echo '${username}:${escapedPassword}' | sudo chpasswd || echo '${username}:${escapedPassword}' | chpasswd`;

  const res = await execVpsSsh(provision, cmd);
  if (res.code !== 0 && res.stderr.toLowerCase().includes('error')) {
    throw new Error(`Remote password update failed: ${res.stderr || 'chpasswd exit error'}`);
  }
  return { success: true };
}

/**
 * SFTP Directory listing.
 */
export async function sftpListFiles(provision: VpsProvision, remotePath: string = '/root'): Promise<SftpItem[]> {
  const conn = await connectVpsSsh(provision);
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return reject(err);
      }
      sftp.readdir(remotePath, (readErr: any, list: any[]) => {
        conn.end();
        if (readErr) return reject(readErr);
        const items: SftpItem[] = list.map((entry) => ({
          name: entry.filename,
          size: entry.attrs.size,
          isDirectory: (entry.attrs.mode & 0o040000) === 0o040000,
          modifyTime: entry.attrs.mtime,
          permissions: entry.attrs.mode,
        }));
        resolve(items);
      });
    });
  });
}

/**
 * SFTP File Download.
 */
export async function sftpDownloadFile(provision: VpsProvision, remotePath: string): Promise<Buffer> {
  const conn = await connectVpsSsh(provision);
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return reject(err);
      }
      const chunks: Buffer[] = [];
      const readStream = sftp.createReadStream(remotePath);
      readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      readStream.on('error', (readErr: any) => {
        conn.end();
        reject(readErr);
      });
      readStream.on('end', () => {
        conn.end();
        resolve(Buffer.concat(chunks));
      });
    });
  });
}

/**
 * SFTP File Upload.
 */
export async function sftpUploadFile(provision: VpsProvision, remotePath: string, fileBuffer: Buffer): Promise<void> {
  const conn = await connectVpsSsh(provision);
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return reject(err);
      }
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on('error', (writeErr: any) => {
        conn.end();
        reject(writeErr);
      });
      writeStream.on('finish', () => {
        conn.end();
        resolve();
      });
      writeStream.end(fileBuffer);
    });
  });
}

/**
 * SFTP File / Directory Deletion.
 */
export async function sftpDeleteFile(provision: VpsProvision, remotePath: string, isDirectory = false): Promise<void> {
  const conn = await connectVpsSsh(provision);
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return reject(err);
      }
      if (isDirectory) {
        sftp.rmdir(remotePath, (rmErr: any) => {
          conn.end();
          if (rmErr) return reject(rmErr);
          resolve();
        });
      } else {
        sftp.unlink(remotePath, (unErr: any) => {
          conn.end();
          if (unErr) return reject(unErr);
          resolve();
        });
      }
    });
  });
}

/**
 * Unzips / extracts an archive (zip, tar, tar.gz, tgz, gz) remotely on the VPS.
 */
export async function extractArchiveSsh(
  provision: VpsProvision,
  archivePath: string,
  targetDirectory?: string
): Promise<{ success: boolean; message: string }> {
  const dir = targetDirectory || archivePath.substring(0, archivePath.lastIndexOf('/')) || '/root';
  const ext = archivePath.toLowerCase();

  let cmd = '';
  if (ext.endsWith('.zip')) {
    cmd = `cd '${dir}' && (unzip -o '${archivePath}' || busybox unzip -o '${archivePath}' || python3 -m zipfile -e '${archivePath}' .)`;
  } else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
    cmd = `cd '${dir}' && tar -xzf '${archivePath}'`;
  } else if (ext.endsWith('.tar')) {
    cmd = `cd '${dir}' && tar -xf '${archivePath}'`;
  } else if (ext.endsWith('.gz')) {
    cmd = `cd '${dir}' && gunzip -k '${archivePath}'`;
  } else {
    throw new Error('Unsupported archive format. Supported formats: .zip, .tar, .tar.gz, .tgz, .gz');
  }

  const res = await execVpsSsh(provision, cmd);
  if (res.code !== 0 && res.stderr.toLowerCase().includes('error')) {
    throw new Error(`Extraction failed: ${res.stderr || res.stdout || 'Archive command error'}`);
  }
  return { success: true, message: `Archive extracted into ${dir}` };
}

/**
 * Renames / moves a file or directory remotely over SSH.
 */
export async function renamePathSsh(
  provision: VpsProvision,
  oldPath: string,
  newPath: string
): Promise<{ success: boolean }> {
  const cmd = `mv '${oldPath.replace(/'/g, "'\\''")}' '${newPath.replace(/'/g, "'\\''")}'`;
  const res = await execVpsSsh(provision, cmd);
  if (res.code !== 0) {
    throw new Error(`Rename failed: ${res.stderr || 'mv command error'}`);
  }
  return { success: true };
}

/**
 * Creates a new directory remotely over SSH.
 */
export async function mkdirSsh(
  provision: VpsProvision,
  dirPath: string
): Promise<{ success: boolean }> {
  const cmd = `mkdir -p '${dirPath.replace(/'/g, "'\\''")}'`;
  const res = await execVpsSsh(provision, cmd);
  if (res.code !== 0) {
    throw new Error(`Directory creation failed: ${res.stderr || 'mkdir command error'}`);
  }
  return { success: true };
}

/**
 * Creates a new empty file remotely over SSH.
 */
export async function touchFileSsh(
  provision: VpsProvision,
  filePath: string
): Promise<{ success: boolean }> {
  const cmd = `touch '${filePath.replace(/'/g, "'\\''")}'`;
  const res = await execVpsSsh(provision, cmd);
  if (res.code !== 0) {
    throw new Error(`File creation failed: ${res.stderr || 'touch command error'}`);
  }
  return { success: true };
}
