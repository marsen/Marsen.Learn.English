// M5 資料庫權限規則：在記憶體內的 Postgres（pglite）跑 supabase/schema.sql，
// 用 set role 模擬 Supabase 的 anon／authenticated，驗收 6.7 的第 3、4 點（別人的紀錄讀不到、答案讀不到）。
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
let db;

const as = async (role, uid) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  if (role) await db.exec(`set role ${role}`);
};
const fails = async (fn) => { try { await fn(); return false; } catch { return true; } };

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
  await db.exec(`
    insert into auth.users values ('${A}'), ('${B}');
    insert into sets (set_id, title, topic, question_count, paper, timing, audio_path, published) values ('s1', 'T', 'gym', 10, '{}', '{}', 'a.mp3', true);
    insert into set_answers values ('s1', '{"answers":[]}');
    insert into attempts (id, user_id, set_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '${A}', 's1'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '${B}', 's1');
    insert into feedback (user_id, rating, message) values ('${B}', 3, 'B 的回饋');
  `);
});

test("sets 與 set_answers：登入者與匿名都不能直接讀（標準答案不外流）", async () => {
  for (const [role, uid] of [["authenticated", A], ["anon", null]]) {
    await as(role, uid);
    assert.ok(await fails(() => db.query("select * from set_answers")), `${role} 不能讀 set_answers`);
    assert.ok(await fails(() => db.query("select * from sets")), `${role} 不能讀 sets`);
  }
});

test("attempts：只讀得到自己的；不能自己寫入或改分數", async () => {
  await as("authenticated", A);
  const r = await db.query("select id from attempts");
  assert.deepEqual(r.rows.map((x) => x.id), ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]);
  assert.ok(await fails(() => db.query(`insert into attempts (user_id, set_id) values ('${A}', 's1')`)));
  assert.ok(await fails(() => db.query("update attempts set score = 10")));
  await as("anon");
  assert.ok(await fails(() => db.query("select * from attempts")));
});

test("feedback：可新增自己的；不能冒名、不能掛在別人的 attempt；讀不到別人的", async () => {
  await as("authenticated", A);
  await db.query("insert into feedback (rating, audio_ok, message, attempt_id) values (4, true, '不錯', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')");
  assert.ok(await fails(() => db.query(`insert into feedback (user_id, rating) values ('${B}', 5)`)), "不能冒名");
  assert.ok(await fails(() => db.query("insert into feedback (rating, attempt_id) values (5, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')")), "不能掛別人的 attempt");
  assert.ok(await fails(() => db.query("insert into feedback (rating) values (9)")), "評分超出範圍");
  const mine = await db.query("select message from feedback");
  assert.deepEqual(mine.rows.map((x) => x.message), ["不錯"]);
  assert.ok(await fails(() => db.query("update feedback set message = 'x'")), "不能改");
  await as("anon");
  assert.ok(await fails(() => db.query("insert into feedback (rating) values (1)")));
});
