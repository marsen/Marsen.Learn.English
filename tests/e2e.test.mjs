import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../generator/validate.mjs";
import { fixture, rules } from "./helpers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = (...args) => execFileSync("node", [join(root, "generator/cli.mjs"), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("端到端：抽籤 → 寫出骨架、題目卷、預覽，檔案存在且內容一致", () => {
  const dir = mkdtempSync(join(tmpdir(), "gapfill-"));
  cli("draw", "--seed", "20261016", "--out", dir);
  for (const f of ["skeleton.json", "paper.json", "preview.html"]) assert.ok(existsSync(join(dir, f)), f);
  const sk = JSON.parse(readFileSync(join(dir, "skeleton.json"), "utf8"));
  const paper = JSON.parse(readFileSync(join(dir, "paper.json"), "utf8"));
  assert.equal(sk.seed, 20261016);
  const blanks = paper.rows.flatMap((r) => r.parts.filter((p) => p.blank).map((p) => p.blank));
  assert.deepEqual(blanks, sk.slots.map((s) => s.question_id));
  const html = readFileSync(join(dir, "preview.html"), "utf8");
  for (const s of sk.slots) assert.ok(html.includes(s.field_id), s.field_id);
  // 同一個種子再抽一次，檔案內容逐位元相同
  const dir2 = mkdtempSync(join(tmpdir(), "gapfill-"));
  cli("draw", "--seed", "20261016", "--out", dir2);
  assert.equal(readFileSync(join(dir2, "skeleton.json"), "utf8"), readFileSync(join(dir, "skeleton.json"), "utf8"));
});

test("端到端：good-0001 的 validate 指令通過，preview 把 10 題答案與陷阱都畫出來", () => {
  const dir = mkdtempSync(join(tmpdir(), "gapfill-"));
  cpSync(join(root, "tests/fixtures/good-0001"), dir, { recursive: true });
  assert.match(cli("validate", dir), /通過/);
  cli("preview", dir);
  const html = readFileSync(join(dir, "preview.html"), "utf8");
  const b = fixture();
  for (const a of b.plan.answers) assert.ok(html.includes(`>${a.answer}<`) || html.includes(a.answer), a.answer);
  assert.equal((html.match(/<mark /g) ?? []).length, 10, "10 題證據句都要標色");
});

test("端到端：validate 指令對壞題目回傳非 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "gapfill-"));
  cpSync(join(root, "tests/fixtures/good-0001"), dir, { recursive: true });
  const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
  plan.answers[8].trap = "distractor";
  execFileSync("node", ["-e", `require('fs').writeFileSync(${JSON.stringify(join(dir, "plan.json"))}, ${JSON.stringify(JSON.stringify(plan))})`]);
  assert.throws(() => cli("validate", dir), (e) => e.status === 1 && /V13/.test(e.stdout));
});
