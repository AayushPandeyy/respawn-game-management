import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";

test("Supabase migration enforces ownership for reads, inserts, updates and deletes", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609280001_library_entries.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    await db.exec(
      `insert into public.library_entries(user_id,game_id,game,status,rating,review) values('${a}',42,'{"id":42,"name":"Test Game"}','playing',4,'Private A');`,
    );
    await assert.rejects(
      db.exec(
        `insert into public.library_entries(user_id,game_id,game,status) values('${b}',43,'{"id":43,"name":"Test Game"}','wishlist');`,
      ),
      /row-level security/i,
    );
    await assert.rejects(
      db.exec(
        `update public.library_entries set user_id='${b}' where game_id=42;`,
      ),
      /row-level security/i,
    );
    await assert.rejects(
      db.exec(`update public.library_entries set rating=6 where game_id=42;`),
      /check constraint/i,
    );
    await db.exec(
      `update public.library_entries set status='completed',rating=5 where game_id=42;`,
    );
    assert.equal(
      (await db.query("select rating from public.library_entries")).rows[0]
        .rating,
      5,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal(
      (await db.query("select * from public.library_entries")).rows.length,
      0,
    );
    await db.exec(`delete from public.library_entries where game_id=42;`);
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
    assert.equal(
      (await db.query("select * from public.library_entries")).rows.length,
      1,
    );
    await db.exec("delete from public.library_entries where game_id=42;");
    assert.equal(
      (await db.query("select * from public.library_entries")).rows.length,
      0,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from public.library_entries"),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});

test("library API uses verified identity, confirmed cloud saves, and propagates failures", async () => {
  let user = { id: "verified-user" },
    failed = false,
    saved,
    removed;
  class LibraryError extends Error {}
  const deps = {
    "@/lib/auth": {
      currentUser: async () => user,
      sameOrigin: (r) => r.headers.get("origin") === "https://respawn.test",
    },
    "@/lib/library": {
      LibraryError,
      saveEntry: async (id, entry) => {
        if (failed) throw new LibraryError("Cloud unavailable");
        saved = { id, entry };
        return { ...entry, updated_at: "2026-09-28T00:00:00Z" };
      },
      removeEntry: async (id, gameId) => {
        if (failed) throw new LibraryError("Cloud unavailable");
        removed = { id, gameId };
      },
    },
  };
  const context = vm.createContext({ Response, console });
  const source = stripTypeScriptTypes(
    await readFile(
      new URL("../app/api/library/route.ts", import.meta.url),
      "utf8",
    ),
  );
  const module = new vm.SourceTextModule(source, { context });
  await module.link(
    (name) =>
      new vm.SyntheticModule(
        Object.keys(deps[name]),
        function () {
          for (const [key, value] of Object.entries(deps[name]))
            this.setExport(key, value);
        },
        { context },
      ),
  );
  await module.evaluate();
  const req = (method, body, origin = "https://respawn.test") =>
    new Request("https://respawn.test/api/library", {
      method,
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const body = {
    user_id: "forged-user",
    game: { id: 42, name: "Test Game", genres: [] },
    status: "playing",
    rating: 4,
    review: "Private",
  };
  const response = await module.namespace.POST(req("POST", body));
  assert.equal(response.status, 200);
  assert.equal(saved.id, "verified-user");
  assert.equal(
    (await response.json()).entry.updated_at,
    "2026-09-28T00:00:00Z",
  );
  assert.equal(
    (await module.namespace.POST(req("POST", { ...body, rating: 6 }))).status,
    400,
  );
  assert.equal(
    (await module.namespace.DELETE(req("DELETE", { gameId: 42 }))).status,
    200,
  );
  assert.deepEqual(removed, { id: "verified-user", gameId: 42 });
  failed = true;
  assert.equal((await module.namespace.POST(req("POST", body))).status, 503);
  assert.equal(
    (await module.namespace.DELETE(req("DELETE", { gameId: 42 }))).status,
    503,
  );
  user = null;
  assert.equal((await module.namespace.POST(req("POST", body))).status, 401);
  assert.equal(
    (await module.namespace.DELETE(req("DELETE", { gameId: 42 }))).status,
    401,
  );
  assert.equal(
    (
      await module.namespace.DELETE(
        req("DELETE", { gameId: 42 }, "https://evil.test"),
      )
    ).status,
    403,
  );
});
