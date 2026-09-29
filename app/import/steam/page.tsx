import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { communityClient } from "@/lib/community";
import Shell from "@/components/community-shell";
import SteamImporter from "@/components/steam-importer";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const savedGames: number[] = [];
  const savedApps: number[] = [];
  let minutes = 0;
  let setupError = "";
  try {
    const c = await communityClient();
    for (let offset = 0; ; offset += 250) {
      const { data, error } = await c
        .from("library_entries")
        .select("game_id,steam_app_id,steam_playtime_minutes")
        .eq("user_id", user.id)
        .order("game_id")
        .range(offset, offset + 249);
      if (error)
        throw new Error(
          ["42703", "PGRST204"].includes(error.code)
            ? "Run the Supabase Steam import migration to enable saving."
            : "Your cloud library could not be loaded. Refresh the page to retry.",
        );
      for (const row of data || []) {
        savedGames.push(row.game_id);
        if (row.steam_app_id) {
          savedApps.push(row.steam_app_id);
          minutes += row.steam_playtime_minutes || 0;
        }
      }
      if (!data || data.length < 250) break;
    }
  } catch (e) {
    setupError =
      e instanceof Error ? e.message : "Could not load your import history.";
  }
  return (
    <Shell
      eyebrow="BRING YOUR ADVENTURES WITH YOU"
      title="Your Steam library. A new home."
      description="Bring the games you own into Respawn, one carefully matched collection at a time."
    >
      <SteamImporter
        configured={!!process.env.STEAM_WEB_API_KEY?.trim()}
        savedGames={savedGames}
        savedApps={savedApps}
        minutes={minutes}
        setupError={setupError}
      />
    </Shell>
  );
}
