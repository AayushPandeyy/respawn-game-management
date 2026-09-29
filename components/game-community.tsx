import Link from "next/link";
import { gameReviews, reviews, lists } from "@/lib/community";
import { ReviewForm, AddToList } from "./community-forms";
import ReviewCards from "./review-cards";
import { DataError } from "./community-shell";

export default async function GameCommunity({
  gameId,
  gameName,
  userId,
  page = 1,
}: {
  gameId: number;
  gameName: string;
  userId?: string;
  page?: number;
}) {
  const [publicResult, ownResult, listResult] = await Promise.allSettled([
    gameReviews(gameId, page),
    userId ? reviews(gameId, userId) : Promise.resolve([]),
    userId ? lists(userId) : Promise.resolve([]),
  ]);
  const mine =
    ownResult.status === "fulfilled" ? ownResult.value[0] : undefined;
  const result =
    publicResult.status === "fulfilled" ? publicResult.value : null;
  const pageUrl = (n: number) =>
    `/games/${gameId}?reviewsPage=${n}#community-reviews`;
  return (
    <section
      className="game-community"
      id="community-reviews"
      aria-labelledby="game-reviews-title"
    >
      <div className="community-heading">
        <span>PLAYER PERSPECTIVES</span>
        <h2 id="game-reviews-title">
          Public reviews{result ? ` (${result.total})` : ""}
        </h2>
        <p>
          What players think of {gameName}. Reviews from everyone, whether you
          follow them or not.
        </p>
      </div>
      <div className="community-columns">
        <div className="review-feed">
          {!result ? (
            <DataError message="Public reviews could not be loaded. Please try again." />
          ) : result.items.length ? (
            <ReviewCards items={result.items} />
          ) : (
            <div className="community-card">
              <h2>
                {result.total
                  ? "No reviews on this page."
                  : "Be the first to share your take."}
              </h2>
              <p>
                {result.total
                  ? "Return to the first page to see this game’s reviews."
                  : `No one has published a review of ${gameName} yet.`}
              </p>
              {result.total > 0 && <Link href={pageUrl(1)}>First page ↗</Link>}
            </div>
          )}
          {result && (
            <nav className="feed-pagination" aria-label="Game review pages">
              {page > 1 && (
                <Link href={pageUrl(page - 1)}>← Newer reviews</Link>
              )}
              {page * 20 < result.total && page < 5000 && (
                <Link href={pageUrl(page + 1)}>Older reviews →</Link>
              )}
            </nav>
          )}
        </div>
        {userId ? (
          <div className="review-feed">
            {ownResult.status === "fulfilled" ? (
              <ReviewForm
                key={mine?.updated_at || "new"}
                gameId={gameId}
                existing={mine}
              />
            ) : (
              <DataError message="Your published review could not be loaded. Please retry before editing." />
            )}
            {listResult.status === "fulfilled" ? (
              <AddToList gameId={gameId} lists={listResult.value} />
            ) : (
              <div className="community-card">
                <p>Your custom lists are temporarily unavailable.</p>
                <Link href="/lists">Manage lists ↗</Link>
              </div>
            )}
          </div>
        ) : (
          <div className="community-card">
            <h2>Have something to say?</h2>
            <p>
              Sign in to publish your review. Your private journal stays
              private.
            </p>
            <Link className="community-button" href="/login">
              Sign in to review
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
