#!/usr/bin/env node
// 用法：node scripts/publish.mjs <打包資料夾（含 set.json、audio.mp3）> [--allow-unreviewed] [--dry-run]
import { resolve } from "node:path";
import { prepareBundlePublish, publishToSupabase } from "../lib/publish.mjs";

const [dirArg, ...rest] = process.argv.slice(2);
if (!dirArg) { console.error("用法：node scripts/publish.mjs <打包資料夾> [--allow-unreviewed] [--dry-run]"); process.exit(2); }
const prep = prepareBundlePublish({ dir: resolve(dirArg), allowUnreviewed: rest.includes("--allow-unreviewed") });
for (const w of prep.warnings) console.error(`注意：${w}`);
if (!prep.ok) { for (const p of prep.problems) console.error(`不能發佈：${p}`); process.exit(1); }
const { set } = prep.payload;
console.log(`${set.set_id}「${set.title}」${set.question_count} 題，錄音 ${(prep.payload.audio.length / 1e6).toFixed(1)} MB → ${set.audio_path}`);
if (rest.includes("--dry-run")) { console.log("（--dry-run：沒有送出任何東西）"); process.exit(0); }
await publishToSupabase({ payload: prep.payload });
console.log("已發佈。");
