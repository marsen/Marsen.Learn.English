// 部署：公開資料夾只含瀏覽器需要的檔案；公開檔案裡沒有金鑰、標準答案或逐字稿。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPublic } from "../scripts/build-public.mjs";

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)).map((x) => `${f}/${x}`) : [f]));

test("public/ 只有 exam 的六個檔案與入口頁", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pub-")), "public");
  buildPublic({ out });
  assert.deepEqual(walk(out).sort(), ["exam/app.js", "exam/auth.mjs", "exam/config.js", "exam/core.mjs", "exam/exam.css", "exam/index.html", "index.html"]);
});

test("公開檔案裡沒有管理金鑰、標準答案、逐字稿的路徑", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pub-")), "public");
  buildPublic({ out });
  for (const f of walk(out)) {
    const text = readFileSync(join(out, f), "utf8");
    assert.ok(!/SERVICE_ROLE|service_role/.test(text), `${f} 不該出現管理金鑰`);
    assert.ok(!/plan\.json|script\.json|content\/sets/.test(text), `${f} 不該讀標準答案或逐字稿`);
  }
});
