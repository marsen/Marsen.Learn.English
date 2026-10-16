// 發佈：把審過、有錄音的題組送到 Supabase。
// 規則：驗證要是最新且通過；有 audio/full.mp3 與 timing.json，且時間軸的每一輪都對得上逐字稿；
//       沒審稿（review）預設不能發佈，要明確加 allowUnreviewed。
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkChain, hasMeta, loadMeta, readSet } from "./meta.mjs";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// 時間軸只留頁面需要的欄位：不帶逐字稿文字與說話者。
export function sanitizeTiming(timing) {
  return {
    set_id: timing.set_id,
    total_seconds: timing.total_seconds,
    events: timing.events.map((e) => {
      const { type, id, start, end, questions, seconds, group } = e;
      return Object.fromEntries(Object.entries({ type, id, start, end, questions, seconds, group }).filter(([, v]) => v !== undefined));
    }),
  };
}

export function preparePublish({ dir, content, allowUnreviewed = false }) {
  const problems = [];
  const warnings = [];
  const need = (f) => existsSync(join(dir, f));
  for (const f of ["meta.json", "paper.json", "plan.json", "script.json", "audio/full.mp3", "audio/timing.json"]) {
    if (!need(f)) problems.push(`缺少 ${f}`);
  }
  if (problems.length) return { ok: false, problems, warnings };

  const meta = loadMeta(dir);
  const chain = checkChain(meta, readSet(dir), content);
  const st = Object.fromEntries(chain.map((o) => [o.stage, o]));
  if (st.validate.state !== "ok") problems.push(`驗證不是最新且通過（${st.validate.state}${st.validate.reason ? "：" + st.validate.reason : ""}）`);
  if (st.review.state !== "ok") {
    if (allowUnreviewed) warnings.push(`還沒審稿（${st.review.state}），依 allowUnreviewed 繼續`);
    else problems.push(`還沒審稿（${st.review.state}${st.review.reason ? "：" + st.review.reason : ""}）。要發佈未審稿的題組請明確加 --allow-unreviewed`);
  }

  const script = readJson(join(dir, "script.json"));
  const timing = readJson(join(dir, "audio/timing.json"));
  if (timing.set_id !== meta.set_id) problems.push(`時間軸的題組是 ${timing.set_id}，不是 ${meta.set_id}`);
  const spoken = timing.events.filter((e) => e.type === "turn").map((e) => e.text);
  const wanted = script.turns.map((t) => t.text);
  if (spoken.length !== wanted.length || spoken.some((t, i) => t !== wanted[i])) problems.push("錄音與逐字稿對不上（逐字稿改過就要重做錄音）");
  if (problems.length) return { ok: false, problems, warnings };

  const paper = readJson(join(dir, "paper.json"));
  const plan = readJson(join(dir, "plan.json"));
  const audio = readFileSync(join(dir, "audio/full.mp3"));
  if (audio.length < 10_000) return { ok: false, problems: ["錄音檔太小，可能是壞的"], warnings };
  const hash = createHash("sha256").update(audio).digest("hex").slice(0, 8);
  const setId = meta.set_id;
  return {
    ok: true, problems, warnings,
    payload: {
      set: { set_id: setId, title: paper.title, topic: plan.topic, question_count: plan.answers.length, paper, timing: sanitizeTiming(timing), audio_path: `${setId}/full-${hash}.mp3` },
      answers: { set_id: setId, plan },
      audio,
    },
  };
}

// 寫入順序：音檔 → sets（未發佈）→ set_answers → sets（發佈）。中途失敗不會留下「已發佈但沒有答案」的題組。
export async function publishToSupabase({ env = process.env, payload, fetchImpl = fetch }) {
  const url = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 SUPABASE_URL／SUPABASE_SERVICE_ROLE_KEY");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const must = async (res, what) => { if (!res.ok) throw new Error(`${what}失敗：${res.status} ${await res.text().catch(() => "")}`); };
  const upsert = (table, row) => fetchImpl(`${url}/rest/v1/${table}?on_conflict=${table === "sets" ? "set_id" : "set_id"}`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(row),
  });

  await must(await fetchImpl(`${url}/storage/v1/object/recordings/${payload.set.audio_path}`, {
    method: "POST", headers: { ...headers, "Content-Type": "audio/mpeg", "x-upsert": "true" }, body: payload.audio,
  }), "上傳錄音");
  await must(await upsert("sets", { ...payload.set, published: false }), "寫入題組");
  await must(await upsert("set_answers", payload.answers), "寫入標準答案");
  await must(await upsert("sets", { ...payload.set, published: true, published_at: new Date().toISOString() }), "發佈題組");
}
