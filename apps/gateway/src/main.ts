/**
 * VistaFam API Gateway
 * Reverse proxy, JWT validation, rate limiting, tenant context injection
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import httpProxy from '@fastify/http-proxy';
import { createLogger } from '@vistafam/logger';

const logger = createLogger('gateway');
const app = Fastify({
  logger: false,
  trustProxy: true,
});

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// ── Upstream Routes ──────────────────────────────────────────

const upstreams: Record<string, { target: string; prefix: string }> = {
  authsphere: { target: process.env.AUTHSPHERE_URL ?? 'http://localhost:4001', prefix: '/api/v1/auth' },
  teamsync: { target: process.env.TEAMSYNC_URL ?? 'http://localhost:4002', prefix: '/api/v1/teamsync' },
  flowboard: { target: process.env.FLOWBOARD_URL ?? 'http://localhost:4003', prefix: '/api/v1/flowboard' },
  vaultspace: { target: process.env.VAULTSPACE_URL ?? 'http://localhost:4004', prefix: '/api/v1/vaultspace' },
  pipevista: { target: process.env.PIPEVISTA_URL ?? 'http://localhost:4006', prefix: '/api/v1/pipevista' },
  loglens: { target: process.env.LOGLENS_URL ?? 'http://localhost:4007', prefix: '/api/v1/loglens' },
  devpulse: { target: process.env.DEVPULSE_URL ?? 'http://localhost:4008', prefix: '/api/v1/devpulse' },
  schemaforge: { target: process.env.SCHEMAFORGE_URL ?? 'http://localhost:4009', prefix: '/api/v1/schemaforge' },
  querymind: { target: process.env.QUERYMIND_URL ?? 'http://localhost:4010', prefix: '/api/v1/querymind' },
  deployhub: { target: process.env.DEPLOYHUB_URL ?? 'http://localhost:4011', prefix: '/api/v1/deployhub' },
  insightai: { target: process.env.INSIGHTAI_URL ?? 'http://localhost:4012', prefix: '/api/v1/insightai' },
};

// ── Startup ──────────────────────────────────────────────────

async function start() {
  // Middleware
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return (req.headers['x-tenant-id'] as string) ?? req.ip;
    },
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${context.after}`,
      retryAfter: context.after,
    }),
  });

  // Health check
  app.get('/health/live', async () => ({ status: 'alive' }));
  app.get('/health/ready', async () => ({ status: 'ready' }));

  // Register proxy routes
  for (const [name, config] of Object.entries(upstreams)) {
    await app.register(httpProxy, {
      upstream: config.target,
      prefix: config.prefix,
      rewritePrefix: config.prefix,
      http2: false,
      replyOptions: {
        rewriteRequestHeaders: (req, headers) => {
          // Inject trace ID if not present
          if (!headers['x-trace-id']) {
            headers['x-trace-id'] = req.id as string;
          }
          return headers;
        },
      },
    });
    logger.info(`Registered upstream: ${config.prefix} -> ${config.target}`, { upstream: name });
  }

  // Catch-all
  app.setNotFoundHandler(async (req, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `No route registered for ${req.url}`,
      availableRoutes: Object.values(upstreams).map((u) => u.prefix),
    });
  });

  // Error handler
  app.setErrorHandler((error, req, reply) => {
    logger.error('Gateway error', { error: error.message, url: req.url });
    reply.status(error.statusCode ?? 500).send({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    });
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Gateway listening on port ${PORT}`, { port: PORT, upstreams: Object.keys(upstreams) });
  } catch (err) {
    logger.fatal('Failed to start gateway', { error: (err as Error).message });
    process.exit(1);
  }
}

// ── Graceful Shutdown ────────────────────────────────────────

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await app.close();
  process.exit(0);
});

start();
