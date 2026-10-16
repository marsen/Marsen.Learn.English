import test from "node:test";
import { fieldsOf, fieldOrder } from "../generator/lib/template.mjs";
import assert from "node:assert/strict";
import { draw, drawFromTopic, DrawError } from "../generator/draw.mjs";
import { staleInputs } from "../generator/artifact.mjs";
import { content, topic } from "./helpers.mjs";

const { recipes, profile } = content;
// 既有測試針對圖書館辦證；多主題的行為另有測試
const topics = content.topics.filter((t) => t.id === "library-card");
const run = (seed, extra = {}) => draw({ seed, topics, recipes, profile, ...extra });

test("主題檔結構：每個情境至少 18 個欄位、2 個變體", () => {
  assert.ok(topic.variants.length >= 2);
  for (const v of topic.variants) {
    const n = topic.fields_pool.filter((f) => !f.only_variants || f.only_variants.includes(v.id)).length;
    assert.ok(n >= 18, `${v.id} 只有 ${n} 個欄位`);
  }
  const rowFields = topic.form.rows.flatMap((r) => fieldsOf(r));
  assert.deepEqual([...rowFields].sort(), topic.fields_pool.map((f) => f.field_id).sort());
});

test("配方：每個配方的陷阱數量加起來剛好 10", () => {
  for (const r of recipes) assert.equal(Object.values(r.traps).reduce((a, b) => a + b, 0), 10, r.id);
});

test("同一個種子抽兩次，骨架完全相同", () => {
  for (const seed of [1, 42, 20261016]) assert.deepEqual(run(seed), run(seed));
});

test("不同種子，骨架有差異", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) seen.add(JSON.stringify(run(seed).slots.map((s) => s.field_id + s.trap)));
  assert.ok(seen.size >= 25, `30 個種子只產生 ${seen.size} 種骨架`);
  assert.ok(new Set(Array.from({ length: 30 }, (_, i) => run(i + 1).recipe)).size === 3);
});

test("骨架性質：10 題、題號連續、順序與表格一致、陷阱符合配方且為欄位允許、成組欄位不拆", () => {
  const rowIndex = fieldOrder(topic);
  for (let seed = 1; seed <= 300; seed++) {
    const sk = run(seed);
    const recipe = recipes.find((r) => r.id === sk.recipe);
    assert.equal(sk.slots.length, 10);
    sk.slots.forEach((s, i) => {
      assert.equal(s.question_id, `q${String(i + 1).padStart(2, "0")}`);
      const f = topic.fields_pool.find((x) => x.field_id === s.field_id);
      assert.ok(f.allowed_traps.includes(s.trap), `${s.field_id} 不允許 ${s.trap}`);
      assert.ok(!f.only_variants || f.only_variants.includes(sk.variant));
      if (i) assert.ok(rowIndex.get(s.field_id) > rowIndex.get(sk.slots[i - 1].field_id));
    });
    for (const [trap, n] of Object.entries(recipe.traps)) assert.equal(sk.slots.filter((s) => s.trap === trap).length, n, `${sk.recipe} ${trap}`);
    const fields = sk.slots.map((s) => s.field_id);
    assert.equal(fields.includes("house_number"), fields.includes("street_name"), "address 組被拆開");
  }
});

test("不連續兩份用同一個配方", () => {
  for (let seed = 1; seed <= 50; seed++) assert.notEqual(run(seed, { previousRecipe: "R2" }).recipe, "R2");
});

test("指定情境變體：居民不會抽到學生欄位", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const sk = run(seed, { variantId: "resident" });
    assert.ok(!sk.slots.some((s) => ["student_number", "course"].includes(s.field_id)));
  }
});

test("配方排不出來：回報 NO_ELIGIBLE_CANDIDATE，不硬湊", () => {
  const poor = { ...topic, fields_pool: topic.fields_pool.map((f) => ({ ...f, allowed_traps: f.allowed_traps.filter((t) => t !== "spelling") })) };
  assert.throws(() => drawFromTopic({ seed: 1, topic: poor, recipes: [recipes[0]], profile, variantId: "student" }), (e) => e instanceof DrawError && e.code === "NO_ELIGIBLE_CANDIDATE");
});

test("主題冷卻：冷卻中的主題不被抽到，全部冷卻就報錯", () => {
  const p = { ...profile, topic_cooldown_days: { value: 90 } };
  const history = [{ topic: "library-card", drawn_at: new Date().toISOString() }];
  assert.throws(() => draw({ seed: 1, topics, recipes, profile: p, history }), (e) => e.code === "NO_ELIGIBLE_TOPIC");
  assert.ok(draw({ seed: 1, topics, recipes, profile }));
});

test("版本：改了主題檔，舊骨架被標為過期", () => {
  const sk = run(7);
  assert.deepEqual(staleInputs(sk.artifact, { topic, recipes, profile }), []);
  const changed = { ...topic, title: "圖書館辦證（改）" };
  assert.deepEqual(staleInputs(sk.artifact, { topic: changed, recipes, profile }), ["topic"]);
  assert.deepEqual(staleInputs(sk.artifact, { topic, recipes: recipes.slice(1), profile }), ["recipes"]);
});

test("每個主題都能用多個種子抽出合法骨架，且每個變體至少 18 個欄位", () => {
  for (const tp of content.topics) {
    for (const v of tp.variants) {
      assert.ok(tp.fields_pool.filter((f) => !f.only_variants || f.only_variants.includes(v.id)).length >= 18, `${tp.id}/${v.id} 欄位不足 18`);
      for (let seed = 1; seed <= 30; seed++) {
        const sk = draw({ seed, topics: [tp], recipes, profile, variantId: v.id });
        assert.equal(sk.slots.length, 10);
      }
    }
  }
});
