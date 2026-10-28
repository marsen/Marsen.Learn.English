"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ExistingSet, UploadOutcome } from "@/application/examSet/examSetResult";
import { SUPPORTED_SCHEMA_VERSION } from "@/domain/examSet/bundle";
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

/** 從 set.json 先讀出來給畫面看的資訊（真正的檢查在伺服器） */
type Preview = { setId: string | null; title: string | null; minor: number } | null;

type Row = {
  pair: BundlePair;
  preview: Preview;
  state: RowState;
  /** 失敗原因（逐條） */
  problems: string[];
  existing?: ExistingSet;
  outcome?: UploadOutcome;
  /** 上傳成功時的 AI 結論文字 */
  verdict?: string;
};

/** 狀態標籤的顏色（只用主題 token） */
const BADGE: Record<RowState, string> = {
  waiting: "bg-muted text-muted-foreground",
  uploading: "bg-primary-soft text-primary-hover",
  done: "bg-accent-soft text-accent-hover",
  exists: "bg-primary-soft text-primary-hover",
  failed: "bg-destructive/10 text-destructive",
};
const CARD: Record<RowState, string> = {
  waiting: "border-border",
  uploading: "border-primary/40",
  done: "border-accent/40",
  exists: "border-primary/40",
  failed: "border-destructive/40",
};
const ORDER: RowState[] = ["waiting", "uploading", "exists", "done", "failed"];

async function readPreview(pair: BundlePair): Promise<Preview> {
  if (!pair.ok) return null;
  try {
    const b = JSON.parse(await pair.setJson.text());
    return {
      setId: typeof b.set_id === "string" ? b.set_id : null,
      title: typeof b.title === "string" ? b.title : null,
      minor: typeof b.schema_minor === "number" ? b.schema_minor : 0,
    };
  } catch {
    return null;
  }
}

/**
 * 批次上傳：選 Question.Generator 的 results/out 資料夾（或其中幾套），一套一套依序上傳。
 * 每套各自成功或失敗，互不影響。網站上已經有的題組不會直接蓋掉：先說明覆蓋會怎樣，按了才覆蓋。
 */
export function BatchUploadForm({ action }: Props) {
  const t = useTranslations();
  const tu = useTranslations("uploadSet");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
    const pairs = pairBundles(files);
    const previews = await Promise.all(pairs.map(readPreview));
    setRows(
      pairs.map((pair, i) => ({
        pair,
        preview: previews[i],
        state: pair.ok ? "waiting" : "failed",
        problems: pair.ok ? [] : [tu("missingFile", { file: pair.missing })],
      })),
    );
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
      if (r.uploaded) {
        update(i, {
          state: "done",
          outcome: r.uploaded.outcome,
          verdict: t(`examSet.aiVerdict.${r.uploaded.aiVerdict}`),
          existing: undefined,
        });
      } else if (r.existing) {
        update(i, { state: "exists", existing: r.existing });
      } else {
        update(i, {
          state: "failed",
          problems: r.problems?.length
            ? r.problems.map((p) => uploadErrorText(t, p))
            : [tu("failed")],
        });
      }
    } catch (err) {
      update(i, {
        state: "failed",
        problems: [tu("failedWith", { message: (err as Error).message })],
      });
    }
  };

  /** 依序處理選到的列（一次一套，避免同時塞大量錄音） */
  const run = async (which: (r: Row) => boolean, overwrite: boolean) => {
    setBusy(true);
    for (const [i, row] of rows.entries()) if (which(row)) await send(row, i, overwrite);
    setBusy(false);
  };

  const count = (s: RowState) => rows.filter((r) => r.state === s).length;
  const isSupplement = (r: Row) =>
    r.state === "exists" && r.existing?.kind === "supplement";
  const supplementCount = rows.filter(isSupplement).length;
  const doneCount = count("done");

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <label
          className={buttonClass({
            variant: "secondary",
            className: "justify-self-start",
          })}
        >
          📁 {tu("pickFolder")}
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
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
            <span className="mr-2 text-sm font-medium">
              {tu("picked", { count: rows.length })}
            </span>
            {ORDER.filter((s) => count(s) > 0).map((s) => (
              <span
                key={s}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[s]}`}
              >
                {tu(`status.${s}`)} {count(s)}
              </span>
            ))}
            <span className="ml-auto flex flex-wrap gap-2">
              {supplementCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(isSupplement, true)}
                >
                  {tu("overwriteAllSupplement", { count: supplementCount })}
                </Button>
              )}
              {count("waiting") > 0 && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => run((r) => r.state === "waiting", false)}
                >
                  {busy ? tu("uploading") : tu("uploadN", { count: count("waiting") })}
                </Button>
              )}
            </span>
          </div>

          <ul className="grid gap-3">
            {rows.map((r) => (
              <li
                key={r.pair.folder}
                className={`rounded-xl border bg-surface px-4 py-3 ${CARD[r.state]}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[r.state]}`}
                  >
                    {tu(`status.${r.state}`)}
                  </span>
                  <span className="font-mono text-sm">
                    {r.preview?.setId ?? folderLabel(r.pair.folder) ?? tu("topFolder")}
                  </span>
                  {r.preview?.title && <span className="text-sm">{r.preview.title}</span>}
                  {r.preview && (
                    <span
                      title={r.preview.minor > 0 ? undefined : tu("noTranscript")}
                      className={`ml-auto rounded-full px-2 py-0.5 font-mono text-xs ${
                        r.preview.minor > 0
                          ? "bg-accent-soft text-accent-hover"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {SUPPORTED_SCHEMA_VERSION}.{r.preview.minor}
                    </span>
                  )}
                </div>

                <RowDetail
                  row={r}
                  busy={busy}
                  onOverwrite={() => run((x) => x === r, true)}
                />
              </li>
            ))}
          </ul>

          {!busy && doneCount > 0 && (
            <a href="/admin/sets" className="text-sm text-primary underline">
              {tu("done", { count: doneCount })}
            </a>
          )}
        </>
      )}
    </div>
  );
}

function RowDetail({
  row,
  busy,
  onOverwrite,
}: {
  row: Row;
  busy: boolean;
  onOverwrite: () => void;
}) {
  const tu = useTranslations("uploadSet");
  if (row.state === "failed") {
    return (
      <ul className="mt-2 list-disc pl-5 text-sm text-destructive">
        {row.problems.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    );
  }
  if (row.state === "done" && row.outcome) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        {tu(`outcome.${row.outcome}`, { verdict: row.verdict ?? "" })}
      </p>
    );
  }
  if (row.state === "exists" && row.existing) {
    const { kind, fields } = row.existing;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm">
        <p className="flex-1">
          {tu(`existing.${kind}`, {
            fields: fields.map((f) => tu(`fields.${f}`)).join(tu("fieldSeparator")),
          })}
        </p>
        {kind !== "unchanged" && (
          <Button
            size="sm"
            variant={kind === "content" ? "danger" : "primary"}
            disabled={busy}
            onClick={onOverwrite}
          >
            {tu(kind === "content" ? "overwriteContent" : "overwriteSupplement")}
          </Button>
        )}
      </div>
    );
  }
  return null;
}
