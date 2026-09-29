import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
async function load(path, deps = {}) {
  const context = vm.createContext({ Response, Date });
  const m = new vm.SourceTextModule(
    stripTypeScriptTypes(
      await readFile(new URL(path, import.meta.url), "utf8"),
    ),
    { context },
  );
  await m.link(
    (name) =>
      new vm.SyntheticModule(
        Object.keys(deps[name]),
        function () {
          for (const [k, v] of Object.entries(deps[name])) this.setExport(k, v);
        },
        { context },
      ),
  );
  await m.evaluate();
  return m.namespace;
}
test("Diary dates reject impossible calendar dates and invalid session fields", async () => {
  const v = await load("../lib/diary-validation.ts");
  for (const date of ["2024-02-29", "2026-09-29", "1970-01-01", "2100-12-31"])
    assert.ok(v.validDiaryDate(date));
  for (const date of [
    "2026-02-29",
    "2026-04-31",
    "2026-00-01",
    "2026-13-01",
    "1969-12-31",
    "2026-1-2",
    null,
  ])
    assert.equal(v.validDiaryDate(date), false);
  const value = {
    id: "00000000-0000-4000-8000-000000000001",
    played_on: "2026-09-29",
    minutes: 60,
    notes: "Private",
    completed: true,
    replay: false,
  };
  assert.ok(v.validSession(value));
  for (const changes of [
    { minutes: 0 },
    { minutes: 1441 },
    { minutes: 1.5 },
    { notes: "x".repeat(3001) },
    { completed: "yes" },
    { id: "not-a-uuid" },
  ])
    assert.equal(v.validSession({ ...value, ...changes }), false);
});
test("Diary API rejects forged ownership and confirms writes before reporting success", async () => {
  const validation = await load("../lib/diary-validation.ts");
  let user = { id: "verified-user" },
    calls = [],
    data = null,
    error = null;
  class DiaryError extends Error {}
  const chain = new Proxy(
    {},
    {
      get: (_, method) =>
        method === "then"
          ? (resolve) => resolve({ data, error })
          : (...args) => {
              calls.push([method, ...args]);
              if (method === "upsert") data = [{ id: args[0].id, ...args[0] }];
              if (method === "update") data = { id: "saved", ...args[0] };
              return chain;
            },
    },
  );
  const api = await load("../app/api/diary/route.ts", {
    "@/lib/auth": {
      currentUser: async () => user,
      sameOrigin: (r) => r.headers.get("origin") === "https://respawn.test",
    },
    "@/lib/diary": {
      DiaryError,
      diaryClient: async () => ({ from: () => chain }),
      checkDiary: (e) => {
        if (e) throw new DiaryError("Cloud unavailable");
      },
    },
    "@/lib/diary-validation": validation,
    "@/lib/rawg": {
      gameDetails: async () => ({ id: 42, name: "Verified game" }),
    },
  });
  const body = {
    id: "00000000-0000-4000-8000-000000000001",
    game_id: 42,
    played_on: "2026-09-29",
    minutes: 90,
    notes: "Private",
    completed: true,
    replay: false,
    user_id: "forged",
  };
  const req = (method, b = body, origin = "https://respawn.test") =>
    new Request("https://respawn.test/api/diary", {
      method,
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });
  assert.equal(
    (await api.POST(req("POST", body, "https://evil.test"))).status,
    403,
  );
  user = null;
  assert.equal((await api.POST(req("POST"))).status, 401);
  user = { id: "verified-user" };
  assert.equal(
    (await api.POST(req("POST", { ...body, played_on: "2026-02-30" }))).status,
    400,
  );
  assert.equal((await api.POST(req("POST"))).status, 200);
  const inserted = calls.find((c) => c[0] === "upsert");
  assert.equal(inserted[1].user_id, "verified-user");
  assert.equal(inserted[1].game_name, "Verified game");
  assert.equal(inserted[2].ignoreDuplicates, true);
  calls = [];
  data = { id: body.id };
  assert.equal((await api.POST(req("POST"))).status, 200);
  assert.ok(
    !calls.some((c) => c[0] === "upsert"),
    "Retry must not insert again",
  );
  calls = [];
  assert.equal((await api.PATCH(req("PATCH"))).status, 200);
  assert.ok(
    calls.some(
      (c) => c[0] === "eq" && c[1] === "user_id" && c[2] === "verified-user",
    ),
  );
  assert.equal(calls.find((c) => c[0] === "update")[1].game_id, undefined);
  data = [];
  assert.equal((await api.DELETE(req("DELETE", { id: body.id }))).status, 404);
  error = { code: "bad" };
  assert.equal((await api.POST(req("POST"))).status, 503);
});
test("Diary migration enforces privacy and monthly trends reflect edits and deletes", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    s = "00000000-0000-4000-8000-000000000003",
    s2 = "00000000-0000-4000-8000-000000000004";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`,
    );
    for (const file of [
      "202609280001_library_entries.sql",
      "202609290005_gaming_diary.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);insert into play_sessions(id,user_id,game_id,game_name,played_on,minutes,completed,replay) values('${s}','${a}',42,'Game','2026-01-31',60,true,false),('${s2}','${a}',42,'Game','2026-02-01',90,true,true);`,
    );
    let months = (await db.query("select * from diary_monthly(2026)")).rows;
    assert.equal(months.length, 2);
    assert.equal(Number(months[0].minutes), 60);
    assert.equal(Number(months[1].replays), 1);
    await assert.rejects(
      db.exec(`update play_sessions set user_id='${b}';`),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(`update play_sessions set minutes=1441;`),
      /check constraint/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal(
      (await db.query("select * from play_sessions")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from diary_monthly(2026)")).rows.length,
      0,
    );
    await db.exec(
      `update play_sessions set notes='Forged';delete from play_sessions;`,
    );
    await assert.rejects(
      db.exec(
        `insert into play_sessions(id,user_id,game_id,game_name,played_on,minutes) values(gen_random_uuid(),'${a}',42,'Game','2026-01-01',1)`,
      ),
      /row-level security/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${a}',false);update play_sessions set played_on='2026-02-02',minutes=30 where id='${s}';`,
    );
    months = (await db.query("select * from diary_monthly(2026)")).rows;
    assert.equal(months.length, 1);
    assert.equal(Number(months[0].minutes), 120);
    assert.equal(Number(months[0].completions), 2);
    await db.exec(`delete from play_sessions where id='${s2}';`);
    assert.equal(
      Number(
        (await db.query("select * from diary_monthly(2026)")).rows[0].minutes,
      ),
      30,
    );
    assert.equal(
      (await db.query("select * from library_entries")).rows.length,
      0,
      "Diary does not silently change library",
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from play_sessions"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from diary_monthly(2026)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
