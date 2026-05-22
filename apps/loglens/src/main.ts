/**
 * VistaFam LogLens - Centralized Log Aggregation and Observability
 * Log ingestion, querying, alerting
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createLogger } from '@vistafam/logger';

const logger = createLogger('loglens');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4007', 10);

app.get('/health/live', async () => ({ status: 'alive' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0' }));

// Log ingestion (push to Loki)
app.post('/api/v1/logs/ingest', async (req, reply) => {
  const body = req.body as { stream: Record<string, string>; values: [string, string][] };
  logger.info(`Log batch ingested: ${body.values.length} entries`);
  // TODO: Forward to Loki
  reply.status(204).send();
});

// Log query (proxy to Loki)
app.get('/api/v1/logs/query', async (req) => {
  const query = (req.query as any).query ?? '{job="vistafam"}';
  // TODO: Query Loki
  return {
    query,
    results: [],
    stats: { totalBytes: 0, executionTimeMs: 0 },
  };
});

// Alerts
app.get('/api/v1/alerts', async () => ({
  alerts: [
    { id: 'alert-1', name: 'High Error Rate', condition: 'rate(error) > 0.01', status: 'active' },
  ],
}));

app.post('/api/v1/alerts', async (req, reply) => {
  const body = req.body as { name: string; condition: string };
  logger.info(`Alert created: ${body.name}`);
  reply.status(201).send({ id: crypto.randomUUID(), ...body });
});

// Dashboards
app.get('/api/v1/dashboards', async () => ({
  dashboards: [
    { id: 'dash-1', name: 'System Overview', panels: [] },
    { id: 'dash-2', name: 'AI Usage', panels: [] },
  ],
}));

async function start() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`LogLens listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start LogLens', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });

start();
