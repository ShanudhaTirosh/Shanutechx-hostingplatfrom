import { Queue } from 'bullmq';
import { env } from '../env';
import { logger } from './logger';

// Push receipt ticket map entry
export interface PushReceiptJob {
  /** Maps Expo ticket IDs to the expoToken that produced them */
  ticketToToken: Array<{ ticketId: string; expoToken: string }>;
}

/**
 * Plain connection options for BullMQ.
 * SIDESTEP CRASHES: If Redis is offline in local dev mode, retryStrategy returns null
 * after 3 attempts to prevent infinite reconnect loops and process crashes.
 */
function parseRedisConnection(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: Number(parsed.port || 6379),
      password: parsed.password || undefined,
      retryStrategy: (times: number) => {
        if (process.env.NODE_ENV === 'test' || times > 3) {
          logger.warn('Redis unreachable after 3 attempts — running in offline mode');
          return null; // Stop retrying if Redis container is down
        }
        return Math.min(times * 500, 2000);
      },
      enableOfflineQueue: true,
      enableReadyCheck: false,
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      retryStrategy: () => null,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
    };
  }
}

export const redisConnectionOptions = parseRedisConnection(env.redisUrl);

let isRedisConnected = false;

export function isQueueSystemHealthy(): boolean {
  return isRedisConnected;
}

export interface SSLRenewalJob {
  // Data for SSL renewal check
}

export const sslRenewalQueue = new Queue<SSLRenewalJob>('ssl-renewal', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  },
});

sslRenewalQueue.on('error', (err) => {
  isRedisConnected = false;
});

export interface BillingSweepJob {}
export interface UptimeSweepJob {}
export interface WorkspaceCleanupJob {}
export interface NodeFailoverSweepJob {}
export interface BackupSweepJob {}
export interface WebmailSweepJob {}
export interface AnnouncementSweepJob {}

export const billingSweepQueue = new Queue<BillingSweepJob>('billing-sweep', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  },
});

// Sends scheduled announcements. attempts: 1 on purpose, like the webmail sweep: never retry a send.
export const announcementSweepQueue = new Queue<AnnouncementSweepJob>('announcement-sweep', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 60 * 60 * 24 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});

// Returns snoozed mail and sends scheduled mail. attempts: 1 on purpose - sending e-mail must never be
// retried by the queue (the next minute's run is the retry for anything not yet due or skipped).
export const webmailSweepQueue = new Queue<WebmailSweepJob>('webmail-sweep', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 60 * 60 * 24 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});

export const uptimeSweepQueue = new Queue<UptimeSweepJob>('uptime-sweep', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { age: 60 * 60 * 24 * 3 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});

export const workspaceCleanupQueue = new Queue<WorkspaceCleanupJob>('workspace-cleanup', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  },
});

export const nodeFailoverQueue = new Queue<NodeFailoverSweepJob>('node-failover', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { age: 60 * 60 * 24 * 3 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});

/**
 * Scheduled deployment backups (see lib/deploymentBackup.ts runDueBackups). attempts is 1 on purpose: the next
 * tick re-scans for due policies, and retrying a half-finished sweep could run the same backup twice.
 */
export const backupSweepQueue = new Queue<BackupSweepJob>('backup-sweep', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 60 * 60 * 24 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});

/**
 * Queue for deferred Expo push receipt checking.
 * Jobs are enqueued immediately after sending push tickets and processed
 * after a 30-second delay (Expo docs: receipts usually aren't ready
 * for several minutes; 30 s catches the fast failures and avoids the
 * inline 2 s anti-pattern).
 */
export const pushReceiptQueue = new Queue<PushReceiptJob>('push-receipt', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    delay: 30_000, // Wait 30 s before the worker picks this up
    removeOnComplete: { age: 60 * 60 * 24 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});

billingSweepQueue.on('error', () => {
  isRedisConnected = false;
});
uptimeSweepQueue.on('error', () => {
  isRedisConnected = false;
});
webmailSweepQueue.on('error', () => {
  isRedisConnected = false;
});
announcementSweepQueue.on('error', () => {
  isRedisConnected = false;
});
workspaceCleanupQueue.on('error', () => {
  isRedisConnected = false;
});
nodeFailoverQueue.on('error', () => {
  isRedisConnected = false;
});
pushReceiptQueue.on('error', () => {
  isRedisConnected = false;
});


// Safely attach event listeners without unhandled promise rejections.
// FIX: The 'connect'/'ready' events can fire before this IIFE runs (async race),
// leaving isRedisConnected permanently false even when Redis is healthy.
// Check the client status synchronously first before wiring event listeners.
if (process.env.NODE_ENV !== 'test') {
(async () => {
  try {
    const queueClient = await sslRenewalQueue.client.catch(() => null);
    if (queueClient) {
      // If Redis was already connected by the time this runs, set the flag now.
      if (queueClient.status === 'ready') {
        logger.info('Redis already connected at queue health listener attach time');
        isRedisConnected = true;
      }
      queueClient.on('connect', () => {
        logger.info('Redis connected for queue system');
        isRedisConnected = true;
      });
      queueClient.on('error', () => {
        isRedisConnected = false;
      });
      queueClient.on('ready', () => {
        isRedisConnected = true;
      });
      queueClient.on('close', () => {
        isRedisConnected = false;
      });
    }
  } catch {
    isRedisConnected = false;
  }
})();
}


export async function closeAllQueues(): Promise<void> {
  const allQueues = [
    sslRenewalQueue,
    billingSweepQueue,
    announcementSweepQueue,
    webmailSweepQueue,
    uptimeSweepQueue,
    workspaceCleanupQueue,
    nodeFailoverQueue,
    backupSweepQueue,
    pushReceiptQueue,
  ];
  await Promise.allSettled(allQueues.map((q) => q.close()));
}
