import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@vistafam/database";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: userErr?.message || "Invalid or expired token" },
        { status: 401 }
      );
    }

    const u = userData.user;
    const email = u.email ?? null;
    const displayName =
      (u.user_metadata?.display_name || u.user_metadata?.name || u.user_metadata?.full_name || null) as
        | string
        | null;
    const avatarUrl = (u.user_metadata?.avatar_url || u.user_metadata?.picture || null) as
      | string
      | null;

    const { error: upsertErr } = await supabase
      .from("users")
      .upsert(
        {
          id: u.id,
          email,
          display_name: displayName,
          avatar_url: avatarUrl,
        },
        { onConflict: "id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
