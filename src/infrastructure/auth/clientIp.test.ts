import { describe, it, expect } from "vitest";
import { clientIpFrom } from "./clientIp";

describe("clientIpFrom", () => {
  it("應該取最後一個（Cloud Run 接上去的真正 IP），不管使用者自己填了什麼", () => {
    expect(clientIpFrom("1.2.3.4, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIpFrom("1.1.1.1, 2.2.2.2,203.0.113.9")).toBe("203.0.113.9");
  });

  it("應該在只有一個 IP 時直接用它", () => {
    expect(clientIpFrom("203.0.113.9")).toBe("203.0.113.9");
  });

  it("應該在沒有標頭時回 null", () => {
    expect(clientIpFrom(null)).toBeNull();
    expect(clientIpFrom("")).toBeNull();
    expect(clientIpFrom(" , ")).toBeNull();
  });
});
