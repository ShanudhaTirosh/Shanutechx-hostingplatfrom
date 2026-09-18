import 'dotenv/config';
import { Worker } from 'bullmq';
import {
  redisConnectionOptions,
  SSLRenewalJob,
  sslRenewalQueue,
  BillingSweepJob,
  billingSweepQueue,
  UptimeSweepJob,
  uptimeSweepQueue,
  WorkspaceCleanupJob,
  workspaceCleanupQueue,
  NodeFailoverSweepJob,
  nodeFailoverQueue,
  PushReceiptJob,
} from './lib/queue';
import { executeSSLRenewalJob } from './jobs/ssl-renewal';
import { runBillingChecks } from './lib/billing';
import { runUptimeChecks } from './lib/uptimeMonitor';
import { executeWorkspaceCleanupJob } from './jobs/workspace-cleanup';
import { checkMetricAlerts } from './lib/alerts';
import { checkNodeHealthAndFailover } from './lib/nodeMonitor';
import { executePushReceiptJob } from './jobs/push-receipt';
import { logger } from './lib/logger';


// SSL Certificate Renewal Worker
const sslRenewalWorker = new Worker<SSLRenewalJob>(
  'ssl-renewal',
  async (job) => {
    logger.info({ jobId: job.id }, 'Starting SSL renewal job execution');
    await executeSSLRenewalJob();
  },
  {
    connection: redisConnectionOptions,
    concurrency: 1,
  }
);

sslRenewalWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'SSL renewal job completed successfully');
});

sslRenewalWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'SSL renewal job failed - will retry in 24 hours');
});

logger.info('SSL renewal worker started');

(async () => {
  try {
    await sslRenewalQueue.add(
      'ssl-renewal-check',
      {},
      {
        repeat: { pattern: '0 0 * * *' },
        jobId: 'ssl-renewal-daily',
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }
    );
  } catch (error) {
    logger.error({ msg: 'Failed to schedule SSL renewal job', error: String(error) });
  }
})();

// Workspace Retention Cleanup Worker (24h retention sweep)
const workspaceCleanupWorker = new Worker<WorkspaceCleanupJob>(
  'workspace-cleanup',
  async (job) => {
    logger.info({ jobId: job.id }, 'Starting 24h workspace retention cleanup sweep');
    const result = await executeWorkspaceCleanupJob();
    logger.info({ jobId: job.id, ...result }, 'Workspace retention cleanup job completed');
  },
  { connection: redisConnectionOptions, concurrency: 1 }
);

workspaceCleanupWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Workspace cleanup job failed');
});

(async () => {
  try {
    await workspaceCleanupQueue.add(
      'workspace-cleanup-hourly',
      {},
      {
        repeat: { pattern: '0 * * * *' }, // Every hour
        jobId: 'workspace-cleanup-hourly',
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }
    );
    logger.info({ msg: 'Workspace retention cleanup job scheduled successfully', pattern: '0 * * * *' });
  } catch (error) {
    logger.error({ msg: 'Failed to schedule workspace cleanup job', error: String(error) });
  }
})();

// Billing past-due/cancel sweep worker.
const billingSweepWorker = new Worker<BillingSweepJob>(
  'billing-sweep',
  async (job) => {
    logger.info({ jobId: job.id }, 'Starting billing sweep job execution');
    const result = await runBillingChecks();
    logger.info({ jobId: job.id, ...result }, 'Billing sweep job completed');
  },
  { connection: redisConnectionOptions, concurrency: 1 }
);

billingSweepWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Billing sweep job failed - will retry');
});

(async () => {
  try {
    await billingSweepQueue.add(
      'billing-sweep-daily',
      {},
      {
        repeat: { pattern: '0 1 * * *' }, // Daily at 01:00, after SSL renewal
        jobId: 'billing-sweep-daily',
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }
    );
    logger.info({ msg: 'Billing sweep job scheduled successfully', pattern: '0 1 * * *' });
  } catch (error) {
    logger.error({
      msg: 'Failed to schedule billing sweep job',
      error: error instanceof Error ? error.message : String(error),
    });
  }
})();

// Uptime monitoring & metric alert sweep worker.
const uptimeSweepWorker = new Worker<UptimeSweepJob>(
  'uptime-sweep',
  async (job) => {
    await runUptimeChecks();
    await checkMetricAlerts();
  },
  { connection: redisConnectionOptions, concurrency: 1 }
);

uptimeSweepWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Uptime sweep job failed - will retry');
});

(async () => {
  try {
    await uptimeSweepQueue.add(
      'uptime-sweep-recurring',
      {},
      {
        repeat: { every: 5 * 60 * 1000 }, // Every 5 minutes
        jobId: 'uptime-sweep-recurring',
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }
    );
    logger.info({ msg: 'Uptime sweep job scheduled successfully', interval: '5 minutes' });
  } catch (error) {
    logger.error({
      msg: 'Failed to schedule uptime sweep job',
      error: error instanceof Error ? error.message : String(error),
    });
  }
})();

// Node health watchdog & automated failover sweep worker.
const nodeFailoverWorker = new Worker<NodeFailoverSweepJob>(
  'node-failover',
  async (job) => {
    const res = await checkNodeHealthAndFailover();
    if (res.failedOver > 0) {
      logger.info({ jobId: job.id, ...res }, 'Node health watchdog completed failover evacuation');
    }
  },
  { connection: redisConnectionOptions, concurrency: 1 }
);

nodeFailoverWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Node failover watchdog job failed');
});

const pushReceiptWorker = new Worker<PushReceiptJob>(
  'push-receipt',
  async (job) => {
    logger.info({ jobId: job.id }, 'Starting push receipt check job execution');
    const result = await executePushReceiptJob(job.data);
    logger.info({ jobId: job.id, ...result }, 'Push receipt check job completed');
  },
  { connection: redisConnectionOptions, concurrency: 2 }
);

pushReceiptWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Push receipt check job failed');
});

[sslRenewalWorker, workspaceCleanupWorker, billingSweepWorker, uptimeSweepWorker, nodeFailoverWorker, pushReceiptWorker].forEach((w) => {
  w.on('error', (err) => {
    logger.warn({ err: err.message, worker: w.name }, 'Worker Redis connection error caught');
  });
});

(async () => {
  try {
    await nodeFailoverQueue.add(
      'node-failover-watchdog-recurring',
      {},
      {
        repeat: { every: 60 * 1000 }, // Every 60 seconds
        jobId: 'node-failover-recurring',
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }
    );
    logger.info({ msg: 'Node failover watchdog scheduled successfully', interval: '1 minute' });
  } catch (error) {
    logger.error({
      msg: 'Failed to schedule node failover watchdog job',
      error: error instanceof Error ? error.message : String(error),
    });
  }
})();

async function gracefulWorkerShutdown(signal: string) {
  logger.info({ signal }, 'Worker process received termination signal. Closing workers cleanly...');
  try {
    await Promise.all([
      sslRenewalWorker.close(),
      workspaceCleanupWorker.close(),
      billingSweepWorker.close(),
      uptimeSweepWorker.close(),
      nodeFailoverWorker.close(),
      pushReceiptWorker.close(),
    ]);
    logger.info('All BullMQ workers shut down gracefully.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void gracefulWorkerShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulWorkerShutdown('SIGINT'));

