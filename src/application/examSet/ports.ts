/** 音檔儲存空間（本機資料夾、Neon Object Storage、S3…由 infrastructure 決定） */
export interface AudioStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** 找不到回傳 null */
  get(key: string): Promise<Uint8Array | null>;
  /** 不存在也不會出錯 */
  delete(key: string): Promise<void>;
  /**
   * 讓瀏覽器直接下載的短效網址（例如 R2 的預簽網址）。
   * 不支援的儲存（本機資料夾、記憶體）回傳 null，改由網站自己送出錄音。
   */
  downloadUrl(key: string, ttlSeconds: number): Promise<string | null>;
}
