/**
 * Event Integration Worker
 * Consumes NATS ecosystem events and routes to TeamSync channels/notifications
 */

import { ServiceLogger } from '@vistafam/pipevista-core';
import { connect, JSONCodec, NatsConnection, JetStreamClient } from 'nats';
import { getSupabase } from '../lib/supabase.js';
import { broadcastEvent } from '../lib/realtime-client.js';

const logger = new ServiceLogger('teamsync:event-integration-worker');
const jc = JSONCodec();

const SUBJECT_MAP: Record<string, { channel: string; type: string; urgent: boolean }> = {
  'flowboard.execution.completed': { channel: '#workflows', type: 'workflow', urgent: false },
  'flowboard.approval.requested': { channel: '#approvals', type: 'approval', urgent: true },
  'deployhub.deployment.succeeded': { channel: '#deployments', type: 'deployment', urgent: false },
  'deployhub.deployment.failed': { channel: '#incidents', type: 'incident', urgent: true },
  'loglens.alert.critical': { channel: '#incidents', type: 'incident', urgent: true },
  'loglens.alert.warning': { channel: '#incidents', type: 'incident', urgent: false },
  'vaultspace.secret.rotated': { channel: '#security', type: 'workflow', urgent: false },
  'pipevista.system.event': { channel: '#system', type: 'workflow', urgent: false },
};

export async function startEventIntegrationWorker(): Promise<{ close: () => Promise<void> }> {
  try {
    const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://localhost:4222' });
    const js = nc.jetstream();

    const consumer = await js.consumers.open('TEAMSYNC_EVENTS', 'teamsync-integration');

    logger.info('Event integration worker started');

    (async () => {
      for await (const msg of consumer.consume({ max_messages: 100 })) {
        try {
          const event = jc.decode(msg.data) as {
            subject: string;
            tenantId: string;
            payload: Record<string, unknown>;
          };

          await handleEcosystemEvent(event);
          msg.ack();
        } catch (err) {
          logger.error('Failed to process event', { error: (err as Error).message });
          msg.nak();
        }
      }
    })();

    return {
      close: async () => {
        await nc.drain();
        await nc.close();
      },
    };
  } catch (err) {
    logger.warn('NATS not available, event integration worker disabled', { error: (err as Error).message });
    return {
      close: async () => { /* no-op */ },
    };
  }
}

async function handleEcosystemEvent(event: {
  subject: string;
  tenantId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const config = SUBJECT_MAP[event.subject];
  if (!config) {
    logger.warn('Unknown event subject', { subject: event.subject });
    return;
  }

  const supabase = getSupabase();

  // Find target channel
  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('name', config.channel)
    .eq('workspace_id', event.tenantId)
    .single();

  const channelId = channel?.id;

  // Create system message
  if (channelId) {
    const { data: message } = await supabase.from('messages').insert({
      channel_id: channelId,
      sender_id: 'system',
      sender_name: 'system-bot',
      content: `${event.subject}: ${JSON.stringify(event.payload).slice(0, 500)}`,
      is_ai: false,
    }).select().single();

    if (message) {
      await broadcastEvent({
        tenantId: event.tenantId,
        channelId,
        eventName: 'message:new',
        payload: message,
      });
    }
  }

  // Notify relevant users
  const targetUsers =
    (event.payload.assignees as string[]) ??
    (event.payload.approvers as string[]) ??
    (event.payload.notifyUsers as string[]) ??
    [];

  for (const userId of targetUsers) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: config.type,
      title: `${event.subject}`,
      body: JSON.stringify(event.payload).slice(0, 200),
      source_service: event.subject.split('.')[0],
      source_id: event.payload.id as string,
      metadata: event.payload,
    });

    await broadcastEvent({
      tenantId: event.tenantId,
      userIds: [userId],
      eventName: 'notification:new',
      payload: { type: config.type, subject: event.subject },
    });
  }

  logger.info('Processed ecosystem event', {
    subject: event.subject,
    tenantId: event.tenantId,
    channel: config.channel,
    notifiedUsers: targetUsers.length,
  });
}
