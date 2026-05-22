/**
 * PipeVista Redis Client Manager
 * Shared Redis connection with connection pooling and key namespace helpers
 */

import Redis, { Cluster } from 'ioredis';

let redisClient: Redis | Cluster | null = null;

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  cluster?: boolean;
  clusterNodes?: Array<{ host: string; port: number }>;
  maxRetriesPerRequest?: number;
}

export function createRedisClient(config: RedisConfig = {}): Redis | Cluster {
  let client: Redis | Cluster;
  if (config.cluster && config.clusterNodes) {
    client = new Redis.Cluster(config.clusterNodes, {
      redisOptions: {
        password: config.password,
        maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
      },
    });
  } else {
    client = new Redis({
      host: config.host ?? process.env.REDIS_HOST ?? 'localhost',
      port: config.port ?? parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: config.password ?? process.env.REDIS_PASSWORD,
      db: config.db ?? 0,
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
      lazyConnect: true,
    });
  }

  client.on('error', (err) => {
    console.error('[pipevista-core:redis] Error:', (err as Error).message);
  });

  client.on('connect', () => {
    console.log('[pipevista-core:redis] Connected');
  });

  redisClient = client;
  return client;
}

export function getRedisClient(): Redis | Cluster {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

// ── Key Namespacing ──────────────────────────────────────────

export const KeyPrefixes = {
  GATEWAY: 'pv:gateway',
  REGISTRY: 'pv:registry',
  EVENT: 'pv:event',
  AI: 'pv:ai',
  REALTIME: 'pv:realtime',
  CONNECTOR: 'pv:connector',
  CONFIG: 'pv:config',
  SESSION: 'pv:session',
  CACHE: 'pv:cache',
  RATE_LIMIT: 'pv:ratelimit',
} as const;

export function buildKey(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].join(':');
}

// ── Typed Helpers ────────────────────────────────────────────

export async function getJson<T>(client: Redis | Cluster, key: string): Promise<T | null> {
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

export async function setJson<T>(client: Redis | Cluster, key: string, value: T, ttlMs?: number): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlMs) {
    await client.setex(key, Math.ceil(ttlMs / 1000), serialized);
  } else {
    await client.set(key, serialized);
  }
}

export async function incrementCounter(
  client: Redis | Cluster,
  key: string,
  windowMs: number
): Promise<number> {
  const multi = client.multi();
  multi.incr(key);
  multi.pexpire(key, windowMs);
  const results = await multi.exec();
  return (results?.[0]?.[1] as number) ?? 0;
}

export async function slidingWindowCheck(
  client: Redis | Cluster,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Remove entries outside window
  await client.zremrangebyscore(key, 0, windowStart);

  // Count current entries
  const currentCount = await client.zcard(key);

  if (currentCount >= maxRequests) {
    const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
    const resetMs = (parseInt(oldest[1] ?? '0', 10) + windowMs) - now;
    return { allowed: false, remaining: 0, resetMs: Math.max(0, resetMs) };
  }

  // Add current request
  await client.zadd(key, now, `${now}-${Math.random().toString(36).substring(2)}`);
  await client.pexpire(key, windowMs);

  return { allowed: true, remaining: maxRequests - currentCount - 1, resetMs: windowMs };
}

export async function acquireLock(
  client: Redis | Cluster,
  lockKey: string,
  ttlMs: number,
  retryMs = 100,
  maxRetries = 50
): Promise<{ release: () => Promise<void> } | null> {
  const token = `${Date.now()}-${Math.random()}`;

  for (let i = 0; i < maxRetries; i++) {
    const acquired = await client.set(lockKey, token, 'PX', ttlMs, 'NX');
    if (acquired === 'OK') {
      return {
        release: async () => {
          const current = await client.get(lockKey);
          if (current === token) {
            await client.del(lockKey);
          }
        },
      };
    }
    await new Promise((r) => setTimeout(r, retryMs));
  }

  return null;
}
