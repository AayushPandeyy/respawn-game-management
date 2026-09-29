import Link from "next/link";
import { diaryMonths } from "@/lib/diary";
export default async function DiaryStats({ year }: { year: number }) {
  try {
    const rows = await diaryMonths(year);
    const months = Array.from(
      { length: 12 },
      (_, i) =>
        rows.find((r) => r.month === i + 1) || {
          month: i + 1,
          minutes: 0,
          sessions: 0,
          completions: 0,
          replays: 0,
        },
    );
    const total = months.reduce(
      (s, m) => ({
        minutes: s.minutes + Number(m.minutes),
        sessions: s.sessions + Number(m.sessions),
        completions: s.completions + Number(m.completions),
        replays: s.replays + Number(m.replays),
      }),
      { minutes: 0, sessions: 0, completions: 0, replays: 0 },
    );
    const max = Math.max(1, ...months.map((m) => Number(m.minutes)));
    const completionMax = Math.max(
      1,
      ...months.map((m) => Number(m.completions)),
    );
    return (
      <section className="diary-stats">
        <div className="diary-stats-heading">
          <div>
            <span>YOUR DIARY, IN PERSPECTIVE</span>
            <h2>A year of adventures.</h2>
            <p>
              Manually logged sessions only. Steam playtime is kept separate.
            </p>
          </div>
          <form action="/stats">
            <label>
              Year
              <input
                type="number"
                name="year"
                required
                min={1970}
                max={2100}
                defaultValue={year}
              />
            </label>
            <button className="community-button">View</button>
          </form>
        </div>
        <div className="stat-grid">
          {[
            ["Logged hours", (total.minutes / 60).toFixed(1)],
            ["Play sessions", total.sessions],
            ["Completion logs", total.completions],
            ["Replay sessions", total.replays],
          ].map(([title, value]) => (
            <div className="community-card stat-card" key={title}>
              <small>
                {title} · {year}
              </small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="community-columns">
          <section className="community-card">
            <h2>Monthly playtime</h2>
            {months.map((m) => (
              <div className="stat-bar" key={m.month}>
                <span>
                  {new Date(Date.UTC(year, m.month - 1, 1)).toLocaleDateString(
                    "en-US",
                    { month: "short", timeZone: "UTC" },
                  )}
                  <b>{(Number(m.minutes) / 60).toFixed(1)} h</b>
                </span>
                <div>
                  <i style={{ width: `${(Number(m.minutes) / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
          <section className="community-card">
            <h2>Monthly completions</h2>
            <p>Completed-session markers, including repeat finishes.</p>
            {months.map((m) => (
              <div className="stat-bar" key={m.month}>
                <span>
                  {new Date(Date.UTC(year, m.month - 1, 1)).toLocaleDateString(
                    "en-US",
                    { month: "short", timeZone: "UTC" },
                  )}
                  <b>{m.completions}</b>
                </span>
                <div>
                  <i
                    style={{
                      width: `${(Number(m.completions) / completionMax) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </section>
        </div>
        {!total.sessions && (
          <p className="diary-notice">
            No sessions logged in {year}.{" "}
            <Link href="/diary">Start your diary ↗</Link>
          </p>
        )}
      </section>
    );
  } catch (e) {
    return (
      <section className="community-card diary-stats" role="status">
        <h2>Diary statistics</h2>
        <p>
          {e instanceof Error ? e.message : "Diary statistics are unavailable."}
        </p>
      </section>
    );
  }
}
