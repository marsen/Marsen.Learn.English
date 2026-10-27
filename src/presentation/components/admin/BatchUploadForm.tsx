"use client";

import { useState } from "react";
import type { UploadSetFormState } from "@/presentation/components/formStates";
import { useTranslations } from "next-intl";
import {
  folderLabel,
  pairBundles,
  type BundlePair,
} from "@/presentation/lib/bundlePairs";
import { Button } from "@/presentation/components/ui/Button";
import { uploadErrorText } from "@/presentation/lib/errorMessages";

type Props = {
  action: (prev: UploadSetFormState, formData: FormData) => Promise<UploadSetFormState>;
};

type Row = {
  pair: BundlePair;
  state: "waiting" | "uploading" | "done" | "failed";
  message: string;
};

/**
 * 批次上傳：選 Question.Generator 的 results/out 資料夾（或其中幾套），一套一套依序上傳。
 * 每套各自成功或失敗，互不影響；同一套已上傳過的會顯示原因、不會重複建立。
 */
export function BatchUploadForm({ action }: Props) {
  const t = useTranslations();
  const tu = useTranslations("uploadSet");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
    setRows(
      pairBundles(files).map((pair) => ({
        pair,
        state: pair.ok ? "waiting" : "failed",
        message: pair.ok ? tu("waiting") : tu("missingFile", { file: pair.missing }),
      })),
    );
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const start = async () => {
    setRunning(true);
    for (const [i, row] of rows.entries()) {
      if (row.state !== "waiting" || !row.pair.ok) continue;
      update(i, { state: "uploading", message: tu("uploading") });
      const fd = new FormData();
      fd.set("setJson", row.pair.setJson);
      fd.set("audio", row.pair.audio);
      try {
        const r = await action({}, fd);
        if (r.uploaded) {
          update(i, {
            state: "done",
            message: tu("uploaded", {
              title: r.uploaded.title,
              verdict: t(`examSet.aiVerdict.${r.uploaded.aiVerdict}`),
            }),
          });
        } else {
          update(i, {
            state: "failed",
            message: r.problems?.length
              ? r.problems
                  .map((p) => uploadErrorText(t, p))
                  .join(t("common.problemSeparator"))
              : tu("failed"),
          });
        }
      } catch (err) {
        update(i, {
          state: "failed",
          message: tu("failedWith", { message: (err as Error).message }),
        });
      }
    }
    setRunning(false);
  };

  const waiting = rows.filter((r) => r.state === "waiting").length;
  const done = rows.filter((r) => r.state === "done").length;
  const badge = {
    waiting: "text-muted-foreground",
    uploading: "text-primary-hover",
    done: "text-accent",
    failed: "text-destructive",
  };
  const mark = { waiting: "○", uploading: "…", done: "✓", failed: "✗" };

  return (
    <div className="grid gap-5">
      <label className="block">
        <span className="mb-1 block font-medium">{tu("pickFolder")}</span>
        <span className="mb-2 block text-sm text-muted-foreground">
          {tu.rich("pickHint", { code: (chunks) => <code>{chunks}</code> })}
        </span>
        {/* webkitdirectory：讓瀏覽器選整個資料夾 */}
        <input
          type="file"
          multiple
          onChange={pick}
          disabled={running}
          {...{ webkitdirectory: "" }}
        />
      </label>

      {rows.length > 0 && (
        <>
          <ul className="grid gap-2 text-sm">
            {rows.map((r, i) => (
              <li
                key={r.pair.folder}
                className="flex gap-3 rounded-lg border border-border bg-surface px-4 py-2"
              >
                <span className={`w-4 ${badge[r.state]}`}>{mark[r.state]}</span>
                <span className="w-40 shrink-0 font-mono">
                  {folderLabel(r.pair.folder) ?? tu("topFolder")}
                </span>
                <span className={badge[r.state]}>{rows[i].message}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            <Button onClick={start} disabled={running || waiting === 0}>
              {running ? tu("uploading") : tu("uploadN", { count: waiting })}
            </Button>
            {!running && done > 0 && (
              <a href="/admin/sets" className="text-sm text-primary underline">
                {tu("done", { count: done })}
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
