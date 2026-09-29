"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Search,
  Check,
  LoaderCircle,
} from "lucide-react";
import type { Game } from "@/lib/types";
import type { SteamGame } from "@/lib/steam";
type Match = { candidates: Game[]; unavailable: boolean };
type Library = { steamId: string; games: SteamGame[] };
async function request(body: unknown, signal?: AbortSignal) {
  const r = await fetch("/api/steam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Could not complete the request.");
  return data;
}
const normalized = (s: string) =>
  s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export default function SteamImporter({
  configured,
  savedGames,
  savedApps,
  minutes,
  setupError,
}: {
  configured: boolean;
  savedGames: number[];
  savedApps: number[];
  minutes: number;
  setupError: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState("");
  const [library, setLibrary] = useState<Library | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState<Record<number, Match>>({});
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [status, setStatus] = useState("wishlist");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const visible = useMemo(
    () => library?.games.slice(page * 8, page * 8 + 8) || [],
    [library, page],
  );
  useEffect(() => {
    const pending = visible.filter(
      (g) =>
        !matches[g.appid] &&
        !savedApps.includes(g.appid) &&
        !done.includes(g.appid),
    );
    if (!pending.length) {
      setMatching(false);
      return;
    }
    const controller = new AbortController();
    setMatching(true);
    request(
      { action: "match", names: pending.map((g) => g.name) },
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const next: Record<number, Match> = {};
        const suggestions: Record<number, number> = {};
        pending.forEach((g, i) => {
          next[g.appid] = data.matches[i];
          const exact = data.matches[i].candidates.find(
            (candidate: Game) =>
              normalized(candidate.name) === normalized(g.name),
          );
          if (exact) suggestions[g.appid] = exact.id;
        });
        setMatches((prev) => ({ ...prev, ...next }));
        setChoices((prev) => ({ ...suggestions, ...prev }));
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Could not find matches.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMatching(false);
      });
    return () => controller.abort();
    // A page is matched once. Manual searches and saved choices must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, retry]);
  function already(g: SteamGame) {
    return (
      done.includes(g.appid) ||
      savedApps.includes(g.appid) ||
      (!!choices[g.appid] && savedGames.includes(choices[g.appid]))
    );
  }
  async function preview(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await request({ action: "preview", profile });
      setMatches({});
      setChoices({});
      setSelected([]);
      setDone([]);
      setPage(0);
      setLibrary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request({
        action: "import",
        profile: library!.steamId,
        status,
        selections: selected.map((appid) => ({
          appid,
          gameId: choices[appid],
        })),
      });
      setDone((prev) => [...prev, ...selected]);
      setSelected([]);
      setNotice(
        `${result.imported} games imported · ${result.skipped} already saved and left unchanged.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="steam-import">
      <div className="steam-intro">
        <form className="community-card community-form" onSubmit={preview}>
          <div className="steam-heading-icon">
            <Download size={24} />
          </div>
          <h2>Start with your Steam profile</h2>
          <p>
            Enter your SteamID64 or profile URL. Your Steam Game details must be
            public. This imports a public library; it does not link or verify
            ownership of a Steam account.
          </p>
          <label>
            Steam profile
            <input
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              required
              maxLength={200}
              placeholder="https://steamcommunity.com/id/yourname"
              disabled={busy}
            />
          </label>
          <button className="community-button" disabled={busy || !configured}>
            {busy ? "Working…" : "Preview library"}{" "}
            {!busy && <ArrowRight size={16} />}
          </button>
          {!configured && (
            <p role="status">
              Steam import needs a server-side STEAM_WEB_API_KEY. Add it to
              .env.local and restart the app.
            </p>
          )}
        </form>
        <aside className="community-card steam-summary">
          <span>YOUR COLLECTION, CARRIED OVER</span>
          <strong>{savedApps.length}</strong>
          <p>Steam games imported</p>
          <b>
            {(minutes / 60).toLocaleString("en-US", {
              maximumFractionDigits: 1,
            })}{" "}
            hours
          </b>
          <p>
            Recorded Steam playtime at import. Existing entries are skipped;
            playtime is not automatically synced.
          </p>
          <Link href="/dashboard">Open your library ↗</Link>
        </aside>
      </div>
      {setupError && (
        <div className="community-card steam-alert" role="alert">
          {setupError}
        </div>
      )}
      {error && (
        <div className="community-card steam-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="community-card steam-success" role="status">
          <Check size={20} />
          {notice}
        </div>
      )}
      {library && (
        <section className="steam-preview">
          <div className="steam-preview-heading">
            <div>
              <span>REVIEW BEFORE YOU IMPORT · {library.steamId}</span>
              <h2>
                {library.games.length} games. Your choice of what comes next.
              </h2>
              <p>
                Choose a RAWG match, then select games to import. Editions can
                differ, so check every suggestion.
              </p>
            </div>
            {matching && (
              <span role="status" className="steam-loading">
                <LoaderCircle size={16} /> Finding matches…
              </span>
            )}
          </div>
          {!library.games.length ? (
            <div className="community-card">
              <h2>This Steam library is empty.</h2>
              <p>
                Try another profile, or return when you’ve added games on Steam.
              </p>
            </div>
          ) : (
            <>
              <div className="steam-controls">
                <label>
                  Save new games as
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={busy}
                  >
                    <option value="wishlist">Wishlist / want to play</option>
                    <option value="playing">Playing</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <button
                  disabled={busy || matching}
                  onClick={() =>
                    setSelected(
                      visible
                        .filter((g) => !!choices[g.appid] && !already(g))
                        .map((g) => g.appid),
                    )
                  }
                >
                  Select matched games on this page
                </button>
                <button disabled={busy} onClick={() => setSelected([])}>
                  Clear selection
                </button>
              </div>
              <div className="steam-rows">
                {visible.map((g) => (
                  <SteamRow
                    key={g.appid}
                    game={g}
                    match={matches[g.appid]}
                    choice={choices[g.appid] || 0}
                    checked={selected.includes(g.appid)}
                    already={already(g)}
                    locked={done.includes(g.appid) || savedApps.includes(g.appid)}
                    disabled={busy || matching}
                    onCheck={(checked) =>
                      setSelected((prev) =>
                        checked
                          ? [...prev, g.appid]
                          : prev.filter((id) => id !== g.appid),
                      )
                    }
                    onChoose={(id) => {
                      setChoices((prev) => ({ ...prev, [g.appid]: id }));
                      setSelected((prev) => prev.filter((v) => v !== g.appid));
                    }}
                    onMatch={(match) => {
                      setMatches((prev) => ({ ...prev, [g.appid]: match }));
                      setChoices((prev) => ({ ...prev, [g.appid]: 0 }));
                      setSelected((prev) => prev.filter((v) => v !== g.appid));
                    }}
                  />
                ))}
              </div>
              <div className="steam-import-footer">
                <div>
                  <button
                    className="community-button"
                    disabled={
                      busy || matching || !selected.length || !!setupError
                    }
                    onClick={commit}
                  >
                    {busy
                      ? "Importing…"
                      : `Import ${selected.length} selected games`}
                    <Download size={16} />
                  </button>
                  <p>
                    Your ratings and private journal entries are never
                    overwritten.
                  </p>
                </div>
                <nav
                  className="feed-pagination"
                  aria-label="Steam library pages"
                >
                  <button
                    disabled={page === 0 || busy}
                    onClick={() => {
                      setSelected([]);
                      setPage((p) => p - 1);
                    }}
                  >
                    ← Previous
                  </button>
                  <span>
                    {page + 1} / {Math.ceil(library.games.length / 8)}
                  </span>
                  <button
                    disabled={(page + 1) * 8 >= library.games.length || busy}
                    onClick={() => {
                      setSelected([]);
                      setPage((p) => p + 1);
                    }}
                  >
                    Next →
                  </button>
                </nav>
              </div>
              <button
                className="steam-retry"
                disabled={busy || matching}
                onClick={() => {
                  setSelected([]);
                  setChoices((prev) =>
                    Object.fromEntries(
                      Object.entries(prev).filter(
                        ([id]) => !visible.some((g) => String(g.appid) === id),
                      ),
                    ),
                  );
                  setMatches((prev) =>
                    Object.fromEntries(
                      Object.entries(prev).filter(
                        ([id]) => !visible.some((g) => String(g.appid) === id),
                      ),
                    ),
                  );
                  setRetry((n) => n + 1);
                }}
              >
                Retry suggestions for this page
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
function SteamRow({
  game,
  match,
  choice,
  checked,
  already,
  locked,
  disabled,
  onCheck,
  onChoose,
  onMatch,
}: {
  game: SteamGame;
  match?: Match;
  choice: number;
  checked: boolean;
  already: boolean;
  locked: boolean;
  disabled: boolean;
  onCheck: (v: boolean) => void;
  onChoose: (v: number) => void;
  onMatch: (v: Match) => void;
}) {
  const [query, setQuery] = useState(game.name);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError("");
    try {
      const r = await fetch(`/api/games?search=${encodeURIComponent(query)}`);
      const d = await r.json();
      if (!r.ok || d.offline)
        throw new Error("Search is unavailable. Please retry.");
      onMatch({ candidates: d.games.slice(0, 10), unavailable: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }
  return (
    <article className="community-card steam-row">
      <div className="steam-source">
        <input
          type="checkbox"
          aria-label={`Import ${game.name}`}
          checked={checked}
          disabled={disabled || searching || already || !choice}
          onChange={(e) => onCheck(e.target.checked)}
        />
        <div>
          <h3>{game.name}</h3>
          <small>
            STEAM ·{" "}
            {(game.playtime_minutes / 60).toLocaleString("en-US", {
              maximumFractionDigits: 1,
            })}{" "}
            hours
          </small>
        </div>
      </div>
      <ArrowRight className="steam-match-arrow" size={20} />
      <div className="steam-match">
        {locked ? (
          <span className="steam-saved">
            <Check size={16} /> Already in your library
          </span>
        ) : (
          <>
            {already && <p className="steam-saved">This RAWG game is already saved. Choose a different match if this is another edition.</p>}
            <label>
              RAWG match
              <select
                aria-label={`RAWG match for ${game.name}`}
                value={choice}
                disabled={disabled || searching}
                onChange={(e) => onChoose(Number(e.target.value))}
              >
                <option value={0}>
                  {!match
                    ? "Finding suggestions…"
                    : match.unavailable
                      ? "Suggestions unavailable"
                      : "Choose a game or skip"}
                </option>
                {match?.candidates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.released ? ` (${g.released.slice(0, 4)})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="steam-match-links">
              {choice > 0 && (
                <Link
                  href={`/games/${choice}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Inspect game ↗
                </Link>
              )}
              <button
                disabled={disabled}
                onClick={() => setShowSearch((v) => !v)}
              >
                {showSearch ? "Close search" : "Find another match"}
              </button>
            </div>
            {showSearch && (
              <form className="steam-manual-search" onSubmit={search}>
                <input
                  aria-label={`Search RAWG for ${game.name}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  required
                  maxLength={100}
                />
                <button
                  className="community-button"
                  disabled={disabled || searching}
                  aria-label={`Search alternatives for ${game.name}`}
                >
                  <Search size={16} />
                </button>
              </form>
            )}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </div>
    </article>
  );
}
