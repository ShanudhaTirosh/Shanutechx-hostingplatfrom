import { Queue } from 'bullmq';
import { EventEmitter } from 'events';
import { prisma } from './prisma';
import { logger } from './logger';
import { redisConnectionOptions } from './queue';
import { JobType, JobStatus } from '@prisma/client';

export interface InfrastructureJobPayload {
  jobId: string;
  type: JobType;
  payload: Record<string, any>;
  userId?: string;
  nodeId?: string;
  resourceType?: string;
  resourceId?: string;
}

// Global EventEmitter for real-time progress & log streaming (SSE)
export const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(500);

export const infrastructureJobQueue = new Queue<InfrastructureJobPayload>('infrastructure-jobs', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7 days retention
    removeOnFail: { age: 60 * 60 * 24 * 30 }, // 30 days retention
  },
});

infrastructureJobQueue.on('error', (err) => {
  logger.warn({ err: err.message }, 'Infrastructure job queue Redis notice');
});

/**
 * Dispatches a new asynchronous infrastructure job.
 * Creates the DB record in 'queued' state and enqueues to BullMQ.
 */
export async function dispatchJob(params: {
  type: JobType;
  payload: Record<string, any>;
  userId?: string;
  nodeId?: string;
  resourceType?: string;
  resourceId?: string;
  idempotencyKey?: string;
  timeoutSec?: number;
}) {
  // If an idempotencyKey is provided, check if job already exists
  if (params.idempotencyKey) {
    const existing = await prisma.infrastructureJob.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      if (existing.status === 'queued' || existing.status === 'running') {
        logger.info({ jobId: existing.id, key: params.idempotencyKey }, 'Reusing active idempotent job');
        return existing;
      }
    }
  }

  const job = await prisma.infrastructureJob.create({
    data: {
      type: params.type,
      status: 'queued',
      progress: 0,
      currentStep: 'Job queued for execution',
      payload: params.payload,
      idempotencyKey: params.idempotencyKey || null,
      timeoutSec: params.timeoutSec || 900,
      userId: params.userId || null,
      nodeId: params.nodeId || null,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      logs: [`[${new Date().toISOString()}] Job created in queue`],
    },
  });

  try {
    await infrastructureJobQueue.add(
      params.type,
      {
        jobId: job.id,
        type: params.type,
        payload: params.payload,
        userId: params.userId,
        nodeId: params.nodeId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      },
      {
        jobId: job.id,
      }
    );
  } catch (err: any) {
    logger.warn({ err: err.message, jobId: job.id }, 'BullMQ enqueue failed, updating job as failed');
    await prisma.infrastructureJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: `Queue service unavailable: ${err.message}`,
      },
    });
    throw err;
  }

  jobEvents.emit(`job:${job.id}`, {
    jobId: job.id,
    status: 'queued',
    progress: 0,
    currentStep: 'Job queued for execution',
    timestamp: new Date().toISOString(),
  });

  return job;
}

/**
 * Updates progress and appends structured step logs to an active job.
 */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  currentStep: string,
  logLine?: string
) {
  const timestamp = new Date().toISOString();
  const formattedLog = logLine ? `[${timestamp}] ${logLine}` : `[${timestamp}] Step: ${currentStep} (${progress}%)`;

  try {
    const updated = await prisma.infrastructureJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        progress: Math.min(100, Math.max(0, Math.round(progress))),
        currentStep,
        startedAt: new Date(),
        logs: { push: formattedLog },
      },
    });

    jobEvents.emit(`job:${jobId}`, {
      jobId,
      status: 'running',
      progress: updated.progress,
      currentStep,
      log: formattedLog,
      timestamp,
    });
  } catch (err: any) {
    logger.warn({ err: err.message, jobId }, 'Failed to persist job progress update');
  }
}

/**
 * Marks job as successfully completed.
 */
export async function completeJob(jobId: string, result?: any, finalLog?: string) {
  const timestamp = new Date().toISOString();
  const logEntry = finalLog ? `[${timestamp}] SUCCESS: ${finalLog}` : `[${timestamp}] Job completed successfully.`;

  try {
    const updated = await prisma.infrastructureJob.update({
      where: { id: jobId },
      data: {
        status: 'succeeded',
        progress: 100,
        currentStep: 'Completed',
        result: result ?? null,
        completedAt: new Date(),
        logs: { push: logEntry },
      },
    });

    jobEvents.emit(`job:${jobId}`, {
      jobId,
      status: 'succeeded',
      progress: 100,
      currentStep: 'Completed',
      result,
      log: logEntry,
      timestamp,
    });

    return updated;
  } catch (err: any) {
    logger.error({ err: err.message, jobId }, 'Failed to mark job as complete');
  }
}

/**
 * Marks job as failed with actionable error information.
 */
export async function failJob(jobId: string, error: string, logLine?: string) {
  const timestamp = new Date().toISOString();
  const logEntry = logLine ? `[${timestamp}] ERROR: ${logLine}` : `[${timestamp}] ERROR: ${error}`;

  try {
    const updated = await prisma.infrastructureJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        currentStep: 'Failed',
        error,
        completedAt: new Date(),
        logs: { push: logEntry },
      },
    });

    jobEvents.emit(`job:${jobId}`, {
      jobId,
      status: 'failed',
      currentStep: 'Failed',
      error,
      log: logEntry,
      timestamp,
    });

    return updated;
  } catch (err: any) {
    logger.error({ err: err.message, jobId }, 'Failed to mark job as failed');
  }
}

/**
 * Cancels a job if it is still queued or running.
 */
export async function cancelJob(jobId: string, reason?: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] Job cancelled${reason ? `: ${reason}` : ''}`;

  try {
    const updated = await prisma.infrastructureJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        currentStep: 'Cancelled',
        error: reason || 'Cancelled by user',
        completedAt: new Date(),
        logs: { push: logEntry },
      },
    });

    jobEvents.emit(`job:${jobId}`, {
      jobId,
      status: 'cancelled',
      currentStep: 'Cancelled',
      error: reason || 'Cancelled by user',
      log: logEntry,
      timestamp,
    });

    return updated;
  } catch (err: any) {
    logger.error({ err: err.message, jobId }, 'Failed to cancel job');
    throw err;
  }
}

/**
 * Subscribes to live SSE events for a job.
 */
export function subscribeToJobLogs(jobId: string, listener: (data: any) => void): () => void {
  const eventName = `job:${jobId}`;
  jobEvents.on(eventName, listener);
  return () => {
    jobEvents.off(eventName, listener);
  };
}

