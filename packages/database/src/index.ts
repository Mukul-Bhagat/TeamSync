import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url =
    typeof process !== "undefined"
      ? process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
      : undefined;

  const key =
    typeof process !== "undefined"
      ? process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : undefined;

  if (!url || !key) {
    throw new Error("Supabase URL and key must be provided via environment variables");
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return client;
}

export function createServiceClient(): SupabaseClient {
  const url =
    typeof process !== "undefined"
      ? process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
      : undefined;

  const key =
    typeof process !== "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;

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
