import crypto from 'crypto';
import net from 'net';
import { prisma } from './prisma';
import { logger } from './logger';
import { decryptSecret } from './secretsVault';
import { env } from '../env';

export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!ip) return true;
  let normalized = ip.trim().toLowerCase();

  // Handle IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (normalized.startsWith('::ffff:')) {
    const rawIp = normalized.substring(7);
    if (net.isIPv4(rawIp)) {
      normalized = rawIp;
    }
  }

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b, c, d] = parts;

    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 127) return true; // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local / Cloud Metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (Private)
    if (a === 192 && b === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (Private)
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (a >= 224) return true; // Multicast & Reserved

    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(normalized) || normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (/^fe[89ab][0-9a-f]:/i.test(normalized) || normalized.startsWith('fe80:')) return true; // Link-local fe80::/10
    if (normalized.startsWith('2001:db8:')) return true; // Documentation 2001:db8::/32

    return false;
  }

  return true;
}

export async function isSafeWebhookUrl(
  urlStr: string
): Promise<{ safe: boolean; reason?: string; resolvedIp?: string }> {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTP and HTTPS URLs are allowed' };
    }
    const hostname = url.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.includes('docker.internal')
    ) {
      return { safe: false, reason: 'Loopback and internal hostnames are prohibited' };
    }

    let resolvedIp = hostname;
    if (!net.isIP(hostname)) {
      try {
        const dns = await import('dns');
        const resolved = await dns.promises.lookup(hostname, { all: true });
        if (!resolved || resolved.length === 0) {
          return { safe: false, reason: 'Failed to resolve domain hostname' };
        }
        for (const addr of resolved) {
          if (isPrivateOrLoopbackIp(addr.address)) {
            return { safe: false, reason: `Resolved IP ${addr.address} is private/loopback` };
          }
        }
        resolvedIp = resolved[0].address;
      } catch {
        return { safe: false, reason: 'Failed to resolve domain hostname' };
      }
    }

    if (isPrivateOrLoopbackIp(resolvedIp)) {
      return { safe: false, reason: 'Private/Loopback/Link-local IP addresses are prohibited' };
    }

    return { safe: true, resolvedIp };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

type WebhookEventName =
  | 'deployment_status_changed'
  | 'payment_status_changed'
  | 'order_paid'
  | 'ticket_updated';

class WebhookRateLimiter {
  private calls: Map<string, number[]> = new Map();
  private readonly maxCallsPerMinute = 60;
  private readonly windowMs = 60 * 1000;

  isAllowed(url: string): boolean {
    const now = Date.now();
    const timestamps = this.calls.get(url) || [];
    const recentCalls = timestamps.filter((ts) => now - ts < this.windowMs);

    if (recentCalls.length >= this.maxCallsPerMinute) {
      return false;
    }

    recentCalls.push(now);
    this.calls.set(url, recentCalls);

    if (Math.random() < 0.01) {
      this.cleanup(now);
    }

    return true;
  }

  private cleanup(now: number) {
    for (const [url, timestamps] of this.calls.entries()) {
      const recent = timestamps.filter((ts) => now - ts < this.windowMs);
      if (recent.length === 0) {
        this.calls.delete(url);
      } else {
        this.calls.set(url, recent);
      }
    }
  }

  getRemainingCalls(url: string): number {
    const now = Date.now();
    const timestamps = this.calls.get(url) || [];
    const recentCalls = timestamps.filter((ts) => now - ts < this.windowMs);
    return Math.max(0, this.maxCallsPerMinute - recentCalls.length);
  }
}

const rateLimiter = new WebhookRateLimiter();

