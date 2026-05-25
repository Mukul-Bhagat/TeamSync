"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@vistafam/database";
import { toast } from "sonner";

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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "OAuth callback failed";
        toast.error(msg);
        window.location.replace("/auth");
      }
    }
    handleCallback();
  }, []);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#020202] text-white/70">
      Completing sign-in...
    </div>
  );
}
