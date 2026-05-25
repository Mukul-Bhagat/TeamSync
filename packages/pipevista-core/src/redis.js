/**
 * PipeVista Redis Client Manager
 * Shared Redis connection with connection pooling and key namespace helpers
 */
import Redis from 'ioredis';
let redisClient = null;
export function createRedisClient(config = {}) {
    let client;
    if (config.cluster && config.clusterNodes) {
        client = new Redis.Cluster(config.clusterNodes, {
            redisOptions: {
                password: config.password,
                maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
            },
        });
    }
    else {
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
        console.error('[pipevista-core:redis] Error:', err.message);
    });
    client.on('connect', () => {
        console.log('[pipevista-core:redis] Connected');
    });
    redisClient = client;
    return client;
}
export function getRedisClient() {
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
};
export function buildKey(prefix, ...parts) {
    return [prefix, ...parts].join(':');
}
// ── Typed Helpers ────────────────────────────────────────────
export async function getJson(client, key) {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
}
export async function setJson(client, key, value, ttlMs) {
    const serialized = JSON.stringify(value);
    if (ttlMs) {
        await client.setex(key, Math.ceil(ttlMs / 1000), serialized);
    }
    else {
        await client.set(key, serialized);
    }
}
export async function incrementCounter(client, key, windowMs) {
    const multi = client.multi();
    multi.incr(key);
    multi.pexpire(key, windowMs);
    const results = await multi.exec();
    return results?.[0]?.[1] ?? 0;
}
export async function slidingWindowCheck(client, key, maxRequests, windowMs) {
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
export async function acquireLock(client, lockKey, ttlMs, retryMs = 100, maxRetries = 50) {
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
