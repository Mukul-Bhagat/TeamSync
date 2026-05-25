import { createClient, SupabaseClient } from "@supabase/supabase-js";
let client = null;
function isValidSupabaseUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.endsWith(".supabase.co") || parsed.hostname.includes("supabase");
    } catch {
        return false;
    }
}
export function getSupabaseClient() {
    if (client)
        return client;
    const url = typeof process !== "undefined"
        ? process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
        : undefined;
    const key = typeof process !== "undefined"
        ? process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        : undefined;
    if (!url || !key) {
        throw new Error(
            "Supabase URL and key must be provided via environment variables. " +
            "Set one of the following pairs:\n" +
            "  - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (for client/browser)\n" +
            "  - SUPABASE_URL + SUPABASE_ANON_KEY (for server)"
        );
    }
    if (!isValidSupabaseUrl(url)) {
        throw new Error(
            `Invalid Supabase URL: "${url}". It must be a valid Supabase project URL (e.g., https://your-project.supabase.co).`
        );
    }
    client = createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
    return client;
}
export function createServiceClient() {
    const url = typeof process !== "undefined"
        ? process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
        : undefined;
    const key = typeof process !== "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
    if (!url || !key) {
        throw new Error("Supabase service role key must be provided");
    }
    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
export { SupabaseClient };
