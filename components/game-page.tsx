"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Expand,
  Gamepad2,
  LoaderCircle,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Brand from "./brand";
import type { Entry, GameDetails, User } from "@/lib/types";

const shelves: {
  value: Entry["status"];
  label: string;
  Icon: typeof Bookmark;
}[] = [
  { value: "wishlist", label: "Want to play", Icon: Bookmark },
  { value: "playing", label: "Playing", Icon: Gamepad2 },
  { value: "completed", label: "Completed", Icon: Check },
];
export default function GamePage({
  game,
  user,
  initialEntry,
  libraryError = "",
}: {
  game: GameDetails;
  user: User | null;
  initialEntry: Entry | null;
  libraryError?: string;
}) {
  const router = useRouter();
  const [entry, setEntry] = useState(initialEntry);
  const [status, setStatus] = useState<Entry["status"]>(
    initialEntry?.status || "wishlist",
  );
  const [rating, setRating] = useState(initialEntry?.rating || 0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(initialEntry?.review || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const gallery = useRef<HTMLDialogElement>(null);
  const removal = useRef<HTMLDialogElement>(null);
  const dirty =
    !!user &&
    (!entry ||
      entry.status !== status ||
      entry.rating !== rating ||
      entry.review !== review);
  useEffect(() => {
    if (!dirty || (!entry && !review && !rating && status === "wishlist"))
      return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, entry, review, rating, status]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, status, rating, review }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntry(data.entry);
      setMessage("Saved to your library.");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntry(null);
      setStatus("wishlist");
      setRating(0);
      setReview("");
      setMessage("Removed from your library.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove this game.");
    } finally {
      setBusy(false);
      removal.current?.close();
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + `/games/${game.id}`,
      );
      setCopied(true);
    } catch {
      setError(
        "Could not copy the link. You can copy the address from your browser.",
      );
    }
  }
  function showImage(index: number) {
    setImageIndex(index);
    gallery.current?.showModal();
  }
  function advance(direction: number) {
    setImageIndex(
      (i) =>
        (i + direction + game.screenshots.length) % game.screenshots.length,
    );
  }
  const release = game.released
    ? new Date(game.released + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be announced";
  return (
    <div className="game-page">
      <header className="game-header">
        <Brand />
        <Link href="/" className="back-discover">
          <ArrowLeft size={16} /> Discover games
        </Link>
        <div className="game-header-account">
          {user ? (
            <>
              <span className="avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span>{user.name}</span>
            </>
          ) : (
            <Link href="/login" className="primary">
              Log in <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </header>
      <section className="game-hero">
        {game.background_image && (
          <img className="game-hero-image" src={game.background_image} alt="" />
        )}
        <div className="game-hero-shade" />
        <div className="game-hero-content">
          <Link href="/" className="game-breadcrumb">
            Discover / <span>{game.name}</span>
          </Link>
          <div className="game-genres">
            {game.genres.map((g) => (
              <span key={g.slug}>{g.name}</span>
            ))}
          </div>
          <h1>{game.name}</h1>
          <div className="game-hero-stats">
            <span>
              <Star size={18} fill="currentColor" />{" "}
              <strong>{game.rating.toFixed(1)}</strong>
              <small>/ 5 on RAWG</small>
            </span>
            {game.metacritic && (
              <span className="critic-score">
                <strong>{game.metacritic}</strong>
                <small>Metascore</small>
              </span>
            )}
            <span>{game.released?.slice(0, 4) || "TBA"}</span>
            {entry && (
              <span className="saved-tag">
                <Check size={16} /> In your library
              </span>
            )}
          </div>
          <div className="game-hero-actions">
            <a className="primary" href="#your-journal">
              <Bookmark size={17} />
              {entry ? "Edit your journal" : "Make it part of your story"}
            </a>
            <button className="secondary" onClick={copyLink}>
              <Copy size={16} />
              {copied ? "Link copied" : "Share game"}
            </button>
            <a className="secondary" href="#community-reviews">
              Read public reviews ↓
            </a>
          </div>
        </div>
      </section>
      <main className="game-content">
        <div className="game-main-column">
          {game.offline && (
            <p className="offline-note">
              RAWG is temporarily unavailable. Showing saved game information.
            </p>
          )}
          <div
            className="game-tabs"
            role="tablist"
            aria-label="Game information"
          >
            {["overview", "screenshots"].map((value) => (
              <button
                key={value}
                id={`tab-${value}`}
                role="tab"
                aria-selected={tab === value}
                aria-controls={`panel-${value}`}
                tabIndex={tab === value ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    const next =
                      tab === "overview" ? "screenshots" : "overview";
                    setTab(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
                onClick={() => setTab(value)}
              >
                {value === "overview"
                  ? "Overview"
                  : `Screenshots (${game.screenshots.length})`}
              </button>
            ))}
          </div>
          {tab === "overview" ? (
            <section
              id="panel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
            >
              <div className="detail-section-heading">
                <span className="mini-label">ENTER ANOTHER WORLD</span>
                <h2>About the game</h2>
              </div>
              <div className={`game-description ${expanded ? "expanded" : ""}`}>
                {game.description ||
                  "A description is not available for this game yet."}
              </div>
              {game.description.length > 650 && (
                <button
                  className="read-more"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "Read less" : "Read the full story"}{" "}
                  <ChevronRight size={15} />
                </button>
              )}
              <dl className="game-facts">
                <div>
                  <dt>Release date</dt>
                  <dd>{release}</dd>
                </div>
                <div>
                  <dt>Developer</dt>
                  <dd>{game.developers.join(", ") || "Not listed"}</dd>
                </div>
                <div>
                  <dt>Publisher</dt>
                  <dd>{game.publishers.join(", ") || "Not listed"}</dd>
                </div>
                <div>
                  <dt>Platforms</dt>
                  <dd>{game.platforms.join(" · ") || "Not listed"}</dd>
                </div>
                <div>
                  <dt>Average playtime on RAWG</dt>
                  <dd>
                    {game.playtime ? `${game.playtime} hours` : "Not listed"}
                  </dd>
                </div>
                <div>
                  <dt>Age rating</dt>
                  <dd>{game.ageRating || "Not rated"}</dd>
                </div>
              </dl>
              {game.website && (
                <a
                  className="secondary"
                  href={game.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official website <ArrowUpRight size={16} />
                </a>
              )}
              <div className="detail-section-heading gallery-heading">
                <h2>A closer look</h2>
                <button
                  className="read-more"
                  onClick={() => setTab("screenshots")}
                >
                  All screenshots <ArrowUpRight size={15} />
                </button>
              </div>
              {game.screenshots.length ? (
                <div className="screenshot-preview">
                  {game.screenshots.slice(0, 2).map((s, index) => (
                    <button
                      key={s.id}
                      onClick={() => showImage(index)}
                      aria-label={`Open screenshot ${index + 1}`}
                    >
                      <img
                        src={s.image}
                        alt={`${game.name} screenshot ${index + 1}`}
                        loading="lazy"
                      />
                      <Expand size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="detail-empty">
                  {game.screenshotsUnavailable
                    ? "Screenshots couldn’t load. Try refreshing the page."
                    : "No screenshots available yet."}
                </p>
              )}
            </section>
          ) : (
            <section
              id="panel-screenshots"
              role="tabpanel"
              aria-labelledby="tab-screenshots"
            >
              <div className="detail-section-heading">
                <span className="mini-label">SEE THE WORLD FOR YOURSELF</span>
                <h2>In-game screenshots</h2>
              </div>
              {game.screenshots.length ? (
                <div className="screenshot-grid">
                  {game.screenshots.map((s, index) => (
                    <button
                      key={s.id}
                      onClick={() => showImage(index)}
                      aria-label={`Open screenshot ${index + 1}`}
                    >
                      <img
                        src={s.image}
                        alt={`${game.name} screenshot ${index + 1}`}
                        loading="lazy"
                      />
                      <Expand size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="detail-empty">
                  {game.screenshotsUnavailable
                    ? "Screenshots couldn’t load. Try refreshing the page."
                    : "No screenshots available yet."}
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="journal-panel" id="your-journal">
          <Link className="diary-game-link" href={`/diary?game=${game.id}`}>
            Log a play session ↗
          </Link>
          <div className="journal-panel-heading">
            <span className="mini-label">YOUR EXPERIENCE</span>
            <h2>Your chapter.</h2>
            <p>
              {entry
                ? "Some games deserve a second thought."
                : "Every game leaves an impression."}
            </p>
          </div>
          {user ? (
            <>
              {libraryError && (
                <p className="form-error" role="alert">
                  {libraryError}{" "}
                  <button onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </p>
              )}
              <fieldset
                className="shelf-field"
                disabled={busy || !!libraryError}
              >
                <legend>On your shelf</legend>
                <div className="shelf-options">
                  {shelves.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      aria-pressed={status === value}
                      className={status === value ? "selected" : ""}
                      onClick={() => {
                        setStatus(value);
                        setMessage("");
                      }}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset
                className="detail-rating"
                disabled={busy || !!libraryError}
              >
                <legend>Your rating</legend>
                <div onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      aria-label={`Rate ${n} stars`}
                      aria-pressed={rating === n}
                      onMouseEnter={() => setHover(n)}
                      onFocus={() => setHover(n)}
                      onBlur={() => setHover(0)}
                      onClick={() => {
                        setRating(n === rating ? 0 : n);
                        setMessage("");
                      }}
                    >
                      <Star
                        size={28}
                        fill={n <= (hover || rating) ? "currentColor" : "none"}
                        className={n <= (hover || rating) ? "green" : ""}
                      />
                    </button>
                  ))}
                  <span>{rating ? `${rating} / 5` : "Unrated"}</span>
                </div>
                <small>Click your selected star to clear your rating.</small>
              </fieldset>
              <label className="field-label" htmlFor="game-review">
                Your review <span>Private</span>
              </label>
              <textarea
                id="game-review"
                className="detail-review"
                value={review}
                disabled={busy || !!libraryError}
                onChange={(e) => {
                  setReview(e.target.value);
                  setMessage("");
                }}
                placeholder="What stayed with you? The story, the world, that one impossible boss…"
                maxLength={3000}
                rows={6}
              />
              <div className="review-counter">
                {review.length.toLocaleString()} / 3,000
              </div>
              <button
                className="primary save-button"
                disabled={busy || !dirty || !!libraryError}
                onClick={save}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Check size={17} />
                )}{" "}
                {entry ? "Save changes" : "Save to my games"}
              </button>
              {dirty && entry && (
                <button
                  className="discard-button"
                  disabled={busy}
                  onClick={() => {
                    setStatus(entry.status);
                    setRating(entry.rating);
                    setReview(entry.review);
                    setError("");
                    setMessage("Changes discarded.");
                  }}
                >
                  Discard changes
                </button>
              )}
              {entry && (
                <>
                  <p className="last-saved">
                    Last saved{" "}
                    {new Date(entry.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <button
                    className="remove-game"
                    disabled={busy}
                    onClick={() => removal.current?.showModal()}
                  >
                    <Trash2 size={14} /> Remove from library
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="guest-journal">
              <Gamepad2 size={35} />
              <h3>Make this game yours.</h3>
              <p>
                Keep track of what you play, leave a rating, and save the
                moments worth remembering.
              </p>
              <Link className="primary" href="/signup">
                Join Respawn <ArrowUpRight size={16} />
              </Link>
              <Link href="/login" className="text-link">
                Already here? Log in
              </Link>
            </div>
          )}
          {message && (
            <p role="status" className="journal-success">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </aside>
      </main>
      <footer className="game-footer">
        <Brand />
        <span>Your life in games.</span>
        <a
          href={`https://rawg.io/games/${game.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Game data & artwork by RAWG <ArrowUpRight size={14} />
        </a>
      </footer>
      <dialog
        ref={gallery}
        className="gallery-dialog"
        aria-label={`${game.name} screenshot viewer`}
        onClick={(e) => {
          if (e.target === e.currentTarget) gallery.current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            advance(-1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            advance(1);
          }
        }}
      >
        <button
          className="gallery-close secondary"
          aria-label="Close screenshot viewer"
          onClick={() => gallery.current?.close()}
        >
          <X size={20} />
        </button>
        {game.screenshots[imageIndex] && (
          <img
            src={game.screenshots[imageIndex].image}
            alt={`${game.name} screenshot ${imageIndex + 1}`}
          />
        )}
        <div className="gallery-controls">
          <button
            className="secondary"
            aria-label="Previous screenshot"
            onClick={() => advance(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <span>
            {imageIndex + 1} / {game.screenshots.length}
          </span>
          <button
            className="secondary"
            aria-label="Next screenshot"
            onClick={() => advance(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </dialog>
      <dialog
        ref={removal}
        className="remove-dialog"
        aria-labelledby="remove-game-title"
      >
        <h2 id="remove-game-title">Remove {game.name}?</h2>
        <p>
          This removes the game, your rating, and your review from your library.
          You can add the game again later.
        </p>
        <div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => removal.current?.close()}
          >
            Keep game
          </button>
          <button className="danger-button" disabled={busy} onClick={remove}>
            {busy ? "Removing…" : "Remove game"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
