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
 * Synthetic monitor execution runner for all running deployments and custom domains.
 * Fires notifications to Discord & user on state transition UP -> DOWN or DOWN -> UP.
 */
export async function runUptimeChecks(): Promise<{ checked: number; up: number; down: number }> {
  const deployments = await prisma.deployment.findMany({
    where: { status: 'running', isPreview: false, subdomain: { not: null } },
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

    const responseTimeMs = Date.now() - start;

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
    }

    isUp ? up++ : down++;
  }

  return { checked: deployments.length, up, down };
}
