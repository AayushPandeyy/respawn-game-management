import { currentUser, sameOrigin } from "@/lib/auth";
import { diaryClient, checkDiary, DiaryError } from "@/lib/diary";
import { validSession, uuidPattern } from "@/lib/diary-validation";
import { gameDetails } from "@/lib/rawg";
async function handle(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in to use your diary." },
      { status: 401 },
    );
  try {
    const b = await request.json();
    if (!b || typeof b.id !== "string" || !uuidPattern.test(b.id))
      return Response.json({ error: "Invalid session." }, { status: 400 });
    if (request.method !== "DELETE" && !validSession(b))
      return Response.json(
        {
          error:
            "Use a valid date, 1–1,440 minutes, and notes up to 3,000 characters.",
        },
        { status: 400 },
      );
    const c = await diaryClient();
    if (request.method === "DELETE") {
      const { data, error } = await c
        .from("play_sessions")
        .delete()
        .eq("id", b.id)
        .eq("user_id", user.id)
        .select("id");
      checkDiary(error);
      if (!data?.length)
        return Response.json({ error: "Session not found." }, { status: 404 });
      return Response.json({ ok: true });
    }
    const values = {
      played_on: b.played_on,
      minutes: b.minutes,
      notes: b.notes.trim(),
      completed: b.completed,
      replay: b.replay,
    };
    if (request.method === "PATCH") {
      const { data, error } = await c
        .from("play_sessions")
        .update(values)
        .eq("id", b.id)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();
      checkDiary(error);
      if (!data)
        return Response.json({ error: "Session not found." }, { status: 404 });
      return Response.json({ session: data });
    }
    if (!Number.isSafeInteger(b.game_id) || b.game_id <= 0)
      return Response.json({ error: "Choose a game first." }, { status: 400 });
    // A stable client-generated ID makes a retry safe after a lost response.
    const existing = await c
      .from("play_sessions")
      .select("*")
      .eq("id", b.id)
      .eq("user_id", user.id)
      .maybeSingle();
    checkDiary(existing.error);
    if (existing.data) return Response.json({ session: existing.data });
    const game = await gameDetails(b.game_id);
    if (!game)
      return Response.json({ error: "Game not found." }, { status: 404 });
    const result = await c
      .from("play_sessions")
      .upsert(
        {
          id: b.id,
          user_id: user.id,
          game_id: game.id,
          game_name: game.name,
          ...values,
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select("*");
    checkDiary(result.error);
    if (result.data?.length) return Response.json({ session: result.data[0] });
    const retry = await c
      .from("play_sessions")
      .select("*")
      .eq("id", b.id)
      .eq("user_id", user.id)
      .maybeSingle();
    checkDiary(retry.error);
    if (!retry.data)
      return Response.json(
        { error: "Session could not be saved. Reload and try again." },
        { status: 409 },
      );
    return Response.json({ session: retry.data });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof DiaryError
            ? e.message
            : e instanceof SyntaxError
              ? "Invalid request."
              : "Could not save your diary. Please try again.",
      },
      { status: e instanceof SyntaxError ? 400 : 503 },
    );
  }
}
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
