"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { UploadOutcome } from "@/application/examSet/examSetResult";
import type { UploadSetFormState } from "@/presentation/components/formStates";
import {
  folderLabel,
  pairBundles,
  type BundlePair,
} from "@/presentation/lib/bundlePairs";
import { Button, buttonClass } from "@/presentation/components/ui/Button";
import { uploadErrorText } from "@/presentation/lib/errorMessages";

type Props = {
  action: (prev: UploadSetFormState, formData: FormData) => Promise<UploadSetFormState>;
};

type RowState = "waiting" | "uploading" | "done" | "exists" | "failed";

type Row = {
  pair: BundlePair;
  state: RowState;
  problems: string[];
  outcome?: UploadOutcome;
};

/** 同一套題組的識別：最後一層資料夾名稱（通常就是 set_id） */
const keyOf = (pair: BundlePair) => folderLabel(pair.folder) ?? pair.folder;

/** 狀態標籤的顏色（只用主題 token） */
const BADGE: Record<RowState, string> = {
  waiting: "bg-muted text-muted-foreground",
  uploading: "bg-primary-soft text-primary-hover",
  done: "bg-accent-soft text-accent-hover",
  exists: "bg-primary-soft text-primary-hover",
  failed: "bg-destructive/10 text-destructive",
};

/**
 * 批次上傳：選 Question.Generator 的 results/out 資料夾（或其中幾套），一套一套依序上傳。
 * 網站上已經有的題組不直接蓋掉：按「覆蓋」才寫入，當成新上傳（見 docs/set-overwrite.md）。
 */
export function BatchUploadForm({ action }: Props) {
  const t = useTranslations();
  const tu = useTranslations("uploadSet");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
    // 清掉選取紀錄：檔案改過後再選同一個資料夾，瀏覽器才會再通知
    e.target.value = "";
    const picked: Row[] = pairBundles(files).map((pair) => ({
      pair,
      state: pair.ok ? "waiting" : "failed",
      problems: pair.ok ? [] : [tu("missingFile", { file: pair.missing })],
    }));
    // 累加到清單，每一行位置不變：已有的留在原位（已完成的不動，其他的換成新選的）；新的加在最後
    setRows((rs) => {
      const byKey = new Map(picked.map((r) => [keyOf(r.pair), r]));
      const kept = rs.map((r) => {
        const next = byKey.get(keyOf(r.pair));
        return next && r.state !== "done" ? next : r;
      });
      const known = new Set(rs.map((r) => keyOf(r.pair)));
      return [...kept, ...picked.filter((r) => !known.has(keyOf(r.pair)))];
    });
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const send = async (row: Row, i: number, overwrite: boolean) => {
    if (!row.pair.ok) return;
    update(i, { state: "uploading", problems: [] });
    const fd = new FormData();
    fd.set("setJson", row.pair.setJson);
    fd.set("audio", row.pair.audio);
    if (overwrite) fd.set("overwrite", "1");
    try {
      const r = await action({}, fd);
      if (r.uploaded) update(i, { state: "done", outcome: r.uploaded.outcome });
      else if (r.existing) update(i, { state: "exists" });
      else
        update(i, {
          state: "failed",
          problems: r.problems?.length
            ? r.problems.map((p) => uploadErrorText(t, p))
            : [tu("failed")],
        });
    } catch (err) {
      update(i, {
        state: "failed",
        problems: [tu("failedWith", { message: (err as Error).message })],
      });
    }
  };

  /** 依序處理（一次一套，避免同時塞大量錄音） */
  const run = async (which: (r: Row) => boolean, overwrite: boolean) => {
    setBusy(true);
    for (const [i, row] of rows.entries()) if (which(row)) await send(row, i, overwrite);
    setBusy(false);
  };

  const waiting = rows.filter((r) => r.state === "waiting").length;
  const done = rows.filter((r) => r.state === "done").length;
  const existing = rows.filter((r) => r.state === "exists").length;
  /** 從清單拿掉（不上傳、不覆蓋）；已完成的拿掉後，再選到就會重新出現為待上傳 */
  const remove = (r: Row) => setRows((rs) => rs.filter((x) => x !== r));

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <label
          className={buttonClass({
            variant: "secondary",
            className: "justify-self-start",
          })}
        >
          {tu("pickFolder")}
          <input
            type="file"
            multiple
            onChange={pick}
            disabled={busy}
            className="sr-only"
            // 讓瀏覽器選整個資料夾
            {...{ webkitdirectory: "" }}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          {tu.rich("pickHint", { code: (chunks) => <code>{chunks}</code> })}
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li
              key={r.pair.folder}
              className="rounded-lg border border-border bg-surface px-4 py-2"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[r.state]}`}
                >
                  {tu(`status.${r.state}`)}
                </span>
                <span className="font-mono text-sm">
                  {folderLabel(r.pair.folder) ?? tu("topFolder")}
                </span>
                {r.state === "done" && r.outcome && (
                  <span className="text-sm text-muted-foreground">
                    {tu(`outcome.${r.outcome}`)}
                  </span>
                )}
                <span className="ml-auto flex gap-2">
                  {r.state === "exists" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => run((x) => x === r, true)}
                    >
                      {tu("overwrite")}
                    </Button>
                  )}
                  {r.state === "failed" && r.pair.ok && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => run((x) => x === r, false)}
                    >
                      {tu("retry")}
                    </Button>
                  )}
                  {r.state !== "uploading" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => remove(r)}
                    >
                      {tu("remove")}
                    </Button>
                  )}
                </span>
              </div>
              {r.state === "failed" && (
                <ul className="mt-1 list-disc pl-5 text-sm text-destructive">
                  {r.problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {(waiting > 0 || existing > 0 || done > 0) && (
        <div className="flex items-center gap-4">
          {waiting > 0 && (
            <Button
              disabled={busy}
              onClick={() => run((r) => r.state === "waiting", false)}
            >
              {busy ? tu("uploading") : tu("uploadN", { count: waiting })}
            </Button>
          )}
          {existing > 0 && (
            <Button
              disabled={busy}
              onClick={() => run((r) => r.state === "exists", true)}
            >
              {tu("overwriteAll", { count: existing })}
            </Button>
          )}
          {!busy && done > 0 && (
            <a href="/admin/sets" className="text-sm text-primary underline">
              {tu("done", { count: done })}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
