import { describe, it, expect } from "vitest";
import { InMemoryRateLimiter } from "./inMemoryRateLimiter";

describe("InMemoryRateLimiter", () => {
  it("應該在時間窗內超過次數就擋，過了時間窗再放行", async () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter(() => now);
    expect(await limiter.hit("a", 2, 1000)).toBe(true);
    expect(await limiter.hit("a", 2, 1000)).toBe(true);
    expect(await limiter.hit("a", 2, 1000)).toBe(false);
    expect(await limiter.hit("b", 2, 1000)).toBe(true);
    now = 1000;
    expect(await limiter.hit("a", 2, 1000)).toBe(true);
  });
});
