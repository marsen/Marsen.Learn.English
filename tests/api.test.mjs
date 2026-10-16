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
  const mails = [];
  const users = { "tok-a": { id: "user-a", email: "a@example.com" }, "tok-b": { id: "user-b", email: "B@Example.com" } };
  const store = {
    listPublishedSets: async () => [{ set_id: SET, title: "Gym", topic: "gym", question_count: 10 }],
    listFinished: async (uid) => [...attempts.values()].filter((a) => a.user_id === uid && a.finished_at).map((a) => ({ set_id: a.set_id, score: a.score, total: a.total })),
    getPublishedSet: async (id) => (id === SET ? { set_id: SET, title: "Gym", question_count: 10, paper: { rows: [] }, timing: { events: [] }, audio_path: "s1/full.mp3" } : null),
    createAttempt: async (row) => { const a = { id: `att-${attempts.size + 1}`, finished_at: null, email: null, mail_count: 0, ...row }; attempts.set(a.id, a); return { ...a }; },
    getAttempt: async (id) => (attempts.has(id) ? { ...attempts.get(id) } : null), // 和真實資料庫一樣回傳副本
    patchAttempt: async (id, patch) => { Object.assign(attempts.get(id), patch); },
    getPlan: async () => plan,
    finishAttempt: async (id, patch) => { const a = attempts.get(id); if (a.finished_at) return false; Object.assign(a, patch); return true; },
  };
  const mailer = { sendLink: async ({ email, redirectTo }) => { mails.push({ email, redirectTo }); return {}; } };
  const api = createApi({ auth: { verify: async (t) => users[t] ?? null }, store, mailer, siteUrl: () => "https://site.example", signUrl: async (p, s) => `https://signed.example/${p}?exp=${s}`, now: () => new Date("2026-10-17T00:00:00Z") });
  const req = (token, body) => ({ headers: token ? { authorization: `Bearer ${token}` } : {}, body });
  const right = Object.fromEntries(plan.answers.map((a) => [a.question_id, a.answer]));
  return { api, req, plan, attempts, right, mails };
}

// 訪客開始作答：回傳 attempt_id 與作答密鑰
const begin = async ({ api, req }, token = null) => (await api.start(req(token, { set_id: SET }))).body;

test("免登入功能：sets、start 不要登入；result、feedback 要登入（沒登入或 token 無效回 401）", async () => {
  const ctx = await setup();
  const { api, req } = ctx;
  assert.equal((await api.sets(req(null))).status, 200);
  assert.equal((await api.sets(req("壞的"))).status, 200, "token 無效當匿名，不是錯誤");
  assert.equal((await api.start(req(null, { set_id: SET }))).status, 200);
  for (const [fn, body] of [["result", { attempt_id: "att-1" }], ["feedback", { rating: 5 }]]) {
    assert.equal((await api[fn](req(null, body))).status, 401, `${fn} 沒帶 token`);
    assert.equal((await api[fn](req("壞的", body))).status, 401, `${fn} token 無效`);
  }
});

test("start：訪客拿到題目卷、時間軸、簽名網址與作答密鑰；密鑰只存雜湊；不含標準答案", async () => {
  const ctx = await setup();
  const out = await ctx.api.start(ctx.req(null, { set_id: SET }));
  assert.equal(out.status, 200);
  assert.equal(out.body.audio_url, "https://signed.example/s1/full.mp3?exp=3600");
  assert.match(out.body.claim_token, /^[0-9a-f]{48}$/);
  const row = ctx.attempts.get(out.body.attempt_id);
  assert.equal(row.user_id, null);
  assert.ok(row.claim_hash && row.claim_hash !== out.body.claim_token, "資料庫裡不是明碼");
  assert.ok(!JSON.stringify(row).includes(out.body.claim_token));
  assert.ok(!JSON.stringify(out.body).includes('"expected"'));
  assert.equal((await ctx.api.start(ctx.req(null, { set_id: "不存在" }))).status, 404);
  assert.equal((await ctx.api.start(ctx.req(null, {}))).status, 400);
  const mine = await begin(ctx, "tok-a");
  assert.equal(ctx.attempts.get(mine.attempt_id).user_id, "user-a", "已登入的人開始作答會直接綁帳號");
});

