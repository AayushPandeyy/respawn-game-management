import { currentUser, sameOrigin } from "@/lib/auth";
import { communityClient, CommunityError } from "@/lib/community";
import { checkFollow } from "@/lib/follows";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Please sign in to follow players." },
      { status: 401 },
    );
  try {
    const b = await request.json();
    if (
      !b ||
      !["follow", "unfollow"].includes(b.action) ||
      typeof b.target !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        b.target,
      ) ||
      b.target.toLowerCase() === user.id.toLowerCase()
    )
      return Response.json(
        { error: "Choose another player to follow." },
        { status: 400 },
      );
    const c = await communityClient();
    const result =
      b.action === "follow"
        ? await c
            .from("follows")
            .upsert(
              { follower_id: user.id, following_id: b.target },
              {
                onConflict: "follower_id,following_id",
                ignoreDuplicates: true,
              },
            )
        : await c
            .from("follows")
            .delete()
            .eq("follower_id", user.id)
            .eq("following_id", b.target);
    if (result.error?.code === "23503")
      return Response.json(
        { error: "This player no longer exists." },
        { status: 404 },
      );
    checkFollow(result.error);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof SyntaxError
            ? "Invalid request."
            : e instanceof CommunityError
              ? e.message
              : "Could not update following. Please retry.",
      },
      { status: e instanceof SyntaxError ? 400 : 503 },
    );
  }
}
