import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Following enforces ownership and feed excludes private and withdrawn content", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    c = "00000000-0000-4000-8000-000000000003";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}'),('${c}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`,
    );
    for (const f of [
      "202609280001_library_entries.sql",
      "202609280002_community.sql",
      "202609290003_follows.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + f, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `insert into profiles(user_id,username,display_name) values('${a}','alice','Alice'),('${b}','bobby','Bob'),('${c}','carol','Carol');insert into public_reviews(user_id,game_id,game_name,body,rating) values('${b}',42,'Game','Public',5),('${c}',43,'Other','Not followed',4);insert into game_lists(user_id,title,is_public) values('${b}','Private list',false),('${b}','Public list',true);insert into library_entries(user_id,game_id,game,status,review) values('${b}',42,'{"id":42,"name":"Game"}','completed','Secret');set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    assert.equal(
      (await db.query("select * from following_feed()")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        `insert into follows(follower_id,following_id) values('${b}','${c}')`,
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(
        `insert into follows(follower_id,following_id) values('${a}','${a}')`,
      ),
      /check constraint/,
    );
    await db.exec(
      `insert into follows(follower_id,following_id) values('${a}','${b}') on conflict do nothing;insert into follows(follower_id,following_id) values('${a}','${b}') on conflict do nothing;`,
    );
    assert.equal((await db.query("select * from follows")).rows.length, 1);
    let feed = (await db.query("select * from following_feed()")).rows;
    assert.equal(feed.length, 2);
    assert.ok(!JSON.stringify(feed).includes("Secret"));
    assert.ok(!JSON.stringify(feed).includes("Private list"));
    assert.ok(!JSON.stringify(feed).includes("Not followed"));
    assert.equal(
      (await db.query("select * from following_feed(1)")).rows.length,
      1,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${c}',false);delete from follows;`,
    );
    assert.equal((await db.query("select * from follows")).rows.length, 1);
    assert.equal(
      (await db.query("select * from following_feed()")).rows.length,
      0,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${b}',false);update game_lists set is_public=false;delete from public_reviews where user_id='${b}';select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    assert.equal(
      (await db.query("select * from following_feed()")).rows.length,
      0,
    );
    await db.exec(`delete from follows;`);
    assert.equal((await db.query("select * from follows")).rows.length, 0);
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from following_feed()"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(
        `insert into follows(follower_id,following_id) values('${a}','${b}')`,
      ),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
