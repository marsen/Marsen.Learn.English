// 登入：Supabase 的 email 登入連結（magic link），不用額外套件。
// 流程：signIn(email) 寄連結 → 使用者點連結回到本頁，網址帶 #access_token=… → consumeHash() 存起來 → token() 取用（快過期自動換新）。
const KEY = "exam-auth";

export class AuthError extends Error { constructor(code, message) { super(message); this.code = code; } }

export function createAuth({ config, fetchImpl = fetch.bind(globalThis), storage, location, now = () => Date.now() }) {
  const url = (config.supabaseUrl ?? "").replace(/\/$/, "");
  const read = () => { try { return JSON.parse(storage.getItem(KEY) ?? "null"); } catch { return null; } };
  const write = (v) => { try { v ? storage.setItem(KEY, JSON.stringify(v)) : storage.removeItem(KEY); } catch { /* 無痕模式等情況：這次登入不會被記住 */ } };
  let memory = null; // storage 不能用時，至少這個分頁內維持登入
  const load = () => read() ?? memory;
  const save = (v) => { memory = v; write(v); };

  const decode = (jwt) => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; } };

  return {
    configured: Boolean(url && config.supabaseAnonKey),
    isLocalDev: ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && !url,

    // 回到本頁時，網址 hash 帶著登入結果。回傳 "ok"、{ error } 或 null（沒有登入結果）。
    consumeHash() {
      const hash = location.hash?.replace(/^#/, "");
      if (!hash) return null;
      const p = new URLSearchParams(hash);
      if (p.get("error")) { try { history.replaceState(null, "", location.pathname + location.search); } catch { /* 略 */ } return { error: p.get("error_description") || p.get("error") }; }
      if (!p.get("access_token")) return null;
      save({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_at: Math.floor(now() / 1000) + Number(p.get("expires_in") ?? 3600) });
      try { history.replaceState(null, "", location.pathname + location.search); } catch { /* 略 */ }
      return "ok";
    },

    // 只有本機開發模式用：不寄信，直接當成登入。
    devLogin(name = "dev-tester") {
      if (!this.isLocalDev) throw new AuthError("dev_only", "開發登入只能在 localhost 且沒設定 Supabase 時使用");
      save({ access_token: name.startsWith("dev-") ? name : `dev-${name}`, expires_at: Math.floor(now() / 1000) + 86400 * 365, dev: true });
    },

    async signIn(email, redirectTo = location.origin + location.pathname) {
      if (!this.configured) throw new AuthError("not_configured", "還沒設定登入服務");
      const res = await fetchImpl(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, create_user: false }),
      });
      if (res.ok) return;
      if (res.status === 422 || res.status === 400) throw new AuthError("not_invited", "這個信箱沒有受邀，或格式不對");
      if (res.status === 429) throw new AuthError("rate_limited", "寄得太頻繁，請稍後再試");
      throw new AuthError("failed", "寄信失敗，請稍後再試");
    },

    // 取得有效的 access token；快過期就用 refresh token 換新；換不到就清掉登入。
    async token() {
      const s = load();
      if (!s?.access_token) return null;
      const left = s.expires_at - Math.floor(now() / 1000);
      if (left > 60 || s.dev) return s.access_token;
      if (!s.refresh_token || !this.configured) { save(null); return null; }
      const res = await fetchImpl(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }),
      }).catch(() => null);
      if (!res?.ok) { save(null); return null; }
      const j = await res.json();
      save({ access_token: j.access_token, refresh_token: j.refresh_token ?? s.refresh_token, expires_at: Math.floor(now() / 1000) + Number(j.expires_in ?? 3600) });
      return j.access_token;
    },

    email() { const s = load(); return s?.dev ? `${s.access_token}（開發）` : decode(s?.access_token ?? "").email ?? null; },
    signOut() { save(null); },
  };
}
