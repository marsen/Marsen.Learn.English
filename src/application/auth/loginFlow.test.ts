import { describe, it, expect, beforeEach } from "vitest";
import { RequestLoginCode } from "./requestLoginCode";
import { VerifyLoginCode } from "./verifyLoginCode";
import type { LoginMailer } from "./ports";
import { InMemoryAccountRepository } from "@/infrastructure/persistence/inMemoryAccountRepository";
import { InMemoryLoginTokenRepository } from "@/infrastructure/persistence/inMemoryLoginTokenRepository";
import { CryptoSecretTokens } from "@/infrastructure/auth/cryptoSecretTokens";
import { LOGIN_TOKEN_TTL_MINUTES, MAX_CODE_ATTEMPTS } from "@/domain/auth/loginToken";

class FakeMailer implements LoginMailer {
  sent: { to: string; code: string }[] = [];
  notices: { to: string; subject: string }[] = [];
  async sendLoginCode(to: string, code: string) {
    this.sent.push({ to, code });
  }
  async sendAdminNotice(to: string, subject: string) {
    this.notices.push({ to, subject });
  }
}

let accounts: InMemoryAccountRepository;
let tokens: InMemoryLoginTokenRepository;
let mailer: FakeMailer;
let clock: Date;
const secrets = new CryptoSecretTokens();
const now = () => clock;

beforeEach(async () => {
  accounts = new InMemoryAccountRepository();
  tokens = new InMemoryLoginTokenRepository();
  mailer = new FakeMailer();
  clock = new Date("2026-10-19T12:00:00Z");
  const a = await accounts.create("admin@marsen.me");
  await accounts.addRole(a.id, "admin");
});

const request = (email: string, extra: { guestId?: string; ipHash?: string } = {}) =>
  new RequestLoginCode(accounts, tokens, secrets, mailer, now).execute({
    email,
    ...extra,
  });
/** 時間往後推幾秒 */
const tick = (seconds: number) => {
  clock = new Date(clock.getTime() + seconds * 1000);
};
const verify = (email: string, code: string) =>
  new VerifyLoginCode(accounts, tokens, secrets, now).execute({ email, code });
const lastCode = () => mailer.sent.at(-1)?.code ?? "";
/** 跟寄出的碼不一樣的 6 位數 */
const wrong = (code: string) => (code === "000000" ? "111111" : "000000");

describe("RequestLoginCode", () => {
  it("應該寄 6 位數登入碼給已存在的帳號（email 大小寫不拘）", async () => {
    const r = await request(" Admin@Marsen.me ");
    expect(r.ok).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("admin@marsen.me");
    expect(mailer.sent[0].code).toMatch(/^\d{6}$/);
  });

  it("應該也寄給還沒有帳號的 email（註冊），但輸入登入碼前不建立帳號", async () => {
    const r = await request("new@example.com");
    expect(r.ok).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    expect(await accounts.findByEmail("new@example.com")).toBeNull();
  });

  it("應該擋下格式錯誤的 email", async () => {
    const r = await request("not-an-email");
    expect(r).toEqual({ ok: false, error: { code: "invalidEmail" } });
    expect(mailer.sent).toHaveLength(0);
  });

  it("應該不存原始登入碼", async () => {
    await request("admin@marsen.me");
    const saved = JSON.stringify(tokens.all());
    expect(saved).not.toContain(`"${lastCode()}"`);
    expect(tokens.all()[0].codeHash).toBe(secrets.hash(`admin@marsen.me:${lastCode()}`));
  });
});

