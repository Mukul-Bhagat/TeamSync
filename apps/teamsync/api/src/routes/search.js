/**
 * Search Routes
 * Full-text and semantic search across messages, channels, files
 */
import { getSupabase } from '../lib/supabase.js';
export async function searchRoutes(app) {
    // ── Full-text search ───────────────────────────────────
    app.get('/v1/search', async (req) => {
        const { q, scope = 'messages', channelId, from, to, limit = '20' } = req.query;
        const supabase = getSupabase();
        const searchQuery = q.trim();
        if (!searchQuery)
            return { results: [] };
        let query = supabase
            .from('messages')
            .select('*, channels(name)')
            .textSearch('search_vector', searchQuery, { type: 'websearch', config: 'english' })
            .order('created_at', { ascending: false })
            .limit(parseInt(limit, 10));
        if (channelId)
            query = query.eq('channel_id', channelId);
        if (from)
            query = query.gte('created_at', from);
        if (to)
            query = query.lte('created_at', to);
        const { data, error } = await query;
        if (error)
            return { results: [], error: error.message };
        return {
            results: data ?? [],
            query: searchQuery,
            scope,
            total: data?.length ?? 0,
        };
    });
    // ── Semantic search (placeholder) ──────────────────────
    app.get('/v1/search/semantic', async (req) => {
        const { q, channelId, limit = '20' } = req.query;
        const supabase = getSupabase();
        if (!q.trim())
            return { results: [] };
        // Placeholder: in production, generate embedding via AI Router
        // and perform cosine similarity search
        // const embedding = await generateEmbedding(q);
        // const { data } = await supabase.rpc('match_messages', {
        //   query_embedding: embedding,
        //   match_threshold: 0.7,
        //   match_count: parseInt(limit, 10),
        // });
        // Fallback to text search for now
        let query = supabase
            .from('messages')
            .select('*, channels(name)')
            .ilike('content', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit, 10));
        if (channelId)
            query = query.eq('channel_id', channelId);
        const { data, error } = await query;
        if (error)
            return { results: [], error: error.message };
        return {
            results: data ?? [],
            query: q,
            type: 'semantic',
            note: 'Semantic search requires embedding generation. Falling back to text search.',
        };
    });
}
