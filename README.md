# Respawn

A Next.js game journal using Supabase Auth and Supabase Postgres for all account and journal persistence. RAWG remains the source of game metadata, search results, and artwork. There is no local database or local persistence fallback.

## Required database setup

Run **supabase/setup.sql** once in your configured project's Supabase SQL Editor. It contains the table, constraints, indexes, row-level security policies, and an import of your existing Supabase-owned journal entry. The import skips entries already in the cloud and never links accounts by email. No passwords or sessions are included. Treat setup.sql as a private data export; it is gitignored.

For a fresh project without old data, run **supabase/migrations/202609280001_library_entries.sql** instead, or apply that migration with the Supabase CLI.

The public/publishable key cannot create tables. Until the migration is applied, signed-in pages display an explicit library-setup message and disable saving so an unavailable library cannot be mistaken for an empty one. Cloud failures never silently fall back to local storage.

## Environment

Fill `.env.local` using `.env.example`:

```dotenv
RAWG_API_KEY=your_rawg_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
# APP_ORIGIN=https://your-production-domain.example
```

A legacy anon key is also supported as `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put a service-role/secret key in a NEXT_PUBLIC variable. No administrator credential is needed by the app.

Enable Email authentication in Supabase. Set Site URL to `http://127.0.0.1:3000` and allow `http://127.0.0.1:3000/auth/callback` under Redirect URLs. Add the equivalent production URL when deploying. The default confirmation email `{{ .ConfirmationURL }}` link is supported. PKCE email confirmation should be opened in the same browser that began signup. Configure production email delivery through Supabase SMTP settings.

## Run

Use Node.js 24 or later for the app and tests.

```sh
npm install
npm run dev
```

Restart after changing environment values. Rebuild production when NEXT_PUBLIC values change.

## Connected features

### Steam library import

1. Add `STEAM_WEB_API_KEY` to `.env.local` and restart the app. Obtain the key from [Steam Web API registration](https://steamcommunity.com/dev/apikey); keep it server-side, never in a `NEXT_PUBLIC` variable.
2. Run `supabase/migrations/202609290004_steam_import.sql` once after the library migration. This adds private Steam app ID/playtime metadata and a transactional import function. It does not alter existing journal contents.
3. Open `/import/steam`, enter a SteamID64 or HTTPS Steam community profile URL, and preview. The Steam account's Game details must be public. This feature imports a public library; it does not verify Steam account ownership or create a linked account.
4. Review RAWG title suggestions, correct matches with search, select games on the current page, choose their initial status, and import. Nothing is imported automatically; completion is never inferred from playtime.

Suggestions load eight games at a time with at most three concurrent RAWG calls. RAWG fallback catalog results are not accepted as matches. On confirmation the server re-reads Steam ownership/playtime and RAWG metadata; submitted playtime, names and owner IDs are ignored. An atomic Supabase function skips both existing RAWG games and existing Steam app IDs, preserving ratings, reviews, statuses and previous playtime snapshots. Retrying after a lost response is safe. Steam playtime is shown as an import snapshot on the import screen and is not synchronized automatically. No Steam key, SteamID or public activity is written by an import.

Run `npm run test:steam`. Live Steam import requires the API key and migration. Reference: [Steam owned games API](https://partner.steamgames.com/doc/webapi/iplayerservice), [Steam vanity URL API](https://partner.steamgames.com/doc/webapi/ISteamUser), [Steam API terms](https://steamcommunity.com/dev/apiterms).

### Following and activity feed

Run `supabase/migrations/202609290003_follows.sql` after the community migration. `/players` provides searchable public profiles. Profile pages show follow/unfollow controls and public follower/following counts. `/feed` shows paginated public reviews and public collections from followed players, including existing posts. Review edits update their feed position; list dates use creation time. Private journals, completion statuses and private lists never enter the feed. Unpublishing content removes it immediately because the feed reads source tables through a security-invoker SQL function. Only the verified user can change their follow connections; self-following is blocked. Follow connections are public and disclosed beside the controls. Run `npm run test:follows` to verify isolation and privacy.

### Profiles, public reviews, custom lists and statistics

After the library migration, run `supabase/migrations/202609280002_community.sql` once in the Supabase SQL Editor. It adds four RLS-protected tables; it does not publish or alter existing private journal entries. The publishable key cannot apply database migrations.

- `/profile`: choose a unique username, display name, bio and avatar color. Saving explicitly creates a public player card at `/u/[username]`. No email or private library data is exposed.
- `/reviews`: latest 100 public reviews. Each game page has a separate publish/edit/unpublish form with ratings and spoiler disclosure. A saved profile is required to publish. Private journal edits do not update public reviews automatically.
- `/lists`: create private or public collections. Each list supports title/description edits, RAWG game search, additions, removals and deletion. Share the URL of a public list; private lists and their items are readable only by their owner.
- `/stats`: private totals, genre counts, rating distribution, completion percentage and recently updated games, calculated from the complete Supabase library. No estimated personal playtime is shown.

Community navigation is available on desktop and mobile. Run `npm run test:community` for the database privacy regression checks. The production build and isolated tests do not replace live verification after applying the migration.

- Signup, login, confirmation, session refresh and logout: Supabase Auth.
- Library additions, quick edits, play statuses, ratings and private reviews: Supabase `public.library_entries`.
- Dashboard, journal, collection counts and individual game entries: cloud reads scoped to the verified Supabase UUID.
- Removal: Supabase delete with both owner and game filters, backed by RLS.
- Save confirmation and timestamps: returned from the cloud database, not simulated locally.
- Sorting/filtering, expanding text, gallery navigation and copying links: transient UI actions over the loaded data; these do not require database writes.
- Game discovery, descriptions and screenshots: RAWG, fetched server-side with caching.

Routes: `/`, `/dashboard`, `/login`, `/signup`, `/games/[id]`.

## Security and storage

Auth uses server-managed HttpOnly cookies and verified `getUser()` identity. Session refresh runs in `proxy.ts`. Every persistence query uses that user's session; no service-role bypass is used. The database allows authenticated users to read, insert, update and delete only their own entries. Anonymous users have no table privileges. Primary key `(user_id, game_id)` prevents duplicate games. Database constraints validate status, rating, review length, and game identity. A trigger sets update timestamps.

Previous local database files were moved outside the app to the workspace recovery directory. They are not opened or used by any app feature. The supplied SQL import preserves the existing Supabase-owned entry; old local-only identities are not silently mapped to new cloud accounts.

## Checks

```sh
npm run test:auth
npm run test:library
npm run typecheck
npm run build
```

Library tests execute the actual migration in an isolated in-memory Postgres runtime and check owner access, cross-user isolation, blocked ownership changes, invalid ratings, and anonymous access. API tests verify authenticated ownership, save responses, cloud failures, and unauthorized requests. Tests do not modify your real Supabase project. Live persistence must be verified after applying the remote schema.

## Deploy

```sh
npm run build
npm start
```

Use a Next.js-compatible Node host. No persistent application disk is needed. Configure the environment values, exact production `APP_ORIGIN`, HTTPS, and Supabase auth redirect allowlist. No remote deployment was created by this change.

[Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) · [RAWG](https://rawg.io)
