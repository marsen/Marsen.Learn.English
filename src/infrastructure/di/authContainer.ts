import type { AccountRepository } from "@/domain/account/accountRepository";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import type { LoginMailer } from "@/application/auth/ports";
import {
  AddAccount,
  ListAccounts,
  SetAccountRoles,
} from "@/application/account/manageAccounts";
import { RequestLoginLink } from "@/application/auth/requestLoginLink";
import { VerifyLoginLink } from "@/application/auth/verifyLoginLink";
import { env } from "@/infrastructure/config/env";
import { CryptoSecretTokens } from "@/infrastructure/auth/cryptoSecretTokens";
import { DevMailer } from "@/infrastructure/mail/devMailer";
import { ResendMailer } from "@/infrastructure/mail/resendMailer";
import { DrizzleAccountRepository } from "@/infrastructure/persistence/drizzleAccountRepository";
import { DrizzleLoginTokenRepository } from "@/infrastructure/persistence/drizzleLoginTokenRepository";
import { InMemoryAccountRepository } from "@/infrastructure/persistence/inMemoryAccountRepository";
import { InMemoryLoginTokenRepository } from "@/infrastructure/persistence/inMemoryLoginTokenRepository";

/**
 * Composition Root（登入／帳號）。
 * - 有 DATABASE_URL → Drizzle（Neon）；沒有 → 記憶體，並預建 admin@marsen.me（管理員＋老師）。
 * - 有 RESEND_API_KEY → 真的寄信；沒有且非正式環境 → DevMailer（連結顯示在登入頁）。
 * 記憶體物件放在 globalThis，讓開發伺服器重新載入模組時資料不會不見。
 */
type Container = {
  accounts: AccountRepository;
  tokens: LoginTokenRepository;
  mailer: LoginMailer;
};

const DEV_SEED_EMAIL = "admin@marsen.me";

const globalStore = globalThis as unknown as { __authContainer?: Container };

function build(): Container {
  const accounts = env.databaseUrl ? new DrizzleAccountRepository() : devAccounts();
  const tokens = env.databaseUrl
    ? new DrizzleLoginTokenRepository()
    : new InMemoryLoginTokenRepository();
  return { accounts, tokens, mailer: buildMailer() };
}

function devAccounts(): AccountRepository {
  const repo = new InMemoryAccountRepository([
    {
      id: "dev-admin",
      email: DEV_SEED_EMAIL,
      roles: ["admin", "teacher"],
      createdAt: new Date(),
    },
  ]);
  return repo;
}

function buildMailer(): LoginMailer {
  if (env.resendApiKey) {
    if (!env.mailFrom) throw new Error("[env] 設了 RESEND_API_KEY 也要設 MAIL_FROM");
    return new ResendMailer(env.resendApiKey, env.mailFrom);
  }
  if (env.isProduction) throw new Error("[env] 正式環境必須設定 RESEND_API_KEY");
  return new DevMailer();
}

function container(): Container {
  globalStore.__authContainer ??= build();
  return globalStore.__authContainer;
}

const secrets = new CryptoSecretTokens();

export function getAccountRepository(): AccountRepository {
  return container().accounts;
}

export function requestLoginLink(): RequestLoginLink {
  const c = container();
  return new RequestLoginLink(c.tokens, secrets, c.mailer, env.siteUrl);
}

export function verifyLoginLink(): VerifyLoginLink {
  const c = container();
  return new VerifyLoginLink(c.accounts, c.tokens, secrets);
}

/** 開發用：取得剛「寄出」的登入連結；有真的寄信服務時一律回 null */
export function devLoginLinkFor(email: string): string | null {
  const mailer = container().mailer;
  return mailer instanceof DevMailer ? mailer.lastLinkFor(email) : null;
}

export function listAccounts(): ListAccounts {
  return new ListAccounts(container().accounts);
}

export function addAccount(): AddAccount {
  return new AddAccount(container().accounts);
}

export function setAccountRoles(): SetAccountRoles {
  return new SetAccountRoles(container().accounts);
}
