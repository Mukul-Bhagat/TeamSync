/**
 * PipeVista Common Fastify Middleware
 * Auth, tenant context, tracing, and request ID plugins
 */
import { randomUUID } from 'crypto';
export async function registerTenantContextPlugin(app) {
    app.addHook('onRequest', async (req, reply) => {
        const traceId = req.headers['x-trace-id'] || randomUUID();
        const requestId = randomUUID();
        const tenantId = req.headers['x-tenant-id'] || 'default';
        req.tenantContext = {
            tenantId,
            tenantSlug: req.headers['x-tenant-slug'] || tenantId,
            userId: req.headers['x-user-id'],
            userEmail: req.headers['x-user-email'],
            roles: req.headers['x-roles']?.split(',') || [],
            permissions: req.headers['x-permissions']?.split(',') || [],
            traceId,
            requestId,
            clientIp: req.ip,
        };
        reply.header('x-trace-id', traceId);
        reply.header('x-request-id', requestId);
    });
}
// ── Request Logger Plugin ────────────────────────────────────
export async function registerRequestLogger(app, serviceName) {
    app.addHook('onRequest', async (req) => {
        req.log = {
            info: (msg, ctx) => {
                console.log(`[${serviceName}] [${req.id}] ${msg}`, ctx ?? '');
            },
            error: (msg, ctx) => {
                console.error(`[${serviceName}] [${req.id}] ${msg}`, ctx ?? '');
            },
        };
    });
    app.addHook('onResponse', async (req, reply) => {
        const duration = reply.getResponseTime();
        console.log(`[${serviceName}] ${req.method} ${req.url} ${reply.statusCode} ${duration.toFixed(2)}ms ` +
            `tid=${req.tenantContext?.traceId ?? 'none'} tenant=${req.tenantContext?.tenantId ?? 'none'}`);
    });
}
// ── Auth Guard ─────────────────────────────────────────────
export function requireAuth() {
    return async (req, reply) => {
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
export function requirePermission(...permissions) {
    return async (req, reply) => {
        const userPerms = req.tenantContext?.permissions || [];
        const hasPerm = permissions.some((p) => userPerms.includes(p) || userPerms.includes('admin:*'));
        if (!hasPerm) {
            reply.status(403).send({ error: 'Forbidden', message: `Required permissions: ${permissions.join(', ')}` });
        }
    };
}
// ── Error Handler ────────────────────────────────────────────
export function registerErrorHandler(app, serviceName) {
    app.setErrorHandler((error, req, reply) => {
        const statusCode = error.statusCode ?? 500;
        const isProd = process.env.NODE_ENV === 'production';
        console.error(`[${serviceName}] Error on ${req.url}:`, error.message);
        reply.status(statusCode).send({
            error: 'Internal Server Error',
            message: isProd ? 'Something went wrong' : error.message,
            requestId: req.tenantContext?.requestId,
            traceId: req.tenantContext?.traceId,
        });
    });
}
