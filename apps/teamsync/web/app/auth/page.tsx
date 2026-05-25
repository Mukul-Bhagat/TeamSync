"use client";

import { useState, useEffect } from "react";
import { signInWithEmail, signUp, signInWithOAuth, getSession } from "@vistafam/auth";
import { useAuth } from "@vistafam/hooks";

export default function AuthPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await signInWithEmail({ email, password });
        const session = await getSession();
        const token = session?.access_token;
        if (token) {
          await fetch("/api/auth/provision", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
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
        // If email confirmation required, no session will exist yet.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth failed");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", padding: 16 }}>
      <div style={{ width: 360 }}>
        <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 8, marginBottom: 8 }}>{error}</div>
        )}
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12 }}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={{ width: "100%", padding: 8 }}
              />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => handleOAuth("google")}>Continue with Google</button>
          <button onClick={() => handleOAuth("github")}>Continue with GitHub</button>
        </div>

        <p style={{ marginTop: 16, fontSize: 12 }}>
          {mode === "login" ? (
            <>
              Don't have an account? {" "}
              <button type="button" onClick={() => setMode("register")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account? {" "}
              <button type="button" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
