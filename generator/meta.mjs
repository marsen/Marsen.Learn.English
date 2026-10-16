// 每套題一個 meta.json：狀態、輸入雜湊、各階段產物的指紋、重寫次數。
// 規格第 12.1 節：上游改了，下游自動標為過期。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { hashOf, staleInputs, SCHEMA_VERSION, GENERATOR_VERSION } from "./artifact.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const MAX_RETRIES = 2;
export const STATUS_ORDER = ["drawn", "planned", "scripted", "papered", "validated", "blind_passed", "reviewed", "voiced", "published"];

export const promptHash = (name) => hashOf(readFileSync(join(here, "prompts", `${name}.md`), "utf8"));
const FILES = { skeleton: "skeleton.json", plan: "plan.json", script: "script.json", paper: "paper.json", check: "check.json" };

export function readSet(dir) {
  const set = {};
  for (const [k, f] of Object.entries(FILES)) set[k] = existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), "utf8")) : undefined;
  return set;
}
const h = (obj) => (obj === undefined ? null : hashOf(obj));
export const currentHashes = (set) => Object.fromEntries(Object.keys(FILES).map((k) => [k, h(set[k])]));

export const metaPath = (dir) => join(dir, "meta.json");
export const hasMeta = (dir) => existsSync(metaPath(dir));
export const loadMeta = (dir) => JSON.parse(readFileSync(metaPath(dir), "utf8"));
export function saveMeta(dir, meta, set, now = new Date()) {
  meta.updated_at = now.toISOString();
  meta.status = deriveStatus(checkChain(meta, set));
  writeFileSync(metaPath(dir), JSON.stringify(meta, null, 2) + "\n");
  return meta;
}

export function newMeta({ dir, skeleton, now = new Date() }) {
  return {
    set_id: basename(dir), seed: skeleton.seed, status: "drawn",
    created_at: now.toISOString(), updated_at: now.toISOString(),
    schema_version: SCHEMA_VERSION, generator_version: GENERATOR_VERSION,
    inputs: skeleton.artifact?.inputs ?? {},
    retries: { plan: 0, script: 0 }, stages: {},
  };
}

// 登記某個階段的產物。extra：model、mode、by、note 等；回傳 meta。
export function stamp(meta, set, stage, extra = {}, now = new Date()) {
  const c = currentHashes(set);
  const at = now.toISOString();
  const prev = meta.stages[stage];
  const base = {
    skeleton: () => ({ hash: c.skeleton }),
    plan: () => ({ hash: c.plan, from: { skeleton: c.skeleton }, prompt: promptHash("plan") }),
    script: () => ({ hash: c.script, from: { plan: c.plan }, prompt: promptHash("script") }),
    paper: () => ({ hash: c.paper, from: { skeleton: c.skeleton } }),
    validate: () => ({ from: { plan: c.plan, script: c.script, paper: c.paper } }),
    blind: () => ({ from: { plan: c.plan, script: c.script, paper: c.paper, check: c.check }, prompt: promptHash("blind") }),
    review: () => ({ from: { script: c.script } }),
  }[stage]();
  // 驗證沒過、而被換掉的正是失敗當時的產物，才算一次「重寫」
  if ((stage === "plan" || stage === "script") && prev && meta.stages.validate && !meta.stages.validate.ok && meta.stages.validate.from?.[stage] === prev.hash) {
    meta.retries[stage] += 1;
  }
  meta.stages[stage] = { ...base, ...extra, at, ...(prev?.edits ? { edits: prev.edits } : {}) };
  return meta;
}

// 這個階段還能不能再重寫？驗證失敗且已重寫滿 MAX_RETRIES 次就不行（要人工處理）。
export function retryAllowed(meta, stage) {
  const v = meta.stages.validate;
  const prev = meta.stages[stage];
  const failing = v && !v.ok && prev && v.from?.[stage] === prev.hash;
  return !(failing && meta.retries[stage] >= MAX_RETRIES);
}

// 人工改了檔案之後，用這個重新認可，並留下紀錄；下游因指紋不符自動過期。
export function accept(meta, set, stage, note, now = new Date()) {
  const s = meta.stages[stage];
  if (!s) throw new Error(`${stage} 還沒有登記過，不能 accept`);
  const c = currentHashes(set);
  s.edits = [...(s.edits ?? []), { at: now.toISOString(), note, from_hash: s.hash }];
  s.hash = c[stage];
  if (stage === "plan") s.from = { skeleton: c.skeleton };
  if (stage === "script") s.from = { plan: c.plan };
  s.at = now.toISOString();
  return meta;
}

