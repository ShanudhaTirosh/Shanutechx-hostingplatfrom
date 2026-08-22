import { Router } from 'express';
import Redis from 'ioredis';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { isQueueSystemHealthy } from '../lib/queue';

export const healthRouter = Router();

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }
  return redisClient;
}

/**
 * Two tiers:
 *   GET /api/health       liveness — is the process up? Used by Docker
 *                         HEALTHCHECK to know if it should restart the
 *                         container. No dependencies checked.
 *   GET /api/health/deep  readiness — are Postgres and Redis actually
 *                         reachable right now? Used by an uptime monitor
 *                         or deploy pipeline before switching traffic to a
 *                         newly-started container. Returns 503 if unhealthy.
 */
healthRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'shanutechx-api', ts: new Date().toISOString() });
});

healthRouter.get('/health/deep', async (_req, res) => {
  const checks: Record<string, boolean | string> = {};
  let allOk = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = true;
  } catch (err) {
    checks.postgres = (err as Error).message;
    allOk = false;
  }

  try {
    const pong = await getRedis().ping();
    checks.redis = pong === 'PONG';
    if (!checks.redis) allOk = false;
  } catch (err) {
    checks.redis = (err as Error).message;
    allOk = false;
  }

  // Check BullMQ queue system health
  checks.queueSystem = isQueueSystemHealthy();
  if (!checks.queueSystem) {
    // Queue system down doesn't fail health check, but report degraded state
    checks.status = 'degraded - background jobs unavailable';
  }

  res
    .status(allOk ? 200 : 503)
    .json({ ok: allOk, service: 'shanutechx-api', ts: new Date().toISOString(), checks });
});
