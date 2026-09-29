import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { diaryTimeline } from "@/lib/diary";
import { gameDetails } from "@/lib/rawg";
import Shell, { DataError } from "@/components/community-shell";
import Diary from "@/components/diary";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; game?: string; month?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const p = await searchParams;
  const page = Math.max(1, Math.min(5000, Number.parseInt(p.page || "1") || 1));
  const gameId =
    typeof p.game === "string" &&
    /^\d+$/.test(p.game) &&
    Number.isSafeInteger(Number(p.game)) &&
    Number(p.game) > 0
      ? Number(p.game)
      : undefined;
  const month =
    typeof p.month === "string" &&
    /^(19[7-9]\d|20\d\d|2100)-(0[1-9]|1[0-2])$/.test(p.month)
      ? p.month
      : undefined;
  let content;
  const href = (n: number) =>
    "/diary?" +
    new URLSearchParams({
      page: String(n),
      ...(gameId ? { game: String(gameId) } : {}),
      ...(month ? { month } : {}),
    }).toString();
  try {
    const [timeline, detail] = await Promise.all([
      diaryTimeline(user.id, page, gameId, month),
      gameId ? gameDetails(gameId) : Promise.resolve(null),
    ]);
    content = (
      <>
        <form className="diary-filter" action="/diary">
          <label>
            Filter by month
            <input
              type="month"
              name="month"
              min="1970-01"
              max="2100-12"
              defaultValue={month}
            />
          </label>
          {gameId && <input type="hidden" name="game" value={gameId} />}
          <button className="community-button">Apply filter</button>
          <Link href="/diary">Clear filters</Link>
          <span>
            {timeline.total} sessions{detail ? ` · ${detail.name}` : ""}
          </span>
        </form>
        <Diary
          sessions={timeline.sessions}
          initialGame={detail ? { id: detail.id, name: detail.name } : null}
        />
        <nav className="feed-pagination" aria-label="Diary pages">
          {page > 1 && <Link href={href(page - 1)}>← Newer sessions</Link>}
          {page * 20 < timeline.total && page < 5000 && (
            <Link href={href(page + 1)}>Older sessions →</Link>
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
      eyebrow="THE MOMENTS BETWEEN SAVE POINTS"
      title="A life in play."
      description="Your private gaming diary. Log the hours, remember the small victories, and revisit your favorite worlds."
    >
      {content}
    </Shell>
  );
}
