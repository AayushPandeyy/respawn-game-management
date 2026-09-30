import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { communityClient } from "@/lib/community";
import { checkDiscussion } from "@/lib/discussions";
import Shell, { DataError } from "@/components/community-shell";
import { ReadNotification } from "@/components/review-interactions";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/notifications");
  const q = await searchParams;
  const page = Math.max(1, Math.min(5000, parseInt(q.page || "1") || 1));
  let content;
  try {
    const c = await communityClient();
    const [result, unread] = await Promise.all([
      c
        .from("review_notifications")
        .select(
          "id,is_read,created_at,review_comments!inner(id,review_user_id,game_id,profiles!review_comments_user_id_fkey(username,display_name),public_reviews(game_name))",
          { count: "exact" },
        )
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range((page - 1) * 20, page * 20 - 1),
      c
        .from("review_notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false),
    ]);
    checkDiscussion(result.error);
    checkDiscussion(unread.error);
    type Notice = {
      id: string;
      is_read: boolean;
      created_at: string;
      review_comments: {
        id: string;
        review_user_id: string;
        game_id: number;
        profiles: { username: string; display_name: string };
        public_reviews: { game_name: string };
      };
    };
    const items = (result.data || []) as unknown as Notice[];
    content = (
      <>
        <p className="diary-notice">{unread.count || 0} unread notifications</p>
        <div className="review-feed">
          {items.map((n) => (
            <article
              className={`community-card notification-card ${n.is_read ? "" : "notification-unread"}`}
              key={n.id}
            >
              <small>
                {n.is_read ? "READ" : "NEW COMMENT"} ·{" "}
                {new Date(n.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </small>
              <h2>
                <Link href={`/u/${n.review_comments.profiles.username}`}>
                  {n.review_comments.profiles.display_name}
                </Link>{" "}
                commented on your review
              </h2>
              <p>{n.review_comments.public_reviews.game_name}</p>
              <div className="notification-actions">
                <Link
                  href={`/reviews/${n.review_comments.review_user_id}/${n.review_comments.game_id}`}
                >
                  Open discussion ↗
                </Link>
                {!n.is_read && <ReadNotification id={n.id} />}
              </div>
            </article>
          ))}
          {!items.length && (
            <div className="community-card">
              <h2>You’re all caught up.</h2>
              <p>
                When someone comments on your public review, you’ll see it here.
              </p>
            </div>
          )}
        </div>
        <nav className="feed-pagination" aria-label="Notification pages">
          {page > 1 && <Link href={`?page=${page - 1}`}>← Newer</Link>}
          {page * 20 < (result.count || 0) && page < 5000 && (
            <Link href={`?page=${page + 1}`}>Older →</Link>
          )}
        </nav>
      </>
    );
  } catch (e) {
    content = (
      <DataError
        message={
          e instanceof Error ? e.message : "Could not load notifications."
        }
      />
    );
  }
  return (
    <Shell
      eyebrow="YOUR COMMUNITY INBOX"
      title="Someone has something to say."
      description="Private notifications for comments on your reviews. Spoiler text never appears in this inbox."
    >
      {content}
    </Shell>
  );
}
