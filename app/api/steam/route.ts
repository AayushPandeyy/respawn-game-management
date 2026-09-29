import { currentUser, sameOrigin } from "@/lib/auth";
import { SteamError, steamLibrary } from "@/lib/steam";
import { games, gameDetails } from "@/lib/rawg";
import { communityClient, CommunityError } from "@/lib/community";
export const maxDuration = 120;
// Bound upstream concurrency for libraries with many games.
async function batch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const result: R[] = [];
  for (let i = 0; i < items.length; i += 3)
    result.push(...(await Promise.all(items.slice(i, i + 3).map(fn))));
  return result;
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in to import your library." },
      { status: 401 },
    );
  try {
    const b = await request.json();
    if (!b || typeof b !== "object")
      return Response.json({ error: "Invalid request." }, { status: 400 });
    if (
      b.action === "preview" &&
      typeof b.profile === "string" &&
      b.profile.length <= 200
    ) {
      return Response.json(await steamLibrary(b.profile));
    }
    if (
      b.action === "match" &&
      Array.isArray(b.names) &&
      b.names.length > 0 &&
      b.names.length <= 8 &&
      b.names.every(
        (n: unknown) => typeof n === "string" && n.trim() && n.length <= 250,
      )
    ) {
      const matches = await batch(b.names as string[], async (name) => {
        const result = await games(name);
        return {
          name,
          candidates: result.offline ? [] : result.games.slice(0, 5),
          unavailable: result.offline,
        };
      });
      return Response.json({ matches });
    }
    if (
      b.action === "import" &&
      typeof b.profile === "string" &&
      b.profile.length <= 200 &&
      ["wishlist", "playing", "completed"].includes(b.status) &&
      Array.isArray(b.selections) &&
      b.selections.length > 0 &&
      b.selections.length <= 20 &&
      b.selections.every(
        (s: { appid?: unknown; gameId?: unknown }) =>
          s &&
          Number.isSafeInteger(s.appid) &&
          Number(s.appid) > 0 &&
          Number.isSafeInteger(s.gameId) &&
          Number(s.gameId) > 0,
      )
    ) {
      const selected = b.selections as { appid: number; gameId: number }[];
      if (
        new Set(selected.map((s) => s.appid)).size !== selected.length ||
        new Set(selected.map((s) => s.gameId)).size !== selected.length
      )
        return Response.json(
          { error: "Choose a different RAWG game for each Steam game." },
          { status: 400 },
        );
      const library = await steamLibrary(b.profile);
      const owned = new Map(library.games.map((g) => [g.appid, g]));
      if (selected.some((s) => !owned.has(s.appid)))
        return Response.json(
          {
            error:
              "Your Steam library changed. Load a fresh preview before importing.",
          },
          { status: 409 },
        );
      const entries = await batch(selected, async (s) => {
        const detail = await gameDetails(s.gameId);
        if (!detail || detail.offline)
          throw new SteamError(
            "Could not verify a selected game with RAWG. Please retry before importing.",
          );
        const {
          id,
          name,
          background_image,
          rating,
          released,
          genres,
          metacritic,
        } = detail;
        return {
          game: {
            id,
            name,
            background_image,
            rating,
            released,
            genres,
            metacritic,
          },
          status: b.status,
          steam_app_id: s.appid,
          steam_playtime_minutes: owned.get(s.appid)!.playtime_minutes,
        };
      });
      const c = await communityClient();
      const { data, error } = await c.rpc("import_steam_games", { entries });
      if (error)
        throw new SteamError(
          ["PGRST202", "42883", "42703"].includes(error.code)
            ? "Steam import needs the Supabase Steam import migration."
            : "Could not save the import. Please retry; existing games will be skipped.",
        );
      const imported = Array.isArray(data) ? data.length : 0;
      return Response.json({ imported, skipped: selected.length - imported });
    }
    return Response.json(
      { error: "Check your import selections and try again." },
      { status: 400 },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof SteamError || e instanceof CommunityError
            ? e.message
            : e instanceof SyntaxError
              ? "Invalid request."
              : "Import is unavailable. Please try again.",
      },
      { status: e instanceof SyntaxError ? 400 : 503 },
    );
  }
}
