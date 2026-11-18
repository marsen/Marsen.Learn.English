import { describe, it, expect } from "vitest";
import {
  checkReviewDraft,
  clearReviewDraft,
  draftStep,
  isoOf,
  loadReviewDraft,
  releaseGuardAfter,
  reviewDraftKey,
  sameContent,
  saveReviewDraft,
  withSubmitFallback,
  type ReviewContent,
} from "./reviewDraft";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

const content: ReviewContent = {
  verdicts: { q01: true, set: false },
  aiActions: { "finding:0": { action: "deleted", text: "" } },
  notes: [{ target: "q01", text: "再確認" }],
  comment: "總評",
  confirmed: { "1": "sig" },
  seen: ["q02"],
};
const draft = {
  ...content,
  setId: "s1",
  accountId: "a1",
  baseReviewedAt: null,
  uploadedAt: "2026-11-01T00:00:00.000Z",
};

describe("reviewDraft", () => {
  it("存了讀得回來；鍵帶帳號和題組", () => {
    const s = memoryStorage();
    expect(saveReviewDraft(s, draft, new Date("2026-11-18T00:00:00Z"))).toBe(true);
    expect([...s.m.keys()]).toEqual([reviewDraftKey("a1", "s1")]);
    const back = loadReviewDraft(s, "a1", "s1");
    expect(back).toMatchObject(content);
    expect(back?.savedAt).toBe("2026-11-18T00:00:00.000Z");
  });

  it("別的帳號讀不到；壞掉的內容回 null", () => {
    const s = memoryStorage();
    saveReviewDraft(s, draft);
    expect(loadReviewDraft(s, "a2", "s1")).toBeNull();
    s.setItem(reviewDraftKey("a1", "s1"), "{壞掉");
    expect(loadReviewDraft(s, "a1", "s1")).toBeNull();
  });

  it("寫不進去、讀時丟錯都不丟出來", () => {
    const bad = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
      removeItem: () => {
        throw new Error("x");
      },
    };
    expect(saveReviewDraft(bad, draft)).toBe(false);
    expect(loadReviewDraft(bad, "a1", "s1")).toBeNull();
    expect(() => clearReviewDraft(bad, "a1", "s1")).not.toThrow();
    expect(saveReviewDraft(null, draft)).toBe(false);
  });

  it("清掉後讀不到", () => {
    const s = memoryStorage();
    saveReviewDraft(s, draft);
    clearReviewDraft(s, "a1", "s1");
    expect(loadReviewDraft(s, "a1", "s1")).toBeNull();
  });

  it("內容比較不管 key 順序、seen 順序", () => {
    expect(
      sameContent(content, {
        ...content,
        verdicts: { set: false, q01: true },
        seen: ["q02", "q02"],
      }),
    ).toBe(true);
    expect(sameContent(content, { ...content, comment: "改了" })).toBe(false);
  });

  const base = {
    baseReviewedAt: null,
    uploadedAt: "2026-11-01T00:00:00.000Z",
    targets: new Set(["set", "q01", "q02"]),
    refs: new Set(["finding:0"]),
  };

  it("別台電腦送出過、覆蓋上傳過就過期", () => {
    const d = { ...draft, savedAt: "x" };
    expect(
      checkReviewDraft(d, { ...base, baseReviewedAt: "2026-11-17T00:00:00.000Z" }).ok,
    ).toBe(false);
    expect(
      checkReviewDraft(d, { ...base, uploadedAt: "2026-11-02T00:00:00.000Z" }).ok,
    ).toBe(false);
    expect(checkReviewDraft(d, base).ok).toBe(true);
  });

  it("套用前濾掉不認得的題號和 AI 意見", () => {
    const d = {
      ...draft,
      savedAt: "x",
      verdicts: { q01: true, q99: false },
      aiActions: { "finding:9": { action: "edited" as const, text: "t" } },
      notes: [
        { target: "q99", text: "x" },
        { target: null, text: "整套" },
      ],
      seen: ["q02", "q99"],
    };
    const r = checkReviewDraft(d, base);
    expect(r.ok && r.content).toMatchObject({
      verdicts: { q01: true },
      aiActions: {},
      notes: [{ target: null, text: "整套" }],
      seen: ["q02"],
    });
  });

  it("isoOf 接受 Date 和字串", () => {
    expect(isoOf(new Date("2026-11-18T00:00:00Z"))).toBe("2026-11-18T00:00:00.000Z");
    expect(isoOf("2026-11-18T00:00:00Z")).toBe("2026-11-18T00:00:00.000Z");
    expect(isoOf(null)).toBeNull();
  });
});

describe("送出結果和暫存（AC-3）", () => {
  const base = { loaded: true, key: "改過", baseKey: "網站上", submittedKey: "改過" };

  it("送出成功：暫存刪掉、離開提醒拆掉", () => {
    const result = { saved: true };
    expect(draftStep({ ...base, result })).toBe("clear");
    expect(releaseGuardAfter(result)).toBe(true);
  });

  it("送出失敗（problems）：暫存保留（內容含總評照樣存）、離開提醒留著", () => {
    const result = { problems: [{ code: "submitFailed" }] };
    expect(draftStep({ ...base, result })).toBe("save");
    expect(releaseGuardAfter(result)).toBe(false);
    const s = memoryStorage();
    saveReviewDraft(s, { ...draft, comment: "總評還在" });
    expect(loadReviewDraft(s, "a1", "s1")?.comment).toBe("總評還在");
  });

  it("送出成功後又改了：照樣存", () => {
    expect(draftStep({ ...base, key: "又改", result: { saved: true } })).toBe("save");
  });

  it("還沒讀完暫存不動；內容和網站上一樣就刪", () => {
    expect(draftStep({ ...base, loaded: false, result: {} })).toBe("wait");
    expect(draftStep({ ...base, key: "網站上", result: {} })).toBe("clear");
  });

  it("連不到網站（action 丟例外）：改成送出失敗，不丟到錯誤頁", async () => {
    const failed = { problems: [{ code: "submitFailed" as const }] };
    const offline = withSubmitFallback(async () => {
      throw new TypeError("Failed to fetch");
    }, failed);
    await expect(offline()).resolves.toBe(failed);
    const ok = withSubmitFallback(
      async (): Promise<{ saved?: boolean }> => ({ saved: true }),
      {},
    );
    await expect(ok()).resolves.toEqual({ saved: true });
  });

  it("框架自己的例外（redirect）照樣丟出去", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    const run = withSubmitFallback(
      async () => {
        throw redirect;
      },
      {},
      (e) => {
        if (e === redirect) throw e;
      },
    );
    await expect(run()).rejects.toBe(redirect);
  });
});
