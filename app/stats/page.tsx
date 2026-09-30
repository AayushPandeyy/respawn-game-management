import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getEntries } from "@/lib/library";
import Shell, { DataError } from "@/components/community-shell";
import DiaryStats from "@/components/diary-stats";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/stats");
  const params = await searchParams;
  const year = Math.max(
    1970,
    Math.min(
      2100,
      Number.parseInt(params.year || "") || new Date().getUTCFullYear(),
    ),
  );
  let content;
  try {
    const entries = await getEntries(user.id);
    const completed = entries.filter((e) => e.status === "completed").length;
    const rated = entries.filter((e) => e.rating > 0);
    const genres: Record<string, number> = {};
    entries.forEach((e) =>
      new Set(e.game.genres.map((g) => g.name)).forEach(
        (g) => (genres[g] = (genres[g] || 0) + 1),
      ),
    );
    const top = Object.entries(genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const max = Math.max(1, ...top.map((g) => g[1]));
    content = (
      <>
        <div className="stat-grid">
          {[
            ["Games saved", entries.length],
            ["Completed", completed],
            [
              "Playing now",
              entries.filter((e) => e.status === "playing").length,
            ],
            [
              "Average rating",
              rated.length
                ? (
                    rated.reduce((n, e) => n + e.rating, 0) / rated.length
                  ).toFixed(1) + " / 5"
                : "—",
            ],
          ].map(([label, value]) => (
            <div className="community-card stat-card" key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {!entries.length && (
          <div className="community-card">
            <h2>Your next chapter starts here.</h2>
            <p>
              Save games and give them ratings to see your habits take shape.
            </p>
            <Link className="community-button" href="/">
              Find your next game ↗
            </Link>
          </div>
        )}
        <div className="community-columns">
          <section className="community-card">
            <h2>Your favorite territories</h2>
            <p>
              Genres across your saved games. A game can belong to more than one
              genre.
            </p>
            {top.map(([g, n]) => (
              <div className="stat-bar" key={g}>
                <span>
                  {g}
                  <b>{n}</b>
                </span>
                <div>
                  <i style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </div>
            ))}
            {!top.length && <p>Genre insights appear as your library grows.</p>}
          </section>
          <section className="community-card">
            <h2>How you rate</h2>
            <p>{rated.length} rated games · Unrated games excluded</p>
            {[5, 4, 3, 2, 1].map((n) => {
              const count = rated.filter((e) => e.rating === n).length;
              return (
                <div className="stat-bar" key={n}>
                  <span>
                    {n} ★<b>{count}</b>
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${(count / Math.max(1, rated.length)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
          <section className="community-card">
            <h2>The journey so far</h2>
            <strong className="completion-number">
              {entries.length
                ? Math.round((completed / entries.length) * 100)
                : 0}
              %
            </strong>
            <p>of all saved games marked completed.</p>
            <p>
              {entries.filter((e) => e.status === "wishlist").length} games
              waiting on your wishlist.
            </p>
          </section>
          <section className="community-card">
            <h2>Recently updated</h2>
            <div className="list-game-rows">
              {entries.slice(0, 5).map((e) => (
                <div key={e.game.id}>
                  <Link href={`/games/${e.game.id}`}>{e.game.name}</Link>
                  <small>{e.status}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      </>
    );
  } catch (e) {
    content = (
      <DataError message={e instanceof Error ? e.message : "Please retry."} />
    );
  }
  return (
    <Shell
      eyebrow="YOUR PLAYING LIFE, IN NUMBERS"
      title="Look how far you’ve played."
      description="A private snapshot of your library, your taste, and the stories you’ve finished."
    >
      {content}
      <DiaryStats year={year} />
    </Shell>
  );
}