async function deliverWebhookPayload(
  initialUrl: string,
  headers: Record<string, string>,
  body: string,
  maxRedirects = 3
): Promise<{ status?: number; ok: boolean; errorMessage?: string }> {
  let currentUrl = initialUrl;

  for (let attempt = 0; attempt <= maxRedirects; attempt++) {
    const safeCheck = await isSafeWebhookUrl(currentUrl);
    if (!safeCheck.safe || !safeCheck.resolvedIp) {
      return { status: 400, ok: false, errorMessage: `Blocked unsafe webhook URL: ${safeCheck.reason}` };
    }

    const resolvedIp = safeCheck.resolvedIp;
    let agent: any = undefined;
    try {
      const undiciMod: any = (eval('require') as any)('undici');
      const AgentClass = undiciMod.Agent;
      if (AgentClass) {
        agent = new AgentClass({
          connect: {
            lookup: (_hostname: any, _opts: any, callback: any) => {
              callback(null, [{ address: resolvedIp, family: net.isIPv6(resolvedIp) ? 6 : 4 }]);
            },
          },
        });
      }
    } catch {
      // undici not bundled; fetch will proceed with standard routing
    }

    const parsedUrl = new URL(currentUrl);

    try {
      const res = await fetch(currentUrl, {
        method: 'POST',
        headers: {
          ...headers,
          Host: parsedUrl.hostname,
        },
        body,
        redirect: 'manual',
        dispatcher: agent,
        signal: AbortSignal.timeout(10_000),
      } as any);

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) {
          return { status: res.status, ok: false, errorMessage: `Redirected with HTTP ${res.status} but no Location header` };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return {
        status: res.status,
        ok: res.ok,
        errorMessage: res.ok ? undefined : `Endpoint responded with HTTP ${res.status}`,
      };
    } catch (err: any) {
      return { status: 500, ok: false, errorMessage: err.message || 'Webhook delivery request failed' };
    }
  }

  return { status: 400, ok: false, errorMessage: 'Maximum redirect limit (3) exceeded' };
}

export async function fireWebhook(
  userId: string,
  event: WebhookEventName,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({ where: { userId, event, isActive: true } });

  const results = await Promise.allSettled(
    webhooks.map(async (webhook: { id: string; url: string; secret: string }) => {
      // SSRF initial security check
      const safeCheck = await isSafeWebhookUrl(webhook.url);
      if (!safeCheck.safe) {
        const errorMessage = `Blocked unsafe webhook URL: ${safeCheck.reason}`;
        logger.warn({ webhookId: webhook.id, url: webhook.url }, errorMessage);
        await prisma.webhookDelivery.create({
          data: {
            webhookId: webhook.id,
            event,
            payload: payload as any,
            statusCode: 400,
            success: false,
            errorMessage,
          },
        });
        return;
      }

      // Rate limit check
      if (!rateLimiter.isAllowed(webhook.url)) {
        const errorMessage = 'Rate limit exceeded: max 60 calls per minute per webhook URL';
        logger.warn({ webhookId: webhook.id, url: webhook.url }, errorMessage);

        await prisma.webhookDelivery.create({
          data: {
            webhookId: webhook.id,
            event,
            payload: payload as any,
            statusCode: 429,
            success: false,
            errorMessage,
          },
        });
        return;
      }

      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const rawSecret = decryptSecret(webhook.secret, env.secretsEncryptionKey);
      const signature = crypto.createHmac('sha256', rawSecret).update(body).digest('hex');

      const delivery = await deliverWebhookPayload(
        webhook.url,
        {
          'Content-Type': 'application/json',
          'X-Shanutechx-Signature': signature,
        },
        body
      );

      if (!delivery.ok && delivery.errorMessage) {
        logger.warn({ webhookId: webhook.id, url: webhook.url, error: delivery.errorMessage }, 'Webhook delivery failed');
      }

      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: payload as any,
          statusCode: delivery.status,
          success: delivery.ok,
          errorMessage: delivery.errorMessage,
        },
      });
    })
  );

  for (const res of results) {
    if (res.status === 'rejected') {
      logger.error({ err: res.reason, event }, 'Unexpected error during webhook dispatch execution');
    }
  }
}

export { rateLimiter };