test("finish（訪客）：批改後只回 pending，不回分數與答案；密鑰不對 404；重複送出 409；格式不對 400", async () => {
  const ctx = await setup();
  const { api, req, right, attempts } = ctx;
  const a = await begin(ctx);
  assert.equal((await api.finish(req(null, { attempt_id: a.attempt_id, claim_token: "亂猜", answers: right }))).status, 404);
  assert.equal((await api.finish(req(null, { attempt_id: a.attempt_id, answers: right }))).status, 404, "沒帶密鑰也不行");
  assert.equal(attempts.get(a.attempt_id).finished_at, null, "被拒絕的不留下紀錄");
  const ok = await api.finish(req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, answers: right }));
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { pending: true, count: 10 }, "訪客看不到分數");
  assert.equal(attempts.get(a.attempt_id).score, 10, "分數已存在伺服器");
  assert.equal(attempts.get(a.attempt_id).finished_at, "2026-10-17T00:00:00.000Z");
  assert.equal((await api.finish(req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, answers: {} }))).status, 409);
  assert.equal(attempts.get(a.attempt_id).score, 10, "第二次送出不改分數");
  const b = await begin(ctx);
  for (const answers of [null, [], "x", { q1: "a" }, { q01: 5 }, { q01: "x".repeat(201) }, { name: "a" }]) {
    assert.equal((await api.finish(req(null, { attempt_id: b.attempt_id, claim_token: b.claim_token, answers }))).status, 400, JSON.stringify(answers)?.slice(0, 30));
  }
  assert.deepEqual(cleanAnswers({ q01: "a", q10: "" }), { q01: "a", q10: "" });
});

test("finish（已登入）：直接回結果；別人的 attempt 404；全空零分", async () => {
  const ctx = await setup();
  const { api, req, right, plan, attempts } = ctx;
  const a = await begin(ctx, "tok-a");
  assert.equal((await api.finish(req("tok-b", { attempt_id: a.attempt_id, answers: right }))).status, 404, "B 不能送 A 的");
  const ok = await api.finish(req("tok-a", { attempt_id: a.attempt_id, answers: right }));
  assert.equal(ok.body.total, plan.answers.length);
  assert.equal(ok.body.results[0].expected, plan.answers[0].answer);
  assert.equal(attempts.get(a.attempt_id).email, "a@example.com");
  const z = await begin(ctx, "tok-a");
  assert.equal((await api.finish(req("tok-a", { attempt_id: z.attempt_id, answers: {} }))).body.total, 0);
});

test("claim：寄出結果連結（redirect 帶作答編號，不帶分數）；信箱存小寫；密鑰不對 404；沒送出 409；格式不對 400；最多 3 次", async () => {
  const ctx = await setup();
  const { api, req, right, mails, attempts } = ctx;
  const a = await begin(ctx);
  const claim = (email, token = a.claim_token) => api.claim(req(null, { attempt_id: a.attempt_id, claim_token: token, email }));
  assert.equal((await claim("x@example.com")).status, 409, "還沒送出作答");
  await api.finish(req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, answers: right }));
  assert.equal((await claim("x@example.com", "亂猜")).status, 404);
  for (const bad of ["", "abc", "a@b", "a b@c.com", 5, null, "a@@b.com", `${"x".repeat(260)}@example.com`]) assert.equal((await claim(bad)).status, 400, String(bad).slice(0, 20));
  assert.equal(mails.length, 0);
  const ok = await claim("  Student@Example.COM ");
  assert.deepEqual(ok.body, { ok: true, email: "student@example.com", sent: 1, max: 3 });
  assert.deepEqual(mails[0], { email: "student@example.com", redirectTo: `https://site.example/exam/?result=${a.attempt_id}` });
  assert.ok(!mails[0].redirectTo.includes("score") && !mails[0].redirectTo.includes(a.claim_token));
  assert.equal(attempts.get(a.attempt_id).email, "student@example.com");
  assert.equal((await claim("fix@example.com")).body.sent, 2, "信箱打錯可以改了再寄");
  assert.equal((await claim("fix@example.com")).body.sent, 3);
  assert.equal((await claim("fix@example.com")).status, 429);
  assert.equal(mails.length, 3);
  assert.equal(attempts.get(a.attempt_id).email, "fix@example.com");
});

