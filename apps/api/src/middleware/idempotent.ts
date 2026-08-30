import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { env } from '../env';
import { AuthedRequest } from './auth';
import { logger } from '../lib/logger';

// Deliberately a separate, independent ioredis client from the BullMQ
// queue's connection (see lib/queue.ts's comment on why bullmq gets plain
// connection options instead of an instance) — this one has nothing to do
// with bullmq, so there's no version-conflict risk handing it a real
// ioredis instance directly.
const redis = new Redis(env.redisUrl);

const TTL_SECONDS = 60 * 10; // 10 minutes — long enough to cover a retry storm, short enough not to accumulate forever

interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Applied to checkout and payment-proof-upload specifically — the two
 * endpoints where a double-tap or a retried request on a flaky mobile
 * connection could otherwise create a duplicate order or a duplicate
 * payment record. The client sends an `Idempotency-Key` header (any
 * unique-per-attempt string, e.g. a UUID generated once per button press);
 * a repeated request with the same key within the TTL window gets the
 * original response replayed instead of re-running the handler.
 *
 * Scoped per-user, not just per-key — two different users could otherwise
 * collide on the same key, and more importantly a leaked/guessed key
 * shouldn't let someone else replay your response.
 */
export function idempotent(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || !key) {
    return next(); // no key provided — not required, just supported
  }

  const userId = (req as AuthedRequest).user?.id ?? 'anonymous';
  const cacheKey = `idempotency:${userId}:${req.path}:${key}`;

  redis
    .set(cacheKey, 'IN_PROGRESS', 'EX', 60, 'NX')
    .then((result) => {
      if (result !== 'OK') {
        // Key already exists — either in-progress concurrently, or previously completed
        return redis.get(cacheKey).then((cached) => {
          if (cached && cached !== 'IN_PROGRESS') {
            try {
              const parsed: CachedResponse = JSON.parse(cached);
              return res.status(parsed.status).json(parsed.body);
            } catch {}
          }
          return res.status(409).json({ error: 'A request with this idempotency key is currently processing or completed' });
        });
      }

      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        if (res.statusCode < 400) {
          void redis
            .set(cacheKey, JSON.stringify({ status: res.statusCode, body }), 'EX', TTL_SECONDS)
            .catch((err) => logger.error({ cacheKey, err }, 'Failed to cache idempotent response'));
        } else {
          void redis
            .del(cacheKey)
            .catch((err) => logger.error({ cacheKey, err }, 'Failed to clear in-progress idempotency key'));
        }
        return originalJson(body);
      };

      next();
    })
    .catch((err) => {
      // Redis being unavailable shouldn't take down checkout/uploads —
      // fail open (process the request normally, just without dedup).
      logger.error({ cacheKey, err }, 'Idempotency cache lookup failed, proceeding without it');
      next();
    });
}
