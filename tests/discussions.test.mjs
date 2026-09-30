import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Review discussions enforce authorship, private notifications, retry safety and deletion cascades", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    c = "00000000-0000-4000-8000-000000000003",
    comment = "00000000-0000-4000-8000-000000000004";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}'),('${c}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`,
    );
    for (const f of [
      "202609280001_library_entries.sql",
      "202609280002_community.sql",
      "202609290006_review_discussions.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + f, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `insert into profiles(user_id,username,display_name) values('${a}','alice','Alice'),('${b}','bobby','Bob'),('${c}','carol','Carol');insert into public_reviews(user_id,game_id,game_name,body,rating) values('${a}',42,'Game','Review',5);set role authenticated;select set_config('request.jwt.claim.sub','${b}',false);insert into review_likes values('${b}','${a}',42) on conflict do nothing;insert into review_likes values('${b}','${a}',42) on conflict do nothing;`,
    );
    await assert.rejects(
      db.exec(`insert into review_likes values('${c}','${a}',42)`),
      /row-level security/,
    );
    const insert = `insert into review_comments(id,user_id,review_user_id,game_id,body,spoiler) values('${comment}','${b}','${a}',42,'Secret ending',true) on conflict do nothing;`;
    await db.exec(insert);
    await db.exec(insert);
    const targets = JSON.stringify([{ user_id: a, game_id: 42 }]);
    let summary = (
      await db.query("select * from review_engagement($1::jsonb)", [targets])
    ).rows[0];
    assert.equal(Number(summary.likes), 1);
    assert.equal(Number(summary.comments), 1);
    assert.equal(summary.liked, true);
    assert.equal(
      (await db.query("select * from review_notifications")).rows.length,
      0,
      "Commenter cannot see recipient inbox",
    );
    await assert.rejects(
      db.exec(
        `insert into review_notifications(recipient_id,comment_id) values('${b}','${comment}')`,
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(`update review_comments set review_user_id='${c}'`),
      /permission denied/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${c}',false);update review_comments set body='Forged';delete from review_comments;delete from review_likes;`,
    );
    assert.equal(
      (await db.query("select body from review_comments")).rows[0].body,
      "Secret ending",
    );
    assert.equal((await db.query("select * from review_likes")).rows.length, 1);
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
    let notifications = (await db.query("select * from review_notifications"))
      .rows;
    assert.equal(
      notifications.length,
      1,
      "Retry creates only one notification",
    );
    assert.equal(notifications[0].is_read, false);
    await db.exec("update review_notifications set is_read=true;");
    await assert.rejects(
      db.exec(`update review_notifications set recipient_id='${b}'`),
      /permission denied/,
    );
    await db.exec(
      `insert into review_comments(id,user_id,review_user_id,game_id,body) values(gen_random_uuid(),'${a}','${a}',42,'My own comment');`,
    );
    assert.equal(
      (await db.query("select * from review_notifications")).rows.length,
      1,
      "No self-notification",
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${b}',false);update review_comments set body='Edited',spoiler=false where id='${comment}';`,
    );
    assert.equal(
      (await db.query(`select body from review_comments where id='${comment}'`))
        .rows[0].body,
      "Edited",
    );
    await db.exec("reset role;set role anon;");
    assert.equal(
      (await db.query("select * from review_comments")).rows.length,
      2,
    );
    await assert.rejects(
      db.query("select * from review_notifications"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("delete from review_comments"),
      /permission denied/,
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${b}',false);delete from review_comments where id='${comment}';select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    assert.equal(
      (await db.query("select * from review_notifications")).rows.length,
      0,
      "Deleted comments remove notifications",
    );
    await db.exec("delete from public_reviews;");
    assert.equal(
      (await db.query("select * from review_comments")).rows.length,
      0,
    );
    assert.equal((await db.query("select * from review_likes")).rows.length, 0);
  } finally {
    await db.close();
  }
});
