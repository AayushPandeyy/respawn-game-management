import "server-only";
import { communityClient, type Profile } from "./community";
export type Engagement = {
  review_user_id: string;
  game_id: number;
  likes: number;
  comments: number;
  liked: boolean;
};
export type ReviewComment = {
  id: string;
  user_id: string;
  review_user_id: string;
  game_id: number;
  body: string;
  spoiler: boolean;
  created_at: string;
  updated_at: string;
  profiles: Profile;
};
export class DiscussionError extends Error {}
export function checkDiscussion(error: { code?: string } | null) {
  if (error)
    throw new DiscussionError(
      ["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code || "")
        ? "Review discussions need the Supabase discussions migration."
        : "Could not update or load this discussion. Please retry.",
    );
}
export async function engagement(
  targets: { user_id: string; game_id: number }[],
) {
  if (!targets.length) return [] as Engagement[];
  const c = await communityClient();
  const { data, error } = await c.rpc("review_engagement", {
    targets: targets.map((t) => ({ user_id: t.user_id, game_id: t.game_id })),
  });
  checkDiscussion(error);
  return (data || []) as Engagement[];
}
export async function comments(reviewer: string, gameId: number, page: number) {
  const c = await communityClient();
  const { data, error, count } = await c
    .from("review_comments")
    .select("*,profiles!review_comments_user_id_fkey(*)", { count: "exact" })
    .eq("review_user_id", reviewer)
    .eq("game_id", gameId)
    .order("created_at")
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  checkDiscussion(error);
  return { items: (data || []) as ReviewComment[], total: count || 0 };
}
