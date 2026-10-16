import test from "node:test";
import assert from "node:assert/strict";
import { fixture, content as contentData } from "./helpers.mjs";
import { assemblePlan, assembleScript, AssembleError } from "../generator/assemble.mjs";
import { compareBlind } from "../generator/blind.mjs";
import { buildPlanPrompt, buildScriptPrompt, buildBlindPrompt } from "../generator/prompt.mjs";

const fx = () => fixture();
const valuesFrom = (plan) => ({ scenario: plan.scenario, values: plan.answers.map(({ question_id, answer, accepted, wrong_value }) => ({ question_id, answer, accepted, wrong_value })) });

test("assemblePlan 由骨架補欄位、陷阱與比對規則", () => {
  const { skeleton, plan } = fx();
  const out = assemblePlan({ skeleton, values: valuesFrom(plan), setId: "x" });
  assert.equal(out.answers.length, 10);
  assert.deepEqual(out.answers.map((a) => a.trap), skeleton.slots.map((s) => s.trap));
});
test("assemblePlan 缺題、多題、重複、空答案都擋下", () => {
  const { skeleton, plan } = fx();
  const v = valuesFrom(plan);
  assert.throws(() => assemblePlan({ skeleton, values: { ...v, values: v.values.slice(1) }, setId: "x" }), AssembleError);
  assert.throws(() => assemblePlan({ skeleton, values: { ...v, values: [...v.values, { question_id: "q99", answer: "a" }] }, setId: "x" }), AssembleError);
  assert.throws(() => assemblePlan({ skeleton, values: { ...v, values: [...v.values, v.values[0]] }, setId: "x" }), AssembleError);
  assert.throws(() => assemblePlan({ skeleton, values: { ...v, values: v.values.map((x, i) => (i ? x : { ...x, answer: " " })) }, setId: "x" }), AssembleError);
});
test("assembleScript 需要 turns 與 evidence", () => {
  assert.throws(() => assembleScript({ script: { turns: [] }, setId: "x" }), AssembleError);
});
test("盲答完全一致則無警示；不一致與備選會警示", () => {
  const { plan } = fx();
  const check = { answers: plan.answers.map((a) => ({ question_id: a.question_id, answer: a.answer, alternatives: [], confidence: "high" })) };
  assert.equal(compareBlind({ plan, check }).ok, true);
  check.answers[0].answer = "zzz"; check.answers[1].alternatives = ["9"]; check.answers[2].confidence = "low";
  assert.deepEqual(compareBlind({ plan, check }).issues.map((i) => i.rule).sort(), ["B1", "B2", "B3"]);
  check.answers.pop();
  assert.ok(compareBlind({ plan, check }).issues.some((i) => i.message.includes("沒有回答")));
});
test("三份 prompt 都能完整填出，且盲答 prompt 不含答案", () => {
  const { skeleton, plan, script, paper } = fx();
  const profile = contentData.profile;
  const topic = contentData.topics.find((t) => t.id === skeleton.topic);
  assert.ok(!/\{\{/.test(buildPlanPrompt({ topic, skeleton, profile })));
  assert.ok(!/\{\{/.test(buildScriptPrompt({ topic, plan, profile })));
  const blind = buildBlindPrompt({ paper, script });
  assert.ok(!/\{\{/.test(blind));
  assert.ok(!blind.includes('"evidence"'));
});
