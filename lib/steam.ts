import "server-only";
export class SteamError extends Error {}
export type SteamGame = {
  appid: number;
  name: string;
  playtime_minutes: number;
};
function isSteamId(value: string) {
  return (
    /^\d{17}$/.test(value) &&
    BigInt(value) >= 76561197960265729n &&
    BigInt(value) <= 76561202255233023n
  );
}
export function parseSteamProfile(input: string): {
  kind: "id" | "vanity";
  value: string;
} {
  const value = input.trim();
  if (isSteamId(value)) return { kind: "id", value };
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "steamcommunity.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    const parts = url.pathname.match(
      /^\/(profiles|id)\/([a-zA-Z0-9_-]{2,64})\/?$/,
    );
    if (!parts) throw new Error();
    if (parts[1] === "profiles" && isSteamId(parts[2]))
      return { kind: "id", value: parts[2] };
    if (parts[1] === "id") return { kind: "vanity", value: parts[2] };
  } catch {}
  throw new SteamError(
    "Enter a 17-digit SteamID64 or an HTTPS steamcommunity.com profile URL.",
  );
}
async function steamRequest(path: string, params: Record<string, string>) {
  const key = process.env.STEAM_WEB_API_KEY?.trim();
  if (!key)
    throw new SteamError("Steam import needs a server-side STEAM_WEB_API_KEY.");
  try {
    const query = new URLSearchParams({ ...params, key });
    const r = await fetch(`https://api.steampowered.com/${path}/?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 401 || r.status === 403)
      throw new SteamError(
        "Steam rejected the server API key. Check the Steam import configuration.",
      );
    if (r.status === 429)
      throw new SteamError(
        "Steam is receiving too many requests. Please try again later.",
      );
    if (!r.ok) throw new Error();
    return (await r.json()).response;
  } catch (e) {
    if (e instanceof SteamError) throw e;
    throw new SteamError("Steam is unavailable right now. Please try again.");
  }
}
export async function steamLibrary(
  input: string,
): Promise<{ steamId: string; games: SteamGame[] }> {
  const parsed = parseSteamProfile(input);
  let steamId = parsed.value;
  if (parsed.kind === "vanity") {
    const result = await steamRequest("ISteamUser/ResolveVanityURL/v1", {
      vanityurl: parsed.value,
      url_type: "1",
    });
    if (
      result?.success !== 1 ||
      typeof result.steamid !== "string" ||
      !isSteamId(result.steamid)
    )
      throw new SteamError(
        "That Steam profile could not be found. Try its SteamID64.",
      );
    steamId = result.steamid;
  }
  const result = await steamRequest("IPlayerService/GetOwnedGames/v1", {
    steamid: steamId,
    include_appinfo: "true",
    include_played_free_games: "true",
  });
  if (
    !result ||
    !Number.isInteger(result.game_count) ||
    result.game_count < 0 ||
    result.game_count > 30000 ||
    (result.game_count > 0 && !Array.isArray(result.games))
  )
    throw new SteamError(
      "Steam could not share this library. Check that Game details are public in Steam privacy settings.",
    );
  const games: SteamGame[] = [];
  const seen = new Set<number>();
  for (const g of result.games || []) {
    if (
      !Number.isSafeInteger(g.appid) ||
      g.appid <= 0 ||
      typeof g.name !== "string" ||
      !g.name.trim() ||
      g.name.length > 250 ||
      !Number.isSafeInteger(g.playtime_forever) ||
      g.playtime_forever < 0
    )
      throw new SteamError(
        "Steam returned incomplete game data. Please try again.",
      );
    if (!seen.has(g.appid)) {
      seen.add(g.appid);
      games.push({
        appid: g.appid,
        name: g.name,
        playtime_minutes: g.playtime_forever,
      });
    }
  }
  if (games.length !== result.game_count)
    throw new SteamError(
      "Steam returned an incomplete library. Please try again.",
    );
  games.sort((a, b) => a.name.localeCompare(b.name) || a.appid - b.appid);
  return { steamId, games };
}
