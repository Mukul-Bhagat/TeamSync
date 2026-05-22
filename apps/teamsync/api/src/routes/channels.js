/**
 * Channel Routes
 * CRUD + membership management
 */
import { getSupabase } from '../lib/supabase.js';
export async function channelRoutes(app) {
    // ── List channels ──────────────────────────────────────
    app.get('/v1/channels', async (req, reply) => {
        const tenantId = req.headers['x-tenant-id'] ?? 'default';
        const userId = req.headers['x-user-id'] ?? '';
        const supabase = getSupabase();
        // Get channels user is a member of + all public channels in workspace
        // Exclude archived channels
        const { data, error } = await supabase
            .from('channels')
            .select('*, channel_members!inner(role)')
            .eq('workspace_id', tenantId)
            .is('archived_at', null)
            .or(`is_private.eq.false,channel_members.user_id.eq.${userId}`)
            .order('created_at', { ascending: true });
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ channels: data ?? [] });
    });
    // ── Create channel ─────────────────────────────────────
    app.post('/v1/channels', async (req, reply) => {
        const body = req.body;
        const supabase = getSupabase();
        const { data: channel, error } = await supabase
            .from('channels')
            .insert({
            name: body.name,
            description: body.description,
            workspace_id: body.workspace_id,
            is_private: body.is_private ?? false,
            created_by: body.created_by,
        })
            .select()
            .single();
        if (error || !channel) {
            reply.status(500).send({ error: error?.message ?? 'Failed' });
            return;
        }
        // Add creator as owner
        await supabase.from('channel_members').insert({
            channel_id: channel.id,
            user_id: body.created_by,
            role: 'owner',
        });
        reply.status(201).send({ channel });
    });
    // ── Get channel ────────────────────────────────────────
    app.get('/v1/channels/:id', async (req, reply) => {
        const { id } = req.params;
        const supabase = getSupabase();
        const { data, error } = await supabase.from('channels').select('*, channel_members(*)').eq('id', id).single();
        if (error || !data) {
            reply.status(404).send({ error: 'Channel not found' });
            return;
        }
        reply.send({ channel: data });
    });
    // ── Update channel ─────────────────────────────────────
    app.patch('/v1/channels/:id', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        const supabase = getSupabase();
        const { data, error } = await supabase.from('channels').update(body).eq('id', id).select().single();
        if (error || !data) {
            reply.status(500).send({ error: error?.message ?? 'Failed' });
            return;
        }
        reply.send({ channel: data });
    });
    // ── Delete channel (soft delete / archive) ─────────────
    app.delete('/v1/channels/:id', async (req, reply) => {
        const { id } = req.params;
        const supabase = getSupabase();
        const { error } = await supabase.from('channels').update({
            archived_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ success: true, archived: true });
    });
    // ── List members ───────────────────────────────────────
    app.get('/v1/channels/:id/members', async (req, reply) => {
        const { id } = req.params;
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('channel_members')
            .select('*, users(id, display_name, avatar_url)')
            .eq('channel_id', id);
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ members: data ?? [] });
    });
    // ── Add member ─────────────────────────────────────────
    app.post('/v1/channels/:id/members', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        const supabase = getSupabase();
        const { data, error } = await supabase.from('channel_members').insert({
            channel_id: id,
            user_id: body.user_id,
            role: body.role ?? 'member',
        }).select().single();
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.status(201).send({ member: data });
    });
    // ── Remove member ──────────────────────────────────────
    app.delete('/v1/channels/:id/members/:userId', async (req, reply) => {
        const { id, userId } = req.params;
        const supabase = getSupabase();
        const { error } = await supabase.from('channel_members').delete()
            .eq('channel_id', id).eq('user_id', userId);
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ success: true });
    });
    // ── Update last read ───────────────────────────────────
    app.post('/v1/channels/:id/read', async (req, reply) => {
        const { id } = req.params;
        const userId = req.headers['x-user-id'] ?? '';
        const supabase = getSupabase();
        const { error } = await supabase.from('channel_members').update({
            last_read_at: new Date().toISOString(),
        }).eq('channel_id', id).eq('user_id', userId);
        if (error) {
            reply.status(500).send({ error: error.message });
            return;
        }
        reply.send({ success: true });
    });
}
