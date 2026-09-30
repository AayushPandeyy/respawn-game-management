import AppSidebar from "./app-sidebar";
import { currentUser } from "@/lib/auth";
import { getEntries } from "@/lib/library";
import type { Entry } from "@/lib/types";
export default async function CommunityShell({
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
  const user = await currentUser();
  let entries: Entry[] = [];
  if (user) try { entries = await getEntries(user.id); } catch {}
  return (
    <div className="community-shell">
      <AppSidebar user={user} entries={entries} />
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
