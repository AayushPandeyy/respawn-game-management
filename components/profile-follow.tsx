import { currentUser } from "@/lib/auth";
import { followSummary } from "@/lib/follows";
import FollowPanel from "./follow-panel";
export default async function ProfileFollow({ target }: { target: string }) {
  try {
    const user = await currentUser();
    const summary = await followSummary(target, user?.id);
    return <FollowPanel target={target} viewer={user?.id} {...summary} />;
  } catch (e) {
    return (
      <p role="alert">
        {e instanceof Error ? e.message : "Following is unavailable."}
      </p>
    );
  }
}
