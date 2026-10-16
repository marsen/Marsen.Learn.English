// 只把「瀏覽器需要的檔案」複製到 public/，Vercel 只公開這個資料夾。
// 這樣 content/（標準答案、逐字稿）、generator/、tests/ 等不會變成公開網址。伺服器函式（api/）另外部署，不在這裡。
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FILES = ["index.html", "app.js", "auth.mjs", "core.mjs", "config.js", "exam.css"];

export function buildPublic({ root = here, out = join(root, "public") } = {}) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "exam"), { recursive: true });
  for (const f of FILES) cpSync(join(root, "exam", f), join(out, "exam", f));
  writeFileSync(join(out, "index.html"), '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=/exam/"><a href="/exam/">進入聽力測驗</a>\n');
  return FILES.map((f) => `exam/${f}`).concat("index.html");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`已複製到 public/：\n  ${buildPublic().join("\n  ")}`);
}
