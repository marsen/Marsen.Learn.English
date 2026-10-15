// 上線前檢查腳本本身的測試：草稿要被擋下，補齊之後要能通過。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const script = join(repo, "scripts", "check.mjs");

function run(dir) {
  const result = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  return { code: result.status, out: result.stdout + result.stderr };
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "waitlist-check-"));
  for (const name of ["assets", "listening", "fluency"]) cpSync(join(repo, name), join(dir, name), { recursive: true });
  return dir;
}

// 把草稿補成「可上線」的樣子：去掉待填標記、補標題與描述、接上端點與統計。
function finish(dir) {
  for (const page of ["listening", "fluency"]) {
    const file = join(dir, page, "index.html");
    let html = readFileSync(file, "utf8");
    html = html
      .replace(/ data-todo/g, "")
      .replace(/<title>[^<]*<\/title>/, "<title>練習候補</title>")
      .replace(/(<meta name="description" content=")[^"]*"/, '$1測試用說明"')
      .replace("</head>", '<script defer data-domain="example.test" src="https://plausible.io/js/script.js"></script>\n</head>');
    writeFileSync(file, html);
  }
  const config = join(dir, "assets", "config.js");
  writeFileSync(
    config,
    readFileSync(config, "utf8")
      .replace('formEndpoint: ""', 'formEndpoint: "https://forms.example.test/submit"')
      .replace('contactEmail: ""', 'contactEmail: "me@example.com"')
  );
}

test("目前的草稿不能上線，而且會列出原因", () => {
  const { code, out } = run(repo);
  assert.equal(code, 1);
  assert.match(out, /formEndpoint/);
  assert.match(out, /統計服務/);
  assert.match(out, /title.*草稿|草稿.*title/i);
});

test("頁面上留著 data-todo 就不能上線", () => {
  const dir = fixture();
  try {
    finish(dir);
    const file = join(dir, "fluency", "index.html");
    writeFileSync(file, readFileSync(file, "utf8").replace("<h2>現在的練習方式</h2>", '<h2 data-todo>待填</h2>'));
    const { code, out } = run(dir);
    assert.equal(code, 1);
    assert.match(out, /待填區塊/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("補齊之後可以通過", () => {
  const dir = fixture();
  try {
    finish(dir);
    const { code, out } = run(dir);
    assert.equal(code, 0, out);
    assert.match(out, /檢查通過/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("出現「保證」「官方」這類不實承諾會被擋下，「不保證」不會", () => {
  const dir = fixture();
  try {
    finish(dir);
    const file = join(dir, "listening", "index.html");
    const original = readFileSync(file, "utf8");

    writeFileSync(file, original.replace("</main>", "<p>保證提分，官方授權題庫</p></main>"));
    let result = run(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /保證/);
    assert.match(result.out, /暗示官方關係/);

    writeFileSync(file, original.replace("</main>", "<p>我們不保證分數。</p></main>"));
    result = run(dir);
    assert.equal(result.code, 0, result.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("缺少免責聲明、收款說明或必填欄位會被擋下", () => {
  const dir = fixture();
  try {
    finish(dir);
    const file = join(dir, "listening", "index.html");
    const original = readFileSync(file, "utf8");

    writeFileSync(file, original.replace('data-required="ielts-disclaimer"', ""));
    assert.match(run(dir).out, /ielts-disclaimer/);

    writeFileSync(file, original.replace('data-required="waitlist-notice"', ""));
    assert.match(run(dir).out, /waitlist-notice/);

    writeFileSync(file, original.replace('name="timeframe"', 'name="other"'));
    assert.match(run(dir).out, /缺少欄位：timeframe/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("兩頁區塊結構不一致時會被擋下，確保對照測試只差在題材", () => {
  const dir = fixture();
  try {
    finish(dir);
    const file = join(dir, "fluency", "index.html");
    const html = readFileSync(file, "utf8").replace(/<section id="price"[\s\S]*?<\/section>/, "");
    writeFileSync(file, html);
    const { code, out } = run(dir);
    assert.equal(code, 1);
    assert.match(out, /區塊結構不一致/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("流利度那頁提到雅思只會警告，不會擋下", () => {
  const dir = fixture();
  try {
    finish(dir);
    const file = join(dir, "fluency", "index.html");
    writeFileSync(file, readFileSync(file, "utf8").replace("</main>", "<p>適合準備雅思的人</p></main>"));
    const { code, out } = run(dir);
    assert.equal(code, 0, out);
    assert.match(out, /兩頁應該只差在題材/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
