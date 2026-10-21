/**
 * 資料庫的 id 欄位是 uuid。外部傳進來的 id（cookie 裡的帳號 id、網址裡的作答 id）不一定是 uuid，
 * 直接拿去查詢 Postgres 會報錯（invalid input syntax for type uuid），所以先擋掉、當作找不到。
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