test("claim：寄信服務失敗時回 502／429，不洩漏內部訊息", async () => {
  const ctx = await setup();
  const a = await begin(ctx);
  await ctx.api.finish(ctx.req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, answers: ctx.right }));
  const failing = (code) => createApi({ auth: { verify: async () => null }, store: { getAttempt: async () => ({ ...ctx.attempts.get(a.attempt_id) }), patchAttempt: async () => {} }, mailer: { sendLink: async () => { throw Object.assign(new Error("secret detail"), { code }); } }, signUrl: async () => "" });
  const r1 = await failing("failed").claim(ctx.req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, email: "a@example.com" }));
  assert.equal(r1.status, 502);
  assert.ok(!JSON.stringify(r1.body).includes("secret"));
  assert.equal((await failing("rate_limited").claim(ctx.req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, email: "a@example.com" }))).status, 429);
});

test("result：要用留下的那個信箱登入才看得到；成功後綁定帳號；別的信箱與沒送出的作答都是 404", async () => {
  const ctx = await setup();
  const { api, req, right, attempts } = ctx;
  const a = await begin(ctx);
  await api.finish(req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, answers: { ...right, q01: "錯的" } }));
  await api.claim(req(null, { attempt_id: a.attempt_id, claim_token: a.claim_token, email: "a@example.com" }));
  assert.equal((await api.result(req("tok-b", { attempt_id: a.attempt_id }))).status, 404, "B 的信箱不是留下的信箱");
  assert.equal(attempts.get(a.attempt_id).user_id, null, "被拒絕的不會綁定");
  const ok = await api.result(req("tok-a", { attempt_id: a.attempt_id }));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.total, 9);
  assert.equal(ok.body.count, 10);
  assert.equal(ok.body.results.filter((r) => !r.correct).length, 1);
  assert.equal(attempts.get(a.attempt_id).user_id, "user-a");
  assert.equal((await api.result(req("tok-a", { attempt_id: a.attempt_id }))).status, 200, "之後還能再看");
  assert.equal((await api.result(req("tok-b", { attempt_id: a.attempt_id }))).status, 404, "綁定後別人還是不行");
  assert.equal((await api.result(req("tok-a", { attempt_id: "att-不存在" }))).status, 404);
  assert.equal((await api.result(req("tok-a", {}))).status, 400);
  const unfinished = await begin(ctx);
  Object.assign(attempts.get(unfinished.attempt_id), { email: "a@example.com" });
  assert.equal((await api.result(req("tok-a", { attempt_id: unfinished.attempt_id }))).status, 404, "沒送出的作答沒有結果");
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
  // 寄結果連結：只用公開金鑰，create_user:true（同學第一次就建立帳號），redirect 是呼叫端給的網址
  calls.length = 0;
  await s.mailer.sendLink({ email: "a@example.com", redirectTo: "https://site.example/exam/?result=1" });
  assert.equal(calls[0].url, "https://x.supabase.co/auth/v1/otp?redirect_to=" + encodeURIComponent("https://site.example/exam/?result=1"));
  assert.equal(calls[0].headers.apikey, "ANON");
  assert.deepEqual(JSON.parse(calls[0].body), { email: "a@example.com", create_user: true });
  assert.ok(!JSON.stringify(calls[0].headers).includes("SERVICE"), "寄信不送管理金鑰");
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

test("sets：登入後每套附上這個人完成過的最高分；訪客與別人的紀錄不會混進來", async () => {
  const ctx = await setup();
  const { api, req, right } = ctx;
  assert.equal((await api.sets(req("tok-a"))).body.sets[0].best, null);
  for (const answers of [{}, right]) {
    const a = await begin(ctx, "tok-a");
    await api.finish(req("tok-a", { attempt_id: a.attempt_id, answers }));
  }
  assert.deepEqual((await api.sets(req("tok-a"))).body.sets[0].best, { score: 10, total: 10 });
  assert.equal((await api.sets(req("tok-b"))).body.sets[0].best, null);
  assert.equal((await api.sets(req(null))).body.sets[0].best, null);
});
