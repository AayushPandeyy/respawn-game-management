import Link from "next/link";
import Brand from "./brand";
export default function CommunityShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="community-shell">
      <header>
        <Brand />
        <nav aria-label="Community navigation">
          <Link href="/">Discover</Link>
          <Link href="/feed">Activity</Link>
          <Link href="/diary">Diary</Link>
          <Link href="/players">Players</Link>
          <Link href="/import/steam">Steam import</Link>
          <Link href="/reviews">Reviews</Link>
          <Link href="/lists">Lists</Link>
          <Link href="/stats">Statistics</Link>
          <Link href="/profile">My profile</Link>
        </nav>
      </header>
      <main>
        <div className="community-heading">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
export function DataError({ message }: { message: string }) {
  return (
    <div className="community-card" role="alert">
      <h2>We couldn’t load this yet.</h2>
      <p>{message}</p>
      <a className="community-button" href="">
        Try again
      </a>
    </div>
  );
}
