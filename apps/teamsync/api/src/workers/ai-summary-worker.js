/**
 * AI Summary Worker
 * Generates channel/thread/meeting summaries via PipeVista AI Router
 */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { getSupabase } from '../lib/supabase.js';
import axios from 'axios';
const logger = new ServiceLogger('teamsync:ai-summary-worker');
const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});
const AI_ROUTER_URL = process.env.AI_ROUTER_URL ?? 'http://localhost:4102';
export function createAISummaryWorker(concurrency = 2) {
    return new Worker('teamsync:ai-summaries', async (job) => {
        const { type, channelId, threadParentId } = job.data;
        logger.info(`Generating AI summary`, { type, channelId, threadParentId });
        const supabase = getSupabase();
        // Fetch messages to summarize
        let messages = [];
        if (type === 'channel_daily' && channelId) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const { data } = await supabase
                .from('messages')
                .select('content, sender_name, created_at')
                .eq('channel_id', channelId)
                .gte('created_at', yesterday.toISOString())
                .order('created_at', { ascending: true });
            messages = data ?? [];
        }
        else if (type === 'thread' && threadParentId) {
            const { data: parent } = await supabase
                .from('messages')
                .select('content, sender_name, created_at')
                .eq('id', threadParentId)
                .single();
            const { data: replies } = await supabase
                .from('messages')
                .select('content, sender_name, created_at')
                .eq('parent_message_id', threadParentId)
                .order('created_at', { ascending: true });
            messages = parent ? [parent, ...(replies ?? [])] : (replies ?? []);
        }
        if (messages.length === 0) {
            logger.info('No messages to summarize');
            return;
        }
        // Build prompt
        const messageText = messages.map((m) => `${m.sender_name}: ${m.content}`).join('\n');
        const prompt = `Summarize the following conversation in 3-5 bullet points. Focus on key decisions, action items, and important updates:\n\n${messageText}`;
        // Call AI Router
        let summary = '';
        try {
            const res = await axios.post(`${AI_ROUTER_URL}/v1/ai/chat`, {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500,
            });
            summary = res.data.choices[0]?.message?.content ?? '';
        }
        catch (err) {
            logger.error('AI summary generation failed', { error: err.message });
            summary = 'AI summary generation failed. Please review the conversation manually.';
        }
        // Store summary
        const { data: summaryRecord } = await supabase.from('ai_summaries').insert({
            channel_id: channelId,
            thread_parent_id: threadParentId,
            summary_type: type,
            content: summary,
            source_message_count: messages.length,
            generated_by: 'gpt-4o',
        }).select().single();
        // Post summary as AI message in channel
        if (summaryRecord && channelId) {
            const { data: aiMessage } = await supabase.from('messages').insert({
                channel_id: channelId,
                sender_id: 'ai-assistant',
                sender_name: 'AI Assistant',
                content: `🤖 **AI Summary**\n\n${summary}`,
                is_ai: true,
            }).select().single();
            if (aiMessage) {
                const { broadcastEvent } = await import('../lib/realtime-client.js');
                await broadcastEvent({
                    tenantId: (await supabase.from('channels').select('workspace_id').eq('id', channelId).single()).data?.workspace_id ?? 'default',
                    channelId,
                    eventName: 'message:new',
                    payload: aiMessage,
                });
            }
        }
        logger.info('AI summary generated', {
            type,
            messageCount: messages.length,
            summaryLength: summary.length,
        });
    }, { connection: redisConnection, concurrency });
}
