"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Brand from "./brand";

export default function PasswordForm({ mode, configured, expired = false }: {
  mode: "forgot-password" | "reset-password"; configured: boolean; expired?: boolean;
}) {
  const reset = mode === "reset-password";
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(expired ? "This reset link is expired, already used, or was opened in a different browser. Request a new link below." : "");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !configured) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (reset && values.password !== values.confirmPassword) {
      setError("Your passwords do not match."); return;
    }
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="password-page">
    <Brand />
    <section className="community-card auth-form-wrap">
      <span className="mini-label">YOUR ACCOUNT</span>
      <h1>{done ? (reset ? "Password updated." : "Check your inbox.") : (reset ? "Choose a new password." : "Get back in the game.")}</h1>
      {done ? <div role="status">
        <p className="auth-intro">{reset ? "Your new password is ready to use." : "If an account exists for that email, we’ll send a reset link. Check your spam folder and open the latest link in this browser."}</p>
        <Link className="primary" href={reset ? "/dashboard" : "/login"}>{reset ? "Back to your dashboard" : "Back to login"}</Link>
        {!reset && <button className="text-link" onClick={() => setDone(false)}>Try another email</button>}
      </div> : <>
        <p className="auth-intro">{reset ? "Use a unique password with 8–128 characters." : "Enter your account email and we’ll send a password reset link."}</p>
        {!configured && <p className="form-error">Account services are not configured yet.</p>}
        <form onSubmit={submit}>
          {reset ? <>
            <label>New password<div className="password-wrap"><input name="password" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required /><button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <label>Confirm new password<input name="confirmPassword" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          </> : <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" /></label>}
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary auth-submit" disabled={busy || !configured}>{busy ? <><LoaderCircle size={18} className="spin" /> Please wait…</> : reset ? "Save new password" : "Send reset link"}</button>
        </form>
        <Link className="text-link" href={reset ? "/forgot-password" : "/login"}>{reset ? "Request a new reset link" : "Back to login"}</Link>
      </>}
    </section>
  </main>;
}
