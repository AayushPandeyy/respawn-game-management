import { notFound } from "next/navigation";
import Link from "next/link";
import Shell, { DataError } from "@/components/community-shell";
import ReviewCards from "@/components/review-cards";
import ProfileFollow from "@/components/profile-follow";
import {
  communityClient,
  check,
  reviews,
  lists,
  type Profile,
} from "@/lib/community";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let p: Profile | null = null;
  let content;
  try {
    const c = await communityClient();
    const r = await c
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    check(r.error);
    p = r.data;
    if (p) {
      const [items, collections] = await Promise.all([
        reviews(undefined, p.user_id),
        lists(p.user_id),
      ]);
      content = (
        <>
          <div className="profile-avatar" style={{ background: p.color }}>
            {p.display_name.slice(0, 2).toUpperCase()}
          </div>
          <ProfileFollow target={p.user_id} />
          <h2>Public collections</h2>
          <div className="collection-grid">
            {collections
              .filter((l) => l.is_public)
              .map((l) => (
                <Link
                  className="community-card"
                  key={l.id}
                  href={`/lists/${l.id}`}
                >
                  <h3>{l.title} ↗</h3>
                  <p>{l.list_items.length} games</p>
                </Link>
              ))}
          </div>
          <h2>Published reviews</h2>
          <ReviewCards items={items} />
        </>
      );
    }
  } catch (e) {
    return (
      <Shell eyebrow="PLAYER PROFILE" title="Player profile" description="">
        <DataError message={e instanceof Error ? e.message : "Please retry."} />
      </Shell>
    );
  }
  if (!p) notFound();
  return (
    <Shell
      eyebrow={`@${p.username}`}
      title={p.display_name}
      description={p.bio || "Always ready for the next adventure."}
    >
      {content}
    </Shell>
  );
}
