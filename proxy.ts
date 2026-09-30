import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";

export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    "/",
    "/dashboard",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/api/auth/:path*",
    "/signup",
    "/api/library",
    "/games/:path*",
    "/profile",
    "/reviews",
    "/lists/:path*",
    "/stats",
    "/achievements",
    "/u/:path*",
    "/api/community",
    "/api/follows",
    "/feed",
    "/players",
    "/reviews/:path*",
    "/notifications",
    "/api/discussions",
    "/diary",
    "/api/diary",
    "/import/steam",
    "/api/steam",
  ],
};
