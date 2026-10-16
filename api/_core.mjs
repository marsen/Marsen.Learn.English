// M5 伺服器函式的核心邏輯。不碰網路、不碰 Vercel：登入驗證、資料庫、寄信、簽名網址都由外面傳進來，方便測試。
// 流程：免登入開始作答 → 送出（只存、不回分數）→ 留信箱 → 寄結果連結（點連結同時完成信箱驗證與登入）→ 看結果。
import { createHash, randomBytes } from "node:crypto";
import { gradeAnswers } from "../generator/grade.mjs";

const QID = /^q\d{2}$/;
const MAX_ANSWER = 200;
const MAX_MAILS = 3; // 每次作答最多寄 3 封結果連結（含改信箱重寄）
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

const json = (status, body) => ({ status, body });
const bearer = (req) => /^Bearer (.+)$/.exec(req.headers?.authorization ?? req.headers?.Authorization ?? "")?.[1] ?? null;
const sha = (s) => createHash("sha256").update(s).digest("hex");

// 作答內容只收 { q01: "文字" }，每題最多 200 字；其他一律拒絕。
export function cleanAnswers(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!QID.test(k) || typeof v !== "string" || v.length > MAX_ANSWER) return null;
    out[k] = v;
  }
  return out;
}

export function cleanEmail(raw) {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

// 回饋：評分 1 到 5、錄音清不清楚、自由文字（最多 2000 字）；至少填一項。
export function cleanFeedback(b) {
  if (!b || typeof b !== "object") return null;
  const out = {};
  if (b.rating !== undefined && b.rating !== null) { if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) return null; out.rating = b.rating; }
  if (b.audio_ok !== undefined && b.audio_ok !== null) { if (typeof b.audio_ok !== "boolean") return null; out.audio_ok = b.audio_ok; }
  if (b.message !== undefined && b.message !== null) { if (typeof b.message !== "string" || b.message.length > 2000) return null; if (b.message.trim()) out.message = b.message.trim(); }
  if (b.attempt_id !== undefined && b.attempt_id !== null) { if (typeof b.attempt_id !== "string") return null; out.attempt_id = b.attempt_id; }
  return Object.keys(out).some((k) => k !== "attempt_id") ? out : null;
}