const staleNow = (meta, set, content) => staleInputs({ inputs: meta.inputs }, {
  topic: content.topics.find((t) => t.id === set.skeleton.topic), recipes: content.recipes, profile: content.profile,
});

// 逐階段檢查：ok / stale / missing / failed / warned
export function checkChain(meta, set, content) {
  const c = currentHashes(set);
  const out = [];
  const add = (stage, state, reason = "") => out.push({ stage, state, reason });
  const S = meta.stages;
  const diff = (from, now) => Object.keys(from ?? {}).filter((k) => from[k] !== now[k]);

  // skeleton
  if (c.skeleton === null) add("skeleton", "missing");
  else if (S.skeleton && S.skeleton.hash !== c.skeleton) add("skeleton", "stale", "檔案被改過，未經 accept");
  else if (content && staleNow(meta, set, content).length) add("skeleton", "stale", `輸入已改：${staleNow(meta, set, content).join("、")}`);
  else add("skeleton", "ok");

  const prompted = (s, name) => s.prompt && s.prompt !== promptHash(name);
  const simple = (stage, promptName) => {
    const s = S[stage];
    if (!s || c[stage] === null) return add(stage, "missing");
    if (s.hash !== c[stage]) return add(stage, "stale", "檔案被改過，未經 accept");
    const d = diff(s.from, c);
    if (d.length) return add(stage, "stale", `上游已變：${d.join("、")}`);
    if (promptName && prompted(s, promptName)) return add(stage, "stale", `${promptName} prompt 已改`);
    add(stage, "ok", promptName && !s.prompt ? "prompt 版本未記錄" : "");
  };
  simple("plan", "plan");
  simple("script", "script");
  simple("paper");

  const v = S.validate;
  if (!v) add("validate", "missing");
  else if (diff(v.from, c).length) add("validate", "stale", `上游已變：${diff(v.from, c).join("、")}`);
  else if (!v.ok) add("validate", "failed", `擋 ${v.block} 項`);
  else add("validate", "ok", v.warn ? `警示 ${v.warn} 項` : "");

  const b = S.blind;
  if (!b) add("blind", "missing");
  else if (diff(b.from, c).length) add("blind", "stale", `上游已變：${diff(b.from, c).join("、")}`);
  else if (b.prompt && b.prompt !== promptHash("blind")) add("blind", "stale", "blind prompt 已改");
  else if (b.warnings === null || b.warnings === undefined) add("blind", "missing", "尚未比對（跑 blind）");
  else if (b.warnings > 0) add("blind", "warned", `警示 ${b.warnings} 項`);
  else add("blind", "ok");

  const r = S.review;
  if (!r) add("review", "missing");
  else if (diff(r.from, c).length) add("review", "stale", "逐字稿在審核後改過");
  else add("review", "ok", r.by ? `審核人 ${r.by}` : "");

  // 上游不是 ok，下游即使指紋對得上也要標「上游過期」
  const byStage = Object.fromEntries(out.map((o) => [o.stage, o]));
  const deps = { plan: ["skeleton"], script: ["plan"], paper: ["skeleton"], validate: ["plan", "script", "paper"], blind: ["validate"], review: ["validate"] };
  for (const o of out) {
    if (o.state !== "ok" && o.state !== "warned") continue;
    const bad = (deps[o.stage] ?? []).filter((u) => !["ok", "warned"].includes(byStage[u].state));
    if (bad.length) { o.state = "stale"; o.reason = `上游 ${bad.join("、")} 有問題`; }
  }
  return out;
}

export function deriveStatus(chain) {
  const st = Object.fromEntries(chain.map((o) => [o.stage, o.state]));
  let status = "none";
  const seq = [["drawn", st.skeleton === "ok"], ["planned", st.plan === "ok"], ["scripted", st.script === "ok"], ["papered", st.paper === "ok"], ["validated", st.validate === "ok"]];
  for (const [name, ok] of seq) { if (!ok) return status; status = name; }
  if (st.blind === "ok") status = "blind_passed";
  if (st.review === "ok" && ["ok", "warned"].includes(st.blind)) status = "reviewed";
  return status;
}
