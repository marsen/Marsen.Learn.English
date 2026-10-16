// M5 伺服器函式：用假的登入、假的資料庫測 6.7 的驗收條件（未登入 401、別人的 attempt、重複送出、答案不外流）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApi, cleanAnswers, cleanFeedback } from "../api/_core.mjs";
import { supabaseFromEnv } from "../api/_supabase.mjs";

const SET = "s1-gym-0002";
const load = async (f) => JSON.parse(await readFile(new URL(`../content/sets/${SET}/${f}`, import.meta.url)));

async function setup() {
  const plan = await load("plan.json");
  const attempts = new Map();
  const users = { "tok-a": { id: "user-a" }, "tok-b": { id: "user-b" } };
  const store = {
    listPublishedSets: async () => [{ set_id: SET, title: "Gym", topic: "gym", question_count: 10 }],
    listFinished: async (uid) => [...attempts.values()].filter((a) => a.user_id === uid && a.finished_at).map((a) => ({ set_id: a.set_id, score: a.score, total: a.total })),
    getPublishedSet: async (id) => (id === SET ? { set_id: SET, title: "Gym", question_count: 10, paper: { rows: [] }, timing: { events: [] }, audio_path: "s1/full.mp3" } : null),
    createAttempt: async (row) => { const a = { id: `att-${attempts.size + 1}`, finished_at: null, ...row }; attempts.set(a.id, a); return a; },
    getAttempt: async (id) => attempts.get(id) ?? null,
    getPlan: async () => plan,
    finishAttempt: async (id, patch) => { const a = attempts.get(id); if (a.finished_at) return false; Object.assign(a, patch); return true; },
  };
  const api = createApi({ auth: { verify: async (t) => users[t] ?? null }, store, signUrl: async (p, s) => `https://signed.example/${p}?exp=${s}`, now: () => new Date("2026-10-17T00:00:00Z") });
  const req = (token, body) => ({ headers: token ? { authorization: `Bearer ${token}` } : {}, body });
  const right = Object.fromEntries(plan.answers.map((a) => [a.question_id, a.answer]));
  return { api, req, plan, attempts, right };
}

test("沒登入或 token 無效：三個函式都回 401", async () => {
  const { api, req } = await setup();
  for (const [fn, body] of [["sets"], ["start", { set_id: SET }], ["finish", { attempt_id: "att-1", answers: {} }]]) {
    assert.equal((await api[fn](req(null, body))).status, 401, `${fn} 沒帶 token`);
    assert.equal((await api[fn](req("壞的", body))).status, 401, `${fn} token 無效`);
  }
});

test("start：回傳題目卷、時間軸、錄音簽名網址；不含標準答案與逐字稿", async () => {
  const { api, req, plan } = await setup();
  const out = await api.start(req("tok-a", { set_id: SET }));
  assert.equal(out.status, 200);
  assert.equal(out.body.audio_url, "https://signed.example/s1/full.mp3?exp=3600");
  assert.ok(out.body.attempt_id);
  const text = JSON.stringify(out.body);
  for (const a of plan.answers) assert.ok(!("plan" in out.body) && !("answers" in out.body), "不回傳 plan");
  assert.ok(!text.includes('"expected"'));
  assert.equal((await api.start(req("tok-a", { set_id: "不存在" }))).status, 404);
  assert.equal((await api.start(req("tok-a", {}))).status, 400);
});

test("finish：批改結果與出題端同一套規則；全對滿分、全空零分", async () => {
  const { api, req, right, plan } = await setup();
  const a1 = (await api.start(req("tok-a", { set_id: SET }))).body.attempt_id;
  const ok = await api.finish(req("tok-a", { attempt_id: a1, answers: right }));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.total, plan.answers.length);
  const a2 = (await api.start(req("tok-a", { set_id: SET }))).body.attempt_id;
  const none = await api.finish(req("tok-a", { attempt_id: a2, answers: {} }));
  assert.equal(none.body.total, 0);
});

test("finish：別人的 attempt 回 404；同一個 attempt 第二次送出回 409；結果寫進紀錄", async () => {
  const { api, req, right, attempts } = await setup();
  const id = (await api.start(req("tok-a", { set_id: SET }))).body.attempt_id;
  assert.equal((await api.finish(req("tok-b", { attempt_id: id, answers: right }))).status, 404, "B 不能送 A 的");
  assert.equal(attempts.get(id).finished_at, null, "被拒絕的不留下紀錄");
  assert.equal((await api.finish(req("tok-a", { attempt_id: id, answers: right }))).status, 200);
  assert.equal(attempts.get(id).score, 10);
  assert.equal(attempts.get(id).finished_at, "2026-10-17T00:00:00.000Z");
  assert.equal((await api.finish(req("tok-a", { attempt_id: id, answers: {} }))).status, 409);
  assert.equal(attempts.get(id).score, 10, "第二次送出不改分數");
  assert.equal((await api.finish(req("tok-a", { attempt_id: "att-不存在", answers: right }))).status, 404);
});

