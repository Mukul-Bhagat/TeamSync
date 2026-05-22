/**
 * Message Routes
 * Messages, reactions, threads, mentions
 */

import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import { broadcastEvent } from '../lib/realtime-client.js';

export async function messageRoutes(app: FastifyInstance) {
  // ── List messages ──────────────────────────────────────
  app.get('/v1/channels/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    const { before, limit = '50' } = req.query as { before?: string; limit?: string };
    const supabase = getSupabase();

    let query = supabase
      .from('messages')
      .select('*, message_reactions(*), message_mentions(*)')
      .eq('channel_id', id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) return { messages: [], error: error.message };
    return { messages: (data ?? []).reverse() };
  });

  // ── Send message ───────────────────────────────────────
  app.post('/v1/channels/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      content: string;
      sender_id: string;
      sender_name: string;
      sender_avatar?: string;
      parent_message_id?: string;
    };
    const tenantId = (req.headers['x-tenant-id'] as string) ?? 'default';
    const supabase = getSupabase();

    // Insert message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        channel_id: id,
        sender_id: body.sender_id,
        sender_name: body.sender_name,
        sender_avatar: body.sender_avatar,
        content: body.content,
        parent_message_id: body.parent_message_id ?? null,
      })
      .select()
      .single();

    if (error || !message) { reply.status(500).send({ error: error?.message ?? 'Failed' }); return; }

    // Handle thread reply
    if (body.parent_message_id) {
      const { data: thread } = await supabase.from('message_threads')
        .select('reply_count').eq('parent_message_id', body.parent_message_id).single();

      await supabase.from('message_threads').upsert({
        parent_message_id: body.parent_message_id,
        reply_count: (thread?.reply_count ?? 0) + 1,
        last_reply_at: new Date().toISOString(),
      }, { onConflict: 'parent_message_id' });

      // Notify parent message author
      const { data: parent } = await supabase.from('messages').select('sender_id').eq('id', body.parent_message_id).single();
      if (parent && parent.sender_id !== body.sender_id) {
        await supabase.from('notifications').insert({
          user_id: parent.sender_id,
          type: 'reply',
          title: 'New reply to your message',
          body: `${body.sender_name}: ${body.content.slice(0, 100)}`,
          source_service: 'teamsync',
          source_id: message.id,
        });
      }
    }

    // Extract mentions (@username)
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = [...body.content.matchAll(mentionRegex)];
    for (const match of mentions) {
      const username = match[1];
      // Find user by display_name (simplified - in production use username field)
      const { data: mentionedUser } = await supabase.from('users').select('id').eq('display_name', username).single();
      if (mentionedUser) {
        await supabase.from('message_mentions').insert({
          message_id: message.id,
          mentioned_user_id: mentionedUser.id,
        });
        await supabase.from('notifications').insert({
          user_id: mentionedUser.id,
          type: 'mention',
          title: 'You were mentioned',
          body: `${body.sender_name} mentioned you in #${id}`,
          source_service: 'teamsync',
          source_id: message.id,
        });
      }
    }

    // Audit log
    await supabase.from('message_audit_logs').insert({
      message_id: message.id,
      actor_id: body.sender_id,
      action: 'create',
      metadata: { channel_id: id },
    });

    // Broadcast via PipeVista Realtime
    await broadcastEvent({
      tenantId,
      channelId: id,
      eventName: 'message:new',
      payload: message,
    });

    reply.status(201).send({ message });
  });

  // ── Get single message ─────────────────────────────────
  app.get('/v1/messages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('messages')
      .select('*, message_reactions(*), message_mentions(*)')
      .eq('id', id)
      .single();

    if (error || !data) { reply.status(404).send({ error: 'Message not found' }); return; }
    reply.send({ message: data });
  });

  // ── Update message ─────────────────────────────────────
  app.patch('/v1/messages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { content: string; editor_id: string };
    const supabase = getSupabase();

    // Get previous content for audit
    const { data: prev } = await supabase.from('messages').select('content').eq('id', id).single();

    const { data, error } = await supabase.from('messages').update({ content: body.content }).eq('id', id).select().single();
    if (error || !data) { reply.status(500).send({ error: error?.message ?? 'Failed' }); return; }

    await supabase.from('message_audit_logs').insert({
      message_id: id,
      actor_id: body.editor_id,
      action: 'edit',
      previous_content: prev?.content,
    });

    reply.send({ message: data });
  });

  // ── Delete message ─────────────────────────────────────
  app.delete('/v1/messages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = (req.headers['x-user-id'] as string) ?? '';
    const supabase = getSupabase();

    await supabase.from('message_audit_logs').insert({
      message_id: id,
      actor_id: userId,
      action: 'delete',
    });

    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) { reply.status(500).send({ error: error.message }); return; }
    reply.send({ success: true });
  });

  // ── Get thread replies ─────────────────────────────────
  app.get('/v1/messages/:id/thread', async (req) => {
    const { id } = req.params as { id: string };
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('parent_message_id', id)
      .order('created_at', { ascending: true });

    return { replies: data ?? [], error: error?.message };
  });

  // ── Add reaction ───────────────────────────────────────
  app.post('/v1/messages/:id/reactions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { user_id: string; emoji: string };
    const tenantId = (req.headers['x-tenant-id'] as string) ?? 'default';
    const supabase = getSupabase();

    const { data, error } = await supabase.from('message_reactions').insert({
      message_id: id,
      user_id: body.user_id,
      emoji: body.emoji,
    }).select().single();

    if (error) { reply.status(500).send({ error: error.message }); return; }

    // Notify message author
    const { data: msg } = await supabase.from('messages').select('sender_id').eq('id', id).single();
    if (msg && msg.sender_id !== body.user_id) {
      await supabase.from('notifications').insert({
        user_id: msg.sender_id,
        type: 'reaction',
        title: 'New reaction',
        body: `Someone reacted with ${body.emoji}`,
        source_service: 'teamsync',
        source_id: id,
      });
    }

    await broadcastEvent({
      tenantId,
      channelId: (await supabase.from('messages').select('channel_id').eq('id', id).single()).data?.channel_id,
      eventName: 'reaction:added',
      payload: { messageId: id, userId: body.user_id, emoji: body.emoji },
    });

    reply.status(201).send({ reaction: data });
  });

  // ── Remove reaction ────────────────────────────────────
  app.delete('/v1/messages/:id/reactions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { user_id: string; emoji: string };
    const supabase = getSupabase();

    const { error } = await supabase.from('message_reactions').delete()
      .eq('message_id', id).eq('user_id', body.user_id).eq('emoji', body.emoji);

    if (error) { reply.status(500).send({ error: error.message }); return; }
    reply.send({ success: true });
  });
}
