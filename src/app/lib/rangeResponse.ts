/**
 * 回傳音檔並支援 HTTP Range（播放器拖曳進度條需要）。
 * 只處理單一範圍 bytes=start-end；其他情況回整個檔案。
 */
export function audioResponse(request: Request, bytes: Uint8Array): Response {
  const total = bytes.byteLength;
  const headers = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    // 錄音的 key 含內容雜湊，同一個網址內容不會變：讓瀏覽器快取一天，重聽、拖進度條不用重新下載
    "Cache-Control": "private, max-age=86400",
  };
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!match || (match[1] === "" && match[2] === "")) {
    return new Response(bytes as BodyInit, {
      headers: { ...headers, "Content-Length": String(total) },
    });
  }
  let start: number;
  let end: number;
  if (match[1] === "") {
    // bytes=-500：最後 500 bytes
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  }
  if (start > end || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }
  return new Response(bytes.slice(start, end + 1) as BodyInit, {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
  });
}

/** 把錄音送給瀏覽器：有短效網址就轉過去（不快取這個轉址），沒有就由網站自己送 */
export function audioSourceResponse(
  request: Request,
  source: { kind: "url"; url: string } | { kind: "bytes"; bytes: Uint8Array },
): Response {
  if (source.kind === "url") {
    return new Response(null, {
      status: 302,
      headers: { Location: source.url, "Cache-Control": "private, no-store" },
    });
  }
  return audioResponse(request, source.bytes);
}
