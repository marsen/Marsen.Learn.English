#!/usr/bin/env node
// 開發用：把 Question.Generator 打包出來的題組匯入本機假後端，用 `npm run dev` 就能在測驗頁完整作答。
// 用法：node scripts/import-bundle.mjs <打包資料夾（含 set.json、audio.mp3）> [--allow-unreviewed]
// 做的事和正式發佈（scripts/publish.mjs）用同一組完整性檢查，只是把結果存到 content/dev-imports/<set_id>/，不送出任何東西。
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareBundlePublish } from "../lib/publish.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [dirArg, ...rest] = process.argv.slice(2);
if (!dirArg) { console.error("用法：node scripts/import-bundle.mjs <打包資料夾> [--allow-unreviewed]"); process.exit(2); }
const prep = prepareBundlePublish({ dir: resolve(dirArg), allowUnreviewed: rest.includes("--allow-unreviewed") });
for (const w of prep.warnings) console.error(`注意：${w}`);
if (!prep.ok) { for (const p of prep.problems) console.error(`不能匯入：${p}`); process.exit(1); }
const { set, answers } = prep.payload;
const out = join(root, "content/dev-imports", set.set_id);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "payload.json"), JSON.stringify({ set, answers }, null, 2));
copyFileSync(join(resolve(dirArg), "audio.mp3"), join(out, "audio.mp3"));
console.log(`已匯入 ${set.set_id}「${set.title}」→ content/dev-imports/${set.set_id}/。執行 npm run dev，開 /exam/ 作答。`);
