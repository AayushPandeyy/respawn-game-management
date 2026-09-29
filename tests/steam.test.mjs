import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";

async function loadSource(path, dependencies = {}, globals = {}) {
  const context = vm.createContext({
    Response,
    URL,
    URLSearchParams,
    AbortSignal,
    console,
    ...globals,
  });
  const source = stripTypeScriptTypes(
    await readFile(new URL(path, import.meta.url), "utf8"),
  );
  const module = new vm.SourceTextModule(source, { context });
  await module.link((name) => {
    const exports = dependencies[name] || {};
    return new vm.SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [key, value] of Object.entries(exports))
          this.setExport(key, value);
      },
      { context },
    );
  });
  await module.evaluate();
  return module.namespace;
}

const steamId = "76561198000000001";

test("Steam profile parsing preserves full IDs and rejects arbitrary or misleading URLs", async () => {
  const { parseSteamProfile } = await loadSource("../lib/steam.ts");
  for (const input of [
    steamId,
    `  ${steamId}  `,
    `https://steamcommunity.com/profiles/${steamId}/`,
  ]) {
    const parsed = parseSteamProfile(input);
    assert.equal(parsed.kind, "id");
    assert.equal(parsed.value, steamId);
  }
  const parsed = parseSteamProfile(
    "https://steamcommunity.com/id/example-player/",
  );
  assert.equal(parsed.kind, "vanity");
  assert.equal(parsed.value, "example-player");
  for (const id of ["76561197960265729", "76561202255233023"])
    assert.equal(parseSteamProfile(id).value, id);
  for (const input of [
    "",
    "123",
    "example-player",
    "http://steamcommunity.com/id/player",
    "76561197960265728",
    "76561202255233024",
    "https://steamcommunity.com.evil.test/id/player",
    "https://evil.test/id/player",
    "https://steamcommunity.com@evil.test/id/player",
    "https://user@steamcommunity.com/id/player",
    "https://steamcommunity.com:444/id/player",
    "https://steamcommunity.com/id/player?url=evil",
    "https://steamcommunity.com/id/player#anchor",
    "https://steamcommunity.com/groups/player",
    "https://steamcommunity.com/profiles/not-an-id",
    "https://steamcommunity.com/id/a/b",
  ])
    assert.throws(() => parseSteamProfile(input), /SteamID64|profile URL/);
});

test("Steam library resolves vanity names server-side, preserves minutes, and handles private and empty libraries", async () => {
  let reply = {
    game_count: 2,
    games: [
      { appid: 20, name: "Zulu", playtime_forever: 123 },
      { appid: 10, name: "Alpha", playtime_forever: 0 },
    ],
  };
  let vanityReply = { success: 1, steamid: steamId };
  let status = 200;
  const requests = [];
  const env = { STEAM_WEB_API_KEY: "test-secret-key" };
  const api = await loadSource(
    "../lib/steam.ts",
    {},
    {
      process: { env },
      fetch: async (input, options) => {
        const url = new URL(input);
        requests.push({ url, options });
        return Response.json(
          {
            response: url.pathname.includes("ResolveVanityURL")
              ? vanityReply
              : reply,
          },
          { status },
        );
      },
    },
  );
  const result = await api.steamLibrary(
    "https://steamcommunity.com/id/example/",
  );
  assert.equal(result.steamId, steamId);
  assert.equal(result.games[0].name, "Alpha");
  assert.equal(result.games[1].playtime_minutes, 123);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.hostname, "api.steampowered.com");
  assert.equal(requests[0].url.searchParams.get("vanityurl"), "example");
  assert.equal(requests[1].url.searchParams.get("steamid"), steamId);
  assert.equal(requests[1].url.searchParams.get("include_appinfo"), "true");
  assert.equal(
    requests[1].url.searchParams.get("include_played_free_games"),
    "true",
  );
  assert.equal(requests[1].options.cache, "no-store");
  assert.ok(!JSON.stringify(result).includes(env.STEAM_WEB_API_KEY));
  reply = { game_count: 0 };
  assert.equal((await api.steamLibrary(steamId)).games.length, 0);
  reply = {};
  await assert.rejects(api.steamLibrary(steamId), /Game details are public/);
  reply = {
    game_count: 2,
    games: [{ appid: 10, name: "Incomplete", playtime_forever: 1 }],
  };
  await assert.rejects(api.steamLibrary(steamId), /incomplete library/);
  reply = {
    game_count: 1,
    games: [{ appid: 10, name: "Bad minutes", playtime_forever: -1 }],
  };
  await assert.rejects(api.steamLibrary(steamId), /incomplete game data/);
  vanityReply = { success: 42 };
  await assert.rejects(
    api.steamLibrary("https://steamcommunity.com/id/missing/"),
    /could not be found/,
  );
  status = 403;
  await assert.rejects(api.steamLibrary(steamId), /server API key/);
  status = 429;
  await assert.rejects(api.steamLibrary(steamId), /too many requests/);
  status = 500;
  await assert.rejects(api.steamLibrary(steamId), /unavailable/);
  delete env.STEAM_WEB_API_KEY;
  await assert.rejects(api.steamLibrary(steamId), /STEAM_WEB_API_KEY/);
});

