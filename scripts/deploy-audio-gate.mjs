// 部署錄音的各地節點（workers/audio-gate），並把網站要用的兩個設定加進 .env.local。
// 用法：pnpm audio-gate:deploy（第一次會打開瀏覽器請你登入 Cloudflare）
// - 密鑰：.env.local 已經有 AUDIO_PASS_SECRET 就沿用，沒有就產生一把新的
// - 先部署再設定密鑰；成功後才把 AUDIO_CDN_BASE、AUDIO_PASS_SECRET 加進 .env.local
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const ENV_FILE = ".env.local";
const CDN_BASE = "https://audio.marsen.me";
const cwd = "workers/audio-gate";

const envText = readFileSync(ENV_FILE, "utf8");
const existing = /^AUDIO_PASS_SECRET=(.+)$/m.exec(envText)?.[1]?.trim();
const secret = existing || randomBytes(32).toString("base64url");

console.log("1/2 部署 audio-gate …");
execSync("npx -y wrangler@4 deploy", { cwd, stdio: "inherit" });

console.log("2/2 設定密鑰 …");
execSync("npx -y wrangler@4 secret put AUDIO_PASS_SECRET", {
  cwd,
  input: secret,
  stdio: ["pipe", "inherit", "inherit"],
});

const lines = [];
if (!/^AUDIO_CDN_BASE=/m.test(envText)) lines.push(`AUDIO_CDN_BASE=${CDN_BASE}`);
if (!existing) lines.push(`AUDIO_PASS_SECRET=${secret}`);
if (lines.length > 0) {
  const prefix = envText.endsWith("\n") ? "" : "\n";
  appendFileSync(
    ENV_FILE,
    `${prefix}\n# 錄音經 Cloudflare 各地節點送出（pnpm audio-gate:deploy 加的）\n${lines.join("\n")}\n`,
  );
  console.log(`已把 ${lines.map((l) => l.split("=")[0]).join("、")} 加進 ${ENV_FILE}`);
}
console.log("完成。重開 pnpm dev，錄音網址會變成 audio.marsen.me。");
