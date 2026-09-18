import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { attachSshTerminalGateway } from './lib/sshTerminalGateway';
import { healthRouter } from './routes/health';
import { meRouter } from './routes/me';
import { authRouter } from './routes/auth';
import { nodesRouter } from './routes/nodes';
import { deploymentsRouter } from './routes/deployments';
import { ordersRouter } from './routes/orders';
import { paymentsRouter } from './routes/payments';
import { invoicesRouter } from './routes/invoices';
import { smsRouter } from './routes/sms';
import { servicesRouter } from './routes/services';
import { smtpRouter } from './routes/smtp';
import { livekitRouter } from './routes/livekit';
import { vpsRouter } from './routes/vps';
import { ticketsRouter } from './routes/tickets';
import { adminRouter } from './routes/admin';
import { cmsRouter } from './routes/cms';
import { billingRouter } from './routes/billing';
import { templatesRouter } from './routes/templates';
import { apiKeysRouter } from './routes/apiKeys';
import { webhooksRouter } from './routes/webhooks';
import { statusRouter } from './routes/status';
import { analyticsRouter } from './routes/analytics';
import { managedDatabasesRouter } from './routes/managedDatabases';
import { projectsRouter } from './routes/projects';
import { filesystemRouter } from './routes/filesystem';
import { backupRouter } from './routes/backup';
import { catalogRouter } from './routes/catalog';
import { vpsPlansRouter } from './routes/vps-plans';
import { domainsRouter } from './routes/domains';
import { discordWebhookConfigRouter } from './routes/discordWebhookConfig';
import { productsRouter } from './routes/products';
import { projectAuthRouter } from './routes/projectAuth';
import { containersRouter } from './routes/containers';
import { traefikStatusRouter } from './routes/traefikStatus';
import { metricsRouter } from './routes/metrics';
import { metricsMiddleware } from './lib/metrics';
import { deployWebhooksRouter } from './routes/deployWebhooks';
import { pushTokensRouter } from './routes/pushTokens';
import { supabaseRouter } from './routes/supabase';
import { secretsRouter } from './routes/secrets';
import { webmailRouter } from './routes/webmail';
import { webmailAuthRouter } from './routes/webmailAuth';
import { settingsRouter } from './routes/settings';
import { gitConnectRouter } from './routes/gitConnect';
import { knowledgebaseRouter } from './routes/knowledgebase';
import { emailRouter } from './routes/email';
import { teamsRouter } from './routes/teams';
import { internalBotRouter } from './routes/internalBot';
import { botAdminRouter } from './routes/botAdmin';
import { observabilityRouter } from './routes/observability';
import { reviewsRouter } from './routes/reviews';
import { ensureSeedReviews } from './routes/reviews';
import { openapiRouter } from './routes/openapi';
import { prWebhooksRouter } from './routes/prWebhooks';
import { dockerDeploymentsRouter } from './routes/dockerDeployments';
import { uploadDeploymentsRouter } from './routes/zipDeployments';
import { nodeEngineRouter } from './routes/nodeEngine';
import { setupRouter } from './routes/setup';
import { wafRouter } from './routes/waf';
import { edgeRulesRouter } from './routes/edgeRules';
import { nixpacksRouter } from './routes/nixpacks';
import { volumesRouter } from './routes/volumes';
import { notificationsRouter } from './routes/notifications';
import { initWildDuckOnBoot } from './lib/wildduckInitializer';
import { ensureDefaultProductsSeeded } from './lib/seedProducts';
import { fullFirebaseDataMigration } from './lib/firebaseSync';

import { globalLimiter } from './middleware/rateLimit';
import { csrfProtection, isOriginAllowed } from './middleware/csrfProtection';

const app = express();
app.set('trust proxy', 1);
app.set('etag', false);

// CORS: explicit allowlist.
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, server-to-server, same-origin) -- allow.
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Idempotency-Key',
      'Cache-Control',
      'Accept',
    ],
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Redact sensitive headers in request logs
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-agent-secret"]',
        'req.headers["x-internal-secret"]',
        'req.headers["x-cron-secret"]',
        'req.headers["x-webhook-secret"]',
        'req.headers["x-signature"]',
      ],
      censor: '[REDACTED]',
    },
  })
);
app.use(globalLimiter);
app.use(metricsMiddleware);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  })
);

// CSRF Protection: Validate Origin header for state-changing requests
app.use(csrfProtection);

