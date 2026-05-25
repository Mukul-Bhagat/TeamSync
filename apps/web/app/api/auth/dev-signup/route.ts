import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@vistafam/database";

/**
 * Dev-only endpoint: create a confirmed user using service-role so login works immediately.
 * Enabled automatically for local development (host is localhost/127.0.0.1) or when NODE_ENV !== 'production'.
 */
export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get("host") || "";
    const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || process.env.NODE_ENV !== "production";
    if (!isLocal) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { email, password, displayName } = (await req.json()) as {
      email: string;
      password: string;
      displayName?: string;
    };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Try to create a confirmed user; if it already exists, update and proceed
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (error) {
      const msg = error.message || "Create user failed";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already exists")) {
        // Best-effort: locate the user by listing and update it
        const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
        const existing = listed.data?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          await supabase.auth.admin.updateUserById(existing.id, {
            email_confirm: true,
            user_metadata: { display_name: displayName },
            password,
          });
          return NextResponse.json({ ok: true, updated: true, userId: existing.id });
        }
        // Could not find via listing; still treat as OK to let client sign in
        return NextResponse.json({ ok: true, updated: false });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ ok: true, userId: data.user?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
