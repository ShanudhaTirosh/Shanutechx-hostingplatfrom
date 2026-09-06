import { Queue } from 'bullmq';
import { env } from '../env';
import { logger } from './logger';

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
        if (times > 3) {
          logger.warn('Redis unreachable after 3 attempts — running in offline mode');
          return null; // Stop retrying if Redis container is down
        }
        return Math.min(times * 500, 2000);
      },
      enableOfflineQueue: false,
      enableReadyCheck: false,
      connectTimeout: 3000,
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

export const billingSweepQueue = new Queue<BillingSweepJob>('billing-sweep', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
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

billingSweepQueue.on('error', () => {
  isRedisConnected = false;
});
uptimeSweepQueue.on('error', () => {
  isRedisConnected = false;
});
workspaceCleanupQueue.on('error', () => {
  isRedisConnected = false;
});
nodeFailoverQueue.on('error', () => {
  isRedisConnected = false;
});


// Safely attach event listeners without unhandled promise rejections
(async () => {
  try {
    const queueClient = await sslRenewalQueue.client.catch(() => null);
    if (queueClient) {
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
