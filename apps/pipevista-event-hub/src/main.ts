/**
 * PipeVista Event Hub - Event Infrastructure
 * Pub/sub, workflow triggers, retries, DLQ, failure recovery, event replay
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { connectNATS, getNATSConnection, createPipeVistaEvent, publishEvent, createStream, subscribeToEvents } from '@vistafam/pipevista-core';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { PipeVistaEvent } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('pipevista-event-hub');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4101', 10);
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';

// DLQ storage (in-memory, replace with PostgreSQL in production)
const dlq = new Map<string, { event: PipeVistaEvent; attempts: number; lastError: string; failedAt: string }>();
const eventStore = new Map<string, PipeVistaEvent>();
const workflowTriggers = new Map<string, { eventPattern: string; workflowId: string }>();

app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-event-hub' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-event-hub' }));

// ── Event Publishing API ───────────────────────────────────

app.post('/v1/events/publish', async (req, reply) => {
  const body = req.body as { type: string; tenantId: string; traceId?: string; payload: Record<string, unknown>; subject?: string };
  const event = createPipeVistaEvent({
    source: 'pipevista-event-hub',
    type: body.type,
    tenantId: body.tenantId,
    traceId: body.traceId,
    payload: body.payload,
  });

  const subject = body.subject ?? `${body.type.replace(/\./g, '_')}.v1`;

  try {
    await publishEvent(subject, event);
    eventStore.set(event.id, event);
    logger.info(`Event published: ${subject}`, { eventId: event.id, tenantId: body.tenantId });

    // Check workflow triggers
    for (const [triggerId, trigger] of workflowTriggers) {
      if (subject.match(new RegExp(trigger.eventPattern.replace(/\*/g, '.*')))) {
        logger.info(`Triggering workflow ${trigger.workflowId} for event ${subject}`);
        // TODO: Enqueue FlowBoard workflow trigger
      }
    }

    reply.status(202).send({ success: true, eventId: event.id, subject });
  } catch (error: any) {
    logger.error('Failed to publish event', { error: error.message, subject });
    reply.status(500).send({ error: 'Event publish failed', message: error.message });
  }
});

// ── Subscription Management ──────────────────────────────────

app.get('/v1/events/subscriptions', async () => ({
  streams: ['AUDIT', 'DOMAIN', 'WORKFLOW', 'LOGS', 'AI', 'REALTIME'],
  activeConsumers: [],
}));

// ── DLQ Management ───────────────────────────────────────────

app.get('/v1/events/dlq', async () => ({
  deadLetters: Array.from(dlq.entries()).map(([id, entry]) => ({
    id,
    eventType: entry.event.type,
    attempts: entry.attempts,
    lastError: entry.lastError,
    failedAt: entry.failedAt,
  })),
}));

app.post('/v1/events/dlq/:id/replay', async (req, reply) => {
  const { id } = req.params as { id: string };
  const entry = dlq.get(id);
  if (!entry) { reply.status(404).send({ error: 'DLQ entry not found' }); return; }

  dlq.delete(id);
  await publishEvent(entry.event.subject, entry.event);
  logger.info(`Replayed DLQ event: ${id}`);
  reply.send({ success: true, replayed: id });
});

// ── Workflow Triggers ────────────────────────────────────────

app.post('/v1/events/triggers', async (req, reply) => {
  const body = req.body as { eventPattern: string; workflowId: string };
  const id = crypto.randomUUID();
  workflowTriggers.set(id, body);
  logger.info(`Workflow trigger registered: ${body.eventPattern} -> ${body.workflowId}`);
  reply.status(201).send({ id, ...body });
});

// ── Event Replay ───────────────────────────────────────────────

app.post('/v1/events/replay', async (req, reply) => {
  const body = req.body as { fromTimestamp: string; toTimestamp: string; subjectFilter?: string };
  const replayed: string[] = [];

  for (const [id, event] of eventStore) {
    if (event.timestamp >= body.fromTimestamp && event.timestamp <= body.toTimestamp) {
      if (!body.subjectFilter || event.subject.includes(body.subjectFilter)) {
        await publishEvent(event.subject, event);
        replayed.push(id);
      }
    }
  }

  logger.info(`Replayed ${replayed.length} events`);
  reply.send({ replayed: replayed.length, eventIds: replayed });
});

async function start() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  try {
    await connectNATS({ servers: NATS_URL, serviceName: 'pipevista-event-hub' });
    // Create standard streams
    await createStream('DOMAIN', ['*.>'], { retention: 'limits', maxMsgs: 50_000_000 });
    await createStream('AUDIT', ['auth.audit.>'], { retention: 'limits', maxMsgs: 10_000_000 });
  } catch (err) {
    logger.warn('NATS not available, running in local-only mode', { error: (err as Error).message });
  }

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`PipeVista Event Hub listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start Event Hub', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });

start();
