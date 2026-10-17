// 本機開發用的假後端：跑的是和正式環境同一份 api/_core.mjs，只是登入、資料庫換成假的。
// 登入：任何以 "dev-" 開頭的 token 都算登入（例如 dev-alice）。資料存在記憶體，重開就清空。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createApi } from "../api/_core.mjs";
import { sanitizeTiming } from "../lib/publish.mjs";

export function makeDevApi(root) {
  const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
  const list = readJson(join(root, "scripts/dev-sets.json"));
  const dirOf = (id) => join(root, "content/sets", id);
  const attempts = new Map();
  const feedback = [];
  const mails = []; // 本機「寄出」的結果連結（不真的寄信）
  let n = 0;

  const toSet = (item) => {
    const dir = dirOf(item.id);
    const paper = readJson(join(dir, "paper.json"));
    const hasAudio = existsSync(join(dir, "audio/full.mp3")) && existsSync(join(dir, "audio/timing.json"));
    return {
      set_id: item.id, title: item.title, topic: readJson(join(dir, "plan.json")).topic, question_count: readJson(join(dir, "plan.json")).answers.length,
      paper, timing: hasAudio ? sanitizeTiming(readJson(join(dir, "audio/timing.json"))) : null,
      audio_path: hasAudio ? `content/sets/${item.id}/audio/full.mp3` : null,
    };
  };

  const store = {
    listPublishedSets: async () => list.map((i) => { const s = toSet(i); return { set_id: s.set_id, title: s.title, topic: s.topic, question_count: s.question_count }; }),
    listFinished: async (userId) => [...attempts.values()].filter((a) => a.user_id === userId && a.finished_at).map((a) => ({ set_id: a.set_id, score: a.score, total: a.total })),
    getPublishedSet: async (id) => { const i = list.find((x) => x.id === id); return i ? toSet(i) : null; },
    createAttempt: async (row) => { const a = { id: `dev-attempt-${++n}`, finished_at: null, user_id: null, email: null, mail_count: 0, ...row }; attempts.set(a.id, a); return a; },
    getAttempt: async (id) => attempts.get(id) ?? null,
    patchAttempt: async (id, patch) => { Object.assign(attempts.get(id), patch); },
    getPlan: async (setId) => (list.some((x) => x.id === setId) ? readJson(join(dirOf(setId), "plan.json")) : null),
    finishAttempt: async (id, patch) => { const a = attempts.get(id); if (!a || a.finished_at) return false; Object.assign(a, patch); return true; },
    addFeedback: async (row) => { feedback.push(row); },
  };
  // 開發登入：token 是 "dev-名字" 或 "dev-信箱"（結果連結用後者）。
  const auth = { verify: async (t) => (/^dev-[\w.@+-]+$/.test(t) ? { id: t, email: t.includes("@") ? t.slice(4) : `${t}@dev.local` } : null) };
  // 開發用寄信：把連結記下來，也回給頁面（正式環境不會回）。
  const mailer = { sendLink: async ({ email, redirectTo }) => { const link = `${redirectTo}#access_token=${encodeURIComponent(`dev-${email}`)}&expires_in=86400`; mails.push({ email, link }); return { devLink: link }; } };
  const signUrl = async (path) => `/${path}`;
  return { api: createApi({ auth, store, signUrl, mailer, siteUrl: () => "" }), attempts, feedback, mails };
}
