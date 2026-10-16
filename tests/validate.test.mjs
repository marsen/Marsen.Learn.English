import test from "node:test";
import assert from "node:assert/strict";
import { validate } from "../generator/validate.mjs";
import { buildPaper } from "../generator/paper.mjs";
import { grade } from "../generator/grade.mjs";
import { matchesAnswer, findInText } from "../generator/answer.mjs";
import { fixture, rules, topic, content } from "./helpers.mjs";

const turn = (b, id) => b.script.turns.find((t) => t.id === id);
const ans = (b, q) => b.plan.answers.find((a) => a.question_id === q);
const ev = (b, q) => b.script.evidence.find((e) => e.question_id === q);
const blocks = (b) => rules(validate(b), "block");

test("good-0001：完全正確的題目，全部通過、沒有任何警示", () => {
  const r = validate(fixture());
  assert.deepEqual(r.issues, []);
  assert.ok(r.ok);
});

test("題目卷由程式從 plan 產生，與手寫的 paper 一致", () => {
  const b = fixture();
  assert.deepEqual(buildPaper({ topic, plan: b.plan }), b.paper);
  assert.ok(!b.paper.rows.some((r) => r.field_id === "first_name"), "沒抽到的欄位要整列拿掉");
  assert.ok(b.paper.rows.some((r) => r.label === "Application type"), "固定印好的列保留");
});

test("V1：缺欄位、plan 與 paper 的題號不一致", () => {
  let b = fixture(); delete b.plan.answers[0].answer;
  assert.ok(blocks(b).includes("V1"));
  b = fixture(); b.paper.rows.find((r) => r.field_id === "course").parts = [{ blank: "q99" }];
  assert.ok(blocks(b).includes("V1"));
  b = fixture(); b.script.evidence.pop();
  assert.ok(blocks(b).includes("V1"));
});

test("V2：重複題號、題數不對", () => {
  let b = fixture(); b.plan.answers[1].question_id = "q01";
  assert.ok(blocks(b).includes("V2"));
  b = fixture(); b.plan.answers.pop(); b.script.evidence.pop(); b.paper.rows = b.paper.rows.filter((r) => r.field_id !== "notification");
  assert.ok(blocks(b).includes("V2"));
});

test("V3a：quote 不是原文子字串", () => {
  const b = fixture(); ev(b, "q06").quote = "I study civil engineering.";
  assert.ok(blocks(b).includes("V3a"));
});

test("V3b：答案只在 evidence，不在真實逐字稿", () => {
  const b = fixture();
  turn(b, "t22").text = "I'm doing a degree, and it's quite a practical course, so I spend a lot of time in the labs.";
  ev(b, "q06").quote = "I'm doing a degree, and it's quite a practical course,";
  assert.ok(blocks(b).includes("V3b"));
});

test("V4：題號順序和音檔順序相反", () => {
  const b = fixture();
  [ev(b, "q09").turn, ev(b, "q10").turn] = ["t30", "t28"];
  ev(b, "q09").quote = "Email is best for me."; ev(b, "q10").quote = "Yes, I love history,";
  assert.ok(blocks(b).includes("V4"));
});

test("V5：字數超限", () => {
  const b = fixture(); ans(b, "q06").answer = "civil engineering degree"; // 3 個字，上限 2
  assert.ok(blocks(b).includes("V5"));
});

test("V6：答案出現在題目卷學生看得到的文字", () => {
  let b = fixture(); b.paper.title = "Library history application";
  ans(b, "q09").answer = "history";
  assert.ok(blocks(b).includes("V6"));
  b = fixture(); b.paper.rows.find((r) => r.field_id === "interest").label = "Favourite subject (e.g. history)";
  assert.ok(blocks(b).includes("V6"));
});

test("V6 合法：別列已印好的值恰好與某題答案相同，不算洩漏", () => {
  const b = fixture();
  b.paper.rows[0].parts = [{ text: "Thursday" }]; // Application type 那列，與 q07 的答案同字
  assert.ok(!blocks(b).includes("V6"));
});

test("V7：自我更正沒有 wrong_value，或錯誤值出現在正確答案之後", () => {
  let b = fixture(); delete ans(b, "q02").wrong_value;
  assert.ok(blocks(b).includes("V7"));
  b = fixture();
  turn(b, "t24").text = "Well, Thursday would be good, oh, wait. Wednesday is fine. Let's say Thursday instead. I like it.";
  ans(b, "q07").wrong_value = "Friday";
  assert.ok(blocks(b).includes("V7"));
  b = fixture(); ans(b, "q08").wrong_value = "Northgate"; // 干擾值沒出現
  assert.ok(blocks(b).includes("V7"));
});