test("Steam import API verifies ownership and authoritative data before its atomic cloud write", async () => {
  let user = { id: "verified-user" },
    saved,
    rpcError = null,
    offline = false;
  let libraryCalls = 0;
  class SteamError extends Error {}
  class CommunityError extends Error {}
  const api = await loadSource("../app/api/steam/route.ts", {
    "@/lib/auth": {
      currentUser: async () => user,
      sameOrigin: (r) => r.headers.get("origin") === "https://respawn.test",
    },
    "@/lib/steam": {
      SteamError,
      steamLibrary: async () => {
        libraryCalls++;
        return {
          steamId,
          games: [{ appid: 10, name: "Steam title", playtime_minutes: 123 }],
        };
      },
    },
    "@/lib/rawg": {
      games: async () => ({ games: [{ id: 42, name: "RAWG title" }], offline }),
      gameDetails: async (id) => ({
        id,
        name: "RAWG title",
        background_image: null,
        genres: [],
        rating: 4,
        released: null,
        metacritic: null,
        offline,
      }),
    },
    "@/lib/community": {
      CommunityError,
      communityClient: async () => ({
        rpc: async (name, args) => {
          saved = { name, args };
          return { data: [{ game_id: 42 }], error: rpcError };
        },
      }),
    },
  });
  const request = (body, origin = "https://respawn.test") =>
    new Request("https://respawn.test/api/steam", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const body = {
    action: "import",
    profile: steamId,
    status: "playing",
    user_id: "forged-user",
    selections: [
      {
        appid: 10,
        gameId: 42,
        playtime_minutes: 999999,
        game: { name: "Forged title" },
      },
    ],
  };
  const response = await api.POST(request(body));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imported, 1);
  assert.equal(saved.name, "import_steam_games");
  assert.equal(saved.args.entries[0].steam_playtime_minutes, 123);
  assert.equal(saved.args.entries[0].game.name, "RAWG title");
  assert.equal(saved.args.entries[0].user_id, undefined);
  saved = null;
  assert.equal(
    (
      await api.POST(
        request({ ...body, selections: [{ appid: 999, gameId: 42 }] }),
      )
    ).status,
    409,
  );
  assert.equal(saved, null);
  assert.equal(
    (
      await api.POST(
        request({
          ...body,
          selections: [body.selections[0], body.selections[0]],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await api.POST(
        request({
          ...body,
          selections: Array.from({ length: 21 }, (_, i) => ({
            appid: i + 1,
            gameId: i + 1,
          })),
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await api.POST(request({ ...body, status: "hacked" }))).status,
    400,
  );
  offline = true;
  assert.equal((await api.POST(request(body))).status, 503);
  assert.equal(saved, null);
  const matched = await api.POST(
    request({ action: "match", names: ["Steam title"] }),
  );
  assert.equal((await matched.json()).matches[0].candidates.length, 0);
  offline = false;
  rpcError = { code: "42883" };
  const missingMigration = await api.POST(request(body));
  assert.equal(missingMigration.status, 503);
  assert.match((await missingMigration.json()).error, /migration/);
  const before = libraryCalls;
  user = null;
  assert.equal((await api.POST(request(body))).status, 401);
  assert.equal(
    (await api.POST(request(body, "https://evil.test"))).status,
    403,
  );
  assert.equal(libraryCalls, before);
});

test("Supabase Steam import is private, atomic and repeat-safe without overwriting journals", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  const entry = (id, appid, extra = {}) => ({
    game: { id, name: `Game ${id}` },
    status: "wishlist",
    steam_app_id: appid,
    steam_playtime_minutes: 123,
    ...extra,
  });
  const imported = async (entries) =>
    (
      await db.query("select * from public.import_steam_games($1::jsonb)", [
        JSON.stringify(entries),
      ])
    ).rows;
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`,
    );
    for (const file of [
      "202609280001_library_entries.sql",
      "202609290004_steam_import.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    await db.exec(
      `insert into library_entries(user_id,game_id,game,status,rating,review) values('${a}',42,'{"id":42,"name":"My saved title"}','completed',5,'Do not overwrite');`,
    );
    const original = (
      await db.query("select * from library_entries where game_id=42")
    ).rows[0];
    assert.equal(
      (await imported([entry(42, 10), entry(43, 11, { user_id: b })])).length,
      1,
    );
    assert.deepEqual(
      (await db.query("select * from library_entries where game_id=42"))
        .rows[0],
      original,
    );
    const added = (
      await db.query("select * from library_entries where game_id=43")
    ).rows[0];
    assert.equal(added.user_id, a);
    assert.equal(added.steam_playtime_minutes, 123);
    assert.equal((await imported([entry(43, 11), entry(44, 11)])).length, 0);
    await assert.rejects(
      imported([entry(45, 12), entry(46, 13, { steam_playtime_minutes: -1 })]),
      /check constraint/,
    );
    assert.equal(
      (await db.query("select * from library_entries where game_id=45")).rows
        .length,
      0,
    );
    await assert.rejects(imported([]), /1 to 20/);
    await assert.rejects(
      imported(Array.from({ length: 21 }, (_, i) => entry(100 + i, 100 + i))),
      /1 to 20/,
    );
    await assert.rejects(
      imported([{ game: { id: 47, name: "Missing fields" } }]),
      /Invalid import entry/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal(
      (await db.query("select * from library_entries")).rows.length,
      0,
    );
    assert.equal((await imported([entry(43, 11)])).length, 1);
    await db.exec("delete from library_entries where game_id=43;");
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
    assert.equal(
      (await db.query("select * from library_entries where game_id=43")).rows
        .length,
      1,
    );
    await db.exec("select set_config('request.jwt.claim.sub','',false);");
    await assert.rejects(imported([entry(44, 12)]), /Authentication required/);
    await db.exec("reset role;set role anon;");
    await assert.rejects(imported([entry(44, 12)]), /permission denied/);
    await assert.rejects(
      db.query("select * from library_entries"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
