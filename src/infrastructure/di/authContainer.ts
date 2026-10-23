import type { AccountRepository } from "@/domain/account/accountRepository";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import type { LoginMailer } from "@/application/auth/ports";
import {
  AddAccount,
  ListAccounts,
  SetAccountRoles,
} from "@/application/account/manageAccounts";
import { RequestLoginCode } from "@/application/auth/requestLoginCode";
import { VerifyLoginCode } from "@/application/auth/verifyLoginCode";
import { env } from "@/infrastructure/config/env";
import { CryptoSecretTokens } from "@/infrastructure/auth/cryptoSecretTokens";
import { DevMailer } from "@/infrastructure/mail/devMailer";
import { ResendMailer } from "@/infrastructure/mail/resendMailer";
import { DrizzleAccountRepository } from "@/infrastructure/persistence/drizzleAccountRepository";
import { DrizzleLoginTokenRepository } from "@/infrastructure/persistence/drizzleLoginTokenRepository";

/**
 * Composition Root（登入／帳號）。
 * - 資料一律存在資料庫（Drizzle + Neon），本機也一樣；沒有 DATABASE_URL 在 env 驗證時就啟動失敗。
 * - 有 RESEND_API_KEY → 真的寄信；沒有且非正式環境 → DevMailer（登入碼顯示在登入頁）。
 * 物件放在模組裡，改程式熱更新時跟著換新。
 */
type Container = {
  accounts: AccountRepository;
  tokens: LoginTokenRepository;
  mailer: LoginMailer;
};

function buildMailer(): LoginMailer {
  if (env.resendApiKey) {
    if (!env.mailFrom) throw new Error("[env] 設了 RESEND_API_KEY 也要設 MAIL_FROM");
    return new ResendMailer(env.resendApiKey, env.mailFrom);
  }
  if (env.isProduction) throw new Error("[env] 正式環境必須設定 RESEND_API_KEY");
  return new DevMailer();
}

let built: Container | undefined;

function container(): Container {
  return (built ??= {
    accounts: new DrizzleAccountRepository(),
    tokens: new DrizzleLoginTokenRepository(),
    mailer: buildMailer(),
  });
}

const secrets = new CryptoSecretTokens();

export function getAccountRepository(): AccountRepository {
  return container().accounts;
}

export function requestLoginCode(): RequestLoginCode {
  const c = container();
  return new RequestLoginCode(c.accounts, c.tokens, secrets, c.mailer);
}

export function verifyLoginCode(): VerifyLoginCode {
  const c = container();
  return new VerifyLoginCode(c.accounts, c.tokens, secrets);
}

/** 開發用：取得剛「寄出」的登入碼；有真的寄信服務時一律回 null */
export function devLoginCodeFor(email: string): string | null {
  const mailer = container().mailer;
  return mailer instanceof DevMailer ? mailer.lastCodeFor(email) : null;
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