test("V8：拼字題沒有逐字母", () => {
  const b = fixture();
  turn(b, "t6").text = "Sure. It's Hargreaves. A lot of people leave out the second R, so I always spell it out for them.";
  ev(b, "q01").quote = "It's Hargreaves.";
  assert.ok(blocks(b).includes("V8"));
});

test("V9：相近數字題沒有容易混淆的對應數字", () => {
  const b = fixture(); turn(b, "t12").text = "It's number 15. The numbers on that road jump around in a very confusing way, and the postman gets it wrong almost every week, you know.";
  assert.ok(blocks(b).includes("V9"));
});

test("V10：同類型答案相同會被擋；不同欄位字面重疊（King Street／King Street West）合法", () => {
  let b = fixture(); ans(b, "q09").answer = "Thursday"; ans(b, "q09").type = "word";
  assert.ok(blocks(b).includes("V10"));
  b = fixture(); ans(b, "q09").answer = "history"; ans(b, "q10").answer = "history west";
  assert.ok(!blocks(b).includes("V10"));
});

test("V11：長度只出警示不擋；題目間距與暖身會擋", () => {
  let b = fixture();
  for (const t of b.script.turns) if (!["t6", "t8", "t12", "t14", "t20", "t22", "t24", "t26", "t28", "t30"].includes(t.id)) t.text = "Okay.";
  let r = validate(b);
  assert.ok(rules(r, "warn").includes("V11"));
  b = fixture(); turn(b, "t13").text = "Fifteen."; turn(b, "t12").text = "It's number 15. Not 50.";
  assert.ok(blocks(b).includes("V11"), "q03 與 q04 間距不足");
  b = fixture(); b.script.turns = b.script.turns.slice(3); // 去掉前 3 輪暖身
  assert.ok(blocks(b).includes("V11"));
});

test("V12：真實格式電話、非 example.com 信箱、黑名單人名", () => {
  let b = fixture(); turn(b, "t30").text = "Email is best for me. Or call me on 07911 123456 if it's urgent.";
  assert.ok(blocks(b).includes("V12"));
  b = fixture(); turn(b, "t30").text = "Email is best for me. Write to tom@gmail.com.";
  assert.ok(blocks(b).includes("V12"));
  b = fixture(); turn(b, "t30").text = "Email is best for me. My friend John Smith uses it too.";
  assert.ok(blocks(b).includes("V12"));
  b = fixture(); turn(b, "t30").text = "Email is best for me. Or call 07700 900 123, or write to tom@example.com.";
  assert.ok(!blocks(b).includes("V12"));
});

test("V13：plan 的陷阱與骨架不一致；骨架違反配方或欄位限制；成組欄位被拆開", () => {
  let b = fixture(); ans(b, "q09").trap = "distractor";
  assert.ok(blocks(b).includes("V13"));
  b = fixture(); b.skeleton.slots[8].trap = "spelling"; // 配方數量與欄位限制都不符
  assert.ok(blocks(b).includes("V13"));
  b = fixture(); b.skeleton.recipe = "R2";
  assert.ok(blocks(b).includes("V13"));
  b = fixture(); b.skeleton.slots = b.skeleton.slots.filter((s) => s.field_id !== "street_name");
  assert.ok(blocks(b).includes("V13"));
});

test("評分一致性：驗證用的找答案與評分用的比對，結果一致", () => {
  const b = fixture();
  const all = grade(b.plan, Object.fromEntries(b.plan.answers.map((a) => [a.question_id, a.answer])));
  assert.equal(all.total, 10);
  for (const a of b.plan.answers) {
    for (const accepted of [a.answer, ...a.accepted]) assert.ok(matchesAnswer(a.answer_policy, accepted, a), accepted);
    // 逐字稿中命中的那一段文字，丟給評分也必須算對（拼字題除外：命中的是逐字母）
    if (a.trap === "spelling") continue;
    const text = b.script.turns.find((t) => t.id === ev(b, a.question_id).turn).text;
    const hit = findInText(a.answer_policy, a, text);
    assert.ok(hit, a.question_id);
    assert.ok(matchesAnswer(a.answer_policy, text.slice(hit.index, hit.end), a), `${a.question_id}: ${text.slice(hit.index, hit.end)}`);
  }
  const wrong = grade(b.plan, { q01: "Hargreeves", q02: "13 March", q03: "50" });
  assert.equal(wrong.total, 0);
  assert.equal(wrong.byTrap.spelling.total, 2);
});

