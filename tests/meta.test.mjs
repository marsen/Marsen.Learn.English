import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newMeta, stamp, saveMeta, loadMeta, readSet, checkChain, deriveStatus, accept, retryAllowed } from "../generator/meta.mjs";
import { content } from "./helpers.mjs";
import { makeArtifactInfo } from "../generator/artifact.mjs";

const SRC = join(import.meta.dirname, "fixtures", "set-sample");
const wj = (dir, f, fn) => { const p = join(dir, f); const o = JSON.parse(readFileSync(p, "utf8")); fn(o); writeFileSync(p, JSON.stringify(o, null, 2)); };

// 建一份全新、已登記到盲答的題組（複製自真實題組）
function fresh() {
  const dir = mkdtempSync(join(tmpdir(), "set-"));
  cpSync(SRC, dir, { recursive: true });
  const set = readSet(dir);
  const meta = newMeta({ dir, skeleton: set.skeleton });
  // 樣本是舊的抽籤結果，輸入指紋以「目前的內容」為準，測試才不會隨主題檔修改而失效
  meta.inputs = makeArtifactInfo({ topic: content.topics.find((t) => t.id === set.skeleton.topic), recipes: content.recipes, profile: content.profile }).inputs;
  stamp(meta, set, "skeleton"); stamp(meta, set, "plan", { model: "t" }); stamp(meta, set, "script", { model: "t" }); stamp(meta, set, "paper");
  stamp(meta, set, "validate", { ok: true, block: 0, warn: 0 });
  stamp(meta, set, "blind", { model: "t", warnings: 0 });
  saveMeta(dir, meta, set);
  return { dir, meta };
}
const state = (dir, meta) => Object.fromEntries(checkChain(meta, readSet(dir), content).map((o) => [o.stage, o.state]));

test("全新登記：整條鏈都是最新，狀態 blind_passed", () => {
  const { dir, meta } = fresh();
  const s = state(dir, meta);
  for (const k of ["skeleton", "plan", "script", "paper", "validate", "blind"]) assert.equal(s[k], "ok", k);
  assert.equal(deriveStatus(checkChain(meta, readSet(dir), content)), "blind_passed");
  rmSync(dir, { recursive: true });
});

test("主題檔改了：骨架過期，下游全部標過期", () => {
  const { dir, meta } = fresh();
  const changed = { ...content, topics: content.topics.map((t) => (t.id === "library-card" ? { ...t, title: t.title + "x" } : t)) };
  const s = Object.fromEntries(checkChain(meta, readSet(dir), changed).map((o) => [o.stage, o.state]));
  assert.equal(s.skeleton, "stale");
  for (const k of ["plan", "script", "validate", "blind"]) assert.equal(s[k], "stale", k);
  rmSync(dir, { recursive: true });
});

test("手動改 plan：plan 過期，逐字稿也過期；accept 之後 plan 恢復、逐字稿仍過期（因為它依據的 plan 已變）", () => {
  const { dir, meta } = fresh();
  wj(dir, "plan.json", (p) => { p.answers[0].answer += "x"; });
  let s = state(dir, meta);
  assert.equal(s.plan, "stale"); assert.equal(s.script, "stale"); assert.equal(s.validate, "stale");
  accept(meta, readSet(dir), "plan", "測試修改");
  s = state(dir, meta);
  assert.equal(s.plan, "ok"); assert.equal(s.script, "stale");
  assert.equal(meta.stages.plan.edits.length, 1);
  rmSync(dir, { recursive: true });
});

test("手動改逐字稿：驗證與盲答過期，但 plan 不受影響", () => {
  const { dir, meta } = fresh();
  wj(dir, "script.json", (s) => { s.turns[0].text += " ok"; });
  const s = state(dir, meta);
  assert.equal(s.plan, "ok"); assert.equal(s.script, "stale"); assert.equal(s.validate, "stale"); assert.equal(s.blind, "stale");
  accept(meta, readSet(dir), "script", "改開場");
  assert.equal(state(dir, meta).script, "ok");
  assert.equal(state(dir, meta).blind, "stale");
  rmSync(dir, { recursive: true });
});

test("prompt 版本變了：用舊 prompt 產的階段過期；版本未記錄（補登記）則不誤判", () => {
  const { dir, meta } = fresh();
  meta.stages.script.prompt = "deadbeefdeadbeef";
  assert.equal(state(dir, meta).script, "stale");
  meta.stages.script.prompt = null;
  assert.equal(state(dir, meta).script, "ok");
  rmSync(dir, { recursive: true });
});

test("驗證失敗後重寫：計次，滿 2 次就不允許再重寫", () => {
  const { dir, meta } = fresh();
  for (let i = 1; i <= 2; i++) {
    stamp(meta, readSet(dir), "validate", { ok: false, block: 1, warn: 0 });
    assert.equal(retryAllowed(meta, "script"), true, `第 ${i} 次重寫前`);
    wj(dir, "script.json", (s) => { s.turns[0].text += ` v${i}`; });
    stamp(meta, readSet(dir), "script", { model: "t" });
    assert.equal(meta.retries.script, i);
  }
  stamp(meta, readSet(dir), "validate", { ok: false, block: 1, warn: 0 });
  assert.equal(retryAllowed(meta, "script"), false);
  rmSync(dir, { recursive: true });
});

test("驗證通過後再改逐字稿不算重寫次數", () => {
  const { dir, meta } = fresh();
  wj(dir, "script.json", (s) => { s.turns[0].text += " y"; });
  stamp(meta, readSet(dir), "script", { model: "t" });
  assert.equal(meta.retries.script, 0);
  rmSync(dir, { recursive: true });
});

test("盲答有警示：狀態停在 validated，審核後變 reviewed；審核後改逐字稿則審核過期", () => {
  const { dir, meta } = fresh();
  stamp(meta, readSet(dir), "blind", { model: "t", warnings: 2 });
  assert.equal(deriveStatus(checkChain(meta, readSet(dir), content)), "validated");
  stamp(meta, readSet(dir), "review", { by: "me" });
  assert.equal(deriveStatus(checkChain(meta, readSet(dir), content)), "reviewed");
  wj(dir, "script.json", (s) => { s.turns[0].text += " z"; });
  assert.notEqual(deriveStatus(checkChain(meta, readSet(dir), content)), "reviewed");
  rmSync(dir, { recursive: true });
});

test("輸入（主題檔）改了：狀態要退回，不能還顯示 blind_passed", () => {
  const { dir, meta } = fresh();
  const changed = { ...content, topics: content.topics.map((t) => (t.id === "library-card" ? { ...t, title: t.title + "x" } : t)) };
  const saved = saveMeta(dir, meta, readSet(dir), new Date(), changed);
  assert.equal(saved.status, "none");
  rmSync(dir, { recursive: true });
});
