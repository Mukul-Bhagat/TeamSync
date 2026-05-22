/**
 * PipeVista Common Fastify Middleware
 * Auth, tenant context, tracing, and request ID plugins
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { TenantContext } from './types';

// ── Tenant Context Plugin ────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    tenantContext: TenantContext;
  }
}

export async function registerTenantContextPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const traceId = req.headers['x-trace-id'] as string || randomUUID();
    const requestId = randomUUID();
    const tenantId = req.headers['x-tenant-id'] as string || 'default';

    req.tenantContext = {
      tenantId,
      tenantSlug: req.headers['x-tenant-slug'] as string || tenantId,
      userId: req.headers['x-user-id'] as string,
      userEmail: req.headers['x-user-email'] as string,
      roles: (req.headers['x-roles'] as string)?.split(',') || [],
      permissions: (req.headers['x-permissions'] as string)?.split(',') || [],
      traceId,
      requestId,
      clientIp: req.ip,
    };

    reply.header('x-trace-id', traceId);
    reply.header('x-request-id', requestId);
  });
}

// ── Request Logger Plugin ────────────────────────────────────

export async function registerRequestLogger(app: FastifyInstance, serviceName: string): Promise<void> {
  app.addHook('onRequest', async (req) => {
    req.log = {
      info: (msg: string, ctx?: Record<string, unknown>) => {
        console.log(`[${serviceName}] [${req.id}] ${msg}`, ctx ?? '');
      },
      error: (msg: string, ctx?: Record<string, unknown>) => {
        console.error(`[${serviceName}] [${req.id}] ${msg}`, ctx ?? '');
      },
    } as any;
  });

  app.addHook('onResponse', async (req, reply) => {
    const duration = (reply as any).getResponseTime();
    console.log(
      `[${serviceName}] ${req.method} ${req.url} ${reply.statusCode} ${duration.toFixed(2)}ms ` +
      `tid=${req.tenantContext?.traceId ?? 'none'} tenant=${req.tenantContext?.tenantId ?? 'none'}`
    );
  });
}

// ── Auth Guard ─────────────────────────────────────────────

export function requireAuth() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Missing authorization token' });
      return;
    }
    // JWT validation happens at gateway; downstream services trust headers
    if (!req.tenantContext?.userId) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token context' });
    }
  };
}

export function requirePermission(...permissions: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userPerms = req.tenantContext?.permissions || [];
    const hasPerm = permissions.some((p) => userPerms.includes(p) || userPerms.includes('admin:*'));
    if (!hasPerm) {
      reply.status(403).send({ error: 'Forbidden', message: `Required permissions: ${permissions.join(', ')}` });
    }
  };
}

// ── Error Handler ────────────────────────────────────────────

export function registerErrorHandler(app: FastifyInstance, serviceName: string): void {
  app.setErrorHandler((error, req, reply) => {
    const statusCode = (error as any).statusCode ?? 500;
    const isProd = process.env.NODE_ENV === 'production';

    console.error(`[${serviceName}] Error on ${req.url}:`, (error as Error).message);

    reply.status(statusCode).send({
      error: 'Internal Server Error',
      message: isProd ? 'Something went wrong' : (error as Error).message,
      requestId: req.tenantContext?.requestId,
      traceId: req.tenantContext?.traceId,
    });
  });
}
