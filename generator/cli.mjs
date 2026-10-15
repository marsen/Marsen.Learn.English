#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { draw, DrawError } from "./draw.mjs";
import { validate } from "./validate.mjs";
import { buildPaper } from "./paper.mjs";

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
  const { topics, recipes, profile } = loadContent();
  try {
    const skeleton = draw({ seed, topics, recipes, profile, variantId: flag("variant"), previousRecipe: flag("previous-recipe", null) });
    const out = flag("out");
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, "skeleton.json"), JSON.stringify(skeleton, null, 2) + "\n"); }
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
  console.log("用法：\n  node generator/cli.mjs draw --seed 42 [--variant student] [--out content/sets/<id>]\n  node generator/cli.mjs paper <set 資料夾>\n  node generator/cli.mjs validate <set 資料夾>");
}
