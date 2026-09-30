import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { communityClient, type Review, type Profile } from "@/lib/community";
import { checkFollow } from "@/lib/follows";
import Shell, { DataError } from "@/components/community-shell";
import ReviewCards from "@/components/review-cards";
export const dynamic = "force-dynamic";
type Event = {
  kind: "review" | "list";
  event_id: string;
  occurred_at: string;
  payload: Review & {
    id: string;
    title: string;
    description: string;
    profiles: Profile;
  };
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/feed");
  const params = await searchParams;
  const page = Math.min(5001, Math.max(1, parseInt(params.page || "1") || 1));
  let content;
  try {
    const c = await communityClient();
    const { data, error } = await c.rpc("following_feed", {
      page_offset: (page - 1) * 20,
    });
    checkFollow(error);
    const events = (data || []) as Event[];
    content = (
      <>
        <div className="feed-toolbar">
          <span>Following · Latest public activity</span>
          <Link className="community-button" href="/players">
            Find players ↗
          </Link>
        </div>
        <div className="review-feed">
          {events.slice(0, 20).map((e) =>
            e.kind === "review" ? (
              <div key={`review-${e.event_id}`}>
                <p className="activity-label">Published or updated a review</p>
                <ReviewCards items={[e.payload]} />
              </div>
            ) : (
              <article className="community-card" key={`list-${e.event_id}`}>
                <div className="review-author">
                  <span
                    className="small-avatar"
                    style={{ background: e.payload.profiles.color }}
                  >
                    {e.payload.profiles.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <Link href={`/u/${e.payload.profiles.username}`}>
                    {e.payload.profiles.display_name}
                    <small>@{e.payload.profiles.username}</small>
                  </Link>
                </div>
                <small>CREATED A PUBLIC COLLECTION</small>
                <h2>
                  <Link href={`/lists/${e.payload.id}`}>
                    {e.payload.title} ↗
                  </Link>
                </h2>
                <p>{e.payload.description}</p>
                <small>
                  {new Date(e.occurred_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </small>
              </article>
            ),
          )}
        </div>
        {!events.length && (
          <section className="community-card feed-empty">
            <span>✦</span>
            <h2>
              {page === 1
                ? "Your people. Your next obsession."
                : "You’re all caught up."}
            </h2>
            <p>
              {page === 1
                ? "Follow a player to see their public reviews and collections here. Their existing public posts will appear too."
                : "No more public activity to show."}
            </p>
            <Link href="/players">Discover players ↗</Link>
          </section>
        )}
        <nav className="feed-pagination" aria-label="Activity pages">
          {page > 1 && (
            <Link href={`/feed?page=${page - 1}`}>← Newer activity</Link>
          )}
          {events.length > 20 && page < 5001 && (
            <Link href={`/feed?page=${page + 1}`}>Older activity →</Link>
          )}
        </nav>
      </>
    );
  } catch (e) {
    content = (
      <DataError message={e instanceof Error ? e.message : "Please retry."} />
    );
  }
  return (
    <Shell
      eyebrow="YOUR CIRCLE, IN PLAY"
      title="A little inspiration from your people."
      description="Reviews and public collections from players you follow. Private journals and play statuses stay private."
    >
      {content}
    </Shell>
  );
}
