import { currentUser, sameOrigin } from "@/lib/auth";
import { saveEntry, removeEntry, LibraryError } from "@/lib/library";
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Request not allowed." }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in to manage your games." },
      { status: 401 },
    );
  try {
    const { gameId } = await request.json();
    if (!Number.isSafeInteger(gameId) || gameId <= 0)
      return Response.json({ error: "Invalid game." }, { status: 400 });
    await removeEntry(user.id, gameId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof LibraryError
            ? error.message
            : "Could not remove this game.",
      },
      { status: error instanceof SyntaxError ? 400 : 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Request not allowed." }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in to save your games." },
      { status: 401 },
    );
  try {
    const { game, status, rating, review } = await request.json();
    if (
      !game ||
      !Number.isSafeInteger(game.id) ||
      game.id <= 0 ||
      typeof game.name !== "string" ||
      game.name.length > 250 ||
      !game.name.trim() ||
      !["wishlist", "playing", "completed"].includes(status) ||
      !Number.isInteger(rating) ||
      rating < 0 ||
      rating > 5 ||
      typeof review !== "string" ||
      review.length > 3000
    )
      return Response.json(
        { error: "Check your entry and try again." },
        { status: 400 },
      );
    const safe = {
      id: game.id,
      name: game.name,
      background_image:
        typeof game.background_image === "string" &&
        game.background_image.startsWith("https://media.rawg.io/")
          ? game.background_image
          : null,
      rating: Number(game.rating) || 0,
      released:
        typeof game.released === "string" ? game.released.slice(0, 10) : null,
      genres: Array.isArray(game.genres)
        ? game.genres.slice(0, 10).map((g: { name: string; slug: string }) => ({
            name: String(g.name).slice(0, 60),
            slug: String(g.slug).slice(0, 60),
          }))
        : [],
      metacritic: Number(game.metacritic) || null,
    };
    const entry = await saveEntry(user.id, {
      game: safe,
      status,
      rating,
      review,
    });
    return Response.json({ ok: true, entry });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof LibraryError
            ? error.message
            : "Could not save your entry.",
      },
      { status: error instanceof SyntaxError ? 400 : 503 },
    );
  }
}