test("finish：作答格式不對一律 400", async () => {
  const { api, req } = await setup();
  const id = (await api.start(req("tok-a", { set_id: SET }))).body.attempt_id;
  for (const answers of [null, [], "x", { q1: "a" }, { q01: 5 }, { q01: "x".repeat(201) }, { name: "a" }]) {
    assert.equal((await api.finish(req("tok-a", { attempt_id: id, answers }))).status, 400, JSON.stringify(answers)?.slice(0, 30));
  }
  assert.deepEqual(cleanAnswers({ q01: "a", q10: "" }), { q01: "a", q10: "" });
});

test("supabase 實作：管理金鑰只送給 Supabase；驗證登入只送公開金鑰；完成作答用條件更新", async () => {
  const calls = [];
  const fakeFetch = async (url, opt = {}) => {
    calls.push({ url: String(url), headers: opt.headers ?? {}, method: opt.method ?? "GET", body: opt.body });
    if (String(url).includes("/auth/v1/user")) return { ok: true, status: 200, json: async () => ({ id: "u1", email: "a@example.com" }) };
    if (String(url).includes("/object/sign/")) return { ok: true, status: 200, json: async () => ({ signedURL: "/object/sign/recordings/s1/full.mp3?token=T" }) };
    if (opt.method === "PATCH") return { ok: true, status: 200, json: async () => [] };
    return { ok: true, status: 200, json: async () => [] };
  };
  const s = supabaseFromEnv({ SUPABASE_URL: "https://x.supabase.co/", SUPABASE_ANON_KEY: "ANON", SUPABASE_SERVICE_ROLE_KEY: "SERVICE" }, fakeFetch);
  assert.deepEqual(await s.auth.verify("tok"), { id: "u1", email: "a@example.com" });
  assert.equal(calls[0].headers.apikey, "ANON");
  assert.equal(calls[0].headers.Authorization, "Bearer tok", "驗證登入用的是使用者自己的 token");
  assert.equal(await s.signUrl("s1/full.mp3", 3600), "https://x.supabase.co/storage/v1/object/sign/recordings/s1/full.mp3?token=T");
  assert.equal(await s.store.finishAttempt("abc", { score: 1 }), false, "沒有更新到任何一列就是已經送出過");
  const patch = calls.find((c) => c.method === "PATCH");
  assert.match(patch.url, /finished_at=is\.null/);
  for (const c of calls) assert.ok(c.url.startsWith("https://x.supabase.co/"), "只會連到 Supabase");
  assert.throws(() => supabaseFromEnv({}, fakeFetch), /缺少/);
});

test("feedback：未登入 401；格式不對 400；掛別人的 attempt 404；成功寫入且 user_id 以登入者為準", async () => {
  const { api, req } = await setup();
  const saved = [];
  // setup 的 store 沒有 addFeedback，這裡另外組一個
  const plan = await load("plan.json");
  const attempts = new Map([["att-a", { id: "att-a", user_id: "user-a", set_id: SET, finished_at: null }]]);
  const api2 = createApi({
    auth: { verify: async (t) => ({ "tok-a": { id: "user-a" }, "tok-b": { id: "user-b" } })[t] ?? null },
    store: { getAttempt: async (id) => attempts.get(id) ?? null, addFeedback: async (r) => { saved.push(r); }, getPlan: async () => plan },
    signUrl: async () => "",
  });
  assert.equal((await api2.feedback(req(null, { rating: 5 }))).status, 401);
  for (const body of [null, {}, { rating: 0 }, { rating: 6 }, { rating: 3.5 }, { audio_ok: "yes" }, { message: "x".repeat(2001) }, { message: "   " }, { attempt_id: "att-a" }]) {
    assert.equal((await api2.feedback(req("tok-a", body))).status, 400, JSON.stringify(body)?.slice(0, 30));
  }
  assert.equal((await api2.feedback(req("tok-b", { rating: 4, attempt_id: "att-a" }))).status, 404, "B 不能對 A 的 attempt 留回饋");
  assert.equal((await api2.feedback(req("tok-b", { rating: 4, attempt_id: "att-不存在" }))).status, 404);
  assert.equal(saved.length, 0);
  const ok = await api2.feedback(req("tok-a", { rating: 4, audio_ok: false, message: " 拼字聽不清楚 ", attempt_id: "att-a", user_id: "user-b" }));
  assert.equal(ok.status, 200);
  assert.deepEqual(saved, [{ user_id: "user-a", rating: 4, audio_ok: false, message: "拼字聽不清楚", attempt_id: "att-a" }]);
  assert.equal((await api2.feedback(req("tok-a", { message: "只有文字" }))).status, 200);
  assert.deepEqual(cleanFeedback({ rating: 5 }), { rating: 5 });
});

test("sets：每套附上這個人完成過的最高分；別人的紀錄不會混進來", async () => {
  const { api, req, right } = await setup();
  const before = await api.sets(req("tok-a"));
  assert.equal(before.body.sets[0].best, null);
  const a1 = (await api.start(req("tok-a", { set_id: SET }))).body.attempt_id;
  await api.finish(req("tok-a", { attempt_id: a1, answers: {} }));
  const a2 = (await api.start(req("tok-a", { set_id: SET }))).body.attempt_id;
  await api.finish(req("tok-a", { attempt_id: a2, answers: right }));
  const a = await api.sets(req("tok-a"));
  assert.deepEqual(a.body.sets[0].best, { score: Object.keys(right).length, total: Object.keys(right).length });
  assert.equal((await api.sets(req("tok-b"))).body.sets[0].best, null);
});
