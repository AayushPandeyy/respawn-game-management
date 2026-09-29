import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/auth";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const origin = requestOrigin(request);
  try {
    const supabase = await createClient();
    if (supabase && code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL("/dashboard", origin), {
          headers: { "Cache-Control": "no-store" },
        });
    }
  } catch {
    /* Do not expose provider details. */
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", origin), {
    headers: { "Cache-Control": "no-store" },
  });
}
