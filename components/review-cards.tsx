import Link from "next/link";
import type { Review } from "@/lib/community";
export default function ReviewCards({ items }: { items: Review[] }) {
  return (
    <div className="review-feed">
      {!items.length && (
        <div className="community-card">
          <h2>The conversation starts here.</h2>
          <p>No public reviews yet. Visit a game to publish yours.</p>
          <Link href="/">Explore games ↗</Link>
        </div>
      )}
      {items.map((r) => (
        <article className="community-card" key={`${r.user_id}-${r.game_id}`}>
          <div className="review-author">
            <span
              className="small-avatar"
              style={{ background: r.profiles.color }}
            >
              {r.profiles.display_name.slice(0, 2).toUpperCase()}
            </span>
            <Link href={`/u/${r.profiles.username}`}>
              {r.profiles.display_name}
              <small>@{r.profiles.username}</small>
            </Link>
            <span
              className="review-stars"
              aria-label={`${r.rating} out of 5 stars`}
            >
              {"★".repeat(r.rating)}
            </span>
          </div>
          <h2>
            <Link href={`/games/${r.game_id}`}>{r.game_name} ↗</Link>
          </h2>
          {r.spoiler ? (
            <details>
              <summary>Contains spoilers — reveal review</summary>
              <p className="review-body">{r.body}</p>
            </details>
          ) : (
            <p className="review-body">{r.body}</p>
          )}
          <small>
            Updated{" "}
            {new Date(r.updated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </small>
        </article>
      ))}
    </div>
  );
}