describe("VerifyLoginCode", () => {
  it("應該用正確的登入碼登入並回傳帳號 id", async () => {
    await request("admin@marsen.me");
    const r = await verify("Admin@Marsen.me", lastCode());
    const account = await accounts.findByEmail("admin@marsen.me");
    expect(r).toEqual({ ok: true, accountId: account?.id, isNew: false, guestId: null });
    expect(account?.roles).toEqual(["admin"]);
  });

  it("應該接受中間有空白的登入碼", async () => {
    await request("admin@marsen.me");
    const c = lastCode();
    expect((await verify("admin@marsen.me", ` ${c.slice(0, 3)} ${c.slice(3)} `)).ok).toBe(
      true,
    );
  });

  it("應該在新 email 第一次登入時建立學生帳號（註冊）", async () => {
    await request("New@Example.com");
    const r = await verify("new@example.com", lastCode());
    const account = await accounts.findByEmail("new@example.com");
    expect(r).toEqual({ ok: true, accountId: account?.id, isNew: true, guestId: null });
    expect(account?.roles).toEqual(["student"]);
  });

  it("應該拒絕用過第二次的登入碼", async () => {
    await request("admin@marsen.me");
    await verify("admin@marsen.me", lastCode());
    expect(await verify("admin@marsen.me", lastCode())).toEqual({
      ok: false,
      error: { code: "codeExpired" },
    });
  });

  it(`應該拒絕超過 ${LOGIN_TOKEN_TTL_MINUTES} 分鐘的登入碼`, async () => {
    await request("admin@marsen.me");
    tick(LOGIN_TOKEN_TTL_MINUTES * 60 + 1);
    expect(await verify("admin@marsen.me", lastCode())).toEqual({
      ok: false,
      error: { code: "codeExpired" },
    });
  });

  it("應該拒絕不是 6 位數字的輸入，而且不算一次錯誤", async () => {
    await request("admin@marsen.me");
    expect(await verify("admin@marsen.me", "12ab")).toEqual({
      ok: false,
      error: { code: "malformedCode" },
    });
    expect(tokens.all()[0].failedAttempts).toBe(0);
  });

  it(`應該在輸錯時告訴還剩幾次，錯 ${MAX_CODE_ATTEMPTS} 次就作廢（連正確的碼也不能用）`, async () => {
    await request("admin@marsen.me");
    const code = lastCode();
    expect(await verify("admin@marsen.me", wrong(code))).toEqual({
      ok: false,
      error: { code: "wrongCode", remaining: 2 },
    });
    expect(await verify("admin@marsen.me", wrong(code))).toEqual({
      ok: false,
      error: { code: "wrongCode", remaining: 1 },
    });
    expect(await verify("admin@marsen.me", wrong(code))).toEqual({
      ok: false,
      error: { code: "codeExpired" },
    });
    expect((await verify("admin@marsen.me", code)).ok).toBe(false);
  });

  it("應該只認最新的一組登入碼", async () => {
    await request("admin@marsen.me");
    const first = lastCode();
    tick(61);
    await request("admin@marsen.me");
    if (first !== lastCode())
      expect((await verify("admin@marsen.me", first)).ok).toBe(false);
    expect((await verify("admin@marsen.me", lastCode())).ok).toBe(true);
  });

  it("應該拒絕別人的 email 配上自己的登入碼", async () => {
    await request("a@example.com");
    const codeOfA = lastCode();
    tick(1);
    await request("b@example.com");
    if (codeOfA !== lastCode())
      expect((await verify("b@example.com", codeOfA)).ok).toBe(false);
    expect((await verify("c@example.com", codeOfA)).ok).toBe(false);
  });
});

describe("路人作答：申請登入碼的瀏覽器", () => {
  it("應該把申請時的瀏覽器識別記下來，登入時交回去", async () => {
    await request("new@example.com", { guestId: "browser-A" });
    const r = await verify("new@example.com", lastCode());
    expect(r.ok && r.guestId).toBe("browser-A");
  });
});

describe("寄信保護", () => {
  it("應該要同一個 email 兩封至少隔 60 秒", async () => {
    expect((await request("a@example.com")).ok).toBe(true);
    tick(30);
    const r = await request("a@example.com");
    expect(r).toEqual({ ok: false, error: { code: "cooldown", seconds: 30 } });
    tick(30);
    expect((await request("a@example.com")).ok).toBe(true);
    expect(mailer.sent).toHaveLength(2);
  });

  it("應該擋下同一個 email 每小時第 6 封", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await request("a@example.com")).ok).toBe(true);
      tick(61);
    }
    expect((await request("a@example.com")).ok).toBe(false);
    tick(3600);
    expect((await request("a@example.com")).ok).toBe(true);
  });

  it("應該擋下同一個 IP 每小時第 21 封（換不同 email 也一樣）", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await request(`u${i}@example.com`, { ipHash: "ip-1" })).ok).toBe(true);
    }
    expect((await request("u99@example.com", { ipHash: "ip-1" })).ok).toBe(false);
    expect((await request("u99@example.com", { ipHash: "ip-2" })).ok).toBe(true);
  });

  it("應該在 24 小時內寄滿 95 封後擋下新 email，但已有帳號照常寄", async () => {
    for (let i = 0; i < 95; i++) await request(`u${i}@example.com`);
    const blocked = await request("late@example.com");
    expect(blocked).toEqual({ ok: false, error: { code: "signupsFull" } });
    expect((await request("admin@marsen.me")).ok).toBe(true);
    tick(24 * 3600);
    expect((await request("late@example.com")).ok).toBe(true);
  });

  it("應該在剛好寄到第 50、80 封時通知管理員，其他時候不通知", async () => {
    const teacher = await accounts.create("t@marsen.me");
    await accounts.addRole(teacher.id, "teacher");
    for (let i = 1; i <= 49; i++) await request(`u${i}@example.com`);
    expect(mailer.notices).toHaveLength(0);
    await request("u50@example.com");
    expect(mailer.notices).toEqual([
      { to: "admin@marsen.me", subject: "登入信今天已寄 50 封" },
    ]);
    for (let i = 51; i <= 79; i++) await request(`u${i}@example.com`);
    expect(mailer.notices).toHaveLength(1);
    await request("u80@example.com");
    await request("u81@example.com");
    expect(mailer.notices.map((n) => n.subject)).toEqual([
      "登入信今天已寄 50 封",
      "登入信今天已寄 80 封",
    ]);
  });
});
