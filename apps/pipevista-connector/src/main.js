/**
 * PipeVista Connector - Integration Layer
 * Webhook dispatcher, external API proxy, connector management, protocol adapters
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import axios from 'axios';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { CircuitBreaker } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('pipevista-connector');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4104', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const webhooks = new Map();
const circuitBreakers = new Map();
function getCB(name) {
    if (!circuitBreakers.has(name))
        circuitBreakers.set(name, new CircuitBreaker({ name, failureThreshold: 5, timeoutMs: 60000 }));
    return circuitBreakers.get(name);
}
app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-connector' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-connector' }));
// ── Webhook Endpoint Registry ──────────────────────────────
app.post('/v1/connectors/webhooks', async (req, reply) => {
    const body = req.body;
    const id = crypto.randomUUID();
    const webhook = { id, ...body, active: true };
    webhooks.set(id, webhook);
    logger.info(`Webhook registered: ${body.url} for events [${body.events.join(', ')}]`);
    reply.status(201).send(webhook);
});
app.get('/v1/connectors/webhooks', async () => ({ webhooks: Array.from(webhooks.values()) }));
// ── Webhook Dispatch ───────────────────────────────────────
app.post('/v1/connectors/webhooks/:id/dispatch', async (req, reply) => {
    const { id } = req.params;
    const webhook = webhooks.get(id);
    if (!webhook || !webhook.active) {
        reply.status(404).send({ error: 'Webhook not found or inactive' });
        return;
    }
    const body = req.body;
    const cb = getCB(webhook.url);
    if (cb.getState() === 'open') {
        reply.status(503).send({ error: 'Circuit breaker open for this webhook' });
        return;
    }
    try {
        const signature = crypto.randomUUID(); // TODO: HMAC-SHA256 with secret
        const response = await axios.post(webhook.url, {
            eventType: body.eventType,
            payload: body.payload,
            timestamp: new Date().toISOString(),
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature,
                'X-Webhook-ID': id,
            },
            timeout: 30000,
        });
        logger.info(`Webhook dispatched: ${webhook.url}`, { status: response.status, eventType: body.eventType });
        reply.send({ success: true, statusCode: response.status });
    }
    catch (error) {
        cb.execute(() => Promise.reject(error)).catch(() => { });
        logger.error(`Webhook dispatch failed: ${webhook.url}`, { error: error.message });
        reply.status(502).send({ error: 'Webhook dispatch failed', message: error.message });
    }
});
// ── External API Proxy ─────────────────────────────────────
app.post('/v1/connectors/proxy', async (req, reply) => {
    const body = req.body;
    try {
        const response = await axios.request({
            method: body.method,
            url: body.url,
            headers: body.headers,
            data: body.body,
            timeout: body.timeout ?? 30000,
        });
        reply.send({ status: response.status, headers: response.headers, data: response.data });
    }
    catch (error) {
        reply.status(error.response?.status ?? 502).send({
            error: 'Proxy request failed',
            message: error.message,
            upstreamStatus: error.response?.status,
        });
    }
});
// ── Protocol Adapters ────────────────────────────────────────
app.get('/v1/connectors/adapters', async () => ({
    adapters: [
        { name: 'rest', version: '1.0', status: 'active' },
        { name: 'graphql', version: '1.0', status: 'beta' },
        { name: 'grpc', version: '0.5', status: 'preview' },
        { name: 'mqtt', version: '1.0', status: 'planned' },
    ],
}));
async function start() {
    await app.register(cors, { origin: true, credentials: true });
    await app.register(helmet);
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`PipeVista Connector listening on port ${PORT}`, { port: PORT });
    }
    catch (err) {
        logger.fatal('Failed to start Connector', { error: err.message });
        process.exit(1);
    }
}
process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });
start();
