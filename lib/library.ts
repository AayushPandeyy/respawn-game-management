import "server-only";
import { createClient } from "./supabase/server";
import type { Entry } from "./types";

export class LibraryError extends Error {}
function check(error: { code?: string } | null) {
  if (!error) return;
  if (["PGRST205", "42P01"].includes(error.code || ""))
    throw new LibraryError(
      "Your cloud library is not set up yet. Run the Supabase database migration to enable it.",
    );
  throw new LibraryError(
    "Your cloud library is unavailable. Please try again.",
  );
}
async function client() {
  const supabase = await createClient();
  if (!supabase) throw new LibraryError("Supabase is not configured yet.");
  return supabase;
}
const columns = "game,status,rating,review,updated_at";
export async function getEntries(userId: string): Promise<Entry[]> {
  const supabase = await client();
  const entries: Entry[] = [];
  // Paginate rather than silently truncating larger collections at the API limit.
  for (let offset = 0; ; offset += 250) {
    const { data, error } = await supabase
      .from("library_entries")
      .select(columns)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("game_id")
      .range(offset, offset + 249);
    check(error);
    entries.push(...((data || []) as Entry[]));
    if (!data || data.length < 250) return entries;
  }
}
export async function getEntry(
  userId: string,
  gameId: number,
): Promise<Entry | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("library_entries")
    .select(columns)
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .maybeSingle();
  check(error);
  return data as Entry | null;
}
export async function saveEntry(
  userId: string,
  entry: Omit<Entry, "updated_at">,
): Promise<Entry> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("library_entries")
    .upsert(
      {
        user_id: userId,
        game_id: entry.game.id,
        game: entry.game,
        status: entry.status,
        rating: entry.rating,
        review: entry.review,
      },
      { onConflict: "user_id,game_id" },
    )
    .select(columns)
    .single();
  check(error);
  if (!data) throw new LibraryError("Could not confirm your saved entry.");
  return data as Entry;
}
export async function removeEntry(userId: string, gameId: number) {
  const supabase = await client();
  const { error } = await supabase
    .from("library_entries")
    .delete()
    .eq("user_id", userId)
    .eq("game_id", gameId);
  check(error);
}
