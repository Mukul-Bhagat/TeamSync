/**
 * PipeVista Observability - Observability Collector
 * Log aggregation proxy, trace collector, metrics forwarder, request ID propagation
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import axios from 'axios';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('pipevista-observability');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4106', 10);
const LOKI_URL = process.env.LOKI_URL ?? 'http://localhost:3100';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL ?? 'http://localhost:9090';
// Buffers for batching
const logBuffer = [];
const traceBuffer = [];
const metricBuffer = [];
app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-observability' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-observability' }));
// ── Log Ingestion Proxy ────────────────────────────────────
app.post('/v1/observability/logs', async (req, reply) => {
    const body = req.body;
    logBuffer.push(...body);
    logger.info(`Buffered ${body.length} log entries`, { totalBuffered: logBuffer.length });
    // Flush to Loki if buffer is large
    if (logBuffer.length >= 100) {
        await flushLogs();
    }
    reply.status(204).send();
});
async function flushLogs() {
    if (logBuffer.length === 0)
        return;
    const batch = logBuffer.splice(0, logBuffer.length);
    const streams = batch.map((log) => ({
        stream: { service: log.service, level: log.level, tenant: log.tenantId ?? 'default' },
        values: [[`${new Date(log.timestamp).getTime() * 1000000}`, JSON.stringify(log)]],
    }));
    try {
        await axios.post(`${LOKI_URL}/loki/api/v1/push`, { streams });
        logger.info(`Flushed ${batch.length} logs to Loki`);
    }
    catch (error) {
        logger.error('Failed to flush logs to Loki', { error: error.message });
    }
}
// ── Trace Collection ───────────────────────────────────────
app.post('/v1/observability/traces', async (req, reply) => {
    const body = req.body;
    traceBuffer.push(...body);
    logger.info(`Buffered ${body.length} trace spans`, { totalBuffered: traceBuffer.length });
    reply.status(204).send();
});
// ── Metrics Forwarding ─────────────────────────────────────
app.post('/v1/observability/metrics', async (req, reply) => {
    const body = req.body;
    metricBuffer.push(...body);
    logger.info(`Buffered ${body.length} metrics`, { totalBuffered: metricBuffer.length });
    reply.status(204).send();
});
// ── Request ID Validation ──────────────────────────────────
app.get('/v1/observability/validate-trace', async (req) => {
    const traceId = req.query.traceId;
    const requestId = req.query.requestId;
    return {
        traceId: traceId || crypto.randomUUID(),
        requestId: requestId || crypto.randomUUID(),
        valid: !!(traceId && requestId),
        generated: !traceId || !requestId,
    };
});
// ── Query Endpoints ──────────────────────────────────────────
app.get('/v1/observability/query/logs', async (req) => {
    const query = req.query.query ?? '{job="vistafam"}';
    const limit = parseInt(req.query.limit ?? '100', 10);
    try {
        const response = await axios.get(`${LOKI_URL}/loki/api/v1/query_range`, {
            params: { query, limit },
        });
        return { query, results: response.data.data?.result ?? [] };
    }
    catch (error) {
        return { query, results: [], error: error.message };
    }
});
app.get('/v1/observability/query/traces/:traceId', async (req) => {
    const { traceId } = req.params;
    const spans = traceBuffer.filter((t) => t.traceId === traceId);
    return { traceId, spans, totalSpans: spans.length };
});
// ── Flush Scheduler ────────────────────────────────────────
setInterval(async () => {
    await flushLogs();
}, 5000);
async function start() {
    await app.register(cors, { origin: true, credentials: true });
    await app.register(helmet);
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`PipeVista Observability listening on port ${PORT}`, { port: PORT });
    }
    catch (err) {
        logger.fatal('Failed to start Observability', { error: err.message });
        process.exit(1);
    }
}
process.on('SIGTERM', async () => { await flushLogs(); await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await flushLogs(); await app.close(); process.exit(0); });
start();
