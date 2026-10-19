import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

describe("session", () => {
  it("應該能驗證自己簽出的 token，並取回帳號 id", async () => {
    const token = await createSessionToken("account-1");
    expect(await verifySessionToken(token)).toEqual({ sub: "account-1" });
  });

  it("應該拒絕被竄改的 token", async () => {
    const token = await createSessionToken("account-1");
    expect(await verifySessionToken(token.slice(0, -2) + "xx")).toBeNull();
  });
});
