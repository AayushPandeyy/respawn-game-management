import Dashboard from "@/components/dashboard";
import { games } from "@/lib/rawg";
import { currentUser } from "@/lib/auth";
import { getEntries, LibraryError } from "@/lib/library";
import type { Entry } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [catalog, user] = await Promise.all([games(), currentUser()]);
  let entries: Entry[] = [];
  let libraryError = "";
  if (user)
    try {
      entries = await getEntries(user.id);
    } catch (error) {
      libraryError =
        error instanceof LibraryError
          ? error.message
          : "Could not load your cloud library. Please try again.";
    }
  return (
    <Dashboard
      initialGames={catalog.games}
      offline={catalog.offline}
      user={user}
      entries={entries}
      libraryError={libraryError}
    />
  );
}
