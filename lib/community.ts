import "server-only";
import { createClient } from "./supabase/server";
export type Profile = {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  color: string;
};
export type Review = {
  user_id: string;
  game_id: number;
  game_name: string;
  body: string;
  rating: number;
  spoiler: boolean;
  updated_at: string;
  profiles: Profile;
};
export type GameList = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_public: boolean;
  list_items: { game_id: number; game_name: string }[];
};
export class CommunityError extends Error {}
export async function communityClient() {
  const c = await createClient();
  if (!c) throw new CommunityError("Supabase is not configured.");
  return c;
}
export function check(error: { code?: string } | null) {
  if (error)
    throw new CommunityError(
      error.code === "23505"
        ? "That username is already taken."
        : error.code === "PGRST205" || error.code === "42P01"
          ? "Community features need the Supabase community migration."
          : "Could not access your data. Please try again.",
    );
}
export async function profile(userId: string) {
  const c = await communityClient();
  const { data, error } = await c
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  check(error);
  return data as Profile | null;
}
export async function reviews(gameId?: number, userId?: string) {
  const c = await communityClient();
  let q = c
    .from("public_reviews")
    .select("*,profiles(*)")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (gameId) q = q.eq("game_id", gameId);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  check(error);
  return (data || []) as Review[];
}
export async function lists(userId: string) {
  const c = await communityClient();
  const { data, error } = await c
    .from("game_lists")
    .select("*,list_items(game_id,game_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  check(error);
  return (data || []) as GameList[];
}
