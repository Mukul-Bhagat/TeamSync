"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@vistafam/database";

export default function OAuthCallbackPage() {
  useEffect(() => {
    async function handleCallback() {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          await fetch("/api/auth/provision", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        window.location.replace("/dashboard");
      } catch (_err) {
        window.location.replace("/auth");
      }
    }
    handleCallback();
  }, []);

  return <div style={{ padding: 16 }}>Completing sign-in...</div>;
}
