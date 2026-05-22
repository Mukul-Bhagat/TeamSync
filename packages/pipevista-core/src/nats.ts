/**
 * PipeVista NATS Client Manager
 * Shared NATS connection with typed publish/subscribe and JetStream helpers
 */

import { connect, NatsConnection, JSONCodec, Msg, headers, StringCodec } from 'nats';
import { randomUUID } from 'crypto';
import { PipeVistaEvent, EventPublishRequest } from './types';

let natsConnection: NatsConnection | null = null;
const jc = JSONCodec<PipeVistaEvent>();
const sc = StringCodec();

export interface NATSConfig {
  servers: string | string[];
  serviceName: string;
  reconnectTimeWait?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  maxPingOut?: number;
}

export async function connectNATS(config: NATSConfig): Promise<NatsConnection> {
  natsConnection = await connect({
    servers: config.servers,
    name: config.serviceName,
    reconnectTimeWait: config.reconnectTimeWait ?? 2000,
    maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
    pingInterval: config.pingInterval ?? 2000,
    maxPingOut: config.maxPingOut ?? 3,
  });

  console.log(`[pipevista-core:nats] Connected as ${config.serviceName}`);

  natsConnection.closed().then((err) => {
    if (err) {
      console.error(`[pipevista-core:nats] Connection closed with error: ${err.message}`);
    } else {
      console.log('[pipevista-core:nats] Connection closed cleanly');
    }
  });

  return natsConnection;
}

export function getNATSConnection(): NatsConnection {
  if (!natsConnection) {
    throw new Error('NATS connection not established. Call connectNATS first.');
  }
  return natsConnection;
}

// ── Event Factory ──────────────────────────────────────────

export function createPipeVistaEvent(
  request: EventPublishRequest & { source: string }
): PipeVistaEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    source: request.source,
    subject: '',
    tenantId: request.tenantId,
    traceId: request.traceId ?? randomUUID(),
    version: 'v1',
    type: request.type,
    payload: request.payload,
    metadata: request.metadata,
  };
}

// ── Publish ──────────────────────────────────────────────────

export async function publishEvent(
  subject: string,
  event: PipeVistaEvent
): Promise<void> {
  const conn = getNATSConnection();
  event.subject = subject;

  const h = headers();
  h.append('trace-id', event.traceId);
  h.append('tenant-id', event.tenantId);
  h.append('source', event.source);

  conn.publish(subject, jc.encode(event), { headers: h });
}

export async function requestReply<T>(
  subject: string,
  event: PipeVistaEvent,
  timeoutMs = 5000
): Promise<T> {
  const conn = getNATSConnection();
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

// ── Subscribe ──────────────────────────────────────────────

export interface SubscriptionHandle {
  unsubscribe: () => void;
}

export async function subscribeToEvents(
  subject: string,
  handler: (event: PipeVistaEvent, msg: Msg) => Promise<void> | void,
  options?: { queue?: string; maxMessages?: number }
): Promise<SubscriptionHandle> {
  const conn = getNATSConnection();

  const sub = conn.subscribe(subject, {
    queue: options?.queue,
    max: options?.maxMessages,
  });

  (async () => {
    for await (const msg of sub) {
      try {
        const event = jc.decode(msg.data);
        await handler(event, msg);
        if (msg.respond) {
          msg.respond(sc.encode('OK'));
        }
      } catch (error) {
        console.error(`[pipevista-core:nats] Error handling ${subject}:`, error);
        const m = msg as any;
        if (m.nak) m.nak();
      }
    }
  })();

  return { unsubscribe: () => sub.unsubscribe() };
}

// ── JetStream ──────────────────────────────────────────────

export async function createStream(
  streamName: string,
  subjects: string[],
  options?: {
    retention?: 'limits' | 'workqueue' | 'interest';
    maxMsgs?: number;
    maxAge?: number;
    maxBytes?: number;
    replicas?: number;
  }
): Promise<void> {
  const conn = getNATSConnection();
  const jsm = await conn.jetstreamManager();

  try {
    await jsm.streams.add({
      name: streamName,
      subjects,
      retention: options?.retention ?? 'limits',
      max_msgs: options?.maxMsgs ?? 10_000_000,
      max_age: options?.maxAge ?? 30 * 24 * 60 * 60 * 1000,
      max_bytes: options?.maxBytes ?? -1,
      num_replicas: options?.replicas ?? 1,
    } as any);
    console.log(`[pipevista-core:nats] Stream created: ${streamName}`);
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log(`[pipevista-core:nats] Stream exists: ${streamName}`);
    } else {
      throw err;
    }
  }
}

export async function createConsumer(
  streamName: string,
  consumerName: string,
  subjectFilter: string,
  options?: { deliverGroup?: string; maxDeliver?: number; ackWait?: number }
): Promise<void> {
  const conn = getNATSConnection();
  const jsm = await conn.jetstreamManager();

  try {
    await jsm.consumers.add(streamName, {
      durable_name: consumerName,
      filter_subject: subjectFilter,
      deliver_group: options?.deliverGroup,
      max_deliver: options?.maxDeliver ?? 5,
      ack_wait: options?.ackWait ?? 30_000,
      ack_policy: 'explicit',
    } as any);
    console.log(`[pipevista-core:nats] Consumer created: ${consumerName} on ${streamName}`);
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log(`[pipevista-core:nats] Consumer exists: ${consumerName}`);
    } else {
      throw err;
    }
  }
}

// ── Graceful Drain ─────────────────────────────────────────

export async function drainNATS(): Promise<void> {
  if (natsConnection) {
    await natsConnection.drain();
    natsConnection = null;
  }
}

export { NatsConnection, Msg } from 'nats';
