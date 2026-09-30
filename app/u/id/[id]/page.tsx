import { notFound } from "next/navigation";
import Link from "next/link";
import Shell, { DataError } from "@/components/community-shell";
import ReviewCards from "@/components/review-cards";
import ProfileFollow from "@/components/profile-follow";
import { communityClient, check, reviews, lists, type Profile } from "@/lib/community";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  let player: Profile | null = null;
  try {
    const client = await communityClient();
    const result = await client.from("profiles").select("*").eq("user_id", id).maybeSingle();
    check(result.error);
    player = result.data as Profile | null;
    if (!player) notFound();
    const [items, collections] = await Promise.all([reviews(undefined, player.user_id), lists(player.user_id)]);
    return <Shell eyebrow="PLAYER PROFILE" title={player.display_name} description={player.bio || "Always ready for the next adventure."}>
      <div className="profile-avatar" style={{ background: player.color }}>{player.display_name.slice(0, 2).toUpperCase()}</div>
      <ProfileFollow target={player.user_id} />
      <h2>Public collections</h2>
      <div className="collection-grid">{collections.filter((list) => list.is_public).map((list) => <Link className="community-card" key={list.id} href={`/lists/${list.id}`}><h3>{list.title} ↗</h3><p>{list.list_items.length} games</p></Link>)}</div>
      <h2>Published reviews</h2>
      <ReviewCards items={items} />
    </Shell>;
  } catch (error) {
    return <Shell eyebrow="PLAYER PROFILE" title="Player profile" description=""><DataError message={error instanceof Error ? error.message : "Please retry."} /></Shell>;
  }
}
