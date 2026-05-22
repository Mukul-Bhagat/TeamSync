/**
 * PipeVista Admin - Admin Dashboard API
 * Cross-service configuration, topology visualization, operational commands
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('pipevista-admin');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4107', 10);
// ── Operational State ──────────────────────────────────────
const serviceStatuses = new Map();
app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-admin' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-admin' }));
// ── Service Topology ───────────────────────────────────────
app.get('/v1/admin/topology', async () => ({
    services: [
        { id: 'gateway', name: 'pipevista-gateway', port: 4100, status: 'healthy', layer: 'edge' },
        { id: 'event-hub', name: 'pipevista-event-hub', port: 4101, status: 'healthy', layer: 'messaging' },
        { id: 'ai-router', name: 'pipevista-ai-router', port: 4102, status: 'healthy', layer: 'ai' },
        { id: 'registry', name: 'pipevista-registry', port: 4103, status: 'healthy', layer: 'control' },
        { id: 'connector', name: 'pipevista-connector', port: 4104, status: 'healthy', layer: 'integration' },
        { id: 'realtime', name: 'pipevista-realtime', port: 4105, status: 'healthy', layer: 'realtime' },
        { id: 'observability', name: 'pipevista-observability', port: 4106, status: 'healthy', layer: 'observability' },
        { id: 'admin', name: 'pipevista-admin', port: 4107, status: 'healthy', layer: 'control' },
    ],
    connections: [
        { from: 'gateway', to: 'event-hub', type: 'event' },
        { from: 'gateway', to: 'registry', type: 'config' },
        { from: 'gateway', to: 'ai-router', type: 'ai' },
        { from: 'event-hub', to: 'realtime', type: 'broadcast' },
        { from: 'registry', to: 'gateway', type: 'discovery' },
        { from: 'connector', to: 'event-hub', type: 'event' },
        { from: 'observability', to: 'gateway', type: 'metrics' },
    ],
    infrastructure: {
        redis: { status: 'healthy', mode: 'cluster', nodes: 6 },
        nats: { status: 'healthy', mode: 'cluster', nodes: 3 },
        postgres: { status: 'healthy', mode: 'primary+replica' },
        minio: { status: 'healthy', mode: 'distributed', nodes: 4 },
    },
}));
// ── Cross-Service Configuration ──────────────────────────────
app.get('/v1/admin/config', async () => ({
    global: {
        'gateway.rate_limit.enabled': true,
        'gateway.rate_limit.requests_per_minute': 100,
        'ai.default_model': 'gpt-4o',
        'ai.fallback_chain': ['openai', 'anthropic', 'google'],
        'event.retention_days': 30,
        'log.level': 'info',
    },
    perService: {
        gateway: { maxConnections: 10000, timeoutMs: 30000 },
        'event-hub': { maxRetries: 5, dlqEnabled: true },
        'ai-router': { tokenQuotaPerTenant: 1000000, cacheEnabled: true },
        realtime: { presenceTTL: 30, maxRoomsPerSocket: 10 },
    },
}));
app.put('/v1/admin/config/:key', async (req, reply) => {
    const { key } = req.params;
    const body = req.body;
    logger.info(`Admin config update: ${key} = ${JSON.stringify(body.value)}`, { scope: body.scope });
    reply.send({ success: true, key, value: body.value, scope: body.scope ?? 'global' });
});
// ── Operational Commands ───────────────────────────────────
app.post('/v1/admin/commands/:command', async (req, reply) => {
    const { command } = req.params;
    const body = req.body;
    logger.info(`Admin command executed: ${command}`, { target: body.targetService, params: body.parameters });
    switch (command) {
        case 'restart-service':
            reply.send({ success: true, command, message: `Restart signal sent to ${body.targetService}` });
            break;
        case 'clear-cache':
            reply.send({ success: true, command, message: 'Cache cleared across all services' });
            break;
        case 'drain-connections':
            reply.send({ success: true, command, message: `Draining connections on ${body.targetService}` });
            break;
        case 'scale-service':
            reply.send({ success: true, command, message: `Scaling ${body.targetService} to ${body.parameters?.replicas ?? 2} replicas` });
            break;
        default:
            reply.status(400).send({ error: 'Unknown command', available: ['restart-service', 'clear-cache', 'drain-connections', 'scale-service'] });
    }
});
// ── Service Status Aggregation ───────────────────────────────
app.get('/v1/admin/status', async () => ({
    overall: 'healthy',
    pipevista: Object.fromEntries(serviceStatuses),
    ecosystem: {
        authsphere: { status: 'healthy', version: '0.1.0' },
        teamsync: { status: 'healthy', version: '0.1.0' },
        flowboard: { status: 'healthy', version: '0.1.0' },
        vaultspace: { status: 'healthy', version: '0.1.0' },
        loglens: { status: 'healthy', version: '0.1.0' },
        devpulse: { status: 'healthy', version: '0.1.0' },
        schemaforge: { status: 'healthy', version: '0.1.0' },
        querymind: { status: 'healthy', version: '0.1.0' },
        deployhub: { status: 'healthy', version: '0.1.0' },
        insightai: { status: 'healthy', version: '0.1.0' },
    },
}));
// ── Audit Log ────────────────────────────────────────────────
app.get('/v1/admin/audit', async () => ({
    events: [
        { id: 'audit-1', action: 'config.updated', actor: 'admin', target: 'gateway.rate_limit', timestamp: new Date().toISOString() },
        { id: 'audit-2', action: 'service.restarted', actor: 'admin', target: 'pipevista-event-hub', timestamp: new Date().toISOString() },
    ],
}));
async function start() {
    await app.register(cors, { origin: true, credentials: true });
    await app.register(helmet);
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`PipeVista Admin listening on port ${PORT}`, { port: PORT });
    }
    catch (err) {
        logger.fatal('Failed to start Admin', { error: err.message });
        process.exit(1);
    }
}
process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });
start();
