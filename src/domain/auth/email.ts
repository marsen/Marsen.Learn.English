/** email 正規化：去頭尾空白、轉小寫。帳號一律用正規化後的值比對。 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// 刻意寬鬆：只擋明顯打錯的格式，真正的驗證是「收得到信」
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}
