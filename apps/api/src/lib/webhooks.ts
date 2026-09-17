import crypto from 'crypto';
import net from 'net';
import { prisma } from './prisma';
import { logger } from './logger';
import { decryptSecret } from './secretsVault';
import { env } from '../env';

export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0' || ip === '::') return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('169.254.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  return false;
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
        const resolved = await dns.promises.lookup(hostname);
        resolvedIp = resolved.address;
      } catch {
        return { safe: false, reason: 'Failed to resolve domain hostname' };
      }
    }

    if (isPrivateOrLoopbackIp(resolvedIp)) {
      return { safe: false, reason: 'Private/Loopback/Link-local IP addresses are prohibited' };
    }

    // Return the resolved IP so the caller can pin the connection to it,
    // closing the DNS-rebinding TOCTOU window between check and connect.
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

/**
 * Rate limiter for outbound webhook calls to prevent overwhelming customer endpoints.
 * Uses sliding window: max 60 calls per minute per webhook URL.
 */
class WebhookRateLimiter {
  private calls: Map<string, number[]> = new Map(); // URL -> timestamps
  private readonly maxCallsPerMinute = 60;
  private readonly windowMs = 60 * 1000; // 1 minute

  /**
   * Check if a webhook call is allowed. Returns true if under rate limit.
   */
  isAllowed(url: string): boolean {
    const now = Date.now();
    const timestamps = this.calls.get(url) || [];
    
    // Remove timestamps older than the window
    const recentCalls = timestamps.filter((ts) => now - ts < this.windowMs);
    
    if (recentCalls.length >= this.maxCallsPerMinute) {
      return false;
    }
    
    // Add current timestamp
    recentCalls.push(now);
    this.calls.set(url, recentCalls);
    
    // Cleanup old entries periodically (every 100 calls)
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

  /**
   * Get remaining calls in current window for monitoring/debugging.
   */
  getRemainingCalls(url: string): number {
    const now = Date.now();
    const timestamps = this.calls.get(url) || [];
    const recentCalls = timestamps.filter((ts) => now - ts < this.windowMs);
    return Math.max(0, this.maxCallsPerMinute - recentCalls.length);
  }
}

const rateLimiter = new WebhookRateLimiter();

/**
 * Fires every active webhook a customer has configured for this event.
 * Payload is HMAC-SHA256 signed (same scheme used elsewhere in this
 * codebase — see lib/smsSignature.ts) with the webhook's own secret, sent
 * as an X-Shanutechx-Signature header, so the customer's endpoint can
 * verify the request actually came from us and wasn't tampered with.
 *
 * ⚠️ REPLAY PROTECTION: Customers should validate the timestamp field
 * in the webhook payload and reject webhooks older than 5-10 minutes
 * to prevent replay attacks. While HMAC signatures prevent tampering,
 * an intercepted webhook could be replayed indefinitely without timestamp validation.
 *
 * Example customer verification code (Python):
 * ```python
 * import hmac, hashlib, json
 * from datetime import datetime, timedelta
 * 
 * def verify_webhook(request, secret):
 *     # Verify signature
 *     signature = request.headers.get('X-Shanutechx-Signature')
 *     body = request.get_data(as_text=True)
 *     computed = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
 *     if not hmac.compare_digest(signature, computed):
 *         return False
 *     
 *     # Verify timestamp (prevent replay attacks)
 *     payload = json.loads(body)
 *     timestamp = datetime.fromisoformat(payload['timestamp'])
 *     if abs((datetime.utcnow() - timestamp).total_seconds()) > 300:  # 5 min window
 *         return False
 *     
 *     return True
 * ```
 *
 * Failures are logged to WebhookDelivery and never thrown — a customer's
 * broken endpoint should never affect the actual business action
 * (deployment status change, payment approval, etc.) that triggered this.
 * 
 * Rate Limited: Maximum 60 calls per minute per webhook URL to prevent
 * overwhelming customer endpoints or causing DDoS concerns.
 */
export async function fireWebhook(
  userId: string,
  event: WebhookEventName,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({ where: { userId, event, isActive: true } });

  await Promise.all(
    webhooks.map(async (webhook: { id: string; url: string; secret: string }) => {
      // SSRF security check
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

      let statusCode: number | undefined;
      let success = false;
      let errorMessage: string | undefined;

      try {
        // DNS-rebinding mitigation: connect directly to the IP address that was
        // verified by isSafeWebhookUrl above, rather than calling fetch(webhook.url)
        // and letting Node re-resolve the hostname. Between our safety check and a
        // plain fetch() call, an attacker-controlled DNS TTL can expire and the
        // record can be swapped to 127.0.0.1, bypassing our SSRF protection.
        //
        // We build a pinned URL using the resolved IP (preserving the original port
        // and path), then pass the original hostname in the Host header so TLS SNI
        // and virtual hosting still work correctly.
        const parsedUrl = new URL(webhook.url);
        const resolvedIp = safeCheck.resolvedIp!;
        const isIPv6 = resolvedIp.includes(':');
        const pinnedHost = isIPv6 ? `[${resolvedIp}]` : resolvedIp;
        const port = parsedUrl.port ? `:${parsedUrl.port}` : '';
        const pinnedUrl = `${parsedUrl.protocol}//${pinnedHost}${port}${parsedUrl.pathname}${parsedUrl.search}`;

        const res = await fetch(pinnedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shanutechx-Signature': signature,
            // Provide the original hostname so the server can route correctly.
            Host: parsedUrl.hostname,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        statusCode = res.status;
        success = res.ok;
        if (!res.ok) errorMessage = `Endpoint responded with HTTP ${res.status}`;
      } catch (err) {
        errorMessage = (err as Error).message;
        logger.warn({ webhookId: webhook.id, url: webhook.url, err }, 'Webhook delivery failed');
      }

      await prisma.webhookDelivery.create({
        data: { webhookId: webhook.id, event, payload: payload as any, statusCode, success, errorMessage },
      });
    })
  );
}

/**
 * Export rate limiter for monitoring endpoints (optional).
 */
export { rateLimiter };
