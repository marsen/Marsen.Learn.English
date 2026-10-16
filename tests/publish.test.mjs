// 發佈：規則（未審稿、錄音對不上逐字稿）與寫入順序；時間軸不帶逐字稿文字。
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePublish, publishToSupabase, sanitizeTiming } from "../generator/publish.mjs";
import { content } from "./helpers.mjs";

const SRC = new URL("../content/sets/s1-gym-0002", import.meta.url).pathname;
const copy = () => { const d = join(mkdtempSync(join(tmpdir(), "pub-")), "s1-gym-0002"); cpSync(SRC, d, { recursive: true }); return d; };

test("沒審稿：預設不能發佈；明確允許才可以，並留下警告", () => {
  const dir = copy();
  const a = preparePublish({ dir, content });
  assert.equal(a.ok, false);
  assert.ok(a.problems.some((p) => /審稿/.test(p)));
  const b = preparePublish({ dir, content, allowUnreviewed: true });
  assert.equal(b.ok, true, b.problems.join("；"));
  assert.ok(b.warnings.some((w) => /還沒審稿/.test(w)));
  assert.equal(b.payload.set.question_count, 10);
  assert.match(b.payload.set.audio_path, /^s1-gym-0002\/full-[0-9a-f]{8}\.mp3$/);
});

test("時間軸只留頁面需要的欄位，沒有逐字稿文字與說話者", () => {
  const dir = copy();
  const { payload } = preparePublish({ dir, content, allowUnreviewed: true });
  const text = JSON.stringify(payload.set.timing);
  assert.ok(!text.includes('"text"') && !text.includes('"speaker"'));
  const turn = payload.set.timing.events.find((e) => e.type === "turn");
  assert.deepEqual(Object.keys(turn).sort(), ["end", "group", "id", "start", "type"]);
  assert.ok(payload.set.timing.events.some((e) => e.type === "pause" && Array.isArray(e.questions)));
  assert.ok(!JSON.stringify(payload.set).includes("Rhiannon"), "題目卷與時間軸不含標準答案");
});

test("錄音與逐字稿對不上、驗證過期、錄音檔壞掉：都不能發佈", () => {
  const dir = copy();
  const t = JSON.parse(readFileSync(join(dir, "audio/timing.json"), "utf8"));
  t.events.find((e) => e.type === "turn").text += " changed";
  writeFileSync(join(dir, "audio/timing.json"), JSON.stringify(t));
  const r = preparePublish({ dir, content, allowUnreviewed: true });
  assert.ok(r.problems.some((p) => /對不上/.test(p)));
  const dir2 = copy();
  writeFileSync(join(dir2, "script.json"), readFileSync(join(dir2, "script.json"), "utf8").replace("Good afternoon", "Good evening"));
  const r2 = preparePublish({ dir: dir2, content, allowUnreviewed: true });
  assert.ok(r2.problems.some((p) => /驗證/.test(p)));
  const dir3 = copy();
  writeFileSync(join(dir3, "audio/full.mp3"), "");
  const r3 = preparePublish({ dir: dir3, content, allowUnreviewed: true });
  assert.ok(r3.problems.some((p) => /太小/.test(p)));
});

test("寫入順序：音檔 → sets（未發佈）→ set_answers → sets（發佈）；標準答案只進 set_answers", async () => {
  const dir = copy();
  const { payload } = preparePublish({ dir, content, allowUnreviewed: true });
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
