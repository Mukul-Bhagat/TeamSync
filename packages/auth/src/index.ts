import { getSupabaseClient, createServiceClient, SupabaseClient } from "@vistafam/database";
import type { AuthUser, LoginCredentials, RegisterCredentials } from "@vistafam/types";

export async function signInWithEmail(credentials: LoginCredentials) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;
  return data;
}

export async function signUp(credentials: RegisterCredentials) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        display_name: credentials.displayName,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithOAuth(provider: "google" | "github") {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    status: profile.status,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const user = await getUser();
      callback(user);
    } else {
      callback(null);
    }
  });
  return data.subscription;
}

export { getSupabaseClient, createServiceClient, SupabaseClient };
