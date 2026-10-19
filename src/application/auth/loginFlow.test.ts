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
  async sendLoginLink(to: string, link: string) {
    this.sent.push({ to, link });
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

const request = (email: string) =>
  new RequestLoginLink(accounts, tokens, secrets, mailer, SITE, now).execute({ email });
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

  it("應該對不存在的帳號回成功但不寄信", async () => {
    const r = await request("nobody@example.com");
    expect(r.ok).toBe(true);
    expect(mailer.sent).toHaveLength(0);
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
    expect(r).toEqual({ ok: true, accountId: account?.id });
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
