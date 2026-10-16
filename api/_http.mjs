// 把核心函式接到 Vercel 的 (req, res)。
import { createApi } from "./_core.mjs";
import { supabaseFromEnv } from "./_supabase.mjs";

let cached;
// 結果連結要導回哪個網站：優先用環境變數 SITE_URL（例如 https://listening.example.com），沒設就用這次請求的網域。
const siteUrlOf = (req) => (process.env.SITE_URL ?? `https://${req.headers?.["x-forwarded-host"] ?? req.headers?.host}`).replace(/\/$/, "");
const api = () => (cached ??= (() => { const s = supabaseFromEnv(); return createApi({ auth: s.auth, store: s.store, signUrl: s.signUrl, mailer: s.mailer, siteUrl: siteUrlOf }); })());

export const handle = (name, method) => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== method) { res.status(405).json({ error: "不支援的請求方式" }); return; }
  try {
    const out = await api()[name](req);
    res.status(out.status).json(out.body);
  } catch (e) {
    console.error(name, e.message);
    res.status(500).json({ error: "伺服器錯誤" });
  }
};