test("重跑：同一輸入、同一版本，驗證結果相同", () => {
  assert.deepEqual(validate(fixture()), validate(fixture()));
});

test("題目卷帶分段標題；有句型的列拆成前文、空格、後文並標 inline", () => {
  const b = fixture();
  const paper = buildPaper({ topic, plan: b.plan });
  assert.ok(paper.rows.filter((r) => r.field_id).every((r) => r.section), "每個抽到的欄位都在某個分段下");
  const inline = paper.rows.filter((r) => r.inline);
  assert.ok(inline.length > 0);
  for (const r of inline) assert.ok(r.parts.some((p) => p.blank) && r.parts.some((p) => p.text), r.label);
  const seq = paper.rows.map((r) => r.section).filter(Boolean);
  const heads = seq.filter((s, i) => i === 0 || seq[i - 1] !== s);
  assert.equal(heads.length, new Set(heads).size, "同一個分段是連續的，不會被拆開");
});

// ---- 段落模板（gym 主題）----
import { splitTemplate, fieldsOf, fieldOrder, showTemplate } from "../generator/lib/template.mjs";
const gym = content.topics.find((t) => t.id === "gym-membership");

test("句型拆解：{} 是主欄位、{別的} 是 also 欄位，其餘文字原樣保留", () => {
  const row = gym.form.rows.find((r) => r.also);
  assert.deepEqual(fieldsOf(row), ["house_number", "street_name"]);
  assert.deepEqual(splitTemplate(row), [{ text: "Address:" }, { field: "house_number" }, { field: "street_name" }]);
  assert.equal(showTemplate({ ...row }, (f) => `<${f}>`), "Address: <house_number> <street_name>");
  const order = fieldOrder(gym);
  assert.ok(order.get("house_number") < order.get("street_name") && order.get("street_name") < order.get("town"));
});

test("段落模板：每個主題的句型列都有一個 {}、所有 {x} 都在 also 裡、同一段連續、每段都有樣式", () => {
  for (const t of content.topics) {
    const seen = [];
    for (const r of t.form.rows.filter((x) => x.template)) {
      assert.ok(r.template.includes("{}"), `${t.id} ${r.label}`);
      for (const m of r.template.matchAll(/\{([a-z_]+)\}/g)) assert.ok((r.also ?? []).includes(m[1]), `${t.id} ${r.label}: {${m[1]}}`);
      for (const f of fieldsOf(r)) assert.ok(t.fields_pool.some((p) => p.field_id === f), `${t.id} ${f}`);
    }
    for (const f of t.fields_pool) assert.ok(t.form.rows.some((r) => fieldsOf(r).includes(f.field_id)), `${t.id} 欄位 ${f.field_id} 沒有對應的列`);
    for (const r of t.form.rows) if (r.section && seen.at(-1) !== r.section) seen.push(r.section);
    assert.equal(seen.length, new Set(seen).size, `${t.id} 同一段必須連續`);
    assert.deepEqual(Object.keys(t.form.section_styles).sort(), [...seen].sort(), t.id);
  }
});

test("V14：題目卷印出的事實，逐字稿沒講到就擋；講到就過", () => {
  const b = fixture();
  b.paper.rows.push({ label: "Fact", parts: [{ text: "Open until midnight" }], says: ["midnight"] });
  assert.ok(rules(validate(b), "block").includes("V14"));
  b.script.turns[0].text += " We stay open until midnight.";
  assert.ok(!rules(validate(b), "block").includes("V14"));
});

test("題目卷：句型列帶出印好的事實、同一句的兩個空格、says", async () => {
  const sk = (await import("node:fs")).readFileSync(new URL("../content/sets/s1-gym-0002/skeleton.json", import.meta.url), "utf8");
  const skeleton = JSON.parse(sk);
  const paper = buildPaper({ topic: gym, skeleton });
  assert.ok(paper.rows.some((r) => r.inline && r.says?.length), "有帶 says 的句型列");
  assert.equal(paper.section_styles["Gym information"], "paragraph");
  const fake = { ...skeleton, slots: skeleton.slots.filter((s) => s.field_id !== "street_name").concat([{ question_id: "q99", field_id: "house_number" }]) };
  assert.throws(() => buildPaper({ topic: gym, skeleton: fake }), /group/);
});
