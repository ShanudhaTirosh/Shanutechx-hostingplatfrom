import net from 'net';
import tls from 'tls';
import dns from 'dns';
import { prisma } from './prisma';
import { env } from '../env';
import { logger } from './logger';
import { notifyCustomer } from './notifications';
import { notifyDiscordChannel } from './discordWebhooks';

export interface SyntheticCheckOptions {
  type: 'http' | 'tcp' | 'dns' | 'ssl';
  target: string;
  port?: number;
  expectedDnsRecord?: string;
  timeoutMs?: number;
}

export interface CheckResult {
  isUp: boolean;
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  sslDaysRemaining?: number;
}

/**
 * Check TCP Port reachability
 */
export function checkTcpPort(host: string, port: number, timeoutMs = 5000): Promise<CheckResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const responseTimeMs = Date.now() - start;
      socket.destroy();
      resolve({ isUp: true, responseTimeMs });
    });

    socket.on('timeout', () => {
      const responseTimeMs = Date.now() - start;
      socket.destroy();
      resolve({ isUp: false, responseTimeMs, errorMessage: 'TCP Connection Timed Out' });
    });

    socket.on('error', (err) => {
      const responseTimeMs = Date.now() - start;
      socket.destroy();
      resolve({ isUp: false, responseTimeMs, errorMessage: err.message });
    });

    socket.connect(port, host);
  });
}

/**
 * Check SSL Certificate expiration and validity
 */
export function checkSslCertificate(hostname: string, port = 443, timeoutMs = 5000): Promise<CheckResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = tls.connect(port, hostname, { servername: hostname, timeout: timeoutMs }, () => {
      const responseTimeMs = Date.now() - start;
      const cert = socket.getPeerCertificate();
      socket.end();

      if (!cert || !cert.valid_to) {
        resolve({ isUp: false, responseTimeMs, errorMessage: 'No valid TLS certificate returned' });
        return;
      }

      const validTo = new Date(cert.valid_to);
      const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const isUp = daysRemaining > 0;

      resolve({
        isUp,
        responseTimeMs,
        sslDaysRemaining: daysRemaining,
        errorMessage: isUp ? undefined : `SSL Certificate expired ${Math.abs(daysRemaining)} days ago`,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ isUp: false, responseTimeMs: Date.now() - start, errorMessage: 'TLS Handshake Timed Out' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ isUp: false, responseTimeMs: Date.now() - start, errorMessage: err.message });
    });
  });
}

/**
 * Check DNS Record resolution
 */
export async function checkDnsResolution(hostname: string, expectedIp?: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const addresses = await dns.promises.resolve(hostname);
    const responseTimeMs = Date.now() - start;

    if (expectedIp && !addresses.includes(expectedIp)) {
      return {
        isUp: false,
        responseTimeMs,
        errorMessage: `DNS resolved to [${addresses.join(', ')}], expected ${expectedIp}`,
      };
    }

    return { isUp: addresses.length > 0, responseTimeMs };
  } catch (err: any) {
    return {
      isUp: false,
      responseTimeMs: Date.now() - start,
      errorMessage: `DNS resolution failed: ${err.message}`,
    };
  }
}

/**
 * Check Postgres Database connectivity
 */
export async function checkPostgresHealth(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTimeMs = Date.now() - start;
    return { isUp: true, responseTimeMs };
  } catch (err: any) {
    return { isUp: false, responseTimeMs: Date.now() - start, errorMessage: err.message };
  }
}

/**
 * Check HTTP endpoint reachability and latency
 */
export async function checkHttpEndpoint(url: string, timeoutMs = 8000): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    const responseTimeMs = Date.now() - start;
    return {
      isUp: res.status < 500,
      statusCode: res.status,
      responseTimeMs,
      errorMessage: res.status >= 400 ? `HTTP ${res.status}` : undefined,
    };
  } catch (err: any) {
    return { isUp: false, responseTimeMs: Date.now() - start, errorMessage: err.message || 'HTTP timeout' };
  }
}

// In-memory ring buffer of recent real probe telemetry for platform components & nodes
export interface LiveProbeTelemetry {
  targetId: string;
  isUp: boolean;
  responseTimeMs: number;
  timestamp: Date;
}

const probeTelemetryCache = new Map<string, LiveProbeTelemetry[]>();

export function recordProbeTelemetry(targetId: string, isUp: boolean, responseTimeMs: number) {
  const existing = probeTelemetryCache.get(targetId) || [];
  existing.push({
    targetId,
    isUp,
    responseTimeMs: Math.max(1, responseTimeMs),
    timestamp: new Date(),
  });
  // Keep last 30 probes
  if (existing.length > 30) {
    existing.shift();
  }
  probeTelemetryCache.set(targetId, existing);
}

