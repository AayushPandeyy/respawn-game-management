"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  LockKeyhole,
  NotebookPen,
  RotateCcw,
  Trophy,
} from "lucide-react";
import type { PlaySession } from "@/lib/diary";
type DiaryGame = { id: number; name: string };
const duration = (n: number) =>
  `${Math.floor(n / 60) ? `${Math.floor(n / 60)}h ` : ""}${n % 60 || n < 60 ? `${n % 60}m` : ""}`.trim();
async function write(method: string, body: unknown) {
  const r = await fetch("/api/diary", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Could not save your diary.");
  return result;
}
export default function Diary({
  sessions,
  initialGame,
}: {
  sessions: PlaySession[];
  initialGame: DiaryGame | null;
}) {
  const [editing, setEditing] = useState<PlaySession | null>(null);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const router = useRouter();
  return (
    <div className="diary-layout">
      <div ref={editor} className="diary-editor">
        <SessionForm
          key={editing?.id || `new-${version}`}
          initialGame={initialGame}
          session={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setVersion((v) => v + 1);
            setNotice("Session saved to your private diary.");
            router.refresh();
          }}
        />
      </div>
      <section className="diary-timeline" aria-label="Play session timeline">
        <div className="diary-timeline-heading">
          <h2>Your time, well played.</h2>
          <span>
            <LockKeyhole size={13} /> Only you
          </span>
        </div>
        {notice && (
          <p className="diary-notice" role="status">
            {notice}
          </p>
        )}
        {!sessions.length && (
          <div className="community-card diary-empty">
            <NotebookPen size={38} />
            <h3>A new chapter starts here.</h3>
            <p>
              No sessions match this view. Log a session, or clear your filters
              to see more.
            </p>
          </div>
        )}
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            onEdit={() => {
              setEditing(s);
              setNotice("");
              editor.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            onDeleted={() => {
              if (editing?.id === s.id) setEditing(null);
              setNotice(
                "Session deleted. Your statistics will reflect the change.",
              );
              router.refresh();
            }}
          />
        ))}
      </section>
    </div>
  );
}
function SessionForm({
  session,
  initialGame,
  onSaved,
  onCancel,
}: {
  session: PlaySession | null;
  initialGame: DiaryGame | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [id] = useState(() => session?.id || crypto.randomUUID());
  const [game, setGame] = useState<DiaryGame | null>(
    session ? { id: session.game_id, name: session.game_name } : initialGame,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiaryGame[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [date, setDate] = useState(session?.played_on || "");
  useEffect(() => {
    if (!session) {
      const d = new Date();
      setDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
  }, [session]);
  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const r = await fetch(`/api/games?search=${encodeURIComponent(query)}`);
      const data = await r.json();
      if (!r.ok || data.offline)
        throw new Error("Game search is unavailable. Try again shortly.");
      setResults(data.games.slice(0, 8));
      setSearched(true);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }
  return (
    <form
      className="community-card community-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!game) {
          setError("Choose a game first.");
          return;
        }
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await write(session ? "PATCH" : "POST", {
            id,
            game_id: game.id,
            played_on: date,
            minutes: Number(f.get("minutes")),
            notes: f.get("notes"),
            completed: f.get("completed") === "on",
            replay: f.get("replay") === "on",
          });
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="diary-form-icon">
        <NotebookPen size={23} />
      </span>
      <h2>{session ? "Edit your session" : "What did you play?"}</h2>
      <p>Keep a little of the adventure. Sessions and notes stay private.</p>
      {game ? (
        <div className="diary-chosen">
          <Link href={`/games/${game.id}`}>{game.name} ↗</Link>
          {!session && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setGame(null);
                setResults([]);
                setSearched(false);
              }}
            >
              Change game
            </button>
          )}
        </div>
      ) : (
        <div className="diary-game-picker">
          <label>
            Find a game
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
              placeholder="Search by title…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
            />
          </label>
          <button
            type="button"
            disabled={searching || busy || !query.trim()}
            onClick={search}
          >
            {searching ? "Searching…" : "Search games"}
          </button>
          {searchError && <p role="alert">{searchError}</p>}
          <div className="diary-search-results">
            {results.map((g) => (
              <button
                type="button"
                key={g.id}
                disabled={busy}
                onClick={() => setGame(g)}
              >
                {g.name}
                <span>Choose →</span>
              </button>
            ))}
          </div>
          {searched && !results.length && (
            <p>No games found. Try another title.</p>
          )}
        </div>
      )}
      <div className="diary-fields">
        <label>
          Date played
          <input
            name="played_on"
            type="date"
            required
            min="1970-01-01"
            max="2100-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Time spent (minutes)
          <input
            name="minutes"
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            defaultValue={session?.minutes || 60}
            disabled={busy}
          />
        </label>
      </div>
      <label>
        Session notes
        <textarea
          name="notes"
          rows={5}
          maxLength={3000}
          defaultValue={session?.notes || ""}
          disabled={busy}
          placeholder="A tough boss, a beautiful view, one more turn…"
        />
        <small>Up to 3,000 characters.</small>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="completed"
          defaultChecked={session?.completed}
          disabled={busy}
        />{" "}
        Finished the game in this session
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="replay"
          defaultChecked={session?.replay}
          disabled={busy}
        />{" "}
        This session was part of a replay
      </label>
      <p className="diary-form-note">
        Completion markers record your history. Manage your library status
        separately.
      </p>
      <button className="community-button" disabled={busy || !game}>
        {busy ? "Saving…" : session ? "Save changes" : "Log session"}
      </button>
      {session && (
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel editing
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function SessionCard({
  session: s,
  onEdit,
  onDeleted,
}: {
  session: PlaySession;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <article className="community-card diary-session">
      <div className="diary-date">
        <span>
          <CalendarDays size={14} />
          <time dateTime={s.played_on}>
            {new Date(s.played_on + "T12:00:00Z").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </span>
        <span>
          <Clock3 size={14} />
          {duration(s.minutes)}
        </span>
      </div>
      <h3>
        <Link href={`/games/${s.game_id}`}>{s.game_name} ↗</Link>
      </h3>
      <div className="diary-badges">
        {s.completed && (
          <span>
            <Trophy size={13} /> Completed
          </span>
        )}
        {s.replay && (
          <span>
            <RotateCcw size={13} /> Replay session
          </span>
        )}
      </div>
      {s.notes && <p className="diary-notes">{s.notes}</p>}
      <div className="diary-actions">
        <button disabled={busy} onClick={onEdit}>
          Edit session
        </button>
        <button disabled={busy} onClick={() => setConfirm((v) => !v)}>
          {confirm ? "Keep session" : "Delete"}
        </button>
      </div>
      {confirm && (
        <div className="diary-delete">
          <p>Delete this session and its notes permanently?</p>
          <button
            className="danger-text"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await write("DELETE", { id: s.id });
                onDeleted();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not delete.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Delete session"}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
