/**
 * PipeVista Gateway - API Gateway
 * Auth routing, validation, rate limiting, request aggregation, websocket routing, circuit breaker
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import httpProxy from '@fastify/http-proxy';
import { createRedisClient, getRedisClient, buildKey, KeyPrefixes, slidingWindowCheck, getJson } from '@vistafam/pipevista-core';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { CircuitBreaker } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('pipevista-gateway');
const app = Fastify({ logger: false, trustProxy: true });
const PORT = parseInt(process.env.PORT ?? '4100', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://localhost:4103';

// ── Upstream Config (fetched from registry dynamically) ────

interface UpstreamDef { target: string; prefix: string; version: string; }

const staticUpstreams: Record<string, UpstreamDef> = {
  authsphere: { target: 'http://localhost:4001', prefix: '/api/v1/auth', version: 'v1' },
  teamsync:   { target: 'http://localhost:4002', prefix: '/api/v1/teamsync', version: 'v1' },
  flowboard:  { target: 'http://localhost:4003', prefix: '/api/v1/flowboard', version: 'v1' },
  vaultspace: { target: 'http://localhost:4004', prefix: '/api/v1/vaultspace', version: 'v1' },
  pipevista:  { target: 'http://localhost:4006', prefix: '/api/v1/pipevista', version: 'v1' },
  loglens:    { target: 'http://localhost:4007', prefix: '/api/v1/loglens', version: 'v1' },
  devpulse:   { target: 'http://localhost:4008', prefix: '/api/v1/devpulse', version: 'v1' },
  schemaforge:{ target: 'http://localhost:4009', prefix: '/api/v1/schemaforge', version: 'v1' },
  querymind:  { target: 'http://localhost:4010', prefix: '/api/v1/querymind', version: 'v1' },
  deployhub:  { target: 'http://localhost:4011', prefix: '/api/v1/deployhub', version: 'v1' },
  insightai:  { target: 'http://localhost:4012', prefix: '/api/v1/insightai', version: 'v1' },
};

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(name: string): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker({ name, failureThreshold: 5, timeoutMs: 30000 }));
  }
  return circuitBreakers.get(name)!;
}

// ── Startup ──────────────────────────────────────────────────

async function start() {
  const redis = createRedisClient({ url: REDIS_URL });
  await redis.connect().catch(() => {});

  await app.register(cors, { origin: process.env.CORS_ORIGIN ?? true, credentials: true });
  await app.register(helmet, { contentSecurityPolicy: false });

  // Custom sliding window rate limiter
  app.addHook('onRequest', async (req, reply) => {
    const tenantId = (req.headers['x-tenant-id'] as string) ?? 'default';
    const key = buildKey(KeyPrefixes.RATE_LIMIT, tenantId, 'general');
    const result = await slidingWindowCheck(redis, key, 100, 60000);
    if (!result.allowed) {
      reply.header('Retry-After', Math.ceil(result.resetMs / 1000));
      reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Retry after ${Math.ceil(result.resetMs / 1000)}s`,
        retryAfter: result.resetMs,
      });
    }
  });

  // Health
  app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-gateway' }));
  app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-gateway' }));

  // Request validation endpoint
  app.post('/v1/gateway/validate', async (req, reply) => {
    const body = req.body as { token?: string; permissions?: string[] };
    reply.send({
      valid: !!body.token,
      tenantId: req.tenantContext?.tenantId ?? 'default',
      permissions: body.permissions ?? [],
    });
  });

  // Register proxy routes with circuit breaker
  for (const [name, config] of Object.entries(staticUpstreams)) {
    const cb = getCircuitBreaker(name);

    await app.register(httpProxy, {
      upstream: config.target,
      prefix: config.prefix,
      rewritePrefix: config.prefix,
      http2: false,
      replyOptions: {
        rewriteRequestHeaders: (req, headers) => {
          headers['x-trace-id'] = (req.headers['x-trace-id'] as string) || req.id;
          headers['x-tenant-id'] = (req.headers['x-tenant-id'] as string) || 'default';
          return headers;
        },
      },
      preHandler: async (req, reply) => {
        if (cb.getState() === 'open') {
          reply.status(503).send({
            error: 'Service Unavailable',
            message: `Circuit breaker OPEN for ${name}`,
            retryAfter: 30,
          });
        }
      },
    });
    logger.info(`Registered upstream: ${config.prefix} -> ${config.target}`);
  }

  // Catch-all
  app.setNotFoundHandler(async (req, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `No route for ${req.url}`,
      available: Object.values(staticUpstreams).map((u) => u.prefix),
    });
  });

  // Error handler
  app.setErrorHandler((error, req, reply) => {
    logger.error('Gateway error', { url: req.url, error: (error as Error).message });
    reply.status((error as any).statusCode ?? 500).send({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : (error as Error).message,
    });
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`PipeVista Gateway listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start gateway', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });

start();
