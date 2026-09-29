import "server-only";
import { createClient } from "./supabase/server";
export type PlaySession = {
  id: string;
  game_id: number;
  game_name: string;
  played_on: string;
  minutes: number;
  notes: string;
  completed: boolean;
  replay: boolean;
  created_at: string;
  updated_at: string;
};
export type DiaryMonth = {
  month: number;
  minutes: number;
  sessions: number;
  completions: number;
  replays: number;
};
export class DiaryError extends Error {}
export function checkDiary(error: { code?: string } | null) {
  if (error)
    throw new DiaryError(
      ["PGRST205", "PGRST202", "42P01", "42883"].includes(error.code || "")
        ? "Your gaming diary needs the Supabase diary migration."
        : "Could not access your diary. Please try again.",
    );
}
export async function diaryClient() {
  const c = await createClient();
  if (!c) throw new DiaryError("Supabase is not configured.");
  return c;
}
export async function diaryTimeline(
  userId: string,
  page: number,
  gameId?: number,
  month?: string,
) {
  const c = await diaryClient();
  let q = c
    .from("play_sessions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("played_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (gameId) q = q.eq("game_id", gameId);
  if (month) {
    const [year, m] = month.split("-").map(Number);
    const end = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
    q = q.gte("played_on", month + "-01").lt("played_on", end);
  }
  const { data, error, count } = await q;
  checkDiary(error);
  return { sessions: (data || []) as PlaySession[], total: count || 0 };
}
export async function diaryMonths(year: number): Promise<DiaryMonth[]> {
  const c = await diaryClient();
  const { data, error } = await c.rpc("diary_monthly", { target_year: year });
  checkDiary(error);
  return (data || []) as DiaryMonth[];
}
