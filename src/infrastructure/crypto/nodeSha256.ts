import { createHash } from "node:crypto";
import type { Sha256 } from "@/application/shared/ports";

export class NodeSha256 implements Sha256 {
  hex(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}
