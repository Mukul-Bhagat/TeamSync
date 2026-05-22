/**
 * Presence Routes
 * Heartbeat, online users, typing indicators
 */
import { getSupabase } from '../lib/supabase.js';
import { updatePresence, getPresence, broadcastEvent } from '../lib/realtime-client.js';
// In-memory typing indicator cache (Redis in production)
const typingCache = new Map();
export async function presenceRoutes(app) {
    // ── Presence heartbeat ─────────────────────────────────
    app.post('/v1/presence/heartbeat', async (req, reply) => {
        const body = req.body;
        await updatePresence({
            tenantId: body.tenantId,
            userId: body.userId,
            status: body.status,
            platform: body.platform ?? 'web',
        });
        // Update user status in DB
        const supabase = getSupabase();
        await supabase.from('users').update({ status: body.status }).eq('id', body.userId);
        reply.send({ success: true });
    });
    // ── Get online users ───────────────────────────────────
    app.get('/v1/presence/:tenantId', async (req) => {
        const { tenantId } = req.params;
        const onlineUsers = await getPresence(tenantId);
        return { tenantId, onlineUsers };
    });
    // ── Typing started ─────────────────────────────────────
    app.post('/v1/typing/start', async (req, reply) => {
        const body = req.body;
        const cacheKey = `${body.userId}:${body.channelId ?? body.conversationId}`;
        // Clear existing timeout
        const existing = typingCache.get(cacheKey);
        if (existing)
            clearTimeout(existing);
        // Broadcast typing started
        await broadcastEvent({
            tenantId: body.tenantId,
            channelId: body.channelId,
            userIds: body.conversationId ? [body.userId] : undefined,
            eventName: 'typing:started',
            payload: {
                userId: body.userId,
                channelId: body.channelId,
                conversationId: body.conversationId,
            },
        });
        // Auto-clear after 5 seconds
        const timeout = setTimeout(async () => {
            await broadcastEvent({
                tenantId: body.tenantId,
                channelId: body.channelId,
                userIds: body.conversationId ? [body.userId] : undefined,
                eventName: 'typing:stopped',
                payload: {
                    userId: body.userId,
                    channelId: body.channelId,
                    conversationId: body.conversationId,
                },
            });
            typingCache.delete(cacheKey);
        }, 5000);
        typingCache.set(cacheKey, timeout);
        reply.send({ success: true });
    });
    // ── Typing stopped ─────────────────────────────────────
    app.post('/v1/typing/stop', async (req, reply) => {
        const body = req.body;
        const cacheKey = `${body.userId}:${body.channelId ?? body.conversationId}`;
        const existing = typingCache.get(cacheKey);
        if (existing) {
            clearTimeout(existing);
            typingCache.delete(cacheKey);
        }
        await broadcastEvent({
            tenantId: body.tenantId,
            channelId: body.channelId,
            userIds: body.conversationId ? [body.userId] : undefined,
            eventName: 'typing:stopped',
            payload: {
                userId: body.userId,
                channelId: body.channelId,
                conversationId: body.conversationId,
            },
        });
        reply.send({ success: true });
    });
}
