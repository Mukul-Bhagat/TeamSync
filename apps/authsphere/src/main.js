/**
 * VistaFam AuthSphere - Identity Provider
 * Authentication, RBAC, tenant management, audit logging
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createLogger } from '@vistafam/logger';
const logger = createLogger('authsphere');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4001', 10);
// ── Routes ───────────────────────────────────────────────────
app.get('/health/live', async () => ({ status: 'alive' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0' }));
// OAuth2 / OIDC endpoints (placeholder)
app.get('/.well-known/openid-configuration', async () => ({
    issuer: 'https://authsphere.vistafam.app',
    authorization_endpoint: '/oauth/authorize',
    token_endpoint: '/oauth/token',
    userinfo_endpoint: '/oauth/userinfo',
    jwks_uri: '/.well-known/jwks.json',
    response_types_supported: ['code', 'token', 'id_token'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
}));
// Tenant management (placeholder)
app.get('/api/v1/tenants', async () => ({
    tenants: [
        { id: 'tenant-1', name: 'Acme Corp', slug: 'acme', status: 'active' },
    ],
}));
// User management (placeholder)
app.get('/api/v1/users', async () => ({
    users: [
        { id: 'user-1', email: 'admin@acme.com', name: 'Admin User', tenantId: 'tenant-1', roles: ['admin'] },
    ],
}));
// Role management (placeholder)
app.get('/api/v1/roles', async () => ({
    roles: [
        { id: 'role-1', name: 'admin', permissions: ['admin:*'] },
        { id: 'role-2', name: 'member', permissions: ['teamsync:channel:read', 'teamsync:message:send'] },
    ],
}));
// Audit logs (placeholder)
app.get('/api/v1/audit', async () => ({
    events: [
        { id: 'audit-1', action: 'user.login', userId: 'user-1', tenantId: 'tenant-1', timestamp: new Date().toISOString() },
    ],
}));
// ── Startup ──────────────────────────────────────────────────
async function start() {
    await app.register(cors, { origin: true, credentials: true });
    await app.register(helmet);
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`AuthSphere listening on port ${PORT}`, { port: PORT });
    }
    catch (err) {
        logger.fatal('Failed to start AuthSphere', { error: err });
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
