import { currentUser, sameOrigin } from "@/lib/auth";
import { communityClient, CommunityError } from "@/lib/community";
import {
  checkDiscussion,
  DiscussionError,
  engagement,
} from "@/lib/discussions";
import { uuidPattern } from "@/lib/diary-validation";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in to join the discussion." },
      { status: 401 },
    );
  try {
    const b = await request.json();
    if (!b || typeof b !== "object")
      return Response.json({ error: "Invalid request." }, { status: 400 });
    const c = await communityClient();
    const validId = (v: unknown) =>
      typeof v === "string" && uuidPattern.test(v);
    let result;
    if (b.action === "read-notification" && validId(b.id)) {
      result = await c
        .from("review_notifications")
        .update({ is_read: true })
        .eq("id", b.id)
        .eq("recipient_id", user.id)
        .select("id");
    } else if (
      ["edit-comment", "delete-comment"].includes(b.action) &&
      validId(b.id)
    ) {
      if (b.action === "delete-comment")
        result = await c
          .from("review_comments")
          .delete()
          .eq("id", b.id)
          .eq("user_id", user.id)
          .select("id");
      else {
        if (
          typeof b.body !== "string" ||
          !b.body.trim() ||
          b.body.length > 2000 ||
          typeof b.spoiler !== "boolean"
        )
          return Response.json(
            { error: "Write a comment of 1–2,000 characters." },
            { status: 400 },
          );
        result = await c
          .from("review_comments")
          .update({ body: b.body.trim(), spoiler: b.spoiler })
          .eq("id", b.id)
          .eq("user_id", user.id)
          .select("id");
      }
    } else if (
      validId(b.reviewer) &&
      Number.isSafeInteger(b.gameId) &&
      b.gameId > 0
    ) {
      if (["like", "unlike"].includes(b.action)) {
        result =
          b.action === "like"
            ? await c
                .from("review_likes")
                .upsert(
                  {
                    user_id: user.id,
                    review_user_id: b.reviewer,
                    game_id: b.gameId,
                  },
                  {
                    onConflict: "user_id,review_user_id,game_id",
                    ignoreDuplicates: true,
                  },
                )
            : await c
                .from("review_likes")
                .delete()
                .eq("user_id", user.id)
                .eq("review_user_id", b.reviewer)
                .eq("game_id", b.gameId);
        checkDiscussion(result.error);
        return Response.json({
          ok: true,
          engagement: (
            await engagement([{ user_id: b.reviewer, game_id: b.gameId }])
          )[0],
        });
      } else if (
        b.action === "comment" &&
        validId(b.id) &&
        typeof b.body === "string" &&
        b.body.trim() &&
        b.body.length <= 2000 &&
        typeof b.spoiler === "boolean"
      ) {
        const p = await c
          .from("profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        checkDiscussion(p.error);
        if (!p.data)
          return Response.json(
            { error: "Create your profile before commenting." },
            { status: 400 },
          );
        result = await c
          .from("review_comments")
          .upsert(
            {
              id: b.id,
              user_id: user.id,
              review_user_id: b.reviewer,
              game_id: b.gameId,
              body: b.body.trim(),
              spoiler: b.spoiler,
            },
            { onConflict: "id", ignoreDuplicates: true },
          )
          .select("id");
        checkDiscussion(result.error);
        if (!result.data?.length) {
          const existing = await c
            .from("review_comments")
            .select("id")
            .eq("id", b.id)
            .eq("user_id", user.id)
            .eq("review_user_id", b.reviewer)
            .eq("game_id", b.gameId)
            .maybeSingle();
          checkDiscussion(existing.error);
          if (!existing.data)
            return Response.json(
              { error: "Could not confirm your comment. Reload and retry." },
              { status: 409 },
            );
        }
        return Response.json({ ok: true });
      } else
        return Response.json(
          { error: "Check your comment and try again." },
          { status: 400 },
        );
    } else return Response.json({ error: "Invalid request." }, { status: 400 });
    checkDiscussion(result.error);
    if (!result.data?.length)
      return Response.json({ error: "Item not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof DiscussionError || e instanceof CommunityError
            ? e.message
            : e instanceof SyntaxError
              ? "Invalid request."
              : "Could not complete the action. Please retry.",
      },
      { status: e instanceof SyntaxError ? 400 : 503 },
    );
  }
}
