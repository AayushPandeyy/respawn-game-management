import Shell, { DataError } from "@/components/community-shell";
import ReviewCards from "@/components/review-cards";
import { reviews } from "@/lib/community";
export const dynamic = "force-dynamic";
export default async function Page() {
  let content;
  try {
    content = <ReviewCards items={await reviews()} />;
  } catch (e) {
    content = (
      <DataError message={e instanceof Error ? e.message : "Please retry."} />
    );
  }
  return (
    <Shell
      eyebrow="FROM THE COMMUNITY"
      title="Every game has a story."
      description="Discover the latest 100 reviews from players. Fresh perspectives, memorable worlds, honest opinions."
    >
      {content}
    </Shell>
  );
}
