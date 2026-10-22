import { describe, it, expect } from "vitest";
import { CdnAudioStorage } from "./cdnAudioStorage";
import { InMemoryAudioStorage } from "./inMemoryAudioStorage";

const DAY = 24 * 60 * 60 * 1000;

describe("CdnAudioStorage", () => {
  it("應該同一天給同一個網址，隔天換新的", async () => {
    let now = Date.UTC(2026, 9, 22, 3, 0);
    const cdn = new CdnAudioStorage(
      new InMemoryAudioStorage(),
      "https://audio.marsen.me/",
      "s3cret",
      () => now,
    );
    const a = await cdn.downloadUrl("s1-gym-0001/audio-ab12cd34.mp3");
    now += 5 * 60 * 60 * 1000;
    expect(await cdn.downloadUrl("s1-gym-0001/audio-ab12cd34.mp3")).toBe(a);
    now += DAY;
    expect(await cdn.downloadUrl("s1-gym-0001/audio-ab12cd34.mp3")).not.toBe(a);

    const url = new URL(a);
    expect(url.origin + url.pathname).toBe(
      "https://audio.marsen.me/s1-gym-0001/audio-ab12cd34.mp3",
    );
    expect(Number(url.searchParams.get("exp"))).toBe(Date.UTC(2026, 9, 24) / 1000);
  });

  it("應該把存放交給裡面的儲存", async () => {
    const inner = new InMemoryAudioStorage();
    const cdn = new CdnAudioStorage(inner, "https://audio.marsen.me", "s");
    await cdn.put("k.mp3", new Uint8Array([1, 2]), "audio/mpeg");
    expect(await inner.get("k.mp3")).toEqual(new Uint8Array([1, 2]));
  });
});
