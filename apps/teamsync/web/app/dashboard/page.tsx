"use client";

import { useAuth } from "@vistafam/hooks";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
    return null;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Welcome, {user.displayName || user.email}</h1>
      <p>You are signed in.</p>
    </div>
  );
}
