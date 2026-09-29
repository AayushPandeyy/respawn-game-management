import { notFound } from "next/navigation";
import { gameDetails } from "@/lib/rawg";
import { currentUser } from "@/lib/auth";
import { getEntry, LibraryError } from "@/lib/library";
import type { Entry } from "@/lib/types";
import GamePage from "@/components/game-page";
import GameCommunity from "@/components/game-community";
export const dynamic = "force-dynamic";
function validId(value: string) {
  return (
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validId(id)) return { title: "Game not found — Respawn" };
  const game = await gameDetails(Number(id));
  return {
    title: game ? `${game.name} — Respawn` : "Game not found — Respawn",
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reviewsPage?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const reviewPage = Math.max(
    1,
    Math.min(5000, Number.parseInt(query.reviewsPage || "1") || 1),
  );
  if (!validId(id)) notFound();
  const [game, user] = await Promise.all([
    gameDetails(Number(id)),
    currentUser(),
  ]);
  if (!game) notFound();
  let entry: Entry | null = null;
  let libraryError = "";
  if (user)
    try {
      entry = await getEntry(user.id, game.id);
    } catch (error) {
      libraryError =
        error instanceof LibraryError
          ? error.message
          : "Could not load your cloud library. Please try again.";
    }
  return (
    <>
      <GamePage
        key={game.id}
        game={game}
        user={user}
        initialEntry={entry}
        libraryError={libraryError}
      />
      <GameCommunity
        gameId={game.id}
        gameName={game.name}
        userId={user?.id}
        page={reviewPage}
      />
    </>
  );
}
