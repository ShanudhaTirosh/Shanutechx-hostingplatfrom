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
  await redis.set(`${prefix}:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
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
    data = await redis.get(fullKey);
    if (data) {
      await redis.del(fullKey);
    }
  }

  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
