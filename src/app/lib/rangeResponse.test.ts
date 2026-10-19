import { describe, it, expect } from "vitest";
import { audioResponse } from "./rangeResponse";

const bytes = new Uint8Array(100).map((_, i) => i);
const req = (range?: string) =>
  new Request("http://x/a", { headers: range ? { range } : {} });

describe("audioResponse", () => {
  it("應該在沒有 Range 時回整個檔案", async () => {
    const r = audioResponse(req(), bytes);
    expect(r.status).toBe(200);
    expect((await r.arrayBuffer()).byteLength).toBe(100);
  });

  it("應該回指定範圍", async () => {
    const r = audioResponse(req("bytes=10-19"), bytes);
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 10-19/100");
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
  });

  it("應該處理開放結尾與最後 N bytes", async () => {
    expect(audioResponse(req("bytes=90-"), bytes).headers.get("content-range")).toBe(
      "bytes 90-99/100",
    );
    expect(audioResponse(req("bytes=-5"), bytes).headers.get("content-range")).toBe(
      "bytes 95-99/100",
    );
  });

  it("應該對超出範圍回 416", () => {
    expect(audioResponse(req("bytes=200-"), bytes).status).toBe(416);
  });
});
