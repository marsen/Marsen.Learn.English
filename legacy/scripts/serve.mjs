// 本機靜態伺服器，沒有任何相依套件。
// 用法：node scripts/serve.mjs [port]    （預設 5173，傳 0 會自動挑一個空的 port）
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { makeDevApi } from "./dev-api.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};

// 不對外提供的路徑：程式碼以外的東西不該被瀏覽器讀到。
const HIDDEN = ["node_modules", ".git", "scripts", "tests", "package.json", "package-lock.json"];

const readBody = (req) => new Promise((ok, fail) => {
  let data = "";
  req.on("data", (c) => { data += c; if (data.length > 1e6) fail(new Error("太大")); });
  req.on("end", () => ok(data));
  req.on("error", fail);
});

export function startServer(port = 5173) {
  const dev = makeDevApi(root);
  const ROUTES = { sets: "GET", start: "POST", finish: "POST", claim: "POST", result: "POST", feedback: "POST" };
  const server = createServer(async (req, res) => {
    try {
      // 本機假後端：和正式環境同一份 api/_core.mjs
      const m = /^\/api\/(\w+)$/.exec(new URL(req.url, "http://localhost").pathname);
      if (m) {
        const name = m[1];
        if (!ROUTES[name]) { res.writeHead(404).end("Not found"); return; }
        if (req.method !== ROUTES[name]) { res.writeHead(405, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "不支援的請求方式" })); return; }
        let body;
        try { const raw = await readBody(req); body = raw ? JSON.parse(raw) : undefined; } catch { res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "不是 JSON" })); return; }
        const out = await dev.api[name]({ headers: req.headers, body });
        res.writeHead(out.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(out.body));
        return;
      }
      const url = new URL(req.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      const target = normalize(join(root, pathname));

      // 擋掉 ../ 跳出專案資料夾的路徑
      if (target !== root && !target.startsWith(root + sep)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const first = target.slice(root.length + 1).split(sep)[0];
      if (HIDDEN.includes(first)) {
        res.writeHead(404).end("Not found");
        return;
      }

      let filePath = target;
      const info = await stat(filePath).catch(() => null);
      if (info && info.isDirectory()) {
        if (!pathname.endsWith("/")) {
          res.writeHead(301, { Location: pathname + "/" + url.search }).end();
          return;
        }
        filePath = join(filePath, "index.html");
      }

      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });

  server.dev = dev;
  return new Promise((resolveStart) => {
    server.listen(port, "127.0.0.1", () => resolveStart(server));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.argv[2] !== undefined ? Number(process.argv[2]) : 5173;
  const server = await startServer(port);
  const actual = server.address().port;
  console.log("本機預覽：");
  console.log(`  聽力測驗（免登入作答，結果連結會直接顯示在頁面上）：http://127.0.0.1:${actual}/exam/`);
  console.log(`  候補頁：http://127.0.0.1:${actual}/listening/?src=local  、  http://127.0.0.1:${actual}/fluency/?src=local`);
  console.log("按 Ctrl+C 結束。");
}
