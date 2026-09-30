import "server-only";
import { createClient } from "./supabase/server";
import type { User } from "./types";

export async function currentUser(): Promise<User | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const name = user.user_metadata?.name || user.user_metadata?.full_name;
  return {
    id: user.id,
    email: user.email || "",
    name:
      typeof name === "string" && name.trim() ? name.slice(0, 40) : "Player",
  };
}
export function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : new URL(request.url).protocol.replace(":", "");
  return (
    (host
      ? `${protocol}://${host}`
      : process.env.APP_ORIGIN?.replace(/\/$/, "") || new URL(request.url).origin)
  );
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === requestOrigin(request);
}
