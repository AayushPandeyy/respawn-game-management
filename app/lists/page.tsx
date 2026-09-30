import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { lists } from "@/lib/community";
import Shell, { DataError } from "@/components/community-shell";
import { ListForm } from "@/components/community-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/lists");
  let content;
  try {
    const items = await lists(user.id);
    content = (
      <div className="community-columns">
        <div className="collection-grid">
          {items.map((l, i) => (
            <Link
              className="collection-card"
              href={`/lists/${l.id}`}
              key={l.id}
            >
              <div className="collection-art">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>✦</b>
              </div>
              <small>
                {l.is_public ? "PUBLIC" : "PRIVATE"} COLLECTION ·{" "}
                {l.list_items.length} GAMES
              </small>
              <h2>{l.title}</h2>
              <p>{l.description || "A collection with your point of view."}</p>
              <span>Explore collection ↗</span>
            </Link>
          ))}
          {!items.length && (
            <div className="community-card">
              <h2>Your taste. Your rules.</h2>
              <p>
                Collect cozy weekends, all-time favorites, or your next great
                adventure.
              </p>
            </div>
          )}
        </div>
        <ListForm />
      </div>
    );
  } catch (e) {
    content = (
      <DataError message={e instanceof Error ? e.message : "Please retry."} />
    );
  }
  return (
    <Shell
      eyebrow="CURATED BY YOU"
      title="Good games belong together."
      description="Create collections for every mood. Keep them private or share a public link."
    >
      {content}
    </Shell>
  );
}