export function createApi({ auth, store, signUrl, mailer, siteUrl = () => "", now = () => new Date() }) {
  // 有帶有效登入 token 才算登入；沒帶或無效都當匿名（不是錯誤，因為大部分功能不用登入）。
  const optionalUser = async (req) => {
    const token = bearer(req);
    if (!token) return null;
    return (await auth.verify(token).catch(() => null)) ?? null;
  };
  const needUser = async (req) => optionalUser(req);
  // 這次作答是不是這個人的：作答密鑰對得上，或已登入且是自己的。
  const owns = (attempt, user, claimToken) =>
    (typeof claimToken === "string" && claimToken && attempt.claim_hash === sha(claimToken)) || (user && attempt.user_id === user.id);

  return {
    // GET /api/sets  免登入；有登入就附上這個人每套的最高分 best
    async sets(req) {
      const user = await optionalUser(req);
      const sets = await store.listPublishedSets();
      const best = new Map();
      if (user) for (const f of await store.listFinished(user.id)) { const b = best.get(f.set_id); if (!b || f.score > b.score) best.set(f.set_id, { score: f.score, total: f.total }); }
      return json(200, { sets: sets.map((s) => ({ ...s, best: best.get(s.set_id) ?? null })) });
    },

    // POST /api/start { set_id }  免登入。回傳作答密鑰 claim_token（只回這一次，之後送出、留信箱都要帶）
    async start(req) {
      const user = await optionalUser(req);
      const setId = req.body?.set_id;
      if (typeof setId !== "string") return json(400, { error: "缺少 set_id" });
      const set = await store.getPublishedSet(setId);
      if (!set) return json(404, { error: "找不到這個題組" });
      const claimToken = randomBytes(24).toString("hex");
      const attempt = await store.createAttempt({ user_id: user?.id ?? null, set_id: setId, claim_hash: sha(claimToken), client: req.body?.client ?? null });
      const audioUrl = set.audio_path ? await signUrl(set.audio_path, 3600) : null; // 開發用：沒有錄音的題組也能試版面
      return json(200, { attempt_id: attempt.id, claim_token: claimToken, set_id: set.set_id, title: set.title, question_count: set.question_count, paper: set.paper, timing: set.timing, audio_url: audioUrl });
    },

    // POST /api/finish { attempt_id, claim_token, answers }
    // 已登入：批改並直接回結果。沒登入：批改並存起來，只回 { pending: true }，結果要驗證信箱後才看得到。
    async finish(req) {
      const user = await optionalUser(req);
      const { attempt_id: attemptId, claim_token: claimToken } = req.body ?? {};
      const answers = cleanAnswers(req.body?.answers);
      if (typeof attemptId !== "string" || !answers) return json(400, { error: "作答內容格式不對" });
      const attempt = await store.getAttempt(attemptId);
      // 不是自己的 attempt 一律回 404，不透露它存不存在。
      if (!attempt || !owns(attempt, user, claimToken)) return json(404, { error: "找不到這次作答" });
      if (attempt.finished_at) return json(409, { error: "這次作答已經送出過了" });
      const plan = await store.getPlan(attempt.set_id);
      if (!plan) return json(500, { error: "題組缺少標準答案" });
      const result = gradeAnswers(plan, answers);
      const saved = await store.finishAttempt(attemptId, { answers, score: result.total, total: result.count, results: result.results, finished_at: now().toISOString(), ...(user ? { user_id: user.id, email: user.email?.toLowerCase() ?? null } : {}) });
      if (!saved) return json(409, { error: "這次作答已經送出過了" }); // 兩個請求同時送出，只有一個會成功
      return user ? json(200, result) : json(200, { pending: true, count: result.count });
    },

    // POST /api/claim { attempt_id, claim_token, email }  留信箱：寄出結果連結（點連結 = 驗證信箱 + 登入）
    async claim(req) {
      const { attempt_id: attemptId, claim_token: claimToken } = req.body ?? {};
      const email = cleanEmail(req.body?.email);
      if (typeof attemptId !== "string") return json(400, { error: "缺少作答編號" });
      if (!email) return json(400, { error: "信箱格式不對" });
      const attempt = await store.getAttempt(attemptId);
      if (!attempt || !owns(attempt, null, claimToken)) return json(404, { error: "找不到這次作答" });
      if (!attempt.finished_at) return json(409, { error: "還沒送出作答" });
      if (attempt.mail_count >= MAX_MAILS) return json(429, { error: "這次作答的結果連結已寄過太多次了，請查看信箱（含垃圾郵件）" });
      const sent = attempt.mail_count + 1;
      await store.patchAttempt(attemptId, { email, mail_count: sent });
      const link = await mailer.sendLink({ email, redirectTo: `${siteUrl(req)}/exam/?result=${encodeURIComponent(attemptId)}` }).catch((e) => ({ error: e }));
      if (link?.error) return json(link.error.code === "rate_limited" ? 429 : 502, { error: link.error.code === "rate_limited" ? "寄信太頻繁，請稍後再試" : "寄信失敗，請稍後再試" });
      return json(200, { ok: true, email, sent, max: MAX_MAILS, ...(link?.devLink ? { dev_link: link.devLink } : {}) });
    },

    // POST /api/result { attempt_id }  需要登入；登入信箱必須就是留下的信箱（或已綁定的帳號）
    async result(req) {
      const user = await needUser(req);
      if (!user) return json(401, { error: "請先用結果連結登入" });
      const attemptId = req.body?.attempt_id;
      if (typeof attemptId !== "string") return json(400, { error: "缺少作答編號" });
      const attempt = await store.getAttempt(attemptId);
      const mine = attempt && attempt.finished_at && (attempt.user_id === user.id || (attempt.email && user.email && attempt.email === user.email.toLowerCase()));
      if (!mine) return json(404, { error: "找不到這次作答的結果（請用留信箱時的那個信箱登入）" });
      if (attempt.user_id !== user.id) await store.patchAttempt(attemptId, { user_id: user.id });
      return json(200, { set_id: attempt.set_id, total: attempt.score, count: attempt.total, results: attempt.results });
    },

    // POST /api/feedback { rating?, audio_ok?, message?, attempt_id? }  需要登入（看過結果的人）
    async feedback(req) {
      const user = await needUser(req);
      if (!user) return json(401, { error: "請先登入" });
      const fb = cleanFeedback(req.body);
      if (!fb) return json(400, { error: "回饋內容格式不對（至少填一項，評分 1 到 5，文字最多 2000 字）" });
      if (fb.attempt_id) {
        const attempt = await store.getAttempt(fb.attempt_id);
        if (!attempt || attempt.user_id !== user.id) return json(404, { error: "找不到這次作答" });
      }
      await store.addFeedback({ user_id: user.id, ...fb });
      return json(200, { ok: true });
    },
  };
}
