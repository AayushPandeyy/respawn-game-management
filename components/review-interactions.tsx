"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import type { Engagement, ReviewComment } from "@/lib/discussions";
async function send(body: unknown) {
  const r = await fetch("/api/discussions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Please try again.");
  return d;
}
export function ReviewActions({
  reviewer,
  gameId,
  initial,
}: {
  reviewer: string;
  gameId: number;
  initial?: Engagement;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => setValue(initial), [initial]);
  return (
    <div className="review-interactions">
      <div>
        <button
          aria-pressed={value?.liked || false}
          disabled={busy || !value}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await send({
                action: value?.liked ? "unlike" : "like",
                reviewer,
                gameId,
              });
              setValue(r.engagement);
              router.refresh();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not update like.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Heart size={16} fill={value?.liked ? "currentColor" : "none"} />
          {value
            ? `${value.likes} ${value.likes === 1 ? "like" : "likes"}`
            : "Likes unavailable"}
        </button>
        <Link href={`/reviews/${reviewer}/${gameId}`}>
          <MessageCircle size={16} />
          {value
            ? `${value.comments} ${value.comments === 1 ? "comment" : "comments"}`
            : "Open discussion"}
        </Link>
      </div>
      {error && (
        <p role="alert">
          {error} <Link href="/login">Sign in ↗</Link>
        </p>
      )}
    </div>
  );
}
export function CommentComposer({
  reviewer,
  gameId,
  session,
}: {
  reviewer: string;
  gameId: number;
  session?: ReviewComment;
}) {
  const router = useRouter();
  const [id, setId] = useState(() => session?.id || crypto.randomUUID());
  const [body, setBody] = useState(session?.body || "");
  const [spoiler, setSpoiler] = useState(session?.spoiler || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <form
      className="community-card community-form comment-composer"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
          await send({
            action: session ? "edit-comment" : "comment",
            id,
            reviewer,
            gameId,
            body,
            spoiler,
          });
          if (!session) {
            setId(crypto.randomUUID());
            setBody("");
            setSpoiler(false);
          }
          setNotice(session ? "Comment updated." : "Comment posted.");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not post.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{session ? "Edit comment" : "Join the conversation"}</h2>
      {!session && (
        <p>
          Comments are public. <Link href="/profile">Set up your profile</Link>{" "}
          before posting.
        </p>
      )}
      <label>
        {session ? "Your comment" : "What do you think?"}
        <textarea
          required
          maxLength={2000}
          rows={4}
          value={body}
          disabled={busy}
          onChange={(e) => setBody(e.target.value)}
        />
        <small>{body.length} / 2,000 characters</small>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={spoiler}
          disabled={busy}
          onChange={(e) => setSpoiler(e.target.checked)}
        />{" "}
        Contains spoilers
      </label>
      <button className="community-button" disabled={busy || !body.trim()}>
        {busy ? "Saving…" : session ? "Save changes" : "Post comment"}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
export function CommentCard({
  comment: c,
  owner,
}: {
  comment: ReviewComment;
  owner: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <article className="community-card comment-card" id={`comment-${c.id}`}>
      <div className="review-author">
        <span className="small-avatar" style={{ background: c.profiles.color }}>
          {c.profiles.display_name.slice(0, 2).toUpperCase()}
        </span>
        <Link href={`/u/${c.profiles.username}`}>
          {c.profiles.display_name}
          <small>@{c.profiles.username}</small>
        </Link>
      </div>
      {editing ? (
        <CommentComposer
          session={c}
          reviewer={c.review_user_id}
          gameId={c.game_id}
        />
      ) : c.spoiler ? (
        <details>
          <summary>Contains spoilers — reveal comment</summary>
          <p className="review-body">{c.body}</p>
        </details>
      ) : (
        <p className="review-body">{c.body}</p>
      )}
      <small>
        {new Date(c.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })}
        {c.updated_at !== c.created_at ? " · Edited" : ""}
      </small>
      {owner && (
        <div className="diary-actions">
          <button disabled={busy} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close editor" : "Edit"}
          </button>
          <button disabled={busy} onClick={() => setConfirm((v) => !v)}>
            {confirm ? "Keep comment" : "Delete"}
          </button>
        </div>
      )}
      {confirm && (
        <div className="diary-delete">
          <p>Delete this comment permanently?</p>
          <button
            className="danger-text"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await send({ action: "delete-comment", id: c.id });
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not delete.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Delete comment"}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export function ReadNotification({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="notification-read"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await send({ action: "read-notification", id });
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not mark read.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Updating…" : "Mark as read"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
