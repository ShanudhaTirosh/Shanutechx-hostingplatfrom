import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redis } from '../lib/redis';
import { AuthedRequest } from './auth';
import { logger } from '../lib/logger';

const TTL_SECONDS = 60 * 10; // 10 minutes

interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Idempotency middleware to prevent duplicate requests (e.g. checkout, payment upload).
 * Key is bound to user ID, HTTP method, route path, idempotency key header, and body hash.
 */
export function idempotent(req: Request, res: Response, next: NextFunction) {
  const headerVal = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  const key = Array.isArray(headerVal) ? headerVal[0] : headerVal;

  if (typeof key !== 'string' || !key.trim()) {
    return next(); // no key provided — process request normally
  }

  const userId = (req as AuthedRequest).user?.id;
  if (!userId) {
    return next();
  }

  const rawBodyStr = (req as any).rawBody
    ? (req as any).rawBody.toString('utf8')
    : JSON.stringify(req.body || {});
  const bodyHash = crypto.createHash('sha256').update(rawBodyStr).digest('hex').slice(0, 16);

  const cacheKey = `idempotency:${userId}:${req.method}:${req.path}:${key.trim()}:${bodyHash}`;

  redis
    .set(cacheKey, 'IN_PROGRESS', 'EX', 45, 'NX')
    .then((result) => {
      if (result !== 'OK') {
        // Key already exists — return cached response or conflict
        return redis
          .get(cacheKey)
          .then((cached) => {
            if (cached && cached !== 'IN_PROGRESS') {
              try {
                const parsed: CachedResponse = JSON.parse(cached);
                return res.status(parsed.status).json(parsed.body);
              } catch {}
            }
            return res.status(409).json({
              error: 'A request with this idempotency key and payload is currently processing or completed',
            });
          })
          .catch(() => next());
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
      logger.error({ cacheKey, err: err.message }, 'Idempotency cache lookup failed, failing open');
      next();
    });
}
