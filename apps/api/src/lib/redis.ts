import Redis from 'ioredis';
import { env } from '../env';
import { logger } from './logger';

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    logger.warn({ times, delay }, 'Redis connection retry');
    return delay;
  },
  reconnectOnError(err) {
    if (err.message.includes('READONLY') || err.message.includes('ECONNRESET')) {
      return true;
    }
    return false;
  },
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis client connection error');
});

export async function storeState<T>(prefix: string, key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(`${prefix}:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err: any) {
    logger.warn({ err: err.message, prefix, key }, 'Failed to store state in Redis');
  }
}

export async function consumeState<T>(prefix: string, key: string): Promise<T | null> {
  const fullKey = `${prefix}:${key}`;
  let data: string | null = null;
  try {
    data = (await redis.eval(
      `local val = redis.call('GET', KEYS[1]) if val then redis.call('DEL', KEYS[1]) end return val`,
      1,
      fullKey
    )) as string | null;
  } catch {
    try {
      data = await redis.get(fullKey);
      if (data) {
        await redis.del(fullKey);
      }
    } catch {}
  }

  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Transparent Redis caching wrapper.
 * Returns cached value if present in Redis; otherwise invokes fetcher, caches result, and returns data.
 * Gracefully falls back to fetcher if Redis is unavailable or fails.
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err: any) {
    logger.warn({ key, err: err.message }, 'Redis getCached read error — falling back to fetcher');
  }

  const freshData = await fetcher();

  if (freshData !== null && freshData !== undefined) {
    try {
      await redis.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
    } catch (err: any) {
      logger.warn({ key, err: err.message }, 'Redis getCached write error');
    }
  }

  return freshData;
}

/**
 * Invalidate a single key or pattern from Redis
 */
export async function invalidateCache(keyOrPattern: string): Promise<void> {
  try {
    if (keyOrPattern.includes('*')) {
      const keys = await redis.keys(keyOrPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      await redis.del(keyOrPattern);
    }
  } catch (err: any) {
    logger.warn({ keyOrPattern, err: err.message }, 'Failed to invalidate Redis cache');
  }
}
