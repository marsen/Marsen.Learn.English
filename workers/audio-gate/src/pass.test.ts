import { describe, it, expect } from "vitest";
import { verifyAudioPass } from "./pass";
import { signAudioPass } from "@/infrastructure/storage/audioPass";

const KEY = "s1-gym-0001/audio-ab12cd34.mp3";
const SECRET = "a-long-enough-secret";
const NOW = Date.UTC(2026, 9, 22);
const EXP = NOW / 1000 + 3600;

describe("verifyAudioPass（Workers）", () => {
  it("應該接受網站簽的通行證（兩邊格式一致）", async () => {
    const sig = signAudioPass(KEY, EXP, SECRET);
    expect(
      await verifyAudioPass({
        key: KEY,
        exp: String(EXP),
        sig,
        secret: SECRET,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it("應該擋下過期、改過 key、簽名不對的", async () => {
    const sig = signAudioPass(KEY, EXP, SECRET);
    const base = { key: KEY, exp: String(EXP), sig, secret: SECRET, nowMs: NOW };
    expect(await verifyAudioPass({ ...base, nowMs: EXP * 1000 })).toBe(false);
    expect(await verifyAudioPass({ ...base, key: "s1-other/audio.mp3" })).toBe(false);
    expect(await verifyAudioPass({ ...base, sig: "0".repeat(64) })).toBe(false);
    expect(await verifyAudioPass({ ...base, exp: null })).toBe(false);
  });
});
