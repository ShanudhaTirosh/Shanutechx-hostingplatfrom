import Redis from 'ioredis';
import { env } from '../env';

export const redis = new Redis(env.redisUrl);

export async function storeState<T>(prefix: string, key: string, value: T, ttlSeconds: number): Promise<void> {
  await redis.set(`${prefix}:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function consumeState<T>(prefix: string, key: string): Promise<T | null> {
  const fullKey = `${prefix}:${key}`;
  const data = await redis.get(fullKey);
  if (!data) return null;
  await redis.del(fullKey);
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
