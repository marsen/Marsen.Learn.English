import { AwsClient } from "aws4fetch";
import type { AudioStorage } from "@/application/examSet/ports";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/**
 * 錄音存在 Cloudflare R2（S3 相容 API）。
 * 瀏覽器用預簽的短效網址直接跟 R2 下載，不經過網站主機（R2 下載流量不收費）。
 */
export class R2AudioStorage implements AudioStorage {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(config: R2Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    this.base = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const res = await this.client.fetch(this.urlOf(key), {
      method: "PUT",
      body: bytes as BodyInit,
      headers: { "Content-Type": contentType },
    });
    if (!res.ok) throw new Error(`[r2] 上傳失敗 ${res.status}：${key}`);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const res = await this.client.fetch(this.urlOf(key));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`[r2] 讀取失敗 ${res.status}：${key}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.client.fetch(this.urlOf(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404)
      throw new Error(`[r2] 刪除失敗 ${res.status}：${key}`);
  }

  async downloadUrl(key: string, ttlSeconds: number): Promise<string> {
    const url = new URL(this.urlOf(key));
    url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
    const signed = await this.client.sign(url.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });
    return signed.url;
  }

  private urlOf(key: string): string {
    if (key.split("/").some((part) => part === "" || part === "." || part === ".."))
      throw new Error(`[r2] 不合法的 key：${key}`);
    return `${this.base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
