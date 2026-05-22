/**
 * Notification Routes
 * In-app notifications CRUD and mark-as-read
 */
import { getSupabase } from '../lib/supabase.js';
export async function notificationRoutes(app) {
    // ── List notifications ─────────────────────────────────
    app.get('/v1/notifications', async (req) => {
        const userId = req.headers['x-user-id'] ?? '';
        const { unread_only = 'false', limit = '50' } = req.query;
        const supabase = getSupabase();
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit, 10));
        if (unread_only === 'true') {
            query = query.eq('is_read', false);
        }
        const { data, error } = await query;
        if (error)
            return { notifications: [], error: error.message };
        return { notifications: data ?? [] };
    });
    // ── Get unread count ───────────────────────────────────
    app.get('/v1/notifications/unread-count', async (req) => {
        const userId = req.headers['x-user-id'] ?? '';
        const supabase = getSupabase();
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        if (error)
            return { count: 0, error: error.message };
        return { count: count ?? 0 };
    });
    // ── Mark notification as read ──────────────────────────
    app.patch('/v1/notifications/:id/read', async (req, reply) => {
        const { id } = req.params;
        const userId = req.headers['x-user-id'] ?? '';
        const supabase = getSupabase();
        const { error } = await supabase.from('notifications').update({
            is_read: true,
        }).eq('id', id).eq('user_id', userId);
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ success: true });
    });
    // ── Mark all as read ───────────────────────────────────
    app.post('/v1/notifications/read-all', async (req, reply) => {
        const userId = req.headers['x-user-id'] ?? '';
        const supabase = getSupabase();
        const { error } = await supabase.from('notifications').update({
            is_read: true,
        }).eq('user_id', userId).eq('is_read', false);
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ success: true });
    });
    // ── Delete notification ────────────────────────────────
    app.delete('/v1/notifications/:id', async (req, reply) => {
        const { id } = req.params;
        const userId = req.headers['x-user-id'] ?? '';
        const supabase = getSupabase();
        const { error } = await supabase.from('notifications').delete()
            .eq('id', id).eq('user_id', userId);
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ success: true });
    });
}
