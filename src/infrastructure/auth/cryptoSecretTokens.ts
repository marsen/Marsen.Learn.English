import { createHash, randomBytes, randomInt } from "node:crypto";
import type { SecretTokens } from "@/application/auth/ports";
import { LOGIN_CODE_LENGTH } from "@/domain/auth/loginToken";

/** 隨機識別（32 bytes base64url）、6 位數登入碼；雜湊用 SHA-256。 */
export class CryptoSecretTokens implements SecretTokens {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }

  generateCode(): string {
    return String(randomInt(0, 10 ** LOGIN_CODE_LENGTH)).padStart(LOGIN_CODE_LENGTH, "0");
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
