import "server-only";
import { communityClient, CommunityError } from "./community";
export function checkFollow(error: { code?: string } | null) {
  if (error)
    throw new CommunityError(
      ["PGRST205", "42P01", "PGRST202", "42883"].includes(error.code || "")
        ? "Following needs the Supabase follows migration."
        : "Could not load or update following. Please try again.",
    );
}
export async function followSummary(target: string, viewer?: string) {
  const c = await communityClient();
  const [followers, following, relation] = await Promise.all([
    c
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", target),
    c
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", target),
    viewer
      ? c
          .from("follows")
          .select("following_id")
          .eq("follower_id", viewer)
          .eq("following_id", target)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  [followers, following, relation].forEach((r) => checkFollow(r.error));
  return {
    followers: followers.count || 0,
    following: following.count || 0,
    isFollowing: !!relation.data,
  };
}
