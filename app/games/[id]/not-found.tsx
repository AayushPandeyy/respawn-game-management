import Link from "next/link";
export default function NotFound() {
  return (
    <main className="route-loading">
      <h1>This game isn’t in the catalog.</h1>
      <p>The link may be incorrect, or the game may have been removed.</p>
      <Link className="primary" href="/">
        Discover games
      </Link>
    </main>
  );
}
