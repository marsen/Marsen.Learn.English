// 登入模組：email 登入連結、token 保存與換新、本機開發登入的限制。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuth, AuthError } from "../exam/auth.mjs";

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };
const cfg = { supabaseUrl: "https://x.supabase.co/", supabaseAnonKey: "ANON" };
const loc = (hash = "", hostname = "app.example.com") => ({ hash, hostname, origin: `https://${hostname}`, pathname: "/exam/", search: "" });
const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

test("signIn：用公開金鑰寄連結；只寄給已邀請的人（create_user:false）；各種失敗有明確代碼", async () => {
  const calls = [];
  const status = { v: 200 };
  const fetchImpl = async (url, opt) => { calls.push({ url, opt }); return { ok: status.v < 300, status: status.v }; };
  const a = createAuth({ config: cfg, fetchImpl, storage: mem(), location: loc() });
  await a.signIn("a@example.com");
  assert.equal(calls[0].url, "https://x.supabase.co/auth/v1/otp?redirect_to=" + encodeURIComponent("https://app.example.com/exam/"));
  assert.equal(calls[0].opt.headers.apikey, "ANON");
  assert.deepEqual(JSON.parse(calls[0].opt.body), { email: "a@example.com", create_user: false });
  for (const [st, code] of [[422, "not_invited"], [400, "not_invited"], [429, "rate_limited"], [500, "failed"]]) {
    status.v = st;
    await assert.rejects(() => a.signIn("a@example.com"), (e) => e instanceof AuthError && e.code === code);
  }
  const none = createAuth({ config: { supabaseUrl: "", supabaseAnonKey: "" }, fetchImpl, storage: mem(), location: loc() });
  await assert.rejects(() => none.signIn("a@example.com"), (e) => e.code === "not_configured");
});

test("consumeHash：連結帶回 token 就存起來並取得 email；錯誤連結回傳原因；沒有 hash 回傳 null", async () => {
  const storage = mem();
  const token = jwt({ email: "a@example.com" });
  const a = createAuth({ config: cfg, fetchImpl: async () => { throw new Error("不該呼叫"); }, storage, location: loc(`#access_token=${token}&refresh_token=R&expires_in=3600&type=magiclink`), now: () => 1_000_000 });
  assert.equal(a.consumeHash(), "ok");
  assert.equal(await a.token(), token);
  assert.equal(a.email(), "a@example.com");
  assert.equal(JSON.parse(storage.m.get("exam-auth")).expires_at, 1000 + 3600);
  const bad = createAuth({ config: cfg, storage: mem(), location: loc("#error=access_denied&error_description=Email+link+is+invalid+or+has+expired") });
  assert.deepEqual(bad.consumeHash(), { error: "Email link is invalid or has expired" });
  assert.equal(createAuth({ config: cfg, storage: mem(), location: loc("") }).consumeHash(), null);
  assert.equal(createAuth({ config: cfg, storage: mem(), location: loc("#section") }).consumeHash(), null);
});

test("token：快過期（60 秒內）用 refresh token 換新；換不到就登出；signOut 清掉", async () => {
  const storage = mem();
  let t = 0;
  const calls = [];
  const fetchImpl = async (url, opt) => { calls.push(url); return t < 5000 ? { ok: true, json: async () => ({ access_token: "NEW", refresh_token: "R2", expires_in: 3600 }) } : { ok: false }; };
  const a = createAuth({ config: cfg, fetchImpl, storage, location: loc(), now: () => t * 1000 });
  storage.setItem("exam-auth", JSON.stringify({ access_token: "OLD", refresh_token: "R1", expires_at: 100 }));
  assert.equal(await a.token(), "OLD", "還沒到換新時間");
  t = 50;
  assert.equal(await a.token(), "NEW");
  assert.match(calls[0], /grant_type=refresh_token/);
  assert.equal(JSON.parse(storage.m.get("exam-auth")).refresh_token, "R2");
  t = 9000;
  assert.equal(await a.token(), null, "換新被拒絕");
  assert.equal(storage.m.get("exam-auth"), undefined);
  storage.setItem("exam-auth", JSON.stringify({ access_token: "X", expires_at: 10 ** 10 }));
  a.signOut();
  assert.equal(await a.token(), null);
});

test("本機開發登入：只在 localhost 且沒設定 Supabase 時可用", async () => {
  const local = createAuth({ config: { supabaseUrl: "", supabaseAnonKey: "" }, storage: mem(), location: loc("", "127.0.0.1") });
  assert.equal(local.isLocalDev, true);
  local.devLogin("alice");
  assert.equal(await local.token(), "dev-alice");
  const remote = createAuth({ config: { supabaseUrl: "", supabaseAnonKey: "" }, storage: mem(), location: loc("", "app.example.com") });
  assert.equal(remote.isLocalDev, false);
  assert.throws(() => remote.devLogin(), (e) => e.code === "dev_only");
  const configured = createAuth({ config: cfg, storage: mem(), location: loc("", "localhost") });
  assert.equal(configured.isLocalDev, false, "設定了 Supabase 就不是開發模式，即使在 localhost");
  assert.throws(() => configured.devLogin(), (e) => e.code === "dev_only");
});

test("storage 不能用（無痕模式等）：這個分頁內仍維持登入，不丟例外", async () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  const a = createAuth({ config: { supabaseUrl: "", supabaseAnonKey: "" }, storage: broken, location: loc("", "localhost") });
  a.devLogin("bob");
  assert.equal(await a.token(), "dev-bob");
  a.signOut();
  assert.equal(await a.token(), null);
});
