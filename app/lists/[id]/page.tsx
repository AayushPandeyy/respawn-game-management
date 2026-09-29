import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { communityClient, check, type GameList } from "@/lib/community";
import Shell, { DataError } from "@/components/community-shell";
import { ListForm, ListItems } from "@/components/community-forms";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let list: GameList | null = null;
  let error = "";
  try {
    const c = await communityClient();
    const result = await c
      .from("game_lists")
      .select("*,list_items(game_id,game_name)")
      .eq("id", id)
      .maybeSingle();
    check(result.error);
    list = result.data;
  } catch (e) {
    error = e instanceof Error ? e.message : "Please retry.";
  }
  if (error)
    return (
      <Shell
        eyebrow="COLLECTION"
        title="Your collection"
        description="Games worth keeping together."
      >
        <DataError message={error} />
      </Shell>
    );
  if (!list) notFound();
  const user = await currentUser();
  const owner = user?.id === list.user_id;
  return (
    <Shell
      eyebrow={list.is_public ? "PUBLIC COLLECTION" : "PRIVATE COLLECTION"}
      title={list.title}
      description={list.description || "One collection. Many adventures."}
    >
      <div className="community-columns">
        <ListItems list={list} owner={owner} />
        {owner && <ListForm list={list} />}
      </div>
      {list.is_public && (
        <p className="sharing-note">
          Share this page’s URL to invite others to browse this collection.
        </p>
      )}
    </Shell>
  );
}
