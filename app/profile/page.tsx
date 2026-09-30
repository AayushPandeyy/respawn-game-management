import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { profile } from "@/lib/community";
import Shell, { DataError } from "@/components/community-shell";
import { ProfileForm } from "@/components/community-forms";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/profile");
  let content;
  try {
    content = <ProfileForm profile={await profile(user.id)} name={user.name} />;
  } catch (e) {
    content = (
      <DataError message={e instanceof Error ? e.message : "Please retry."} />
    );
  }
  return (
    <Shell
      eyebrow="YOUR PLAYER CARD"
      title="Make yourself at home."
      description="A little about the person behind the controller."
    >
      {content}
      <section className="community-card" style={{ marginTop: 24 }}>
        <h2>Account security</h2>
        <p>Set a new password for your account.</p>
        <Link className="community-button" href="/reset-password">Change password</Link>
      </section>
    </Shell>
  );
}