app.use('/api', healthRouter);
app.use('/api', meRouter);
app.use('/api', authRouter);
app.use('/api', nodesRouter);
app.use('/api', deploymentsRouter);
app.use('/api', ordersRouter);
app.use('/api', paymentsRouter);
app.use('/api', invoicesRouter);
app.use('/api', smsRouter);
app.use('/api', servicesRouter);
app.use('/api', smtpRouter);
app.use('/api', livekitRouter);
app.use('/api', vpsRouter);
app.use('/api', ticketsRouter);
app.use('/api', adminRouter);
app.use('/api', cmsRouter);
app.use('/api', billingRouter);
app.use('/api', templatesRouter);
app.use('/api', apiKeysRouter);
app.use('/api', webhooksRouter);
app.use('/api', statusRouter);
app.use('/api', analyticsRouter);
app.use('/api', managedDatabasesRouter);
app.use('/api', projectsRouter);
app.use('/api', filesystemRouter);
app.use('/api', backupRouter);
app.use('/api', catalogRouter);
app.use('/api', vpsPlansRouter);
app.use('/api', domainsRouter);
app.use('/api', discordWebhookConfigRouter);
app.use('/api', productsRouter);
app.use('/api', gitConnectRouter);
app.use('/api', projectAuthRouter);
app.use('/api', containersRouter);
app.use('/api', traefikStatusRouter);
app.use(metricsRouter);
app.use('/api', deployWebhooksRouter);
app.use('/api', pushTokensRouter);
app.use('/api', supabaseRouter);
app.use('/api', secretsRouter);
app.use('/api', openapiRouter);
app.use('/api', prWebhooksRouter);
app.use('/api', dockerDeploymentsRouter);
app.use('/api', uploadDeploymentsRouter);
app.use('/api', nodeEngineRouter);
app.use('/api', setupRouter);
app.use('/api', webmailRouter);
app.use('/api', webmailAuthRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/knowledgebase', knowledgebaseRouter);
app.use('/api', emailRouter);
app.use('/api', teamsRouter);
app.use('/api', internalBotRouter);
app.use('/api', botAdminRouter);
app.use('/api', observabilityRouter);
app.use('/api', reviewsRouter);
app.use('/api', wafRouter);
app.use('/api', edgeRulesRouter);
app.use('/api', nixpacksRouter);
app.use('/api', volumesRouter);
app.use('/api', notificationsRouter);


// Catches any request that didn't match a route above. Without this,
// Express falls back to its own plain-text/HTML 404 ("Cannot GET /foo"),
// which is a jarring inconsistency for a JSON API — every other error
// response in this app is JSON, so a missing route should be too.
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler with sanitized error messages
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');

  if (res.headersSent) {
    return next(err);
  }

  let statusCode = typeof err?.statusCode === 'number' ? err.statusCode : (typeof err?.status === 'number' ? err.status : 500);
  let message = 'Internal server error';

  // Client errors (4xx) - safe to show message
  if (statusCode >= 400 && statusCode < 500) {
    message = err?.message || message;
  }

  // Sanitize Prisma errors (hide database internals)
  if (err?.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    statusCode = 400;
    switch (err.code) {
      case 'P2002': {
        const target = err.meta?.target;
        const field = Array.isArray(target) ? target[0] : (typeof target === 'string' ? target : 'field');
        message = `A record with this ${field} already exists`;
        break;
      }
      case 'P2025':
        message = 'The requested resource was not found';
        break;
      case 'P2003':
        message = 'This action cannot be completed due to related records';
        break;
      case 'P2014':
        message = 'Cannot delete this record because it has associated data';
        break;
      default:
        message = 'Database operation failed. Please try again.';
    }
  }

  // Sanitize validation errors (Zod)
  if (err?.name === 'ZodError') {
    statusCode = 400;
    message = 'Invalid request data';
  }

  res.status(statusCode).json({ error: message });
});

const server = http.createServer(app);
attachSshTerminalGateway(server);

server.listen(env.port, () => {
  logger.info({ port: env.port }, 'SHANUTECHX API listening (HTTP + /ws/vps-ssh)');
  logger.info('Initializing all-in-one platform telemetry engine: Loki Log Collector, Prometheus Metrics, and Status Health Checkers active.');
  void ensureDefaultProductsSeeded();
  void ensureSeedReviews(); // BUG-M05 FIX: seed once at startup, not on every request
  void ensureDefaultMasterNodeRegistered();
  void initWildDuckOnBoot();
  void fullFirebaseDataMigration().catch((err) => {
    logger.error({ err: err.message }, 'Initial startup Firebase data sync error');
  });
});

async function ensureDefaultMasterNodeRegistered() {
  try {
    const existing = await prisma.node.findFirst({
      where: { ip: '127.0.0.1', label: 'Local Master Compute Host' },
    });
    if (!existing) {
      await prisma.node.create({
        data: {
          label: 'Local Master Compute Host',
          ip: '127.0.0.1',
          sshKeyRef: 'vault:nodes:master-ssh-key',
          cpuCores: 8,
          ramMb: 32768,
          diskGb: 500,
          roleTags: ['web-hosting', 'node-hosting', 'python-hosting', 'vps-master'],
          monthlyBandwidthGb: 30000,
          isActive: true,
        },
      });
      logger.info('Auto-registered Host API Server as default Local Master Compute Node (30 TB VPS Quota active).');
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Master node auto-registration warning');
  }
}

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received termination signal. Closing HTTP server and database pool...');
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    logger.info('API server shut down gracefully.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection caught at process level');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception caught at process level');
});
