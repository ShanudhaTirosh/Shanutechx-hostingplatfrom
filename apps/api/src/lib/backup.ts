import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { spawn, exec } from 'child_process';
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

    pgDump.stdout.pipe(gzip.stdin);

    pgDump.stderr.on('data', (data) => {
      errOutput += data.toString();
    });

    gzip.stderr.on('data', (data) => {
      errOutput += data.toString();
    });

    gzip.stdout.on('data', (chunk) => {
      chunks.push(chunk as Buffer);
    });

    gzip.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`pg_dump/gzip failed with code ${code}: ${errOutput}`));
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
  const slot = getSlot();
  const key = `backups/db-${slot}.sql.gz`;

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
          slot,
          timestamp: new Date().toISOString(),
          database: dbName,
          sizeBytes: stdout.length,
          base64Data: stdout.subarray(0, 100 * 1024).toString('base64'),
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

  const byteArray = await response.Body?.transformToByteArray();
  if (!byteArray) {
    throw new Error('Failed to retrieve backup archive');
  }

  const dbUrl = new URL(env.databaseUrl);
  const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(dbUrl.password) };
  const host = dbUrl.hostname;
  const port = dbUrl.port || '5432';
  const user = decodeURIComponent(dbUrl.username);
  const dbName = dbUrl.pathname.replace(/^\//, '');

  const restoreCmd = `gunzip -c | psql -h ${host} -p ${port} -U ${user} -d ${dbName}`;

  return new Promise((resolve, reject) => {
    const child = exec(restoreCmd, { env: pgEnv }, (err) => {
      if (err) return reject(err);
      resolve({ success: true, durationMs: Date.now() - start });
    });
    if (child.stdin) {
      child.stdin.write(Buffer.from(byteArray));
      child.stdin.end();
    }
  });
}
