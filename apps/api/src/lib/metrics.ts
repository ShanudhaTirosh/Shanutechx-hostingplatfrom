import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';

/**
 * Prometheus metrics for the API server, scraped by the Prometheus service
 * in infra/control-plane/docker-compose.observability.yml. Exposed at
 * GET /metrics (routes/metrics.ts) — deliberately unauthenticated, same as
 * every real-world Prometheus target, but only ever reachable by Prometheus
 * itself over the internal Docker network (never published publicly), same
 * pattern as Traefik's API in routes/traefikStatus.ts.
 *
 * Honest limitation: this has not been exercised against a live Prometheus
 * scrape in this sandbox — no Prometheus process here to confirm the scrape
 * actually succeeds end-to-end. The metric shapes below are standard
 * prom-client output, which Prometheus understands unconditionally, so the
 * scrape side should just work — what's unverified is the docker-compose
 * wiring (network reachability, port) once actually deployed.
 */

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: 'shanutechx_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: 'shanutechx_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

// Business-level gauges, refreshed on each /metrics scrape rather than
// tracked incrementally — simpler and accurate enough for a dashboard,
// avoids having to hook every create/delete call site just for a gauge.
const activeDeploymentsGauge = new client.Gauge({
  name: 'shanutechx_active_deployments',
  help: 'Number of deployments currently in the running state',
  registers: [registry],
});

const pendingPaymentsGauge = new client.Gauge({
  name: 'shanutechx_pending_payment_reviews',
  help: 'Number of payments awaiting manual admin review',
  registers: [registry],
});

const openTicketsGauge = new client.Gauge({
  name: 'shanutechx_open_tickets',
  help: 'Number of support tickets currently open',
  registers: [registry],
});

export async function refreshBusinessMetrics(): Promise<void> {
  const [deployments, payments, tickets] = await Promise.all([
    prisma.deployment.count({ where: { status: 'running' } }),
    prisma.payment.count({ where: { status: 'manual_review' } }),
    prisma.ticket.count({ where: { status: 'open' } }),
  ]);
  activeDeploymentsGauge.set(deployments);
  pendingPaymentsGauge.set(payments);
  openTicketsGauge.set(tickets);
}

/** Express middleware — records request count + duration per route/method/status. */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    // req.route.path gives the matched pattern (e.g. "/api/orders/:id"), not
    // the literal URL — keeps cardinality bounded instead of one series per
    // distinct ID ever requested.
    const route = req.route?.path ?? req.path;
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });
  next();
}
