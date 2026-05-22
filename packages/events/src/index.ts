/**
 * @vistafam/events - NATS Event Bus Client
 * Typed event publishing and subscribing with schema validation
 */

import { connect, NatsConnection, JSONCodec, Msg, headers } from 'nats';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// ── Event Schema ───────────────────────────────────────────────

export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  source: z.string(),
  subject: z.string(),
  tenantId: z.string(),
  traceId: z.string(),
  version: z.string().default('v1'),
  type: z.string(),
  payload: z.record(z.unknown()),
  metadata: z.object({
    userId: z.string().optional(),
    clientIp: z.string().optional(),
    requestId: z.string().optional(),
  }).optional(),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

// ── NATS Client ──────────────────────────────────────────────

let natsConnection: NatsConnection | null = null;
const jc = JSONCodec<BaseEvent>();

export interface EventBusConfig {
  servers: string | string[];
  serviceName: string;
  reconnectTimeWait?: number;
  maxReconnectAttempts?: number;
}

export async function connectEventBus(config: EventBusConfig): Promise<NatsConnection> {
  natsConnection = await connect({
    servers: config.servers,
    name: config.serviceName,
    reconnectTimeWait: config.reconnectTimeWait ?? 2000,
    maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
  });

  console.log(`[events] Connected to NATS as ${config.serviceName}`);
  return natsConnection;
}

export function getConnection(): NatsConnection {
  if (!natsConnection) {
    throw new Error('NATS connection not established. Call connectEventBus first.');
  }
  return natsConnection;
}

// ── Event Factory ────────────────────────────────────────────

export interface CreateEventParams {
  type: string;
  tenantId: string;
  traceId?: string;
  source?: string;
  payload: Record<string, unknown>;
  metadata?: BaseEvent['metadata'];
}

export function createEvent(params: CreateEventParams): BaseEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    source: params.source ?? 'unknown',
    subject: '', // set during publish
    tenantId: params.tenantId,
    traceId: params.traceId ?? randomUUID(),
    version: 'v1',
    type: params.type,
    payload: params.payload,
    metadata: params.metadata,
  };
}

// ── Publish ──────────────────────────────────────────────────

export async function publish(
  subject: string,
  params: Omit<CreateEventParams, 'source'> & { source: string }
): Promise<void> {
  const conn = getConnection();
  const event = createEvent(params);
  event.subject = subject;

  const h = headers();
  h.append('trace-id', event.traceId);
  h.append('tenant-id', event.tenantId);

  conn.publish(subject, jc.encode(event), { headers: h });
}

export async function requestReply<T>(
  subject: string,
  params: Omit<CreateEventParams, 'source'> & { source: string },
  timeoutMs = 5000
): Promise<T> {
  const conn = getConnection();
  const event = createEvent(params);
  event.subject = subject;

  const h = headers();
  h.append('trace-id', event.traceId);
  h.append('tenant-id', event.tenantId);

  const response = await conn.request(subject, jc.encode(event), {
    timeout: timeoutMs,
    headers: h,
  });

  return jc.decode(response.data) as T;
}

// ── Subscribe ────────────────────────────────────────────────

export interface SubscriptionOptions {
  queue?: string;
  maxMessages?: number;
}

export async function subscribe(
  subject: string,
  handler: (event: BaseEvent, msg: Msg) => Promise<void> | void,
  options?: SubscriptionOptions
): Promise<{ unsubscribe: () => void }> {
  const conn = getConnection();

  const sub = conn.subscribe(subject, {
    queue: options?.queue,
    max: options?.maxMessages,
  });

  (async () => {
    for await (const msg of sub) {
      try {
        const event = jc.decode(msg.data);
        await handler(event, msg);
        if (!msg.didRespond) msg.ack?.();
      } catch (error) {
        console.error(`[events] Error handling message on ${subject}:`, error);
        msg.nak?.();
      }
    }
  })();

  return {
    unsubscribe: () => sub.unsubscribe(),
  };
}

export async function waitFor(
  subject: string,
  timeoutMs = 5000
): Promise<BaseEvent> {
  const conn = getConnection();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event on ${subject}`));
    }, timeoutMs);

    const sub = conn.subscribe(subject, { max: 1 });

    (async () => {
      for await (const msg of sub) {
        clearTimeout(timer);
        resolve(jc.decode(msg.data));
        break;
      }
    })();
  });
}

// ── JetStream Utilities ────────────────────────────────────────

export async function createStream(
  streamName: string,
  subjects: string[],
  options?: {
    retention?: 'limits' | 'workqueue' | 'interest';
    maxMsgs?: number;
    maxAge?: number;
  }
): Promise<void> {
  const conn = getConnection();
  const jsm = await conn.jetstreamManager();

  try {
    await jsm.streams.add({
      name: streamName,
      subjects,
      retention: options?.retention ?? 'limits',
      max_msgs: options?.maxMsgs ?? 10_000_000,
      max_age: options?.maxAge ?? 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    console.log(`[events] Created JetStream stream: ${streamName}`);
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log(`[events] Stream ${streamName} already exists`);
    } else {
      throw err;
    }
  }
}

// ── Graceful Drain ───────────────────────────────────────────

export async function drain(): Promise<void> {
  if (natsConnection) {
    await natsConnection.drain();
    natsConnection = null;
  }
}

// ── Re-exports ───────────────────────────────────────────────

export { NatsConnection, Msg } from 'nats';
