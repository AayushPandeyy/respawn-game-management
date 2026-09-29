import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

test("Community API verifies identity, validates input and scopes mutations", async () => {
  let user = { id: "verified-owner" },
    calls = [],
    failure = false,
    owned = true;
  class CommunityError extends Error {}
  const chain = new Proxy(
    {},
    {
      get: (_, method) =>
        method === "then"
          ? (resolve) =>
              resolve({
                data: owned ? { id: "saved" } : null,
                error: failure ? { code: "unavailable" } : null,
              })
          : (...args) => {
              calls.push([method, ...args]);
              return chain;
            },
    },
  );
  const deps = {
    "@/lib/auth": {
      currentUser: async () => user,
      sameOrigin: (r) => r.headers.get("origin") === "https://respawn.test",
    },
    "@/lib/community": {
      CommunityError,
      communityClient: async () => ({
        from: (table) => {
          calls.push(["from", table]);
          return chain;
        },
      }),
      check: (e) => {
        if (e) throw new CommunityError("Cloud unavailable");
      },
    },
    "@/lib/rawg": {
      gameDetails: async (id) => ({ id, name: "Verified game" }),
    },
  };
  const context = vm.createContext({ Response });
  const module = new vm.SourceTextModule(
    stripTypeScriptTypes(
      await readFile(
        new URL("../app/api/community/route.ts", import.meta.url),
        "utf8",
      ),
    ),
    { context },
  );
  await module.link(
    (name) =>
      new vm.SyntheticModule(
        Object.keys(deps[name]),
        function () {
          for (const [k, v] of Object.entries(deps[name])) this.setExport(k, v);
        },
        { context },
      ),
  );
  await module.evaluate();
  const request = (body, origin = "https://respawn.test") =>
    new Request("https://respawn.test/api/community", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const post = module.namespace.POST;
  assert.equal((await post(request({}, "https://evil.test"))).status, 403);
  user = null;
  assert.equal((await post(request({}))).status, 401);
  user = { id: "verified-owner" };
  for (const body of [
    null,
    [],
    { action: "profile", username: "Bad name" },
    { action: "review", game_id: 1, rating: 7, body: "Review", spoiler: false },
    { action: "add-item", id: "invalid", game_id: 1 },
  ])
    assert.equal((await post(request(body))).status, 400);
  calls = [];
  assert.equal(
    (
      await post(
        request({
          action: "profile",
          user_id: "forged",
          username: "player",
          display_name: "Player",
          bio: "",
          color: "#c3f66b",
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    calls.find((c) => c[0] === "upsert")[1].user_id,
    "verified-owner",
  );
  calls = [];
  await post(
    request({
      action: "review",
      game_id: 42,
      game_name: "Forged title",
      body: "Public review",
      rating: 5,
      spoiler: true,
    }),
  );
  assert.equal(
    calls.find((c) => c[0] === "upsert")[1].game_name,
    "Verified game",
  );
  assert.equal(
    calls.find((c) => c[0] === "upsert")[1].user_id,
    "verified-owner",
  );
  calls = [];
  await post(request({ action: "unpublish", game_id: 42 }));
  assert.ok(
    calls.some(
      (c) => c[0] === "eq" && c[1] === "user_id" && c[2] === "verified-owner",
    ),
  );
  const id = "00000000-0000-4000-8000-000000000003";
  owned = false;
  calls = [];
  assert.equal(
    (await post(request({ action: "add-item", id, game_id: 42 }))).status,
    404,
  );
  assert.ok(!calls.some((c) => c[0] === "upsert"));
  owned = true;
  calls = [];
  await post(
    request({
      action: "list",
      id,
      title: "Collection",
      description: "",
      is_public: false,
    }),
  );
  assert.ok(
    calls.some(
      (c) => c[0] === "eq" && c[1] === "user_id" && c[2] === "verified-owner",
    ),
  );
  failure = true;
  const r = await post(request({ action: "unpublish", game_id: 42 }));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "Cloud unavailable");
});
test("Community RLS separates public content from private libraries and lists", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    id = "00000000-0000-4000-8000-000000000003";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`,
    );
    for (const f of [
      "202609280001_library_entries.sql",
      "202609280002_community.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + f, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);insert into profiles values('${a}','player_a','Player A','','#c3f66b');insert into library_entries(user_id,game_id,game,status,review) values('${a}',42,'{"id":42,"name":"Game"}','playing','Private note');insert into game_lists(id,user_id,title) values('${id}','${a}','Secret list');insert into list_items(list_id,game_id,game_name) values('${id}',42,'Game');insert into public_reviews(user_id,game_id,game_name,body,rating) values('${a}',42,'Game','Published review',5);`,
    );
    await assert.rejects(
      db.exec(`update profiles set user_id='${b}';`),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(`update public_reviews set rating=6;`),
      /check constraint/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    for (const table of ["library_entries", "game_lists", "list_items"])
      assert.equal(
        (await db.query(`select * from ${table}`)).rows.length,
        0,
        table + " private",
      );
    assert.equal(
      (await db.query("select * from public_reviews")).rows.length,
      1,
    );
    await assert.rejects(
      db.exec(`insert into list_items values('${id}',43,'Intruder',now());`),
      /row-level security/,
    );
    await db.exec(
      `update public_reviews set body='Forged';delete from public_reviews;update game_lists set is_public=true;`,
    );
    assert.equal(
      (await db.query("select body from public_reviews")).rows[0].body,
      "Published review",
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${a}',false);update game_lists set is_public=true;reset role;set role anon;select set_config('request.jwt.claim.sub','',false);`,
    );
    assert.equal((await db.query("select * from game_lists")).rows.length, 1);
    assert.equal((await db.query("select * from list_items")).rows.length, 1);
    await assert.rejects(
      db.query("select * from library_entries"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(`delete from public_reviews;`),
      /permission denied/,
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);update game_lists set is_public=false;delete from public_reviews;`,
    );
    assert.equal(
      (await db.query("select * from library_entries")).rows.length,
      1,
      "Unpublishing preserves private journal",
    );
    await db.exec(
      `reset role;set role anon;select set_config('request.jwt.claim.sub','',false);`,
    );
    assert.equal(
      (await db.query("select * from list_items")).rows.length,
      0,
      "Revoking visibility hides items",
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);delete from game_lists;`,
    );
    assert.equal(
      (await db.query("select * from list_items")).rows.length,
      0,
      "Deletion cascades",
    );
  } finally {
    await db.close();
  }
});
