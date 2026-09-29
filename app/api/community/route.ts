import { currentUser, sameOrigin } from "@/lib/auth";
import { communityClient, check, CommunityError } from "@/lib/community";
import { gameDetails } from "@/lib/rawg";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const b = await request.json();
    if (!b || typeof b !== "object" || Array.isArray(b))
      return Response.json({ error: "Invalid request." }, { status: 400 });
    const c = await communityClient();
    const str = (v: unknown, max: number, min = 0) =>
      typeof v === "string" && v.trim().length >= min && v.length <= max;
    const uuid = (v: unknown) =>
      typeof v === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    let result;
    if (
      b.action === "profile" &&
      str(b.username, 24, 3) &&
      /^[a-z0-9_]+$/.test(b.username) &&
      str(b.display_name, 40, 1) &&
      str(b.bio, 500) &&
      ["#c3f66b", "#91bfff", "#d5a3ff", "#ffb58a"].includes(b.color)
    ) {
      result = await c
        .from("profiles")
        .upsert({
          user_id: user.id,
          username: b.username,
          display_name: b.display_name.trim(),
          bio: b.bio.trim(),
          color: b.color,
        })
        .select()
        .single();
    } else if (
      b.action === "review" &&
      Number.isSafeInteger(b.game_id) &&
      b.game_id > 0 &&
      str(b.body, 3000, 1) &&
      Number.isInteger(b.rating) &&
      b.rating >= 1 &&
      b.rating <= 5 &&
      typeof b.spoiler === "boolean"
    ) {
      const game = await gameDetails(b.game_id);
      if (!game)
        return Response.json({ error: "Game not found." }, { status: 404 });
      const { data: p, error } = await c
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      check(error);
      if (!p)
        return Response.json(
          { error: "Create your profile before publishing a review." },
          { status: 400 },
        );
      result = await c
        .from("public_reviews")
        .upsert({
          user_id: user.id,
          game_id: game.id,
          game_name: game.name,
          body: b.body.trim(),
          rating: b.rating,
          spoiler: b.spoiler,
        })
        .select()
        .single();
    } else if (b.action === "unpublish" && Number.isSafeInteger(b.game_id)) {
      result = await c
        .from("public_reviews")
        .delete()
        .eq("user_id", user.id)
        .eq("game_id", b.game_id);
    } else if (
      b.action === "list" &&
      str(b.title, 100, 1) &&
      str(b.description, 1000) &&
      typeof b.is_public === "boolean" &&
      (!b.id || uuid(b.id))
    ) {
      const value = {
        title: b.title.trim(),
        description: b.description.trim(),
        is_public: b.is_public,
      };
      result = b.id
        ? await c
            .from("game_lists")
            .update(value)
            .eq("id", b.id)
            .eq("user_id", user.id)
            .select()
            .single()
        : await c
            .from("game_lists")
            .insert({ ...value, user_id: user.id })
            .select()
            .single();
    } else if (b.action === "delete-list" && uuid(b.id)) {
      result = await c
        .from("game_lists")
        .delete()
        .eq("id", b.id)
        .eq("user_id", user.id);
    } else if (
      ["add-item", "remove-item"].includes(b.action) &&
      uuid(b.id) &&
      Number.isSafeInteger(b.game_id) &&
      b.game_id > 0
    ) {
      const { data: owned, error } = await c
        .from("game_lists")
        .select("id")
        .eq("id", b.id)
        .eq("user_id", user.id)
        .maybeSingle();
      check(error);
      if (!owned)
        return Response.json({ error: "List not found." }, { status: 404 });
      if (b.action === "remove-item")
        result = await c
          .from("list_items")
          .delete()
          .eq("list_id", b.id)
          .eq("game_id", b.game_id);
      else {
        const game = await gameDetails(b.game_id);
        if (!game)
          return Response.json({ error: "Game not found." }, { status: 404 });
        result = await c
          .from("list_items")
          .upsert({ list_id: b.id, game_id: game.id, game_name: game.name });
      }
    } else
      return Response.json(
        { error: "Check the fields and try again." },
        { status: 400 },
      );
    check(result.error);
    return Response.json({ ok: true, data: result.data });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof SyntaxError
            ? "Invalid request."
            : e instanceof CommunityError
              ? e.message
              : "Could not save. Please try again.",
      },
      { status: e instanceof SyntaxError ? 400 : 503 },
    );
  }
}
