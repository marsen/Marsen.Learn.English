import type { AiVerdict } from "@/domain/examSet/examSet";

export type UploadExamSetResult =
  | { ok: true; setId: string; title: string; aiVerdict: AiVerdict }
  | { ok: false; problems: string[] };
