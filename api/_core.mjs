// M5 伺服器函式的核心邏輯。不碰網路、不碰 Vercel：登入驗證、資料庫、簽名網址都由外面傳進來，方便測試。
import { gradeAnswers } from "../generator/grade.mjs";

const QID = /^q\d{2}$/;
const MAX_ANSWER = 200;

const json = (status, body) => ({ status, body });
const bearer = (req) => /^Bearer (.+)$/.exec(req.headers?.authorization ?? req.headers?.Authorization ?? "")?.[1] ?? null;

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

export function createApi({ auth, store, signUrl, now = () => new Date() }) {
  const needUser = async (req) => {
    const token = bearer(req);
    if (!token) return null;
    return (await auth.verify(token).catch(() => null)) ?? null;
  };

  return {
    // GET /api/sets
    async sets(req) {
      const user = await needUser(req);
      if (!user) return json(401, { error: "請先登入" });
      const [sets, finished] = await Promise.all([store.listPublishedSets(), store.listFinished(user.id)]);
      // best：這個人在該題組完成過的最高分；沒做過是 null。
      const best = new Map();
      for (const f of finished) { const b = best.get(f.set_id); if (!b || f.score > b.score) best.set(f.set_id, { score: f.score, total: f.total }); }
      return json(200, { sets: sets.map((s) => ({ ...s, best: best.get(s.set_id) ?? null })) });
    },

    // POST /api/start { set_id }
    async start(req) {
      const user = await needUser(req);
      if (!user) return json(401, { error: "請先登入" });
      const setId = req.body?.set_id;
      if (typeof setId !== "string") return json(400, { error: "缺少 set_id" });
      const set = await store.getPublishedSet(setId);
      if (!set) return json(404, { error: "找不到這個題組" });
      const attempt = await store.createAttempt({ user_id: user.id, set_id: setId, client: req.body?.client ?? null });
      const audioUrl = set.audio_path ? await signUrl(set.audio_path, 3600) : null; // 開發用：沒有錄音的題組也能試版面
      return json(200, { attempt_id: attempt.id, set_id: set.set_id, title: set.title, question_count: set.question_count, paper: set.paper, timing: set.timing, audio_url: audioUrl });
    },

    // POST /api/feedback { rating?, audio_ok?, message?, attempt_id? }
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

    // POST /api/finish { attempt_id, answers }
    async finish(req) {
      const user = await needUser(req);
      if (!user) return json(401, { error: "請先登入" });
      const { attempt_id: attemptId } = req.body ?? {};
      const answers = cleanAnswers(req.body?.answers);
      if (typeof attemptId !== "string" || !answers) return json(400, { error: "作答內容格式不對" });
      const attempt = await store.getAttempt(attemptId);
      // 不是自己的 attempt 一律回 404，不透露它存不存在。
      if (!attempt || attempt.user_id !== user.id) return json(404, { error: "找不到這次作答" });
      if (attempt.finished_at) return json(409, { error: "這次作答已經送出過了" });
      const plan = await store.getPlan(attempt.set_id);
      if (!plan) return json(500, { error: "題組缺少標準答案" });
      const result = gradeAnswers(plan, answers);
      const saved = await store.finishAttempt(attemptId, { answers, score: result.total, total: result.count, results: result.results, finished_at: now().toISOString() });
      if (!saved) return json(409, { error: "這次作答已經送出過了" }); // 兩個請求同時送出，只有一個會成功
      return json(200, result);
    },
  };
}
