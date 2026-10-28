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
  BackupSweepJob,
  backupSweepQueue,
  webmailSweepQueue,
  announcementSweepQueue,
  PushReceiptJob,
  WebmailSweepJob,
  AnnouncementSweepJob,
} from './lib/queue';
import { executeSSLRenewalJob } from './jobs/ssl-renewal';
import { runBillingChecks } from './lib/billing';
import { runUptimeChecks } from './lib/uptimeMonitor';
import { executeWorkspaceCleanupJob } from './jobs/workspace-cleanup';
import { checkMetricAlerts } from './lib/alerts';
import { checkNodeHealthAndFailover } from './lib/nodeMonitor';
import { executePushReceiptJob } from './jobs/push-receipt';
import { executeWebmailSweepJob } from './jobs/webmail-sweep';
import { executeAnnouncementSweepJob } from './jobs/announcement-sweep';
import { executeBackupSweepJob } from './jobs/backup-sweep';
import { logger } from './lib/logger';
import { InfrastructureJobPayload } from './lib/jobQueue';
import { processInfrastructureJob } from './jobs/infrastructure-job-processor';

// Infrastructure Operations Job Worker
export const infrastructureWorker = new Worker<InfrastructureJobPayload>(
  'infrastructure-jobs',
  async (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'Starting infrastructure job processing');
    await processInfrastructureJob(job);
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5,
  }
);

infrastructureWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Infrastructure job completed successfully');
});

infrastructureWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Infrastructure job failed');
});


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
    // S13 FIX: upsertJobScheduler is idempotent across restarts and replaces stale repeat entries.
    await sslRenewalQueue.upsertJobScheduler(
      'ssl-renewal-daily',
      { pattern: '0 0 * * *' },
      { name: 'ssl-renewal-check', data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }
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
    await workspaceCleanupQueue.upsertJobScheduler(
      'workspace-cleanup-hourly',
      { pattern: '0 * * * *' },
      { name: 'workspace-cleanup-hourly', data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }
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
    await billingSweepQueue.upsertJobScheduler(
      'billing-sweep-daily',
      { pattern: '0 1 * * *' }, // Daily at 01:00, after SSL renewal
      { name: 'billing-sweep-daily', data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }
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
    await uptimeSweepQueue.upsertJobScheduler(
      'uptime-sweep-recurring',
      { every: 5 * 60 * 1000 }, // Every 5 minutes
      { name: 'uptime-sweep-recurring', data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }
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

// Scheduled deployment backups (GitHub). Concurrency 1: backups are heavy (archive + multi-GB upload).
const backupSweepWorker = new Worker<BackupSweepJob>(
  'backup-sweep',
  async (job) => {
    const res = await executeBackupSweepJob();
    if (res.ran > 0) logger.info({ jobId: job.id, ...res }, 'Scheduled backup sweep completed');
  },
  { connection: redisConnectionOptions, concurrency: 1 }
);

backupSweepWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Scheduled backup sweep failed');
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

// Scheduled announcements (POST /internal/announcements/send with scheduledFor) were stored and never sent.
const announcementSweepWorker = new Worker<AnnouncementSweepJob>(
  'announcement-sweep',
  async () => executeAnnouncementSweepJob(),
  { connection: redisConnectionOptions, concurrency: 1 }
);

announcementSweepWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Announcement sweep job failed');
});

(async () => {
  try {
    await announcementSweepQueue.upsertJobScheduler(
      'announcement-sweep-recurring',
      { every: 60 * 1000 },
      { name: 'announcement-sweep-recurring', data: {} }
    );
    logger.info({ msg: 'Announcement sweep scheduled successfully', interval: '1 minute' });
  } catch (error) {
    logger.error({ msg: 'Failed to schedule announcement sweep job', error: error instanceof Error ? error.message : String(error) });
  }
})();

// Webmail: returns snoozed mail to the inbox and sends scheduled mail (see lib/webmailSweep.ts).
// concurrency 1 + at-most-once claiming: a message can be sent late, never twice.
const webmailSweepWorker = new Worker<WebmailSweepJob>(
  'webmail-sweep',
  async () => executeWebmailSweepJob(),
  { connection: redisConnectionOptions, concurrency: 1 }
);

webmailSweepWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Webmail sweep job failed');
});

(async () => {
  try {
    await webmailSweepQueue.upsertJobScheduler(
      'webmail-sweep-recurring',
      { every: 60 * 1000 }, // every minute: snooze and scheduled send have minute granularity
      { name: 'webmail-sweep-recurring', data: {} }
    );
    logger.info({ msg: 'Webmail sweep scheduled successfully', interval: '1 minute' });
  } catch (error) {
    logger.error({ msg: 'Failed to schedule webmail sweep job', error: error instanceof Error ? error.message : String(error) });
  }
})();

[sslRenewalWorker, workspaceCleanupWorker, billingSweepWorker, uptimeSweepWorker, nodeFailoverWorker, backupSweepWorker, pushReceiptWorker, webmailSweepWorker, announcementSweepWorker, infrastructureWorker].forEach((w) => {
  w.on('error', (err) => {
    logger.warn({ err: err.message, worker: w.name }, 'Worker Redis connection error caught');
  });
});

(async () => {
  try {
    await nodeFailoverQueue.upsertJobScheduler(
      'node-failover-recurring',
      { every: 60 * 1000 }, // Every 60 seconds
      { name: 'node-failover-watchdog-recurring', data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }
    );
    logger.info({ msg: 'Node failover watchdog scheduled successfully', interval: '1 minute' });
  } catch (error) {
    logger.error({
      msg: 'Failed to schedule node failover watchdog job',
      error: error instanceof Error ? error.message : String(error),
    });
  }
})();

(async () => {
  try {
    await backupSweepQueue.upsertJobScheduler(
      'backup-sweep-recurring',
      { every: 5 * 60 * 1000 }, // Every 5 minutes
      { name: 'backup-sweep-recurring', data: {} }
    );
    logger.info({ msg: 'Backup sweep scheduled successfully', interval: '5 minutes' });
  } catch (error) {
    logger.error({ msg: 'Failed to schedule backup sweep job', error: error instanceof Error ? error.message : String(error) });
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
      backupSweepWorker.close(),
      pushReceiptWorker.close(),
      infrastructureWorker.close(),
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