export function getProbeTelemetry(targetId: string): LiveProbeTelemetry[] {
  return probeTelemetryCache.get(targetId) || [];
}

/**
 * Synthetic monitor execution runner for platform infrastructure and customer deployments.
 * Fires notifications to Discord & user on state transition UP -> DOWN or DOWN -> UP.
 */
export async function runUptimeChecks(): Promise<{ checked: number; up: number; down: number }> {
  // 1. Probe core platform services & PostgreSQL database
  const apiHealthUrl = `http://127.0.0.1:${env.port}/api/health`;
  const dbResult = await checkPostgresHealth();
  recordProbeTelemetry('core-postgres', dbResult.isUp, dbResult.responseTimeMs);

  const apiResult = await checkHttpEndpoint(apiHealthUrl, 5000);
  recordProbeTelemetry('core-api', apiResult.isUp, apiResult.responseTimeMs);

  // 2. Probe active compute nodes
  const nodes = await prisma.node.findMany({ where: { isActive: true } });
  for (const node of nodes) {
    const nodePort = env.nodeAgentPort || 4001;
    const nodeCheck = await checkTcpPort(node.ip, nodePort, 3000);
    recordProbeTelemetry(`node-${node.id}`, nodeCheck.isUp, nodeCheck.responseTimeMs);

    // Update node health timestamp
    await prisma.node.update({
      where: { id: node.id },
      data: {
        lastSeenAt: new Date(),
        isActive: nodeCheck.isUp,
      },
    }).catch(() => {});
  }

  // 3. Probe customer deployments
  const deployments = await prisma.deployment.findMany({
    where: {
      status: 'running',
      isPreview: false,
      frameworkPreset: { notIn: ['nodejs_bot', 'python_bot', 'whatsapp_baileys'] },
      subdomain: { not: null },
    },
    include: { user: true },
  });

  let up = 0;
  let down = 0;

  for (const deployment of deployments) {
    const isCustom = deployment.customDomainStatus === 'verified' && Boolean(deployment.customDomain);
    const host = isCustom ? deployment.customDomain! : `${deployment.subdomain}.${env.rootDomain}`;
    const url = `https://${host}`;

    const start = Date.now();
    let isUp = false;
    let statusCode: number | undefined;
    let errorMessage: string | undefined;

    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) });
      statusCode = res.status;
      isUp = res.status < 500;
    } catch (err) {
      errorMessage = (err as Error).message;
      logger.warn({ deploymentId: deployment.id, url, err }, 'HTTP Uptime check failed');
    }

    const responseTimeMs = Math.max(1, Date.now() - start);
    recordProbeTelemetry(`dep-${deployment.id}`, isUp, responseTimeMs);

    // Check previous check to detect downtime / recovery transition
    const lastCheck = await prisma.uptimeCheck.findFirst({
      where: { deploymentId: deployment.id },
      orderBy: { checkedAt: 'desc' },
    });

    await prisma.uptimeCheck.create({
      data: { deploymentId: deployment.id, isUp, responseTimeMs, statusCode, errorMessage },
    });

    if (lastCheck && lastCheck.isUp !== isUp) {
      const stateStr = isUp ? 'RECOVERED (UP)' : 'DOWN';
      const msg = `Alert: Deployment "${deployment.subdomain}" (${url}) is now ${stateStr}. ${errorMessage ? `Reason: ${errorMessage}` : ''}`;
      
      void notifyCustomer(deployment.user, msg);
      void notifyDiscordChannel(isUp ? 'deployment_recovered' : 'deployment_failed', {
        Deployment: deployment.id,
        Subdomain: deployment.subdomain ?? '',
        Status: stateStr,
        URL: url,
      });

      // Automatically record or resolve automated status incident
      if (!isUp && deployment.subdomain) {
        await prisma.statusIncident.create({
          data: {
            title: `Automated Detection: ${deployment.subdomain} service disruption`,
            body: `Synthetic uptime probe to ${url} failed. Response status: ${statusCode ?? 'Timeout'}. Error: ${errorMessage ?? 'Service unreachable'}.`,
            severity: 'major',
          },
        }).catch((err) => logger.warn({ err }, 'Failed to log automated status incident'));
      } else if (isUp && deployment.subdomain) {
        const openIncident = await prisma.statusIncident.findFirst({
          where: { title: { contains: deployment.subdomain }, resolvedAt: null },
        });
        if (openIncident) {
          await prisma.statusIncident.update({
            where: { id: openIncident.id },
            data: { resolvedAt: new Date() },
          }).catch((err) => logger.warn({ err }, 'Failed to resolve automated status incident'));
        }
      }
    }

    isUp ? up++ : down++;
  }

  return { checked: deployments.length, up, down };
}

