import type { DraftStorage } from "./examDraft";

/**
 * 審到一半的判定暫存在老師的瀏覽器（localStorage），一個老師一套題一個鍵。
 * 內容一改就存；送出成功、或內容和網站上的一樣時刪掉。
 * 讀寫都包 try/catch：私密瀏覽、空間滿了寫不進去，審稿照常進行。
 */

/** 審稿頁上會變的內容（存進暫存的部分） */
export type ReviewContent = {
  /** key：題號或 "set"（整套）；true＝OK，false＝有問題 */
  verdicts: Record<string, boolean>;
  /** 對 AI 意見的處理；沒有＝保留 */
  aiActions: Record<string, { action: "edited" | "deleted"; text: string }>;
  /** 老師的意見；target null＝整套 */
  notes: { target: string | null; text: string }[];
  comment: string;
  /** 完整考卷：每段按「完成」時記下的 signature（key 是段號） */
  confirmed: Record<string, string>;
  /** 完整考卷：老師確認看過的題號（預設 OK 的題目要再按一次 OK） */
  seen: string[];
};

export type ReviewDraft = ReviewContent & {
  setId: string;
  accountId: string;
  /** 存的時候，網站上的上次送出時間（ISO）；還沒審過是 null */
  baseReviewedAt: string | null;
  /** 存的時候，題組的上傳時間（ISO）；覆蓋上傳後暫存就過期 */
  uploadedAt: string;
  savedAt: string;
};

const PREFIX = "review-draft:";

export function reviewDraftKey(accountId: string, setId: string): string {
  return `${PREFIX}${accountId}:${setId}`;
}

/** 比較用：key 排好、seen 排好，內容一樣就得到一樣的字串 */
export function contentKey(c: ReviewContent): string {
  const sorted = <T>(o: Record<string, T>) =>
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]] as const);
  return JSON.stringify([
    sorted(c.verdicts),
    sorted(c.aiActions).map(([k, a]) => [k, a.action, a.text]),
    c.notes.map((n) => [n.target, n.text]),
    c.comment,
    sorted(c.confirmed),
    [...new Set(c.seen)].sort(),
  ]);
}

export function sameContent(a: ReviewContent, b: ReviewContent): boolean {
  return contentKey(a) === contentKey(b);
}

/** 存一次；成功回 true，寫不進去回 false（不丟錯） */
export function saveReviewDraft(
  storage: DraftStorage | null,
  draft: Omit<ReviewDraft, "savedAt">,
  now: Date = new Date(),
): boolean {
  if (!storage) return false;
  try {
    const value: ReviewDraft = { ...draft, savedAt: now.toISOString() };
    storage.setItem(reviewDraftKey(draft.accountId, draft.setId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** 讀回來；沒有、壞掉、形狀不對都回 null。個別欄位壞掉的項目丟掉 */
export function loadReviewDraft(
  storage: DraftStorage | null,
  accountId: string,
  setId: string,
): ReviewDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(reviewDraftKey(accountId, setId));
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (
      !isObj(v) ||
      v.setId !== setId ||
      v.accountId !== accountId ||
      typeof v.uploadedAt !== "string" ||
      typeof v.savedAt !== "string" ||
      !(v.baseReviewedAt === null || typeof v.baseReviewedAt === "string")
    )
      return null;
    const verdicts: ReviewContent["verdicts"] = {};
    if (isObj(v.verdicts))
      for (const [k, ok] of Object.entries(v.verdicts))
        if (typeof ok === "boolean") verdicts[k] = ok;
    const aiActions: ReviewContent["aiActions"] = {};
    if (isObj(v.aiActions))
      for (const [k, a] of Object.entries(v.aiActions))
        if (
          isObj(a) &&
          (a.action === "edited" || a.action === "deleted") &&
          typeof a.text === "string"
        )
          aiActions[k] = { action: a.action, text: a.text };
    const notes: ReviewContent["notes"] = Array.isArray(v.notes)
      ? v.notes.flatMap((n) =>
          isObj(n) &&
          typeof n.text === "string" &&
          (n.target === null || typeof n.target === "string")
            ? [{ target: n.target, text: n.text }]
            : [],
        )
      : [];
    const confirmed: ReviewContent["confirmed"] = {};
    if (isObj(v.confirmed))
      for (const [k, s] of Object.entries(v.confirmed))
        if (typeof s === "string") confirmed[k] = s;
    const seen = Array.isArray(v.seen)
      ? v.seen.filter((x): x is string => typeof x === "string")
      : [];
    return {
      setId,
      accountId,
      baseReviewedAt: v.baseReviewedAt,
      uploadedAt: v.uploadedAt,
      savedAt: v.savedAt,
      verdicts,
      aiActions,
      notes,
      comment: typeof v.comment === "string" ? v.comment : "",
      confirmed,
      seen,
    };
  } catch {
    return null;
  }
}

export function clearReviewDraft(
  storage: DraftStorage | null,
  accountId: string,
  setId: string,
): void {
  if (!storage) return;
  try {
    storage.removeItem(reviewDraftKey(accountId, setId));
  } catch {
    // 刪不掉也不影響審稿
  }
}

/** 網站上現在的樣子：暫存是不是還對得上，以及認得哪些題號、AI 意見 */
export type DraftBase = {
  baseReviewedAt: string | null;
  uploadedAt: string;
  /** 題號和 "set" */
  targets: ReadonlySet<string>;
  /** AI 意見的 ref */
  refs: ReadonlySet<string>;
};

/**
 * 暫存能不能用：別台電腦已送出（上次送出時間不同）、題組覆蓋上傳過（上傳時間不同）就過期。
 * 能用的話，濾掉不認得的題號和 AI 意見。
 */
export function checkReviewDraft(
  draft: ReviewDraft,
  base: DraftBase,
): { ok: true; content: ReviewContent } | { ok: false } {
  if (
    draft.baseReviewedAt !== base.baseReviewedAt ||
    draft.uploadedAt !== base.uploadedAt
  )
    return { ok: false };
  const pick = <T>(o: Record<string, T>, keep: ReadonlySet<string>) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => keep.has(k)));
  return {
    ok: true,
    content: {
      verdicts: pick(draft.verdicts, base.targets),
      aiActions: pick(draft.aiActions, base.refs),
      notes: draft.notes.filter(
        (n) => n.target === null || (n.target !== "set" && base.targets.has(n.target)),
      ),
      comment: draft.comment,
      confirmed: draft.confirmed,
      seen: draft.seen.filter((id) => base.targets.has(id)),
    },
  };
}

/** Date 或從伺服器傳來的字串都轉成 ISO 字串 */
export function isoOf(d: Date | string | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
