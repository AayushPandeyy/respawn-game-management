import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { reviews } from "@/lib/community";
import { comments } from "@/lib/discussions";
import { uuidPattern } from "@/lib/diary-validation";
import Shell, { DataError } from "@/components/community-shell";
import ReviewCards from "@/components/review-cards";
import { CommentCard, CommentComposer } from "@/components/review-interactions";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reviewer: string; gameId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { reviewer, gameId } = await params;
  if (
    !uuidPattern.test(reviewer) ||
    !/^\d+$/.test(gameId) ||
    !Number.isSafeInteger(Number(gameId)) ||
    Number(gameId) <= 0
  )
    notFound();
  const q = await searchParams;
  const page = Math.max(1, Math.min(5000, parseInt(q.page || "1") || 1));
  const user = await currentUser();
  let review;
  try {
    review = (await reviews(Number(gameId), reviewer))[0];
  } catch (e) {
    return (
      <Shell
        eyebrow="PLAYER DISCUSSION"
        title="Review discussion"
        description=""
      >
        <DataError
          message={e instanceof Error ? e.message : "Could not load review."}
        />
      </Shell>
    );
  }
  if (!review) notFound();
  let content;
  try {
    const result = await comments(reviewer, Number(gameId), page);
    content = (
      <>
        <div className="discussion-heading">
          <h2>{result.total} comments</h2>
          <span>Oldest first · Spoilers hidden</span>
        </div>
        <div className="review-feed">
          {result.items.map((c) => (
            <CommentCard
              key={`${c.id}-${c.updated_at}`}
              comment={c}
              owner={user?.id === c.user_id}
            />
          ))}
          {!result.items.length && (
            <div className="community-card">
              <p>
                {result.total
                  ? "No comments on this page."
                  : "Start the conversation with a thoughtful comment."}
              </p>
            </div>
          )}
        </div>
        <nav className="feed-pagination" aria-label="Comment pages">
          {page > 1 && (
            <Link href={`?page=${page - 1}`}>← Earlier comments</Link>
          )}
          {page * 20 < result.total && page < 5000 && (
            <Link href={`?page=${page + 1}`}>More comments →</Link>
          )}
        </nav>
        {user ? (
          <CommentComposer reviewer={reviewer} gameId={Number(gameId)} />
        ) : (
          <div className="community-card">
            <Link className="community-button" href="/login">
              Sign in to comment
            </Link>
          </div>
        )}
      </>
    );
  } catch (e) {
    content = (
      <DataError
        message={e instanceof Error ? e.message : "Comments unavailable."}
      />
    );
  }
  return (
    <Shell
      eyebrow="THE CONVERSATION CONTINUES"
      title={review.game_name}
      description={`A review by ${review.profiles.display_name}. Share your perspective.`}
    >
      <div className="discussion-thread">
        <ReviewCards items={[review]} />
        {content}
      </div>
    </Shell>
  );
}
