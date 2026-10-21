/** 音檔儲存空間（本機資料夾、Neon Object Storage、S3…由 infrastructure 決定） */
export interface AudioStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** 找不到回傳 null */
  get(key: string): Promise<Uint8Array | null>;
  /** 不存在也不會出錯 */
  delete(key: string): Promise<void>;
}
