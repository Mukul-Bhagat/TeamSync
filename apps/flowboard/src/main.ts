/**
 * VistaFam FlowBoard - Workflow Orchestration Engine
 * DAG execution, event triggers, automation, AI orchestration
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ServiceLogger } from '@vistafam/pipevista-core';

// API routes
import { workflowRoutes } from './api/workflows.js';
import { executionRoutes } from './api/executions.js';
import { approvalRoutes } from './api/approvals.js';
import { taskRoutes } from './api/tasks.js';

// Workers
import { createStepWorker } from './workers/step-worker.js';
import { createEventWorker } from './workers/event-worker.js';
import { createRetryWorker } from './workers/retry-worker.js';
import { createSchedulerWorker } from './workers/scheduler-worker.js';

// Trigger router
import { rebuildTriggerCache } from './engine/trigger-router.js';
import { PrismaClient } from '@prisma/client';

const logger = new ServiceLogger('flowboard');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4003', 10);
const prisma = new PrismaClient();

// ── Health Endpoints ───────────────────────────────────────

app.get('/health/live', async () => ({ status: 'alive', service: 'flowboard' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'flowboard' }));

// ── API Routes ─────────────────────────────────────────────

app.register(workflowRoutes, { prefix: '/api' });
app.register(executionRoutes, { prefix: '/api' });
app.register(approvalRoutes, { prefix: '/api' });
app.register(taskRoutes, { prefix: '/api' });

// ── Webhook Trigger Endpoint ───────────────────────────────

app.post('/api/v1/webhooks/:workflowId', async (req, reply) => {
  const { workflowId } = req.params as { workflowId: string };
  const body = req.body as Record<string, unknown>;
  const tenantId = (req.headers['x-tenant-id'] as string) ?? 'default';

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) { reply.status(404).send({ error: 'Workflow not found' }); return; }

  const { createExecution, startExecution } = await import('./engine/execution-manager.js');
  const execution = await createExecution({
    workflowId,
    tenantId,
    triggerType: 'webhook',
    triggerEvent: body,
    triggerMetadata: { webhookPath: `/api/v1/webhooks/${workflowId}` },
  });

  await startExecution(execution.id);
  reply.status(202).send({ executionId: execution.id, status: 'running' });
});

// ── Event Ingestion Endpoint (from PipeVista Event Hub) ────

app.post('/api/v1/events/ingest', async (req, reply) => {
  const body = req.body as {
    subject: string;
    tenantId: string;
    payload: Record<string, unknown>;
    traceId?: string;
  };

  const { Queue } = await import('bullmq');
  const Redis = (await import('ioredis')).default;
  const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  redisConnection.on('error', (err) => logger.warn('Redis connection error', { error: err.message }));
  const eventQueue = new Queue('flowboard-events', { connection: redisConnection });

  await eventQueue.add('event', body);
  reply.status(202).send({ received: true, subject: body.subject });
});

// ── Templates ──────────────────────────────────────────────

app.get('/api/v1/templates', async () => {
  const templates = await prisma.workflowTemplate.findMany();
  return { templates };
});

app.post('/api/v1/templates/:id/instantiate', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as { tenantId: string; name: string; createdBy: string };

  const template = await prisma.workflowTemplate.findUnique({ where: { id } });
  if (!template) { reply.status(404).send({ error: 'Template not found' }); return; }

  const workflow = await prisma.workflow.create({
    data: {
      tenantId: body.tenantId,
      name: body.name ?? template.name,
      description: template.description,
      status: 'draft',
      definition: template.definition as any,
      createdBy: body.createdBy,
    },
  });

  reply.status(201).send({ workflow });
});

// ── Startup ────────────────────────────────────────────────

async function start() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  // Rebuild trigger cache from database
  try {
    const triggers = await prisma.workflowTrigger.findMany({
      where: { isActive: true },
    });
    await rebuildTriggerCache(
      triggers.map((t) => ({
        triggerId: t.id,
        workflowId: t.workflowId,
        tenantId: t.tenantId,
        type: t.type as 'event' | 'cron' | 'webhook' | 'manual',
        config: t.config as Record<string, unknown>,
      }))
    );
    logger.info(`Rebuilt trigger cache with ${triggers.length} active triggers`);
  } catch (err) {
    logger.warn('Failed to rebuild trigger cache at startup', { error: (err as Error).message });
  }

  // Start workers
  const stepWorker = createStepWorker(5);
  const eventWorker = createEventWorker(3);
  const retryWorker = createRetryWorker(3);
  const schedulerWorker = createSchedulerWorker();

  logger.info('Workers started: step(5), event(3), retry(3), scheduler(1)');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down workers and server...');
    await stepWorker.close();
    await eventWorker.close();
    await retryWorker.close();
    await schedulerWorker.close();
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Shutting down workers and server...');
    await stepWorker.close();
    await eventWorker.close();
    await retryWorker.close();
    await schedulerWorker.close();
    await app.close();
    process.exit(0);
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`FlowBoard listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start FlowBoard', { error: (err as Error).message });
    process.exit(1);
  }
}

start();
