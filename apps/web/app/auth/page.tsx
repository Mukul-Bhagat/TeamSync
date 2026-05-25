"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { signInWithEmail, signUp, signInWithOAuth, getSession } from "@vistafam/auth";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Github } from "lucide-react";

function getConfigError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || url.includes("your-project") || !key || key.includes("your-anon") || key.includes("your-")) {
    return "Supabase credentials are missing or using placeholder values. Update apps/web/.env with real values.";
  }
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".supabase.co") && !parsed.hostname.includes("supabase")) {
      return `Invalid Supabase URL: "${url}". Must end with .supabase.co`;
    }
  } catch {
    return `Invalid Supabase URL format: "${url}"`;
  }
  return null;
}

export default function AuthPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const isLocal =
    typeof window !== "undefined"
      ? ["localhost", "127.0.0.1"].includes(window.location.hostname)
      : process.env.NODE_ENV !== "production";

  useEffect(() => {
    setConfigError(getConfigError());
  }, []);

  if (user) {
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        try {
          await signInWithEmail({ email, password });
        } catch (e) {
          const msg = e instanceof Error ? e.message.toLowerCase() : "";
          if (isLocal && (msg.includes("confirm") || msg.includes("email not confirmed"))) {
            // Dev fallback: try to confirm and create the user, then sign in again
            await fetch("/api/auth/dev-signup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, displayName }),
            });
            await signInWithEmail({ email, password });
          } else {
            throw e;
          }
        }
        const session = await getSession();
        const token = session?.access_token;
        if (token) {
          await fetch("/api/auth/provision", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        toast.success("Welcome back!");
        window.location.href = "/dashboard";
      } else {
        if (isLocal || process.env.NEXT_PUBLIC_DEV_AUTO_CONFIRM === "true") {
          const res = await fetch("/api/auth/dev-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, displayName }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as any));
            throw new Error(body?.error || "Dev signup failed");
          }

          await signInWithEmail({ email, password });
          const session = await getSession();
          const token = session?.access_token;
          if (token) {
            await fetch("/api/auth/provision", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          }
          toast.success("Account created and confirmed (dev). Redirecting...");
          window.location.href = "/dashboard";
        } else {
          await signUp({ email, password, displayName });
          const session = await getSession();
          const token = session?.access_token;
          if (token) {
            await fetch("/api/auth/provision", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          }
          toast.success("Account created! Please check your email.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OAuth failed");
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#020202] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-gradient">PipeSync</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to your workspace" : "Create your account"}
            </p>
          </div>

          {configError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              {configError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/70">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="glass-input w-full pl-9"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input w-full pl-9"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full pl-9"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {!isLocal && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#0a0a0a] px-2 text-white/30">or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleOAuth("google")}
                  className="h-10 glass-input flex items-center justify-center gap-2 text-sm hover:bg-white/[0.06] transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button
                  onClick={() => handleOAuth("github")}
                  className="h-10 glass-input flex items-center justify-center gap-2 text-sm hover:bg-white/[0.06] transition-colors"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </button>
              </div>
            </>
          )}

          <p className="text-center text-sm text-white/40">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button onClick={() => setMode("register")} className="text-primary hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
