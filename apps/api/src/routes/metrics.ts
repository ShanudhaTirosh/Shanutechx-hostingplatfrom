import { Router } from 'express';
import { registry, refreshBusinessMetrics } from '../lib/metrics';
import { logger } from '../lib/logger';

/**
 * GET /metrics — standard Prometheus scrape endpoint. Deliberately no auth
 * middleware, matching every real-world Prometheus target; safety comes
 * from network placement (internal Docker network only), not a token.
 * See infra/control-plane/docker-compose.observability.yml for the
 * Prometheus service that scrapes this.
 */
export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req, res) => {
  try {
    await refreshBusinessMetrics();
  } catch (err) {
    // Don't fail the whole scrape just because a business-metric query
    // errored (e.g. DB hiccup) — still return the default process/http
    // metrics, which are more important for basic uptime/latency alerting.
    logger.warn({ err }, 'Failed to refresh business metrics for /metrics scrape');
  }

  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});
