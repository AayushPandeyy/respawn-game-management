export type Game = {
  id: number;
  name: string;
  background_image: string | null;
  rating: number;
  released: string | null;
  genres: { name: string; slug: string }[];
  metacritic: number | null;
};
export type User = { id: string; name: string; email: string };
export type GameDetails = Game & {
  description: string;
  platforms: string[];
  developers: string[];
  publishers: string[];
  website: string | null;
  playtime: number;
  ageRating: string | null;
  screenshots: { id: number; image: string }[];
  screenshotsUnavailable: boolean;
  offline: boolean;
};
export type Entry = {
  game: Game;
  status: "wishlist" | "playing" | "completed";
  rating: number;
  review: string;
  updated_at: string;
};
