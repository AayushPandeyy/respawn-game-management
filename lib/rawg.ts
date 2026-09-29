import "server-only";
import type { Game, GameDetails } from "./types";
import { cache } from "react";
import fallback from "./catalog.json";
export const gameDetails = cache(
  async (id: number): Promise<GameDetails | null> => {
    const key = process.env.RAWG_API_KEY || "";
    let data;
    try {
      const response = await fetch(
        `https://api.rawg.io/api/games/${id}?key=${key}`,
        { next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Unavailable");
      data = await response.json();
    } catch {
      const saved = (fallback as Game[]).find((game) => game.id === id);
      if (!saved)
        throw new Error(
          "Game details are temporarily unavailable. Please retry.",
        );
      return {
        ...saved,
        description: "",
        platforms: [],
        developers: [],
        publishers: [],
        website: null,
        playtime: 0,
        ageRating: null,
        screenshots: [],
        screenshotsUnavailable: true,
        offline: true,
      };
    }
    let screenshots: GameDetails["screenshots"] = [];
    let screenshotsUnavailable = false;
    try {
      const response = await fetch(
        `https://api.rawg.io/api/games/${id}/screenshots?key=${key}&page_size=8`,
        { next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) },
      );
      if (!response.ok) throw new Error("Unavailable");
      screenshots = (await response.json()).results
        .filter(
          (s: { image: string; is_deleted?: boolean }) =>
            !s.is_deleted && s.image?.startsWith("https://media.rawg.io/"),
        )
        .map((s: { id: number; image: string }) => ({
          id: s.id,
          image: s.image,
        }));
    } catch {
      screenshotsUnavailable = true;
    }
    let website = null;
    try {
      const url = new URL(data.website);
      if (["https:", "http:"].includes(url.protocol)) website = url.href;
    } catch {}
    return {
      id: data.id,
      name: data.name,
      background_image: data.background_image,
      rating: data.rating || 0,
      released: data.released,
      genres: data.genres || [],
      metacritic: data.metacritic,
      description: data.description_raw || "",
      platforms: (data.platforms || []).map(
        (p: { platform: { name: string } }) => p.platform.name,
      ),
      developers: (data.developers || []).map((d: { name: string }) => d.name),
      publishers: (data.publishers || []).map((p: { name: string }) => p.name),
      website,
      playtime: data.playtime || 0,
      ageRating: data.esrb_rating?.name || null,
      screenshots,
      screenshotsUnavailable,
      offline: false,
    };
  },
);
export async function games(
  search = "",
  genre = "",
): Promise<{ games: Game[]; offline: boolean }> {
  try {
    const params = new URLSearchParams({
      key: process.env.RAWG_API_KEY || "",
      page_size: "24",
      ordering: "-added",
    });
    if (search) params.set("search", search.slice(0, 100));
    else
      params.set(
        "dates",
        "2020-01-01," + new Date().toISOString().slice(0, 10),
      );
    if (genre) params.set("genres", genre);
    const res = await fetch(`https://api.rawg.io/api/games?${params}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error("RAWG unavailable");
    const data = await res.json();
    return {
      games: data.results.map((g: Game) => ({
        id: g.id,
        name: g.name,
        background_image: g.background_image,
        rating: g.rating,
        released: g.released,
        genres: g.genres,
        metacritic: g.metacritic,
      })),
      offline: false,
    };
  } catch {
    return {
      games: (fallback as Game[]).filter(
        (g) =>
          (!search || g.name.toLowerCase().includes(search.toLowerCase())) &&
          (!genre || g.genres.some((x) => x.slug === genre)),
      ),
      offline: true,
    };
  }
}
