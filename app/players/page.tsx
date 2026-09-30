import Link from "next/link";
import Shell, { DataError } from "@/components/community-shell";
import { communityClient, check, type Profile } from "@/lib/community";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query =
    typeof params.q === "string"
      ? params.q.slice(0, 24).replace(/[^a-z0-9_ ]/gi, "").trim()
      : "";
  const page = Math.min(4000, Math.max(1, parseInt(params.page || "1") || 1));
  let content;
  try {
    const c = await communityClient();
    let q = c
      .from("profiles")
      .select("*")
      .order("display_name")
      .range((page - 1) * 24, page * 24);
    if (query) {
      const safe = query.replace(/_/g, "\\_");
      q = q.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`);
    }
    const { data, error } = await q;
    check(error);
    const players = (data || []) as Profile[];
    content = (
      <>
        <div className="collection-grid">
          {players.slice(0, 24).map((p) => (
            <Link
              className="community-card player-card"
              href={p.username ? `/u/${p.username}` : `/u/id/${p.user_id}`}
              key={p.user_id}
            >
              <span className="profile-avatar" style={{ background: p.color }}>
                {p.display_name.slice(0, 2).toUpperCase()}
              </span>
              <h2>{p.display_name}</h2>
              <small>{p.username ? `@${p.username}` : "New player"}</small>
              <p>{p.bio || "Ready for the next adventure."}</p>
              <span>View player ↗</span>
            </Link>
          ))}
        </div>
        {!players.length && (
          <div className="community-card">
            <h2>No players found.</h2>
            <p>Try another name or username.</p>
            <Link href="/profile">Set up your profile ↗</Link>
          </div>
        )}
        <nav className="feed-pagination" aria-label="Player pages">
          {page > 1 && (
            <Link href={`/players?q=${query}&page=${page - 1}`}>
              ← Previous
            </Link>
          )}
          {players.length > 24 && page < 4000 && (
            <Link href={`/players?q=${query}&page=${page + 1}`}>Next →</Link>
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
      eyebrow="FIND YOUR PEOPLE"
      title="Good games. Great company."
      description="Discover players, visit their profiles, and follow the perspectives you enjoy."
    >
      <form className="player-search" action="/players">
        <label htmlFor="player-query">Search players</label>
        <div>
          <input
            id="player-query"
            name="q"
            maxLength={24}
            defaultValue={query}
            placeholder="Search by name or username…"
          />
          <button className="community-button">Search</button>
        </div>
      </form>
      {content}
    </Shell>
  );
}
