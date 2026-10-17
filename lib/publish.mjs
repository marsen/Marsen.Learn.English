// 發佈：把 Question.Generator 打包出來的題組（set.json + audio.mp3）送到 Supabase。
// 這裡不做題目品質的檢查（那是產題工具打包前的事），只驗打包檔完整、錄音沒被動過；
// 沒審稿的題組預設不能發佈，要明確加 allowUnreviewed。
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SUPPORTED_SCHEMA = 1;

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

export function prepareBundlePublish({ dir, allowUnreviewed = false }) {
  const problems = [];
  const warnings = [];
  const setPath = join(dir, "set.json");
  if (!existsSync(setPath)) return { ok: false, problems: [`缺少 ${setPath}`], warnings };
  const b = JSON.parse(readFileSync(setPath, "utf8"));
  if (b.schema_version !== SUPPORTED_SCHEMA) return { ok: false, problems: [`不支援的 schema_version：${b.schema_version}`], warnings };
  const audioPath = join(dir, b.audio?.file ?? "audio.mp3");
  if (!existsSync(audioPath)) return { ok: false, problems: [`缺少 ${audioPath}`], warnings };
  const audio = readFileSync(audioPath);
  const sha = createHash("sha256").update(audio).digest("hex");
  if (audio.length !== b.audio.bytes || sha !== b.audio.sha256) problems.push("錄音檔與 set.json 記載的不一致");
  if (audio.length < 10_000) problems.push("錄音檔太小，可能是壞的");
  if (!b.provenance?.validate?.ok) problems.push("打包檔記錄的驗證不是通過");
  if (!b.provenance?.review) {
    if (allowUnreviewed) warnings.push("還沒審稿，依 allowUnreviewed 繼續");
    else problems.push("還沒審稿。要發佈未審稿的題組請明確加 --allow-unreviewed");
  }
  if (problems.length) return { ok: false, problems, warnings };
  return {
    ok: true, problems, warnings,
    payload: {
      set: { set_id: b.set_id, title: b.title, topic: b.topic, question_count: b.question_count, paper: b.paper, timing: sanitizeTiming(b.timing), audio_path: `${b.set_id}/full-${sha.slice(0, 8)}.mp3` },
      answers: { set_id: b.set_id, plan: b.answers },
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
