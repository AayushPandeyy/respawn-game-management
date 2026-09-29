import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sameOrigin, requestOrigin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { missingAuthMessage } from "@/lib/supabase/config";
export const runtime = "nodejs";
const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  const { action } = await params;
  if (!["login", "signup", "logout"].includes(action))
    return json({ error: "Not found." }, 404);
  try {
    const supabase = await createClient();
    if (!supabase) return json({ error: missingAuthMessage }, 503);
    if (action === "logout") {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error)
        return json({ error: "Could not sign out. Please try again." }, 502);
      (await cookies()).delete("respawn_session");
      return json({ ok: true });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request." }, 400);
    }
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 8 ||
      password.length > 128
    )
      return json(
        { error: "Enter a valid email and a password with 8–128 characters." },
        400,
      );
    if (action === "signup" && (name.length < 2 || name.length > 40))
      return json({ error: "Your name should be 2–40 characters." }, 400);
    const { data, error } =
      action === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo: `${requestOrigin(request)}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429)
        return json(
          {
            error:
              "Too many attempts. Please wait a few minutes and try again.",
          },
          429,
        );
      if (error.code === "email_not_confirmed")
        return json(
          {
            error:
              "Please confirm your email using the link in your inbox before logging in.",
          },
          401,
        );
      if (action === "login")
        return json(
          {
            error:
              "Unable to sign in. Check your email and password and try again.",
          },
          401,
        );
      if (error.code === "weak_password")
        return json(
          {
            error:
              "Choose a stronger password that meets the account password requirements.",
          },
          400,
        );
      return json(
        {
          error:
            "Unable to create an account. Please try signing in or try again later.",
        },
        400,
      );
    }
    (await cookies()).delete("respawn_session");
    return json({ ok: true, needsConfirmation: !data.session });
  } catch {
    return json(
      {
        error: "The sign-in service is unavailable. Please try again shortly.",
      },
      503,
    );
  }
}
