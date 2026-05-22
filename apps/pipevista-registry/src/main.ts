/**
 * PipeVista Registry - Service Registry
 * Health monitoring, discovery, endpoint registry, dynamic routing, config distribution
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createRedisClient, buildKey, KeyPrefixes, setJson, getJson } from '@vistafam/pipevista-core';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { ServiceRegistration, ServiceInstance, ServiceHealthStatus, SystemHealth } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('pipevista-registry');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4103', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const redis = createRedisClient({ url: REDIS_URL });
const registry = new Map<string, ServiceInstance>();
const configs = new Map<string, { value: unknown; version: number; updatedAt: string }>();

app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-registry' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-registry' }));

// ── Registration ─────────────────────────────────────────────

app.post('/v1/registry/register', async (req, reply) => {
  const body = req.body as ServiceRegistration;
  const instance: ServiceInstance = {
    ...body,
    status: 'healthy',
    lastHeartbeat: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  registry.set(body.id, instance);
  await setJson(redis, buildKey(KeyPrefixes.REGISTRY, 'service', body.name), instance, 30000);
  logger.info(`Service registered: ${body.name} (${body.id}) at ${body.host}:${body.port}`);
  reply.status(201).send(instance);
});

app.post('/v1/registry/heartbeat/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const service = registry.get(id);
  if (!service) { reply.status(404).send({ error: 'Service not found' }); return; }

  service.lastHeartbeat = new Date().toISOString();
  service.status = 'healthy';
  service.updatedAt = new Date().toISOString();
  registry.set(id, service);

  await setJson(redis, buildKey(KeyPrefixes.REGISTRY, 'health', id), { status: 'healthy', lastHeartbeat: service.lastHeartbeat }, 15000);
  reply.send({ success: true, status: 'healthy' });
});

app.get('/v1/registry/services', async () => ({
  services: Array.from(registry.values()),
  total: registry.size,
  healthy: Array.from(registry.values()).filter((s) => s.status === 'healthy').length,
}));

app.get('/v1/registry/services/:name', async (req, reply) => {
  const { name } = req.params as { name: string };
  const instances = Array.from(registry.values()).filter((s) => s.name === name);
  if (instances.length === 0) { reply.status(404).send({ error: 'Service not found' }); return; }
  reply.send({ name, instances });
});

app.delete('/v1/registry/deregister/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const service = registry.get(id);
  if (service) {
    registry.delete(id);
    await redis.del(buildKey(KeyPrefixes.REGISTRY, 'health', id));
    logger.info(`Service deregistered: ${id}`);
  }
  reply.send({ success: true });
});

// ── Health Monitoring ────────────────────────────────────────

app.get('/v1/registry/health/system', async (): Promise<SystemHealth> => ({
  overall: 'healthy',
  lastUpdated: new Date().toISOString(),
  services: Array.from(registry.values()).map((s) => ({
    name: s.name,
    status: s.status,
    instances: { total: 1, healthy: s.status === 'healthy' ? 1 : 0, degraded: s.status === 'degraded' ? 1 : 0, unhealthy: s.status === 'unhealthy' ? 1 : 0 },
    latency: { p50: 15, p95: 45, p99: 120 },
    errorRate: 0,
    throughput: 0,
  })),
  infrastructure: {
    database: { status: 'up', utilization: 25 },
    cache: { status: 'up', utilization: 15 },
    messaging: { status: 'up', utilization: 10 },
    storage: { status: 'up', utilization: 5 },
  },
}));

// ── Config Distribution ──────────────────────────────────────

app.get('/v1/config/:key', async (req) => {
  const { key } = req.params as { key: string };
  const tenantId = (req.query as any).tenantId;
  const service = (req.query as any).service;

  const scopedKey = `${key}:${tenantId ?? 'global'}:${service ?? 'global'}`;
  const cached = await getJson(redis, buildKey(KeyPrefixes.CONFIG, scopedKey));

  return { key, value: cached ?? configs.get(key)?.value ?? null, scope: { tenantId, service } };
});

app.put('/v1/config/:key', async (req, reply) => {
  const { key } = req.params as { key: string };
  const body = req.body as { value: unknown; scope?: { tenantId?: string; service?: string } };

  const entry = { value: body.value, version: (configs.get(key)?.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  configs.set(key, entry);

  const scopedKey = `${key}:${body.scope?.tenantId ?? 'global'}:${body.scope?.service ?? 'global'}`;
  await setJson(redis, buildKey(KeyPrefixes.CONFIG, scopedKey), entry.value);

  logger.info(`Config updated: ${key}`, { scope: body.scope });
  reply.send({ success: true, key, version: entry.version });
});

// ── Dependency Graph ─────────────────────────────────────────

app.get('/v1/registry/topology', async () => {
  const nodes = Array.from(registry.values()).map((s) => ({ id: s.id, name: s.name, version: s.version, status: s.status }));
  const edges: Array<{ from: string; to: string }> = [];
  for (const service of registry.values()) {
    for (const dep of service.dependencies) {
      const depService = Array.from(registry.values()).find((s) => s.name === dep);
      if (depService) edges.push({ from: service.id, to: depService.id });
    }
  }
  return { nodes, edges };
});

async function start() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`PipeVista Registry listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start Registry', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });

start();
