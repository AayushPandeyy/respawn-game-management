"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Profile, GameList, Review } from "@/lib/community";
import type { Game } from "@/lib/types";
async function send(body: unknown) {
  const r = await fetch("/api/community", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Could not save.");
  return data;
}
export function AddToList({
  gameId,
  lists,
}: {
  gameId: number;
  lists: GameList[];
}) {
  const { busy, message, save } = useSave();
  return (
    <form
      className="community-card community-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save(
          { action: "add-item", id: f.get("list"), game_id: gameId },
          "Added to your collection.",
        );
      }}
    >
      <h2>Keep good company.</h2>
      {lists.length ? (
        <>
          <label>
            Add this game to a list
            <select name="list" required defaultValue="">
              <option value="" disabled>
                Choose a collection
              </option>
              {lists.map((l) => (
                <option
                  key={l.id}
                  value={l.id}
                  disabled={l.list_items.some((g) => g.game_id === gameId)}
                >
                  {l.title}
                  {l.list_items.some((g) => g.game_id === gameId)
                    ? " — already added"
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="community-button" disabled={busy}>
            {busy ? "Adding…" : "Add to list"}
          </button>
        </>
      ) : (
        <p>Create your first collection to save this game to a list.</p>
      )}
      <Link href="/lists">Manage your lists ↗</Link>
      <p role="status">{message}</p>
    </form>
  );
}
function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(body: unknown, success = "Saved to Supabase.") {
    setBusy(true);
    setMessage("");
    try {
      const data = await send(body);
      setMessage(success);
      router.refresh();
      return data;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, save };
}
export function ProfileForm({
  profile,
  name,
}: {
  profile: Profile | null;
  name: string;
}) {
  const { busy, message, save } = useSave();
  const [color, setColor] = useState(profile?.color || "#c3f66b");
  return (
    <form
      className="community-card community-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save({
          action: "profile",
          username: f.get("username"),
          display_name: f.get("display_name"),
          bio: f.get("bio"),
          color,
        });
      }}
    >
      <div className="profile-avatar" style={{ background: color }}>
        {(profile?.display_name || name).slice(0, 2).toUpperCase()}
      </div>
      <h2>Your player identity</h2>
      <p>
        Your username, name, bio and avatar color are public. Your library stays
        private.
      </p>
      <label>
        Username
        <input
          name="username"
          required
          pattern="[a-z0-9_]{3,24}"
          minLength={3}
          maxLength={24}
          defaultValue={profile?.username}
          placeholder="your_player_name"
        />
        <small>3–24 lowercase letters, numbers or underscores.</small>
      </label>
      <label>
        Display name
        <input
          name="display_name"
          required
          maxLength={40}
          defaultValue={profile?.display_name || name}
        />
      </label>
      <label>
        Bio
        <textarea
          name="bio"
          maxLength={500}
          rows={4}
          defaultValue={profile?.bio}
          placeholder="The games, worlds and stories you love."
        />
      </label>
      <fieldset>
        <legend>Avatar color</legend>
        <div className="color-options">
          {["#c3f66b", "#91bfff", "#d5a3ff", "#ffb58a"].map((c, i) => (
            <button
              type="button"
              key={c}
              aria-label={["Lime", "Blue", "Purple", "Peach"][i]}
              aria-pressed={c === color}
              style={{ background: c }}
              onClick={() => setColor(c)}
            >
              {c === color ? "✓" : ""}
            </button>
          ))}
        </div>
      </fieldset>
      <button className="community-button" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </button>
      {profile && (
        <Link href={`/u/${profile.username}`}>View public profile ↗</Link>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
export function ListForm({ list }: { list?: GameList }) {
  const { busy, message, save } = useSave();
  const router = useRouter();
  return (
    <form
      className="community-card community-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await save({
          action: "list",
          id: list?.id,
          title: f.get("title"),
          description: f.get("description"),
          is_public: f.get("is_public") === "on",
        });
        if (r && !list) router.push(`/lists/${r.data.id}`);
      }}
    >
      <h2>{list ? "Edit collection" : "Start a collection"}</h2>
      <label>
        List title
        <input
          name="title"
          required
          maxLength={100}
          defaultValue={list?.title}
          placeholder="Worlds I wish I could live in"
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={list?.description}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={list?.is_public}
        />{" "}
        Public — anyone with the link can view
      </label>
      <button className="community-button" disabled={busy}>
        {busy ? "Saving…" : list ? "Save changes" : "Create list"}
      </button>
      {list && (
        <button
          type="button"
          className="danger-text"
          disabled={busy}
          onClick={async () => {
            if (confirm("Delete this list and all its items?")) {
              const r = await save({ action: "delete-list", id: list.id });
              if (r) router.push("/lists");
            }
          }}
        >
          Delete list
        </button>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
export function ListItems({ list, owner }: { list: GameList; owner: boolean }) {
  const { busy, message, save } = useSave();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="community-card">
      <h2>{list.list_items.length} games in this collection</h2>
      <div className="list-game-rows">
        {list.list_items.map((g) => (
          <div key={g.game_id}>
            <Link href={`/games/${g.game_id}`}>{g.game_name} ↗</Link>
            {owner && (
              <button
                disabled={busy}
                onClick={() =>
                  save({
                    action: "remove-item",
                    id: list.id,
                    game_id: g.game_id,
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {!list.list_items.length && (
        <p>A good collection starts with one game.</p>
      )}
      {owner && (
        <>
          <form
            className="game-search"
            onSubmit={async (e) => {
              e.preventDefault();
              setSearching(true);
              setError("");
              try {
                const r = await fetch(
                  `/api/games?search=${encodeURIComponent(query)}`,
                );
                const d = await r.json();
                if (!r.ok || d.offline)
                  throw new Error("Game search is unavailable. Please retry.");
                setResults(d.games);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Search failed.");
              } finally {
                setSearching(false);
              }
            }}
          >
            <label>
              Find a game
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                placeholder="Search games…"
              />
            </label>
            <button className="community-button" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          <p role="status">{error}</p>
          <div className="list-game-rows">
            {results.map((g) => (
              <div key={g.id}>
                <Link href={`/games/${g.id}`}>{g.name}</Link>
                <button
                  disabled={
                    busy || list.list_items.some((i) => i.game_id === g.id)
                  }
                  onClick={() =>
                    save({ action: "add-item", id: list.id, game_id: g.id })
                  }
                >
                  {list.list_items.some((i) => i.game_id === g.id)
                    ? "Added"
                    : "＋ Add"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
export function ReviewForm({
  gameId,
  existing,
}: {
  gameId: number;
  existing?: Review;
}) {
  const { busy, message, save } = useSave();
  return (
    <form
      className="community-card community-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save(
          {
            action: "review",
            game_id: gameId,
            body: f.get("body"),
            rating: Number(f.get("rating")),
            spoiler: f.get("spoiler") === "on",
          },
          "Your review is now public.",
        );
      }}
    >
      <h2>{existing ? "Edit your public review" : "Share your perspective"}</h2>
      <p>
        Published separately from your private journal.{" "}
        <Link href="/profile">Set up your profile</Link> before publishing.
      </p>
      <label>
        Your rating
        <select name="rating" defaultValue={existing?.rating || 5}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} — {n}/5
            </option>
          ))}
        </select>
      </label>
      <label>
        Review
        <textarea
          key={existing?.body}
          required
          name="body"
          maxLength={3000}
          rows={5}
          defaultValue={existing?.body}
          placeholder="What stayed with you after the credits?"
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="spoiler"
          defaultChecked={existing?.spoiler}
        />{" "}
        Contains spoilers
      </label>
      <button className="community-button" disabled={busy}>
        {busy
          ? "Saving…"
          : existing
            ? "Update public review"
            : "Publish review"}
      </button>
      {existing && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            save(
              { action: "unpublish", game_id: gameId },
              "Review unpublished. Your private journal is unchanged.",
            )
          }
        >
          Unpublish review
        </button>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
