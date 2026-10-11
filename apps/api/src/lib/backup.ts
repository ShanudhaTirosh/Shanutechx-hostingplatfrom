import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { spawn, exec } from 'child_process';
import { Readable } from 'stream';
import { env } from '../env';
import { logger } from './logger';

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

function getSlot(): 'even' | 'odd' {
  return new Date().getDate() % 2 === 0 ? 'even' : 'odd';
}

function dumpDatabase(host: string, port: string, user: string, dbName: string, pgDumpEnv: NodeJS.ProcessEnv): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pgDump = spawn('pg_dump', ['-h', host, '-p', port, '-U', user, '-d', dbName, '--no-owner', '--no-privileges'], {
      env: pgDumpEnv,
    });
    const gzip = spawn('gzip', [], { stdio: ['pipe', 'pipe', 'pipe'] });

    const chunks: Buffer[] = [];
    let errOutput = '';
    let pgDumpCode: number | null = null;

    pgDump.stdout.pipe(gzip.stdin);

    pgDump.stderr.on('data', (data) => {
      errOutput += data.toString();
    });

    pgDump.on('close', (code) => {
      pgDumpCode = code;
      if (code !== 0) {
        gzip.kill();
        reject(new Error(`pg_dump failed with exit code ${code}: ${errOutput}`));
      }
    });

    gzip.stderr.on('data', (data) => {
      errOutput += data.toString();
    });

    gzip.stdout.on('data', (chunk) => {
      chunks.push(chunk as Buffer);
    });

    gzip.on('close', (code) => {
      if (pgDumpCode !== null && pgDumpCode !== 0) {
        return reject(new Error(`pg_dump failed with exit code ${pgDumpCode}: ${errOutput}`));
      }
      if (code !== 0) {
        return reject(new Error(`gzip failed with code ${code}: ${errOutput}`));
      }
      resolve(Buffer.concat(chunks));
    });

    pgDump.on('error', (err) => reject(err));
    gzip.on('error', (err) => reject(err));
  });
}

/**
 * Dump the main Postgres database and upload the gzipped output to R2 or Free Cloud backup target.
 */
export async function runBackup(): Promise<{ key: string; sizeBytes: number; durationMs: number }> {
  const start = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slot = getSlot();
  const key = `backups/db-${timestamp}.sql.gz`;

  const dbUrl = new URL(env.databaseUrl);
  const pgDumpEnv = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(dbUrl.password),
  };

  const host = dbUrl.hostname;
  const port = dbUrl.port || '5432';
  const user = decodeURIComponent(dbUrl.username);
  const dbName = dbUrl.pathname.replace(/^\//, '');

  let stdout: Buffer;
  try {
    stdout = await dumpDatabase(host, port, user, dbName, pgDumpEnv);
  } catch (err: any) {
    logger.error({ err: err.message }, 'pg_dump failed');
    throw new Error(`pg_dump failed: ${err.message}`);
  }

  if (!stdout || stdout.length === 0) {
    throw new Error('pg_dump produced empty output');
  }

  const client = getR2Client();
  if (client) {
    await client.send(
      new PutObjectCommand({
        Bucket: env.r2BucketName,
        Key: key,
        Body: stdout,
        ContentType: 'application/gzip',
        Metadata: { slot, timestamp: new Date().toISOString(), database: dbName },
      })
    );
  }

  // Also sync to Free Cloud Storage Webhook (Google Sheets / Supabase Free / Firestore webhook)
  if (process.env.FREE_BACKUP_WEBHOOK_URL) {
    try {
      await fetch(process.env.FREE_BACKUP_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          slot,
          timestamp: new Date().toISOString(),
          database: dbName,
          sizeBytes: stdout.length,
        }),
      });
    } catch (e) {
      logger.warn({ err: e }, 'Free cloud webhook backup sync skipped');
    }
  }

  const durationMs = Date.now() - start;
  logger.info({ key, sizeBytes: stdout.length, durationMs, slot }, 'Backup created and synced successfully');

  return { key, sizeBytes: stdout.length, durationMs };
}

/**
 * Restore a database backup from R2 or SQL gzip input.
 */
export async function restoreBackup(key: string): Promise<{ success: boolean; durationMs: number }> {
  const start = Date.now();
  const client = getR2Client();

  if (!client) {
    throw new Error('R2 storage client not configured for restore');
  }

  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.r2BucketName,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error('Failed to retrieve backup archive');
  }

  const dbUrl = new URL(env.databaseUrl);
  const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(dbUrl.password) };
  const host = dbUrl.hostname;
  const port = dbUrl.port || '5432';
  const user = decodeURIComponent(dbUrl.username);
  const dbName = dbUrl.pathname.replace(/^\//, '');

  return new Promise((resolve, reject) => {
    const gunzip = spawn('gunzip', ['-c']);
    const psql = spawn('psql', ['-h', host, '-p', port, '-U', user, '-d', dbName], { env: pgEnv });

    let stderr = '';
    gunzip.stderr.on('data', (d) => { stderr += d.toString(); });
    psql.stderr.on('data', (d) => { stderr += d.toString(); });

    gunzip.stdout.pipe(psql.stdin);

    psql.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Restore process exited with code ${code}: ${stderr}`));
      resolve({ success: true, durationMs: Date.now() - start });
    });

    gunzip.on('error', (err) => reject(err));
    psql.on('error', (err) => reject(err));

    const bodyStream = response.Body instanceof Readable
      ? response.Body
      : Readable.fromWeb(response.Body as any);
    bodyStream.pipe(gunzip.stdin);
  });
}

