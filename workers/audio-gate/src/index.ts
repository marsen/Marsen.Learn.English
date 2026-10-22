/**
 * audio-gate：在 Cloudflare 各地節點送出考試錄音。
 * 1. 檢查網站發的通行證（exp、sig）
 * 2. 先找這個節點的快取；沒有才從 R2 拿，放進快取
 * 3. 支援 Range（播放器拖進度條）
 * R2 bucket 不對外公開，只有這支程式讀得到。
 */
import { verifyAudioPass } from "./pass";

type R2Object = { body: ReadableStream; httpEtag: string; size: number };
type Env = {
  AUDIO: { get(key: string): Promise<R2Object | null> };
  AUDIO_PASS_SECRET: string;
};
type Ctx = { waitUntil(promise: Promise<unknown>): void };

/** 同一個網址（同一天的通行證）內容不會變：瀏覽器和節點都快取 30 天 */
const CACHE_CONTROL = "public, max-age=2592000, immutable";

const worker = {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Method not allowed", { status: 405 });

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1));
    const ok = await verifyAudioPass({
      key,
      exp: url.searchParams.get("exp"),
      sig: url.searchParams.get("sig"),
      secret: env.AUDIO_PASS_SECRET,
      nowMs: Date.now(),
    });
    if (!ok) return new Response("Forbidden", { status: 403 });

    // 快取用「不含通行證」的網址：不同人、不同天的通行證共用同一份快取
    const cacheKey = new Request(`${url.origin}${url.pathname}`);
    const cache = (caches as unknown as { default: Cache }).default;
    let full = await cache.match(cacheKey);
    if (!full) {
      const obj = await env.AUDIO.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      full = new Response(obj.body, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(obj.size),
          "Cache-Control": CACHE_CONTROL,
          ETag: obj.httpEtag,
          "Accept-Ranges": "bytes",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, full.clone()));
    }
    return withRange(request, full);
  },
};

export default worker;

/** 有 Range 就切出那一段（單一範圍），否則回整個檔案 */
async function withRange(request: Request, full: Response): Promise<Response> {
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!range || (range[1] === "" && range[2] === "")) {
    return request.method === "HEAD" ? new Response(null, full) : full;
  }
  const bytes = new Uint8Array(await full.arrayBuffer());
  const total = bytes.byteLength;
  let start: number;
  let end: number;
  if (range[1] === "") {
    start = Math.max(0, total - Number(range[2]));
    end = total - 1;
  } else {
    start = Number(range[1]);
    end = range[2] === "" ? total - 1 : Math.min(Number(range[2]), total - 1);
  }
  if (start > end || start >= total)
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  const headers = new Headers(full.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(request.method === "HEAD" ? null : bytes.slice(start, end + 1), {
    status: 206,
    headers,
  });
}
