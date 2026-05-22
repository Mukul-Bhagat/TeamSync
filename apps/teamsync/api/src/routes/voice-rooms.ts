/**
 * Voice Room Routes
 * Room management and SFU token generation
 */

import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import { createRoom, generateParticipantToken, deleteRoom } from '../lib/sfu-adapter.js';

export async function voiceRoomRoutes(app: FastifyInstance) {
  // ── List voice rooms ───────────────────────────────────
  app.get('/v1/voice-rooms', async (req) => {
    const { channelId } = req.query as { channelId?: string };
    const supabase = getSupabase();

    let query = supabase
      .from('voice_rooms')
      .select('*, voice_room_participants(count)')
      .eq('is_active', true)
      .order('participant_count', { ascending: false });

    if (channelId) query = query.eq('channel_id', channelId);

    const { data, error } = await query;
    if (error) return { rooms: [], error: error.message };
    return { rooms: data ?? [] };
  });

  // ── Create voice room ──────────────────────────────────
  app.post('/v1/voice-rooms', async (req, reply) => {
    const body = req.body as {
      channelId?: string;
      name: string;
      description?: string;
      createdBy: string;
      maxParticipants?: number;
    };
    const supabase = getSupabase();

    // Create SFU room
    const sfuRoom = await createRoom(body.name, body.maxParticipants ?? 50);

    const { data, error } = await supabase.from('voice_rooms').insert({
      channel_id: body.channelId,
      name: body.name,
      description: body.description,
      created_by: body.createdBy,
      sfu_provider: 'livekit',
      sfu_room_id: sfuRoom.id,
      max_participants: body.maxParticipants ?? 50,
    }).select().single();

    if (error || !data) { reply.status(500).send({ error: error?.message ?? 'Failed' }); return; }
    reply.status(201).send({ room: data, sfu: sfuRoom });
  });

  // ── Get voice room ───────────────────────────────────
  app.get('/v1/voice-rooms/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('voice_rooms')
      .select('*, voice_room_participants(*)')
      .eq('id', id)
      .single();

    if (error || !data) { reply.status(404).send({ error: 'Room not found' }); return; }
    reply.send({ room: data });
  });

  // ── Join voice room (get token) ────────────────────────
  app.post('/v1/voice-rooms/:id/token', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { userId: string; userName: string };
    const supabase = getSupabase();

    const { data: room, error } = await supabase.from('voice_rooms').select('*').eq('id', id).single();
    if (error || !room) { reply.status(404).send({ error: 'Room not found' }); return; }

    // Check capacity
    if (room.participant_count >= room.max_participants) {
      reply.status(403).send({ error: 'Room is full' });
      return;
    }

    // Generate participant token
    const token = await generateParticipantToken(room.sfu_room_id, body.userId, body.userName);

    // Add participant record
    await supabase.from('voice_room_participants').insert({
      room_id: id,
      user_id: body.userId,
    });

    // Increment participant count
    await supabase.from('voice_rooms').update({
      participant_count: room.participant_count + 1,
    }).eq('id', id);

    reply.send({
      token,
      roomId: room.sfu_room_id,
      wsUrl: process.env.SFU_URL ?? '',
      provider: room.sfu_provider,
    });
  });

  // ── Leave voice room ───────────────────────────────────
  app.post('/v1/voice-rooms/:id/leave', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { userId: string };
    const supabase = getSupabase();

    const { data: room } = await supabase.from('voice_rooms').select('participant_count').eq('id', id).single();
    if (!room) { reply.status(404).send({ error: 'Room not found' }); return; }

    // Mark participant as left
    await supabase.from('voice_room_participants').update({
      left_at: new Date().toISOString(),
    }).eq('room_id', id).eq('user_id', body.userId).is('left_at', null);

    // Decrement count
    await supabase.from('voice_rooms').update({
      participant_count: Math.max(0, room.participant_count - 1),
    }).eq('id', id);

    reply.send({ success: true });
  });

  // ── Delete voice room ──────────────────────────────────
  app.delete('/v1/voice-rooms/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const supabase = getSupabase();

    const { data: room } = await supabase.from('voice_rooms').select('sfu_room_id').eq('id', id).single();
    if (room?.sfu_room_id) {
      await deleteRoom(room.sfu_room_id);
    }

    const { error } = await supabase.from('voice_rooms').delete().eq('id', id);
    if (error) { reply.status(500).send({ error: error.message }); return; }

    reply.send({ success: true });
  });
}
