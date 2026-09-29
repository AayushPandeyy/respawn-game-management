import { games } from "@/lib/rawg";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return Response.json(
    await games(query.get("search") || "", query.get("genre") || ""),
  );
}
