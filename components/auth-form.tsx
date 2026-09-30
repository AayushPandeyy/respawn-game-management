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
  destination = "/dashboard",
}: {
  mode: "login" | "signup";
  configured?: boolean;
  initialError?: string;
  destination?: string;
}) {
  const signup = mode === "signup";
  const [show, setShow] = useState(false);
  const [error, setError] = useState(initialError);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  async function googleSignIn() {
    if (!configured || busy || googleBusy) return;
    setGoogleBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next: destination }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Google sign-in is unavailable.");
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in is unavailable.");
      setGoogleBusy(false);
    }
  }
  const art = catalog.find((g) => g.id === 58550)!;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured || busy || googleBusy) return;
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
      window.location.assign(destination);
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
            <>
            <button type="button" className="google-signin" onClick={googleSignIn} disabled={!configured || busy || googleBusy}>
              {googleBusy ? <LoaderCircle size={18} className="spin" /> : <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>}
              {googleBusy ? "Connecting to Google…" : "Continue with Google"}
            </button>
            <div className="auth-divider"><span />OR USE EMAIL<span /></div>
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
                    minLength={signup ? 8 : 1}
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
              {!signup && <Link href="/forgot-password" className="text-link">Forgot your password?</Link>}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button
                disabled={busy || googleBusy || !configured}
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
            </>
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
