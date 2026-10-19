/** 各 use case 共用的外部能力（port）。 */
export interface Sha256 {
  hex(bytes: Uint8Array): string;
}
