import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { subscribeToJobLogs, cancelJob } from '../lib/jobQueue';
import { useForOwnRoutes } from '../lib/routerGuard';
import { logger } from '../lib/logger';

export const jobsRouter = Router();
useForOwnRoutes(jobsRouter, requireAuth);

/**
 * GET /api/jobs
 * List jobs with role-based scoping (customers only see their own jobs; admins/devs see all).
 */
jobsRouter.get('/jobs', async (req: AuthedRequest, res: Response) => {
  const isStaff = req.user?.role === 'admin' || req.user?.role === 'dev';
  const { type, status, resourceId, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

  const where: any = {};
  if (!isStaff) {
    where.userId = req.user?.id;
  }
  if (type) where.type = type;
  if (status) where.status = status;
  if (resourceId) where.resourceId = resourceId;

  try {
    const [jobs, total] = await Promise.all([
      prisma.infrastructureJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          currentStep: true,
          error: true,
          resourceType: true,
          resourceId: true,
          nodeId: true,
          userId: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.infrastructureJob.count({ where }),
    ]);

    res.json({
      jobs,
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to list infrastructure jobs');
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

/**
 * GET /api/jobs/:id
 * Get full job details, payload, result, and structured logs.
 */
jobsRouter.get('/jobs/:id', async (req: AuthedRequest, res: Response) => {
  const isStaff = req.user?.role === 'admin' || req.user?.role === 'dev';

  try {
    const job = await prisma.infrastructureJob.findUnique({
      where: { id: req.params.id },
      include: {
        node: { select: { id: true, label: true, ip: true } },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!isStaff && job.userId && job.userId !== req.user?.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (err: any) {
    logger.error({ err: err.message, id: req.params.id }, 'Failed to fetch job');
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

/**
 * GET /api/jobs/:id/stream
 * Server-Sent Events (SSE) stream for real-time progress updates & logs.
 */
jobsRouter.get('/jobs/:id/stream', async (req: AuthedRequest, res: Response) => {
  const isStaff = req.user?.role === 'admin' || req.user?.role === 'dev';
  const jobId = req.params.id;

  try {
    const job = await prisma.infrastructureJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!isStaff && job.userId && job.userId !== req.user?.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Configure SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      logs: job.logs,
      error: job.error,
      result: job.result,
      timestamp: new Date().toISOString(),
    })}\n\n`);

    // If job already ended, close stream
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      res.end();
      return;
    }

    // Subscribe to live events
    const unsubscribe = subscribeToJobLogs(jobId, (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'cancelled') {
          res.end();
        }
      } catch {
        unsubscribe();
      }
    });

    req.on('close', () => {
      unsubscribe();
    });
  } catch (err: any) {
    logger.error({ err: err.message, jobId }, 'SSE streaming error for job');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' });
    }
  }
});

/**
 * POST /api/jobs/:id/cancel
 * Cancel a pending or running job.
 */
jobsRouter.post('/jobs/:id/cancel', async (req: AuthedRequest, res: Response) => {
  const isStaff = req.user?.role === 'admin' || req.user?.role === 'dev';
  const jobId = req.params.id;

  try {
    const job = await prisma.infrastructureJob.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isStaff && job.userId && job.userId !== req.user?.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    const cancelled = await cancelJob(jobId, 'Cancelled via API');
    res.json({ ok: true, job: cancelled });
  } catch (err: any) {
    logger.error({ err: err.message, jobId }, 'Failed to cancel job');
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

