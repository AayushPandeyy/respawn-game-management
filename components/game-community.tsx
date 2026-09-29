import Link from "next/link";
import { reviews, lists } from "@/lib/community";
import { ReviewForm, AddToList } from "./community-forms";
import ReviewCards from "./review-cards";
import { DataError } from "./community-shell";
export default async function GameCommunity({
  gameId,
  userId,
}: {
  gameId: number;
  userId?: string;
}) {
  try {
    const [items, own, collections] = await Promise.all([
      reviews(gameId),
      userId ? reviews(gameId, userId) : Promise.resolve([]),
      userId ? lists(userId) : Promise.resolve([]),
    ]);
    const mine = own[0];
    return (
      <section className="game-community">
        <div className="community-heading">
          <span>PLAYER PERSPECTIVES</span>
          <h2>Better when shared.</h2>
          <p>
            The latest 100 public reviews. Your private journal stays yours.
          </p>
          <Link href="/lists">Manage custom lists ↗</Link>
        </div>
        <div className="community-columns">
          <ReviewCards items={items} />
          {userId ? (
            <div className="review-feed">
              <AddToList gameId={gameId} lists={collections} />
              <ReviewForm
                key={mine?.updated_at || "new"}
                gameId={gameId}
                existing={mine}
              />
            </div>
          ) : (
            <div className="community-card">
              <h2>Have something to say?</h2>
              <Link className="community-button" href="/login">
                Sign in to review
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  } catch (e) {
    return (
      <section className="game-community">
        <DataError
          message={e instanceof Error ? e.message : "Reviews unavailable."}
        />
      </section>
    );
  }
}
