// 真正的實作：用 fetch 呼叫 Supabase（登入驗證、資料庫、簽名網址）。不用額外套件。
// 環境變數：SUPABASE_URL、SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY（管理金鑰只放在 Vercel 的環境變數）。
export function supabaseFromEnv(env = process.env, fetchImpl = fetch) {
  const url = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const anon = env.SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("缺少 SUPABASE_URL／SUPABASE_ANON_KEY／SUPABASE_SERVICE_ROLE_KEY");

  const rest = async (path, { method = "GET", body, prefer } = {}) => {
    const res = await fetchImpl(`${url}/rest/v1/${path}`, {
      method,
      headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${path} 失敗：${res.status}`);
    return res.status === 204 ? null : res.json();
  };
  const one = async (path) => (await rest(path))?.[0] ?? null;
  const enc = encodeURIComponent;

  return {
    auth: {
      // 用使用者自己的 token 問 Supabase 他是誰（只送公開金鑰，不送管理金鑰）。
      async verify(token) {
        const res = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
        if (!res.ok) return null;
        const u = await res.json();
        return u?.id ? { id: u.id, email: u.email } : null;
      },
    },
    store: {
      listPublishedSets: () => rest("sets?select=set_id,title,topic,question_count&published=eq.true&order=set_id"),
      listFinished: (userId) => rest(`attempts?select=set_id,score,total&user_id=eq.${enc(userId)}&finished_at=not.is.null`),
      getPublishedSet: (id) => one(`sets?select=*&set_id=eq.${enc(id)}&published=eq.true`),
      createAttempt: async (row) => (await rest("attempts?select=id", { method: "POST", body: row, prefer: "return=representation" }))[0],
      getAttempt: (id) => one(`attempts?select=id,user_id,set_id,finished_at&id=eq.${enc(id)}`),
      addFeedback: (row) => rest("feedback", { method: "POST", body: row, prefer: "return=minimal" }),
      getPlan: async (setId) => (await one(`set_answers?select=plan&set_id=eq.${enc(setId)}`))?.plan ?? null,
      // 條件更新：只有還沒完成的才會更新，回傳空陣列就代表已經被別人先送出。
      finishAttempt: async (id, patch) => {
        const rows = await rest(`attempts?id=eq.${enc(id)}&finished_at=is.null&select=id`, { method: "PATCH", body: patch, prefer: "return=representation" });
        return rows.length === 1;
      },
    },
    async signUrl(path, seconds) {
      const res = await fetchImpl(`${url}/storage/v1/object/sign/recordings/${path.split("/").map(enc).join("/")}`, {
        method: "POST",
        headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: seconds }),
      });
      if (!res.ok) throw new Error(`簽名網址失敗：${res.status}`);
      const { signedURL } = await res.json();
      return `${url}/storage/v1${signedURL}`;
    },
  };
}
