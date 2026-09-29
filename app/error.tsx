"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="route-loading">
      <h1>Let’s try that again.</h1>
      <p>We couldn’t load this page.</p>
      <button className="primary" onClick={reset}>
        Retry
      </button>
    </main>
  );
}
