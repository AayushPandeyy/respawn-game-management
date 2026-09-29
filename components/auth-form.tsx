"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  ArrowRight,
  LoaderCircle,
  Star,
} from "lucide-react";
import Brand from "./brand";
import catalog from "@/lib/catalog.json";
export default function AuthForm({
  mode,
  configured = false,
  initialError = "",
}: {
  mode: "login" | "signup";
  configured?: boolean;
  initialError?: string;
}) {
  const signup = mode === "signup";
  const [show, setShow] = useState(false);
  const [error, setError] = useState(initialError);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const art = catalog.find((g) => g.id === 58550)!;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured || busy) return;
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.needsConfirmation) {
        setConfirmation(true);
        setBusy(false);
        return;
      }
      window.location.assign("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section
        className="auth-art"
        style={{ backgroundImage: `url(${art.background_image})` }}
      >
        <div className="auth-art-shade" />
        <div className="auth-brand">
          <Brand />
        </div>
        <div className="auth-story">
          <span className="eyebrow">
            <span /> EVERY GAME LEAVES A STORY
          </span>
          <h1>
            Your life.
            <br /> In games.
          </h1>
          <p>
            Remember the worlds you got lost in.
            <br />
            Find the ones you haven’t discovered yet.
          </p>
          <div className="auth-caption">
            <span>GHOST OF TSUSHIMA</span>
            <span>
              <Star size={13} fill="currentColor" /> {art.rating} on RAWG
            </span>
          </div>
        </div>
        <a
          className="art-credit"
          href="https://rawg.io/games/ghost-of-tsushima"
          target="_blank"
          rel="noreferrer"
        >
          Artwork & game data by RAWG <ArrowUpRight size={12} />
        </a>
      </section>
      <section className="auth-side">
        <div className="auth-top">
          <Link href="/">
            <ArrowLeft size={15} /> Explore games
          </Link>
          <span>
            {signup ? "Already a member?" : "New around here?"}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Log in" : "Join Respawn"} <ArrowUpRight size={13} />
            </Link>
          </span>
        </div>
        <div className="auth-form-wrap">
          <div className="mini-label">YOUR NEXT CHAPTER STARTS HERE</div>
          <h2>{signup ? "Make yourself at home." : "Welcome back, player."}</h2>
          <p className="auth-intro">
            {signup
              ? "A place for every game you play. And every opinion you have."
              : "Your next obsession is waiting. Pick up where you left off."}
          </p>
          {!configured && (
            <p className="form-error" role="status">
              Sign-in is not configured yet. You can still explore the games.
            </p>
          )}
          {confirmation ? (
            <div className="confirmation-message" role="status">
              <h3>Check your inbox.</h3>
              <p>
                If your email is eligible for a new account, you’ll receive a
                confirmation link. Open it in this browser to finish signing up.
                Already registered? Sign in below.
              </p>
              <Link href="/login" className="primary">
                Go to login <ArrowRight size={16} />
              </Link>
              <button
                className="text-link"
                onClick={() => setConfirmation(false)}
              >
                Use another email
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {signup && (
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="What should we call you?"
                    required
                    minLength={2}
                    maxLength={40}
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Password
                <div className="password-wrap">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={signup ? "new-password" : "current-password"}
                    placeholder={
                      signup ? "At least 8 characters" : "Enter your password"
                    }
                    required
                    minLength={8}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {signup && (
                <p className="form-hint">
                  Make it yours. Use a unique password with at least 8
                  characters.
                </p>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button
                disabled={busy || !configured}
                className="primary auth-submit"
              >
                {busy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : signup ? (
                  "Create your account"
                ) : (
                  "Let’s play"
                )}
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>
          )}
          <div className="auth-divider">
            <span />
            OR TAKE A LOOK AROUND
            <span />
          </div>
          <Link href="/" className="guest-link">
            Explore the games <ArrowUpRight size={16} />
          </Link>
          <p className="auth-footnote">
            Track. Rate. Remember.
            <br />
            <span>Your gaming story belongs here.</span>
          </p>
        </div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} Respawn</span>
          <span>Made for the love of games.</span>
        </footer>
      </section>
    </main>
  );
}
