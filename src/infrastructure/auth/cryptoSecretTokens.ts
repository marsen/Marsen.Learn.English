import { createHash, randomBytes } from "node:crypto";
import type { SecretTokens } from "@/application/auth/ports";

/** 32 bytes 隨機登入碼（base64url），雜湊用 SHA-256。 */
export class CryptoSecretTokens implements SecretTokens {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
