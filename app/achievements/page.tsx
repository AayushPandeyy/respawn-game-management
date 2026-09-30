import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, LockKeyhole, Check } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Shell, { DataError } from "@/components/community-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Achievements — Respawn" };
type Achievement = {
  id: string; title: string; description: string; category: string;
  target: number; points: number; progress: number; unlocked_at: string | null;
};

export default async function Page({
  searchParams,
}: { searchParams: Promise<{ filter?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/achievements");
  const { filter: requestedFilter } = await searchParams;
  const filter = requestedFilter === "earned" || requestedFilter === "locked" ? requestedFilter : "all";
  let content;
  try {
    const client = await createClient();
    if (!client) throw new Error("Supabase is not configured yet.");
    const { data, error } = await client.rpc("my_achievements");
    if (error) {
      if (error.code === "PGRST202")
        throw new Error("Supabase cannot find the achievements function in its API schema cache (PGRST202). If you already ran the migration, run NOTIFY pgrst, 'reload schema'; in the same Supabase project used by this app, then refresh.");
      if (error.code === "42P01" || error.code === "42883")
        throw new Error(`An achievements database dependency is missing (${error.code}): ${error.message}. Check that the earlier library, community, and gaming diary migrations were applied in this project's database.`);
      if (error.code === "42501")
        throw new Error("Supabase denied access to achievements (42501). Check the authenticated role's permissions on public.my_achievements().");
      throw new Error(`Could not load your achievements (${error.code || "connection error"}). Please try again.`);
    }
    const achievements = (data || []) as Achievement[];
    const earned = achievements.filter((a) => a.unlocked_at);
    const points = earned.reduce((total, a) => total + a.points, 0);
    const visible = achievements.filter((a) => filter === "all" || (filter === "earned" ? !!a.unlocked_at : !a.unlocked_at));
    content = <>
      <section className="achievement-summary community-card">
        <Trophy size={42} aria-hidden="true" />
        <div><small>YOUR TROPHY CABINET</small><h2>{earned.length} / {achievements.length} unlocked</h2><p>Every saved game, review, and session adds to your story.</p></div>
        <strong>{points}<span>achievement points</span></strong>
      </section>
      <nav className="achievement-filters" aria-label="Filter achievements">
        {([["all", "All achievements"], ["earned", "Unlocked"], ["locked", "In progress"]] as const).map(([key, label]) =>
          <Link key={key} href={key === "all" ? "/achievements" : `/achievements?filter=${key}`} className={filter === key ? "genre active" : "genre"} aria-current={filter === key ? "page" : undefined}>{label}</Link>
        )}
      </nav>
      {!visible.length && <div className="community-card"><h2>{filter === "earned" ? "Your first milestone is waiting." : filter === "locked" ? "Every milestone unlocked!" : "No achievements available yet."}</h2><p>Explore games and keep track of your playing life to earn achievements.</p><Link href="/" className="community-button">Discover games ↗</Link></div>}
      <div className="achievement-grid">
        {visible.map((a) => <article key={a.id} className={`community-card achievement-card ${a.unlocked_at ? "is-earned" : ""}`}>
          <div className="achievement-card-top"><span className="achievement-emblem">{a.unlocked_at ? <Trophy size={26} /> : <LockKeyhole size={24} />}</span><small>{a.points} POINTS</small></div>
          <small className="achievement-category">{a.category}</small>
          <h2>{a.title}</h2><p>{a.description}</p>
          <div className="achievement-progress"><span>{a.unlocked_at ? "Unlocked" : "Progress"}</span><b>{Number(a.progress).toLocaleString()} / {Number(a.target).toLocaleString()}</b></div>
          <progress max={Number(a.target)} value={Number(a.progress)} aria-label={`${a.title} progress`} />
          <small className="achievement-status">{a.unlocked_at ? <><Check size={14} /> Earned {new Date(a.unlocked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</> : "Keep playing. You're on your way."}</small>
        </article>)}
      </div>
      <p className="achievement-footnote">Achievements unlock automatically from your Respawn activity. Earned badges stay yours. Existing milestones receive the date they were first credited.</p>
    </>;
  } catch (error) {
    content = <DataError message={error instanceof Error ? error.message : "Please retry."} />;
  }
  return <Shell eyebrow="SMALL STEPS. GREAT STORIES." title="Your achievements." description="A celebration of the games you play and the memories you keep.">{content}</Shell>;
}
