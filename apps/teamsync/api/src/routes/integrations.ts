/**
 * Integration Routes
 * Ingest ecosystem events from FlowBoard, DeployHub, LogLens, VaultSpace
 */

import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import { broadcastEvent } from '../lib/realtime-client.js';

export async function integrationRoutes(app: FastifyInstance) {
  // ── Ingest external event ──────────────────────────────
  app.post('/v1/integrations/events', async (req, reply) => {
    const body = req.body as {
      subject: string;
      tenantId: string;
      source: 'flowboard' | 'deployhub' | 'loglens' | 'vaultspace' | 'pipevista';
      payload: Record<string, unknown>;
      severity?: 'info' | 'warning' | 'error' | 'critical';
    };

    const supabase = getSupabase();
    const { subject, tenantId, source, payload, severity = 'info' } = body;

    // Determine target channel based on source and subject
    let channelName: string;
    let notificationType: string;
    let isUrgent = false;

    switch (source) {
      case 'flowboard':
        channelName = '#workflows';
        notificationType = subject.includes('approval') ? 'approval' : 'workflow';
        isUrgent = subject.includes('approval');
        break;
      case 'deployhub':
        channelName = '#deployments';
        notificationType = 'deployment';
        isUrgent = severity === 'error' || severity === 'critical';
        if (isUrgent) channelName = '#incidents';
        break;
      case 'loglens':
        channelName = '#incidents';
        notificationType = 'incident';
        isUrgent = severity === 'critical';
        break;
      case 'vaultspace':
        channelName = '#security';
        notificationType = 'workflow';
        break;
      case 'pipevista':
        channelName = '#system';
        notificationType = 'workflow';
        break;
      default:
        channelName = '#general';
        notificationType = 'workflow';
    }

    // Find or get the system channel
    const { data: channel } = await supabase
      .from('channels')
      .select('id')
      .eq('name', channelName)
      .eq('workspace_id', tenantId)
      .single();

    const channelId = channel?.id;

    // Create a system message in the channel
    if (channelId) {
      const { data: message } = await supabase.from('messages').insert({
        channel_id: channelId,
        sender_id: 'system',
        sender_name: `${source}-bot`,
        content: `${subject}: ${JSON.stringify(payload).slice(0, 500)}`,
        is_ai: false,
      }).select().single();

      if (message) {
        await broadcastEvent({
          tenantId,
          channelId,
          eventName: 'message:new',
          payload: message,
        });
      }
    }

    // Create notifications for relevant users
    const targetUsers = (payload.assignees as string[]) ?? (payload.approvers as string[]) ?? [];
    for (const userId of targetUsers) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: notificationType,
        title: `${source}: ${subject}`,
        body: JSON.stringify(payload).slice(0, 200),
        source_service: source,
        source_id: payload.id as string,
        metadata: payload,
      });

      await broadcastEvent({
        tenantId,
        userIds: [userId],
        eventName: 'notification:new',
        payload: { type: notificationType, source, subject },
      });
    }

    reply.status(202).send({
      received: true,
      channel: channelName,
      channelId,
      notificationCount: targetUsers.length,
      isUrgent,
    });
  });

  // ── System channel setup ───────────────────────────────
  app.post('/v1/integrations/setup-channels', async (req, reply) => {
    const body = req.body as { workspaceId: string; createdBy: string };
    const supabase = getSupabase();

    const systemChannels = [
      { name: '#general', description: 'General workspace discussions' },
      { name: '#workflows', description: 'FlowBoard workflow updates' },
      { name: '#deployments', description: 'DeployHub deployment status' },
      { name: '#incidents', description: 'Critical alerts and incidents' },
      { name: '#security', description: 'VaultSpace security events' },
      { name: '#system', description: 'PipeVista system events' },
    ];

    const created = [];
    for (const ch of systemChannels) {
      const { data, error } = await supabase.from('channels').insert({
        name: ch.name,
        description: ch.description,
        workspace_id: body.workspaceId,
        is_private: false,
        created_by: body.createdBy,
      }).select().single();

      if (!error && data) {
        created.push(data);
      }
    }

    reply.status(201).send({ channels: created });
  });
}
