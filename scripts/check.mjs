// 上線前檢查：任何一項「錯誤」都會讓指令以非 0 結束，部署流程可以直接用它擋下草稿。
// 用法：node scripts/check.mjs [專案資料夾]
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(process.argv[2] || fileURLToPath(new URL("..", import.meta.url)));
const PAGES = ["listening", "fluency"];

// 這些字眼會讓頁面變成不實承諾，一律擋下。「不保證」這類否定寫法不受影響。
const BANNED = [
  { pattern: /(?<!不)(?<!不能)(?<!無法)保證/, label: "保證" },
  { pattern: /必過|包過|提分保證|保證提分/, label: "必過／包過" },
  { pattern: /官方授權|官方認證|官方合作|官方題庫/, label: "暗示官方關係" },
  { pattern: /\bofficial\b/i, label: "official" },
];

// 只看真正的 <script> 標籤。註解裡提到 Plausible、Umami 不算，否則檢查會被說明文字騙過。
const ANALYTICS_HINT = /plausible\.io|umami|cloudflareinsights|googletagmanager|data-analytics|data-domain|data-website-id|data-cf-beacon/i;

function hasAnalytics(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  return [...withoutComments.matchAll(/<script\b[^>]*>/gi)].some((match) => ANALYTICS_HINT.test(match[0]));
}
const REQUIRED_MARKERS = {
  all: ["waitlist-notice", "privacy-note", "footer-disclaimer"],
  listening: ["ielts-disclaimer"],
};

const issues = [];
const add = (level, where, message) => issues.push({ level, where, message });

function read(relative) {
  const path = join(root, relative);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function structureOf(html) {
  const ids = [];
  for (const match of html.matchAll(/<(section|footer)\b[^>]*\bid="([^"]+)"/g)) ids.push(`${match[1]}#${match[2]}`);
  return ids;
}

// ---- 設定檔 ----------------------------------------------------------------

const configSource = read("assets/config.js");
if (configSource === null) {
  add("error", "assets/config.js", "找不到設定檔。");
} else {
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(configSource, sandbox, { timeout: 1000 });
    const cfg = sandbox.window.WAITLIST_CONFIG || {};
    if (!cfg.formEndpoint) {
      add("error", "assets/config.js", "formEndpoint 是空的：表單目前不會把資料送到任何地方。");
    } else if (!/^https:\/\//.test(cfg.formEndpoint)) {
      add("error", "assets/config.js", "formEndpoint 必須是 https:// 開頭。");
    }
    if (!cfg.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cfg.contactEmail)) {
      add("error", "assets/config.js", "contactEmail 沒填或格式不對：頁面上「要求刪除資料」的信箱會是空的。");
    }
    if (cfg.formMode === "no-cors") {
      add("warn", "assets/config.js", "formMode 是 no-cors：送出後無法確認對方是否真的收到，上線後請自己送一筆測試並到後台確認。");
    }
  } catch (error) {
    add("error", "assets/config.js", "設定檔無法執行：" + error.message);
  }
}

// ---- 各頁 ------------------------------------------------------------------

const structures = {};

for (const name of PAGES) {
  const file = `${name}/index.html`;
  const html = read(file);
  if (html === null) {
    add("error", file, "找不到頁面。");
    continue;
  }
  const text = visibleText(html);

  const todos = [...html.matchAll(/<([a-z0-9]+)\b[^>]*\bdata-todo\b[^>]*>([\s\S]*?)<\/\1>/g)];
  if (todos.length) {
    add("error", file, `還有 ${todos.length} 個待填區塊（data-todo）。`);
    for (const todo of todos.slice(0, 5)) {
      add("info", file, "  " + todo[2].replace(/<[^>]+>/g, "").trim().slice(0, 40));
    }
  }

  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  if (!title.trim() || title.includes("草稿")) add("error", file, "<title> 還是草稿或空的。");

  const description = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || "";
  if (!description.trim() || description.includes("草稿")) add("error", file, "meta description 還是草稿或空的。");

  if (!hasAnalytics(html)) {
    add("error", file, "找不到統計服務的 script：沒有造訪數就算不出轉換率。");
  }

  if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) {
    add("note", file, "目前設定 noindex（搜尋引擎不會收錄）。測試期間這是合理的；要公開收錄時再拿掉。");
  }

  for (const marker of [...REQUIRED_MARKERS.all, ...(REQUIRED_MARKERS[name] || [])]) {
    if (!html.includes(`data-required="${marker}"`)) add("error", file, `缺少必要區塊：${marker}。`);
  }

  for (const field of ["email", "timeframe", "website"]) {
    if (!new RegExp(`name="${field}"`).test(html)) add("error", file, `表單缺少欄位：${field}。`);
  }

  for (const { pattern, label } of BANNED) {
    const hit = text.match(pattern);
    if (hit) add("error", file, `出現不該有的字眼（${label}）：「${hit[0]}」。`);
  }

  if (name === "fluency" && /IELTS|雅思/i.test(text)) {
    add("warn", file, "英文流利度這頁提到了雅思：兩頁應該只差在題材，這樣對照結果才能解讀。");
  }

  structures[name] = structureOf(html);
}

if (structures.listening && structures.fluency) {
  const a = structures.listening.join(" > ");
  const b = structures.fluency.join(" > ");
  if (a !== b) {
    add("error", "兩頁對照", `區塊結構不一致，無法比較。\n  listening: ${a}\n  fluency:   ${b}`);
  }
}

// ---- 輸出 ------------------------------------------------------------------

const labels = { error: "錯誤", warn: "警告", note: "提醒", info: "" };
for (const { level, where, message } of issues) {
  const prefix = level === "info" ? "" : `[${labels[level]}] ${where}：`;
  console.log(prefix + message);
}

const errors = issues.filter((i) => i.level === "error").length;
const warns = issues.filter((i) => i.level === "warn").length;
console.log(
  errors
    ? `\n不能上線：${errors} 個錯誤、${warns} 個警告。`
    : `\n檢查通過：0 個錯誤、${warns} 個警告。`
);
process.exit(errors ? 1 : 0);
