import { describe, it, expect } from "vitest";
import { R2AudioStorage } from "./r2AudioStorage";

const storage = new R2AudioStorage({
  accountId: "acc123",
  accessKeyId: "AKID",
  secretAccessKey: "secret",
  bucket: "audio",
});

describe("R2AudioStorage", () => {
  it("應該產生有時效的預簽網址（不連網路）", async () => {
    const url = new URL(
      await storage.downloadUrl("s1-gym-0001/audio-ab12cd34.mp3", 3600),
    );
    expect(url.origin).toBe("https://acc123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/audio/s1-gym-0001/audio-ab12cd34.mp3");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("應該擋下會跳出資料夾的 key", async () => {
    await expect(storage.downloadUrl("../secret.mp3", 60)).rejects.toThrow();
  });
});
