import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/auth";
import { authDestination } from "@/lib/auth-destination";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const recovery = new URL(request.url).searchParams.get("flow") === "recovery";
  const google = new URL(request.url).searchParams.get("flow") === "google";
  const next = authDestination(new URL(request.url).searchParams.get("next"));
  const origin = requestOrigin(request);
  try {
    const supabase = await createClient();
    if (supabase && code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL(recovery ? "/reset-password" : next, origin), {
          headers: { "Cache-Control": "no-store" },
        });
    }
  } catch {
    /* Do not expose provider details. */
  }
  return NextResponse.redirect(new URL(recovery ? "/forgot-password?expired=1" : google ? `/login?oauth=failed&next=${encodeURIComponent(next)}` : "/login?confirmation=failed", origin), {
    headers: { "Cache-Control": "no-store" },
  });
}
