"use client";

import { useActionState } from "react";
import type { UploadSetFormState } from "@/presentation/components/formStates";
import { AI_VERDICT_LABELS } from "@/presentation/lib/examSetLabels";

type Props = {
  action: (prev: UploadSetFormState, formData: FormData) => Promise<UploadSetFormState>;
};

/** 上傳一套題組：選 set.json 和 audio.mp3（Question.Generator 的 results/out/<題組>/ 裡那兩個檔）。 */
export function UploadSetForm({ action }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-5">
      {state.uploaded && (
        <p className="rounded-lg bg-card px-4 py-3 text-sm">
          已上傳 {state.uploaded.setId}「{state.uploaded.title}」，
          {AI_VERDICT_LABELS[state.uploaded.aiVerdict]}。狀態：待老師審稿。
        </p>
      )}
      {state.problems && state.problems.length > 0 && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">不能上傳：</p>
          <ul className="mt-1 list-disc pl-5">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <label htmlFor="setJson" className="mb-1 block font-medium">
          set.json
        </label>
        <input
          id="setJson"
          name="setJson"
          type="file"
          accept=".json,application/json"
          required
        />
      </div>
      <div>
        <label htmlFor="audio" className="mb-1 block font-medium">
          audio.mp3
        </label>
        <input id="audio" name="audio" type="file" accept=".mp3,audio/mpeg" required />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="justify-self-start rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "上傳中…" : "上傳"}
      </button>
    </form>
  );
}
