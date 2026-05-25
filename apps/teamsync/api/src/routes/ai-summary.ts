/**
 * AI Summary Routes
 * Trigger and retrieve AI-generated summaries
 */

import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
redisConnection.on('error', (err: Error) => { /* ignore Redis errors in dev */ });

const aiSummaryQueue = new Queue('teamsync-ai-summaries', { connection: redisConnection });

export async function aiSummaryRoutes(app: FastifyInstance) {
  // ── Trigger AI summary ─────────────────────────────────
  app.post('/v1/ai/summarize', async (req, reply) => {
    const body = req.body as {
      type: 'channel_daily' | 'channel_weekly' | 'thread' | 'meeting' | 'workflow';
      channelId?: string;
      threadParentId?: string;
      meetingId?: string;
      workflowId?: string;
      userId: string;
    };

    if (!body.type || !body.userId) {
      reply.status(400).send({ error: 'type and userId are required' });
      return;
    }

    const job = await aiSummaryQueue.add('generate-summary', {
      type: body.type,
      channelId: body.channelId,
      threadParentId: body.threadParentId,
      meetingId: body.meetingId,
      workflowId: body.workflowId,
      userId: body.userId,
    });

    reply.status(202).send({
      queued: true,
      jobId: job.id,
      type: body.type,
    });
  });

  // ── List AI summaries for a channel ────────────────────
  app.get('/v1/channels/:id/summaries', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { type } = req.query as { type?: string };
    const supabase = getSupabase();

    let query = supabase
      .from('ai_summaries')
      .select('*')
      .eq('channel_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (type) query = query.eq('summary_type', type);

    const { data, error } = await query;
    if (error) { reply.status(500).send({ error: error.message }); return; }
    reply.send({ summaries: data ?? [] });
  });

  // ── Get single AI summary ──────────────────────────────
  app.get('/v1/ai/summaries/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) { reply.status(404).send({ error: 'Summary not found' }); return; }
    reply.send({ summary: data });
  });
}
