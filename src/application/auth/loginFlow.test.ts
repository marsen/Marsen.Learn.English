import { describe, it, expect, beforeEach } from "vitest";
import { RequestLoginLink } from "./requestLoginLink";
import { VerifyLoginLink } from "./verifyLoginLink";
import type { LoginMailer } from "./ports";
import { InMemoryAccountRepository } from "@/infrastructure/persistence/inMemoryAccountRepository";
import { InMemoryLoginTokenRepository } from "@/infrastructure/persistence/inMemoryLoginTokenRepository";
import { CryptoSecretTokens } from "@/infrastructure/auth/cryptoSecretTokens";
import { LOGIN_TOKEN_TTL_MINUTES } from "@/domain/auth/loginToken";

class FakeMailer implements LoginMailer {
  sent: { to: string; link: string }[] = [];
  notices: { to: string; subject: string }[] = [];
  async sendLoginLink(to: string, link: string) {
    this.sent.push({ to, link });
  }
  async sendAdminNotice(to: string, subject: string) {
    this.notices.push({ to, subject });
  }
}

const SITE = "http://localhost:3000";
const tokenOf = (link: string) => new URL(link).searchParams.get("token") ?? "";

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
  new RequestLoginLink(accounts, tokens, secrets, mailer, SITE, now).execute({
    email,
    ...extra,
  });
/** 時間往後推幾秒 */
const tick = (seconds: number) => {
  clock = new Date(clock.getTime() + seconds * 1000);
};
const verify = (token: string) =>
  new VerifyLoginLink(accounts, tokens, secrets, now).execute({ token });

describe("RequestLoginLink", () => {
  it("應該寄登入連結給已存在的帳號（email 大小寫不拘）", async () => {
    const r = await request(" Admin@Marsen.me ");
    expect(r.ok).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("admin@marsen.me");
    expect(mailer.sent[0].link.startsWith(`${SITE}/auth/verify?token=`)).toBe(true);
  });

  it("應該也寄給還沒有帳號的 email（註冊），但點連結前不建立帳號", async () => {
    const r = await request("new@example.com");
    expect(r.ok).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    expect(await accounts.findByEmail("new@example.com")).toBeNull();
  });

  it("應該擋下格式錯誤的 email", async () => {
    const r = await request("not-an-email");
    expect(r.ok).toBe(false);
    expect(mailer.sent).toHaveLength(0);
  });

  it("應該只存登入碼的雜湊，不存原始碼", async () => {
    await request("admin@marsen.me");
    const token = tokenOf(mailer.sent[0].link);
    expect(tokens.all().some((t) => t.tokenHash === token)).toBe(false);
    expect(tokens.all()[0].tokenHash).toBe(secrets.hash(token));
  });
});

describe("VerifyLoginLink", () => {
  it("應該用有效連結登入並回傳帳號 id", async () => {
    await request("admin@marsen.me");
    const r = await verify(tokenOf(mailer.sent[0].link));
    const account = await accounts.findByEmail("admin@marsen.me");
    expect(r).toEqual({ ok: true, accountId: account?.id, isNew: false, guestId: null });
    expect(account?.roles).toEqual(["admin"]);
  });

  it("應該在新 email 第一次點連結時建立學生帳號（註冊）", async () => {
    await request("New@Example.com");
    const r = await verify(tokenOf(mailer.sent[0].link));
    const account = await accounts.findByEmail("new@example.com");
    expect(r).toEqual({ ok: true, accountId: account?.id, isNew: true, guestId: null });
    expect(account?.roles).toEqual(["student"]);
  });

  it("應該拒絕用過第二次的連結", async () => {
    await request("admin@marsen.me");
    const token = tokenOf(mailer.sent[0].link);
    await verify(token);
    expect((await verify(token)).ok).toBe(false);
  });

  it("應該拒絕過期的連結", async () => {
    await request("admin@marsen.me");
    clock = new Date(clock.getTime() + LOGIN_TOKEN_TTL_MINUTES * 60_000 + 1);
    expect((await verify(tokenOf(mailer.sent[0].link))).ok).toBe(false);
  });

  it("應該拒絕亂填的碼", async () => {
    expect((await verify("made-up")).ok).toBe(false);
    expect((await verify("")).ok).toBe(false);
  });
});

describe("跨裝置：申請連結的瀏覽器", () => {
  it("應該把申請時的瀏覽器識別記在登入碼裡，點連結時交回去", async () => {
    await request("new@example.com", { guestId: "browser-A" });
    const r = await verify(tokenOf(mailer.sent[0].link));
    expect(r.ok && r.guestId).toBe("browser-A");
  });
});

describe("寄信保護", () => {
  it("應該要同一個 email 兩封至少隔 60 秒", async () => {
    expect((await request("a@example.com")).ok).toBe(true);
    tick(30);
    const r = await request("a@example.com");
    expect(r).toEqual({ ok: false, error: "剛寄過，請等 30 秒再試" });
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
    expect(blocked).toEqual({ ok: false, error: "今天註冊人數已滿，請明天再來" });
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
