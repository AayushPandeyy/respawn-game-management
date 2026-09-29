"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function FollowPanel({
  target,
  viewer,
  followers,
  following,
  isFollowing,
}: {
  target: string;
  viewer?: string;
  followers: number;
  following: number;
  isFollowing: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isFollowing ? "unfollow" : "follow",
          target,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update following.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="follow-panel">
      <p>
        <strong>{followers}</strong> followers <span>·</span>{" "}
        <strong>{following}</strong> following
      </p>
      {viewer === target ? (
        <Link href="/feed">Your activity feed ↗</Link>
      ) : viewer ? (
        <button className="community-button" disabled={busy} onClick={toggle}>
          {busy ? "Updating…" : isFollowing ? "Unfollow" : "Follow player"}
        </button>
      ) : (
        <Link className="community-button" href="/login">
          Sign in to follow
        </Link>
      )}
      <small>
        Follow connections are public. Only public reviews and lists appear in
        feeds.
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
