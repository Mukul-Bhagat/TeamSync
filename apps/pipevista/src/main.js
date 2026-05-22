/**
 * VistaFam PipeVista - Infrastructure Intelligence
 * Service discovery, health monitoring, configuration distribution
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createLogger } from '@vistafam/logger';
const logger = createLogger('pipevista');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4006', 10);
// In-memory service registry (backed by PostgreSQL in production)
const registry = new Map();
app.get('/health/live', async () => ({ status: 'alive' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0' }));
// Service Registry API
app.post('/registry/register', async (req, reply) => {
    const body = req.body;
    registry.set(body.id, { ...body, registeredAt: new Date().toISOString(), status: 'healthy' });
    logger.info(`Service registered: ${body.name} (${body.id})`);
    reply.status(201).send({ success: true });
});
app.post('/registry/heartbeat/:id', async (req, reply) => {
    const { id } = req.params;
    const service = registry.get(id);
    if (!service) {
        reply.status(404).send({ error: 'Service not found' });
        return;
    }
    registry.set(id, { ...service, lastHeartbeat: new Date().toISOString() });
    reply.send({ success: true });
});
app.get('/registry/services', async () => {
    return { services: Array.from(registry.values()) };
});
app.delete('/registry/deregister/:id', async (req, reply) => {
    const { id } = req.params;
    const service = registry.get(id);
    if (service) {
        registry.delete(id);
        logger.info(`Service deregistered: ${id}`);
    }
    reply.send({ success: true });
});
// System Health Dashboard
app.get('/api/v1/health/system', async () => ({
    overall: 'healthy',
    services: Array.from(registry.values()).map((s) => ({
        name: s.name,
        status: s.status ?? 'unknown',
        lastHeartbeat: s.lastHeartbeat,
    })),
    infrastructure: {
        database: { status: 'up' },
        cache: { status: 'up' },
        messaging: { status: 'up' },
    },
}));
// Config Management
const configStore = new Map();
app.get('/api/v1/config/:key', async (req) => {
    const { key } = req.params;
    return { key, value: configStore.get(key) ?? null };
});
app.put('/api/v1/config/:key', async (req, reply) => {
    const { key } = req.params;
    const body = req.body;
    configStore.set(key, body.value);
    logger.info(`Config updated: ${key}`);
    reply.send({ success: true });
});
async function start() {
    await app.register(cors, { origin: true, credentials: true });
    await app.register(helmet);
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`PipeVista listening on port ${PORT}`, { port: PORT });
    }
    catch (err) {
        logger.fatal('Failed to start PipeVista', { error: err.message });
        process.exit(1);
    }
}
process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });
start();
