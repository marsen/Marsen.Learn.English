import type { SecretTokens } from "./ports";

/** 登入碼的雜湊綁定 email：同一組數字在不同 email 是不同的雜湊 */
export const codeHashOf = (secrets: SecretTokens, email: string, code: string) =>
  secrets.hash(`${email}:${code}`);
