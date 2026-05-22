/**
 * TeamSync Supabase Client
 * Service-role client for database operations
 */
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
let client = null;
export function getSupabase() {
    if (!client) {
        client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    return client;
}
export function getSupabaseAdmin() {
    return getSupabase();
}
