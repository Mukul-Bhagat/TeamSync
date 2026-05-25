import { getSupabaseClient, createServiceClient, SupabaseClient } from "@vistafam/database";
import type { AuthUser, LoginCredentials, RegisterCredentials } from "@vistafam/types";

function handleAuthError(err: unknown): never {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      throw new Error(
        "Unable to reach Supabase. Check your NEXT_PUBLIC_SUPABASE_URL in .env and ensure the project exists."
      );
    }
    if (msg.includes("429") || msg.includes("Too Many Requests")) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    if (msg.includes("404") || msg.includes("Not Found")) {
      throw new Error(
        "Supabase auth endpoint not found. Verify your NEXT_PUBLIC_SUPABASE_URL and that Auth is enabled in your Supabase project."
      );
    }
    throw err;
  }
  throw new Error("Authentication request failed. Please try again.");
}

export async function signInWithEmail(credentials: LoginCredentials) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function signUp(credentials: RegisterCredentials) {
  try {
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
  } catch (err) {
    handleAuthError(err);
  }
}

export async function signInWithOAuth(provider: "google" | "github") {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function signOut() {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function getSession() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function getUser(): Promise<AuthUser | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      // Fallback: allow app to proceed with minimal user derived from auth session
      const u = data.user;
      return {
        id: u.id,
        email: u.email || "",
        displayName:
          (u.user_metadata?.display_name || u.user_metadata?.name || u.user_metadata?.full_name || null) as
            | string
            | null,
        avatarUrl: (u.user_metadata?.avatar_url || u.user_metadata?.picture || null) as string | null,
        role: "member",
        status: "online",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

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
  } catch (err) {
    handleAuthError(err);
  }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      try {
        const user = await getUser();
        callback(user);
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
  return data.subscription;
}

export { getSupabaseClient, createServiceClient, SupabaseClient };
