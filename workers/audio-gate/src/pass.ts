/**
 * 驗證網站發的錄音通行證（簽名的那一半在 src/infrastructure/storage/audioPass.ts）。
 * 簽名內容：「錄音 key:到期時間（秒）」，HMAC-SHA256，十六進位字串。
 * 只用 Web Crypto，Cloudflare Workers 和 Node 都能跑。
 */
const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 長度一樣才比，逐字元比完（不提早結束，避免從回應時間猜出簽名） */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyAudioPass(input: {
  key: string;
  exp: string | null;
  sig: string | null;
  secret: string;
  nowMs: number;
}): Promise<boolean> {
  if (!input.exp || !input.sig || !/^\d+$/.test(input.exp)) return false;
  if (Number(input.exp) * 1000 <= input.nowMs) return false;
  const expected = await hmacHex(input.secret, `${input.key}:${input.exp}`);
  return sameText(expected, input.sig.toLowerCase());
}
