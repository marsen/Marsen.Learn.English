// 把本機 AUDIO_LOCAL_DIR 的錄音搬上 Cloudflare R2（已經在 R2 的會跳過，可以重複執行）。
// 用法：pnpm audio:to-r2
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { AwsClient } from "aws4fetch";

const {
  AUDIO_LOCAL_DIR,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
} = process.env;
if (
  !AUDIO_LOCAL_DIR ||
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET
) {
  console.error("[r2] 請在 .env.local 設定 AUDIO_LOCAL_DIR 與 R2_* 四個變數");
  process.exit(1);
}

const client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (entry.name.endsWith(".mp3")) yield path;
  }
}

let uploaded = 0;
let skipped = 0;
for await (const path of files(AUDIO_LOCAL_DIR)) {
  const key = relative(AUDIO_LOCAL_DIR, path).split(sep).join("/");
  const url = `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const head = await client.fetch(url, { method: "HEAD" });
  if (head.ok) {
    skipped += 1;
    continue;
  }
  const res = await client.fetch(url, {
    method: "PUT",
    body: await readFile(path),
    headers: { "Content-Type": "audio/mpeg" },
  });
  if (!res.ok) {
    console.error(`[r2] 上傳失敗 ${res.status}：${key}`);
    process.exit(1);
  }
  uploaded += 1;
  console.log(`上傳 ${key}`);
}
console.log(`完成：上傳 ${uploaded} 個，已存在跳過 ${skipped} 個`);
