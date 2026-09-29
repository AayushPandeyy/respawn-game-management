"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Gamepad2,
  Library,
  LogOut,
  Plus,
  Search,
  Star,
  NotebookPen,
  X,
  LoaderCircle,
  SlidersHorizontal,
} from "lucide-react";
import Brand from "./brand";
import type { Entry, Game, User } from "@/lib/types";
const genres = [
  ["", "All games"],
  ["action", "Action"],
  ["role-playing-games-rpg", "RPG"],
  ["adventure", "Adventure"],
  ["indie", "Indie"],
  ["shooter", "Shooter"],
];
export default function Dashboard({
  initialGames,
  offline,
  user,
  entries,
  libraryError = "",
}: {
  initialGames: Game[];
  offline: boolean;
  user: User | null;
  entries: Entry[];
  libraryError?: string;
}) {
  const [view, setView] = useState("discover");
  const [catalog, setCatalog] = useState(initialGames);
  const [saved, setSaved] = useState(entries);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [shelfFilter, setShelfFilter] = useState("all");
  const [sort, setSort] = useState("default");
  useEffect(() => setSaved(entries), [entries]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(offline);
  const [heroIndex, setHeroIndex] = useState(0);
  const [selected, setSelected] = useState<Game | null>(null);
  const [status, setStatus] = useState<Entry["status"]>("wishlist");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const first = useRef(true);
  const requestNumber = useRef(0);
  const featured = [326243, 58550, 41494]
    .map((id) => initialGames.find((g) => g.id === id))
    .filter(Boolean) as Game[];
  const hero = featured[heroIndex] || initialGames[0];
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    const id = ++requestNumber.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/games?search=${encodeURIComponent(search)}&genre=${genre}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (id === requestNumber.current) {
          setCatalog(data.games);
          setCached(data.offline);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setNotice("Could not load games. Please try again.");
      } finally {
        if (id === requestNumber.current) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, genre]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  function open(game: Game) {
    if (libraryError) {
      setNotice(libraryError);
      return;
    }
    const entry = saved.find((e) => e.game.id === game.id);
    setSelected(game);
    setStatus(entry?.status || "wishlist");
    setRating(entry?.rating || 0);
    setReview(entry?.review || "");
    setError("");
    dialog.current?.showModal();
  }
  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: selected, status, rating, review }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSaved((prev) => [
        result.entry,
        ...prev.filter((e) => e.game.id !== selected.id),
      ]);
      dialog.current?.close();
      setNotice("Saved to your library. A new chapter logged.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  const filtered =
    view === "discover"
      ? catalog
      : saved
          .filter(
            (e) =>
              (view !== "journal" || e.review || e.rating > 0) &&
              (shelfFilter === "all" || e.status === shelfFilter) &&
              e.game.name.toLowerCase().includes(search.toLowerCase()) &&
              (!genre || e.game.genres.some((g) => g.slug === genre)),
          )
          .map((e) => e.game);
  const shown = [...filtered].sort((a, b) =>
    sort === "rating"
      ? b.rating - a.rating
      : sort === "title"
        ? a.name.localeCompare(b.name)
        : sort === "release"
          ? (b.released || "").localeCompare(a.released || "")
          : 0,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-inner">
          <span className="nav-label">YOUR CORNER OF THE GAME WORLD</span>
          <nav>
            <Link className="nav-item" href="/diary">
              Gaming diary
            </Link>
            <Link className="nav-item" href="/feed">
              Activity feed
            </Link>
            <Link className="nav-item" href="/players">
              Find players
            </Link>
            <Link className="nav-item" href="/profile">
              My profile
            </Link>
            <Link className="nav-item" href="/reviews">
              Public reviews
            </Link>
            <Link className="nav-item" href="/lists">
              Custom lists
            </Link>
            <Link className="nav-item" href="/stats">
              Statistics
            </Link>
            {[
              ["discover", "Discover", Compass],
              ["library", "My library", Library],
              ["journal", "My journal", NotebookPen],
            ].map(([key, label, Icon]) => (
              <button
                key={String(key)}
                className={view === key ? "nav-item active" : "nav-item"}
                onClick={() => setView(String(key))}
              >
                <Icon size={19} />
                <span>{String(label)}</span>
                {key === "library" && <small>{saved.length}</small>}
              </button>
            ))}
          </nav>
          <div className="sidebar-collection">
            <span className="nav-label">YOUR COLLECTION</span>
            <button
              onClick={() => {
                setView("library");
                setShelfFilter("playing");
                setSearch("");
                setGenre("");
              }}
            >
              <Gamepad2 size={17} />
              <span>Playing</span>
              <b>{saved.filter((e) => e.status === "playing").length}</b>
            </button>
            <button
              onClick={() => {
                setView("library");
                setShelfFilter("completed");
                setSearch("");
                setGenre("");
              }}
            >
              <Check size={17} />
              <span>Completed</span>
              <b>{saved.filter((e) => e.status === "completed").length}</b>
            </button>
            <button
              onClick={() => {
                setView("library");
                setShelfFilter("wishlist");
                setSearch("");
                setGenre("");
              }}
            >
              <Bookmark size={17} />
              <span>Want to play</span>
              <b>{saved.filter((e) => e.status === "wishlist").length}</b>
            </button>
          </div>
          <div className="sidebar-note">
            <div className="tiny-mark">✳</div>
            <h3>
              Good games.
              <br />
              Great memories.
            </h3>
            <p>
              A little space for your
              <br />
              ever-growing backlog.
            </p>
            {!user && (
              <Link href="/signup">
                Start your collection <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          <div className="sidebar-bottom">
            {user ? (
              <>
                <div className="avatar">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <b>{user.name}</b>
                  <small>Player one</small>
                </div>
                <button
                  className="icon-button"
                  title="Log out"
                  onClick={async () => {
                    try {
                      const result = await fetch("/api/auth/logout", {
                        method: "POST",
                      });
                      if (result.ok) window.location.assign("/");
                      else setNotice("Could not sign out. Please try again.");
                    } catch {
                      setNotice("Could not sign out. Please try again.");
                    }
                  }}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <>
                <span className="guest-avatar">
                  <Gamepad2 size={21} />
                </span>
                <div>
                  <b>Player one?</b>
                  <Link href="/login">Sign in to your account</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="breadcrumb">
            Your next adventure starts here <span>↗</span>
          </span>
          <div className="topbar-right">
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Search games"
                placeholder="Find your next game…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={15} />
                </button>
              )}
            </label>
            {user ? (
              <>
                <div className="avatar">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <button
                  className="mobile-logout icon-button"
                  aria-label="Log out"
                  onClick={async () => {
                    const result = await fetch("/api/auth/logout", {
                      method: "POST",
                    });
                    if (result.ok) window.location.assign("/");
                    else setNotice("Could not sign out. Please try again.");
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <Link className="login-link" href="/login">
                  Log in
                </Link>
                <Link className="primary join-button" href="/signup">
                  Join Respawn <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </header>
        <nav className="community-mobile-links" aria-label="Community">
          <Link href="/feed">Activity</Link>
          <Link href="/diary">Diary</Link>
          <Link href="/players">Players</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/reviews">Reviews</Link>
          <Link href="/lists">Lists</Link>
          <Link href="/stats">Statistics</Link>
        </nav>
        <nav className="mobile-nav">
          {["discover", "library", "journal"].map((v) => (
            <button
              className={v === view ? "active" : ""}
              key={v}
              onClick={() => setView(v)}
            >
              {v === "discover" ? "Discover" : `My ${v}`}
            </button>
          ))}
        </nav>
        <main className="dashboard">
          {libraryError && (
            <p className="form-error" role="alert">
              {libraryError}{" "}
              <button onClick={() => window.location.reload()}>Retry</button>
            </p>
          )}
          <div className="page-heading">
            <div>
              <div className="mini-label">PLAY SOMETHING WORTH REMEMBERING</div>
              <h1>
                {view === "discover"
                  ? "Discover"
                  : view === "library"
                    ? "Your library."
                    : "Your gaming journal."}
                <span className="green">{view === "discover" ? "." : ""}</span>
              </h1>
            </div>
            <span className="heading-note">
              {user
                ? `Welcome back, ${user.name.split(" ")[0]}.`
                : "New worlds. Same love for games."}
            </span>
          </div>
          {view === "discover" && !search && !genre && hero && (
            <section className="feature" aria-label="Featured game">
              <img
                key={hero.id}
                className="feature-image"
                src={hero.background_image || ""}
                alt=""
              />
              <div className="feature-shade" />
              <div className="feature-content">
                <div className="feature-kicker">
                  <span /> THE SPOTLIGHT <i /> WORTH GETTING LOST IN
                </div>
                <h2>{hero.name}</h2>
                <div className="feature-meta">
                  <span className="feature-rating">
                    <Star size={15} fill="currentColor" />
                    {hero.rating.toFixed(1)}
                  </span>
                  <span>{hero.released?.slice(0, 4)}</span>
                  <span>
                    {hero.genres
                      .slice(0, 2)
                      .map((g) => g.name)
                      .join(" / ")}
                  </span>
                </div>
                <p>
                  {hero.id === 326243
                    ? "A world in ruins. A journey without limits. Answer the call of the Lands Between."
                    : hero.id === 58550
                      ? "Wind at your back. A world to protect. Forge your own path across the island of Tsushima."
                      : "One city. A thousand stories. Find your place in the neon-soaked streets of Night City."}
                </p>
                <button className="primary" onClick={() => open(hero)}>
                  <Plus size={18} /> Add to my games
                </button>
                <Link
                  className="feature-detail-link"
                  href={`/games/${hero.id}`}
                >
                  Explore game <ArrowUpRight size={15} />
                </Link>
              </div>
              <div className="feature-bottom">
                <span>
                  FEATURED GAME <b>0{heroIndex + 1}</b>
                  <span className="feature-line" />0{featured.length}
                </span>
                <div>
                  <button
                    aria-label="Previous featured game"
                    onClick={() =>
                      setHeroIndex(
                        (heroIndex + featured.length - 1) % featured.length,
                      )
                    }
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <button
                    aria-label="Next featured game"
                    onClick={() =>
                      setHeroIndex((heroIndex + 1) % featured.length)
                    }
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              </div>
            </section>
          )}
          <section className="games-section">
            <div className="section-heading">
              <div>
                <h2>
                  {search
                    ? `Results for “${search}”`
                    : view === "discover"
                      ? "Find your next obsession"
                      : view === "library"
                        ? "Every world, in one place"
                        : "The games stay with you"}
                </h2>
                <p>
                  {view === "discover"
                    ? "The games players keep coming back to."
                    : view === "library"
                      ? `${saved.length} games in your collection`
                      : "Your ratings and reflections, one game at a time."}
                </p>
              </div>
              <span className="catalog-note">
                <SlidersHorizontal size={14} />
                {view === "discover" ? "Popular on RAWG" : "Your collection"}
              </span>
            </div>
            <div className="genre-bar">
              {genres.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setGenre(key)}
                  className={genre === key ? "genre active" : "genre"}
                >
                  {label}
                </button>
              ))}
              <span className="game-count">
                {loading ? "Finding games…" : `${shown.length} games`}
              </span>
            </div>
            <div className="library-toolbar">
              {view !== "discover" && (
                <label>
                  On your shelf{" "}
                  <select
                    value={shelfFilter}
                    onChange={(e) => setShelfFilter(e.target.value)}
                  >
                    <option value="all">All games</option>
                    <option value="wishlist">Want to play</option>
                    <option value="playing">Playing</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              )}
              <label>
                Sort by{" "}
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="default">
                    {view === "discover" ? "Popularity" : "Recently saved"}
                  </option>
                  <option value="rating">RAWG rating</option>
                  <option value="title">Title A–Z</option>
                  <option value="release">Release date</option>
                </select>
              </label>
              {(genre || shelfFilter !== "all" || search) && (
                <button
                  className="read-more"
                  onClick={() => {
                    setSearch("");
                    setGenre("");
                    setShelfFilter("all");
                  }}
                >
                  Clear filters <X size={14} />
                </button>
              )}
            </div>
            {cached && view === "discover" && (
              <p className="offline-note">
                RAWG is temporarily unavailable. Showing our saved game
                selection.
              </p>
            )}
            {loading ? (
              <div className="loading-state">
                <LoaderCircle className="spin" /> Finding your next adventure…
              </div>
            ) : shown.length ? (
              <div
                className={view === "journal" ? "journal-grid" : "game-grid"}
              >
                {shown.map((game) => {
                  const entry = saved.find((e) => e.game.id === game.id);
                  return (
                    <article className="game-card" key={game.id}>
                      <div className="game-art-wrap">
                        <Link
                          className="game-art"
                          href={`/games/${game.id}`}
                          prefetch={false}
                          aria-label={`View ${game.name}`}
                        >
                          <img
                            src={game.background_image || ""}
                            alt={game.name}
                            loading="lazy"
                          />
                          <span className="game-art-gradient" />
                          {game.metacritic && (
                            <span
                              className="metacritic"
                              title="Metacritic score"
                            >
                              {game.metacritic}
                            </span>
                          )}
                          <span className="cover-title">{game.name}</span>
                        </Link>
                        <button
                          className="card-add"
                          aria-label={`${entry ? "Quick edit" : "Quick add"} ${game.name}`}
                          onClick={() => open(game)}
                        >
                          {entry ? <Check size={19} /> : <Plus size={19} />}
                        </button>
                      </div>
                      <div className="card-title">
                        <Link href={`/games/${game.id}`} prefetch={false}>
                          {game.name}
                        </Link>
                        <span>
                          <Star size={12} fill="currentColor" />
                          {game.rating.toFixed(1)}
                        </span>
                      </div>
                      <div className="card-meta">
                        <span>
                          {game.released?.slice(0, 4) || "TBA"}
                          <i /> {game.genres[0]?.name || "Game"}
                        </span>
                        {entry && (
                          <span className="entry-status">
                            {entry.status === "wishlist"
                              ? "Want to play"
                              : entry.status === "playing"
                                ? "Playing"
                                : "Completed"}
                          </span>
                        )}
                      </div>
                      {view === "journal" && entry && (
                        <div className="journal-text">
                          <div className="green">
                            {"★".repeat(entry.rating)}
                            {"☆".repeat(5 - entry.rating)}
                          </div>
                          <p>
                            {entry.review ||
                              "No review yet. Add your thoughts."}
                          </p>
                          <small>
                            {new Date(entry.updated_at).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </small>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <Gamepad2 size={38} />
                <h3>
                  {search
                    ? "No games found."
                    : user
                      ? "Your story starts with one game."
                      : "Make this space yours."}
                </h3>
                <p>
                  {search
                    ? "Try a different title or genre."
                    : "Save the games you love, rate your favorites, and keep the memories."}
                </p>
                {!search &&
                  (user ? (
                    <button
                      className="primary"
                      onClick={() => {
                        setView("discover");
                        setGenre("");
                      }}
                    >
                      Discover games <ArrowRight size={16} />
                    </button>
                  ) : (
                    <Link className="primary" href="/signup">
                      Create your account <ArrowRight size={16} />
                    </Link>
                  ))}
              </div>
            )}
          </section>
          <footer className="dashboard-footer">
            <span>
              respawn<span className="green">.</span>
              <small>Made for the love of games.</small>
            </span>
            <a href="https://rawg.io" target="_blank" rel="noreferrer">
              Game data & artwork by RAWG <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        className="game-dialog"
        aria-labelledby="game-dialog-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <button
          aria-label="Close game details"
          className="dialog-close icon-button"
          onClick={() => dialog.current?.close()}
        >
          <X size={21} />
        </button>
        {selected && (
          <>
            <div
              className="dialog-art"
              style={{ backgroundImage: `url(${selected.background_image})` }}
            />
            <div className="dialog-body">
              <div className="mini-label">YOUR NEXT CHAPTER</div>
              <h2 id="game-dialog-title">{selected.name}</h2>
              <p className="dialog-meta">
                {selected.released?.slice(0, 4)} ·{" "}
                {selected.genres.map((g) => g.name).join(" / ")} · ★{" "}
                {selected.rating} on RAWG
              </p>
              {user ? (
                <>
                  <label className="field-label">
                    On your shelf
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as Entry["status"])
                      }
                    >
                      <option value="wishlist">Want to play</option>
                      <option value="playing">Currently playing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                  <div className="rating-field">
                    <span>Your rating</span>
                    <div>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          aria-label={`Rate ${n} stars`}
                          aria-pressed={n === rating}
                          onClick={() => setRating(rating === n ? 0 : n)}
                        >
                          <Star
                            size={26}
                            fill={n <= rating ? "currentColor" : "none"}
                            className={n <= rating ? "green" : ""}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="field-label">
                    Your thoughts <span>Optional</span>
                    <textarea
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      maxLength={3000}
                      placeholder="What stayed with you?"
                      rows={3}
                    />
                  </label>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    disabled={saving}
                    className="primary save-button"
                    onClick={save}
                  >
                    {saving ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Check size={17} />
                    )}{" "}
                    Save to my games
                  </button>
                </>
              ) : (
                <div className="join-prompt">
                  <h3>One more for your collection.</h3>
                  <p>
                    Join Respawn to track your games, leave ratings, and tell
                    your story.
                  </p>
                  <Link className="primary" href="/signup">
                    Create your account <ArrowUpRight size={16} />
                  </Link>
                  <Link className="text-link" href="/login">
                    Already a member? Log in
                  </Link>
                </div>
              )}
              <a
                className="rawg-link"
                href={`https://rawg.io/games/${selected.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Explore on RAWG <ArrowUpRight size={12} />
              </a>
            </div>
          </>
        )}
      </dialog>
      {notice && (
        <div role="status" className="toast">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
