/**
 * Direct Message Routes
 * DM conversations and messages
 */

import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import { broadcastEvent } from '../lib/realtime-client.js';

export async function dmRoutes(app: FastifyInstance) {
  // ── List DM conversations ───────────────────────────────
  app.get('/v1/dms', async (req) => {
    const userId = (req.headers['x-user-id'] as string) ?? '';
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('dm_conversations')
      .select('*, user_a:users!dm_conversations_user_a_id_fkey(id, display_name, avatar_url), user_b:users!dm_conversations_user_b_id_fkey(id, display_name, avatar_url)')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) return { conversations: [], error: error.message };
    return { conversations: data ?? [] };
  });

  // ── Get or create DM conversation ──────────────────────
  app.post('/v1/dms', async (req, reply) => {
    const body = req.body as { user_a_id: string; user_b_id: string };
    const supabase = getSupabase();

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(`and(user_a_id.eq.${body.user_a_id},user_b_id.eq.${body.user_b_id}),and(user_a_id.eq.${body.user_b_id},user_b_id.eq.${body.user_a_id})`)
      .single();

    if (existing) { reply.send({ conversation: existing }); return; }

    const { data, error } = await supabase.from('dm_conversations').insert({
      user_a_id: body.user_a_id,
      user_b_id: body.user_b_id,
    }).select().single();

    if (error || !data) { reply.status(500).send({ error: error?.message ?? 'Failed' }); return; }
    reply.status(201).send({ conversation: data });
  });

  // ── List DM messages ───────────────────────────────────
  app.get('/v1/dms/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    const { before, limit = '50' } = req.query as { before?: string; limit?: string };
    const supabase = getSupabase();

    let query = supabase
      .from('dm_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) return { messages: [], error: error.message };
    return { messages: (data ?? []).reverse() };
  });

  // ── Send DM message ────────────────────────────────────
  app.post('/v1/dms/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { content: string; sender_id: string };
    const tenantId = (req.headers['x-tenant-id'] as string) ?? 'default';
    const supabase = getSupabase();

    const { data: message, error } = await supabase
      .from('dm_messages')
      .insert({ conversation_id: id, sender_id: body.sender_id, content: body.content })
      .select()
      .single();

    if (error || !message) { reply.status(500).send({ error: error?.message ?? 'Failed' }); return; }

    // Update conversation last_message_at
    await supabase.from('dm_conversations').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', id);

    // Get the other user in the conversation
    const { data: conv } = await supabase.from('dm_conversations').select('user_a_id, user_b_id').eq('id', id).single();
    if (conv) {
      const otherUserId = conv.user_a_id === body.sender_id ? conv.user_b_id : conv.user_a_id;

      // Notify other user
      await supabase.from('notifications').insert({
        user_id: otherUserId,
        type: 'mention',
        title: 'New direct message',
        body: body.content.slice(0, 100),
        source_service: 'teamsync',
        source_id: message.id,
      });

      // Broadcast to both users via Realtime
      await broadcastEvent({
        tenantId,
        userIds: [otherUserId],
        eventName: 'dm:message',
        payload: message,
      });
    }

    reply.status(201).send({ message });
  });

  // ── Mark DM as read ────────────────────────────────────
  app.post('/v1/dms/:id/read', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = (req.headers['x-user-id'] as string) ?? '';
    const supabase = getSupabase();

    // Mark all unread messages from the other user as read
    const { data: conv } = await supabase.from('dm_conversations').select('user_a_id, user_b_id').eq('id', id).single();
    if (!conv) { reply.status(404).send({ error: 'Conversation not found' }); return; }

    const otherUserId = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id;

    const { error } = await supabase.from('dm_messages').update({ is_read: true })
      .eq('conversation_id', id)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);

    if (error) { reply.status(500).send({ error: error.message }); return; }
    reply.send({ success: true });
  });
}
