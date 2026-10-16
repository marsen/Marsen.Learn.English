#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { draw, DrawError } from "./draw.mjs";
import { validate } from "./validate.mjs";
import { buildPaper } from "./paper.mjs";
import { renderPreview } from "./preview.mjs";
import { buildPlanPrompt, buildScriptPrompt, buildBlindPrompt } from "./prompt.mjs";
import { assemblePlan, assembleScript, AssembleError } from "./assemble.mjs";
import { compareBlind } from "./blind.mjs";
import { basename } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export function loadContent() {
  const dir = join(root, "content/topics");
  return {
    topics: readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => readJson(join(dir, f))),
    recipes: readJson(join(root, "content/recipes/section1.json")),
    profile: readJson(join(root, "config/exam-profile.json")),
  };
}

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, d) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : d; };

if (cmd === "draw") {
  const seed = Number(flag("seed", Date.now() % 2 ** 31));
  const all = loadContent();
  const { recipes, profile } = all;
  const topics = flag("topic") ? all.topics.filter((t) => t.id === flag("topic")) : all.topics;
  if (!topics.length) { console.error(`沒有這個主題：${flag("topic")}`); process.exit(2); }
  try {
    const skeleton = draw({ seed, topics, recipes, profile, variantId: flag("variant"), previousRecipe: flag("previous-recipe", null) });
    const out = flag("out");
    if (out) {
      mkdirSync(out, { recursive: true });
      const topic = topics.find((t) => t.id === skeleton.topic);
      const paper = buildPaper({ topic, skeleton });
      writeFileSync(join(out, "skeleton.json"), JSON.stringify(skeleton, null, 2) + "\n");
      writeFileSync(join(out, "paper.json"), JSON.stringify(paper, null, 2) + "\n");
      writeFileSync(join(out, "preview.html"), renderPreview({ paper, skeleton }));
      console.error(`已寫入 ${out}/skeleton.json、paper.json、preview.html`);
    }
    console.log(JSON.stringify(skeleton, null, 2));
  } catch (e) {
    if (e instanceof DrawError) { console.error(`${e.code}: ${e.message}`); process.exit(2); }
    throw e;
  }
} else if (cmd === "paper") {
  const dir = resolve(rest[0]);
  const { topics } = loadContent();
  const plan = readJson(join(dir, "plan.json"));
  const topic = topics.find((t) => t.id === plan.topic);
  const paper = buildPaper({ topic, plan });
  writeFileSync(join(dir, "paper.json"), JSON.stringify(paper, null, 2) + "\n");
  console.log(JSON.stringify(paper, null, 2));
} else if (cmd === "preview") {
  const dir = resolve(rest[0]);
  const load = (n) => (existsSync(join(dir, n)) ? readJson(join(dir, n)) : undefined);
  const { topics } = loadContent();
  const skeleton = load("skeleton.json");
  const paper = load("paper.json") ?? buildPaper({ topic: topics.find((t) => t.id === skeleton.topic), skeleton });
  writeFileSync(join(dir, "preview.html"), renderPreview({ paper, skeleton, plan: load("plan.json"), script: load("script.json") }));
  console.log(`已寫入 ${join(dir, "preview.html")}`);
} else if (cmd === "prompt") {
  // 人工模式：印出 prompt，交給 AI（最好是全新的對話），把回覆存成檔案，再用 assemble 組回去。
  const [kind, d] = rest;
  const dir = resolve(d);
  const { topics, profile } = loadContent();
  const load = (n) => readJson(join(dir, n));
  const skeleton = load("skeleton.json");
  const topic = topics.find((t) => t.id === skeleton.topic);
  const prompts = {
    plan: () => buildPlanPrompt({ topic, skeleton, profile }),
    script: () => buildScriptPrompt({ topic, plan: load("plan.json"), profile }),
    blind: () => buildBlindPrompt({ paper: load("paper.json"), script: load("script.json") }),
  };
  if (!prompts[kind]) { console.error("用法：prompt plan|script|blind <set 資料夾> [--out 檔案]"); process.exit(2); }
  const text = prompts[kind]();
  const out = flag("out");
  if (out) { writeFileSync(out, text); console.error(`已寫入 ${out}`); } else process.stdout.write(text);
} else if (cmd === "assemble") {
  const [kind, d, file] = rest;
  const dir = resolve(d);
  const input = readJson(resolve(file));
  const setId = basename(dir);
  try {
    if (kind === "plan") {
      const plan = assemblePlan({ skeleton: readJson(join(dir, "skeleton.json")), values: input, setId });
      writeFileSync(join(dir, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
      console.log(`已寫入 ${join(dir, "plan.json")}`);
    } else if (kind === "script") {
      writeFileSync(join(dir, "script.json"), JSON.stringify(assembleScript({ script: input, setId }), null, 2) + "\n");
      console.log(`已寫入 ${join(dir, "script.json")}`);
    } else if (kind === "check") {
      writeFileSync(join(dir, "check.json"), JSON.stringify({ set_id: setId, ...input }, null, 2) + "\n");
      console.log(`已寫入 ${join(dir, "check.json")}`);
    } else { console.error("用法：assemble plan|script|check <set 資料夾> <AI 回覆.json>"); process.exit(2); }
  } catch (e) {
    if (e instanceof AssembleError) { console.error(`組裝失敗：${e.message}`); process.exit(1); }
    throw e;
  }
} else if (cmd === "blind") {
  const dir = resolve(rest[0]);
  const result = compareBlind({ plan: readJson(join(dir, "plan.json")), check: readJson(join(dir, "check.json")) });
  for (const i of result.issues) console.log(`警示  ${i.rule} ${i.question_id}  ${i.message}`);
  console.log(result.ok ? "盲答與標準答案完全一致，沒有警示" : `共 ${result.issues.length} 項警示，需要人工判斷`);
} else if (cmd === "validate") {
  const dir = resolve(rest[0] ?? ".");
  const { topics, recipes, profile } = loadContent();
  const load = (n) => readJson(join(dir, n));
  const skeleton = load("skeleton.json");
  const topic = topics.find((t) => t.id === skeleton.topic);
  const result = validate({ skeleton, plan: load("plan.json"), script: load("script.json"), paper: load("paper.json"), topic, recipes, profile });
  for (const i of result.issues) console.log(`${i.level === "block" ? "擋" : "警示"}  ${i.rule}${i.question_id ? " " + i.question_id : ""}  ${i.message}`);
  console.log(result.ok ? "通過（沒有「擋」級問題）" : "未通過");
  process.exit(result.ok ? 0 : 1);
} else {
  console.log("用法：\n  node generator/cli.mjs draw --seed 42 [--topic library-card] [--variant student] [--out content/sets/<id>]\n  node generator/cli.mjs paper <set 資料夾>\n  node generator/cli.mjs preview <set 資料夾>   產生 preview.html\n  node generator/cli.mjs prompt plan|script|blind <set 資料夾>   印出給 AI 的 prompt\n  node generator/cli.mjs assemble plan|script|check <set 資料夾> <AI 回覆.json>\n  node generator/cli.mjs blind <set 資料夾>   盲答與標準答案比對\n  node generator/cli.mjs validate <set 資料夾>");
}
