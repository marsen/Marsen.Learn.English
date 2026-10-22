import type { RateLimiter } from "@/application/examSet/ports";

/**
 * 記憶體版次數限制（單一主機）。之後有多台主機時再換成存在資料庫或 KV。
 * 固定時間窗：每個 key 在 windowMs 內最多 limit 次。
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const t = this.now();
    const w = this.windows.get(key);
    if (!w || t - w.start >= windowMs) {
      this.windows.set(key, { start: t, count: 1 });
      this.sweep(t, windowMs);
      return true;
    }
    if (w.count >= limit) return false;
    w.count += 1;
    return true;
  }

  /** 偶爾清掉過期的 key，避免一直變大 */
  private sweep(t: number, windowMs: number) {
    if (this.windows.size < 10_000) return;
    for (const [k, w] of this.windows)
      if (t - w.start >= windowMs) this.windows.delete(k);
  }
}
