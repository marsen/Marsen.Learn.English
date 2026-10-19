// 發佈（讀 Question.Generator 的打包檔）
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareBundlePublish, publishToSupabase, sanitizeTiming } from "../lib/publish.mjs";

const timing = { set_id: "s1-x-0001", total_seconds: 5, events: [
  { type: "turn", id: "t0", start: 0, end: 2, text: "secret words", speaker: "A", group: "g1" },
  { type: "pause", id: "p0", start: 2, end: 4, seconds: 2, questions: ["q1"] } ] };
function bundle({ review = { by: "x", at: "now" }, validOk = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "bun-"));
  const audio = Buffer.alloc(20_000, 3);
  writeFileSync(join(dir, "audio.mp3"), audio);
  writeFileSync(join(dir, "set.json"), JSON.stringify({
    schema_version: 1, set_id: "s1-x-0001", title: "T", topic: "x", question_count: 1,
    paper: { title: "T" }, answers: { answers: [{ question_id: "q1", answer: "Rhiannon" }] }, timing,
    audio: { file: "audio.mp3", bytes: audio.length, sha256: createHash("sha256").update(audio).digest("hex"), seconds: 5 },
    provenance: { validate: { ok: validOk }, review },
  }));
  return dir;
}

test("沒審稿：預設不能發佈；明確允許才可以，並留下警告", () => {
  const dir = bundle({ review: null });
  const a = prepareBundlePublish({ dir });
  assert.equal(a.ok, false); assert.ok(a.problems.some((p) => /審稿/.test(p)));
  const b = prepareBundlePublish({ dir, allowUnreviewed: true });
  assert.equal(b.ok, true, b.problems.join("；"));
  assert.ok(b.warnings.some((w) => /還沒審稿/.test(w)));
  assert.match(b.payload.set.audio_path, /^s1-x-0001\/full-[0-9a-f]{8}\.mp3$/);
});

test("時間軸只留頁面需要的欄位，沒有逐字稿文字與說話者；題目卷不含標準答案", () => {
  const { payload } = prepareBundlePublish({ dir: bundle() });
  const text = JSON.stringify(payload.set.timing);
  assert.ok(!text.includes('"text"') && !text.includes('"speaker"'));
  assert.deepEqual(Object.keys(payload.set.timing.events[0]).sort(), ["end", "group", "id", "start", "type"]);
  assert.ok(!JSON.stringify(payload.set).includes("Rhiannon"));
  assert.deepEqual(sanitizeTiming(timing).events[1].questions, ["q1"]);
});

test("錄音被動過、太小、驗證未過：都不能發佈", () => {
  const d1 = bundle(); writeFileSync(join(d1, "audio.mp3"), Buffer.alloc(20_000, 9));
  assert.ok(prepareBundlePublish({ dir: d1 }).problems.some((p) => /不一致/.test(p)));
  const d2 = bundle(); writeFileSync(join(d2, "audio.mp3"), "");
  assert.ok(prepareBundlePublish({ dir: d2 }).problems.some((p) => /太小/.test(p)));
  assert.ok(prepareBundlePublish({ dir: bundle({ validOk: false }) }).problems.some((p) => /驗證/.test(p)));
  assert.equal(prepareBundlePublish({ dir: join(tmpdir(), "nope-xyz") }).ok, false);
});

test("寫入順序：音檔 → sets（未發佈）→ set_answers → sets（發佈）；標準答案只進 set_answers", async () => {
  const { payload } = prepareBundlePublish({ dir: bundle() });
  const calls = [];
  const fakeFetch = async (url, opt) => { calls.push({ url: String(url), method: opt.method, body: opt.body, headers: opt.headers }); return { ok: true, status: 200, text: async () => "" }; };
  await publishToSupabase({ env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "SERVICE" }, payload, fetchImpl: fakeFetch });
  assert.deepEqual(calls.map((c) => c.url.replace("https://x.supabase.co", "").split("?")[0]), [
    `/storage/v1/object/recordings/${payload.set.audio_path}`, "/rest/v1/sets", "/rest/v1/set_answers", "/rest/v1/sets",
  ]);
  assert.equal(JSON.parse(calls[1].body).published, false);
  assert.equal(JSON.parse(calls[3].body).published, true);
  assert.ok(!calls[1].body.includes('"expected"') && !calls[1].body.includes("accepted"), "sets 不含標準答案");
  assert.ok(calls[2].body.includes("answers"));
  for (const c of calls) assert.ok(c.url.startsWith("https://x.supabase.co/"));
  const failing = async () => ({ ok: false, status: 500, text: async () => "boom" });
  await assert.rejects(() => publishToSupabase({ env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "K" }, payload, fetchImpl: failing }), /上傳錄音失敗/);
  await assert.rejects(() => publishToSupabase({ env: {}, payload, fetchImpl: fakeFetch }), /缺少/);
  assert.deepEqual(sanitizeTiming({ set_id: "a", total_seconds: 1, events: [{ type: "turn", id: "t1", start: 0, end: 1, text: "x", speaker: "A", group: 1 }] }).events[0], { type: "turn", id: "t1", start: 0, end: 1, group: 1 });
});
