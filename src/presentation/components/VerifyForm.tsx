"use client";

import { useActionState } from "react";
import type { VerifyFormState } from "./formStates";

type Props = {
  token: string;
  action: (prev: VerifyFormState, formData: FormData) => Promise<VerifyFormState>;
};

/**
 * 點信裡的連結後，再按一次按鈕才真的登入。
 * 原因：有些信箱會自動「預先打開」信裡的連結檢查安全性，直接登入的話碼會被它用掉。
 */
export function VerifyForm({ token, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}{" "}
          <a href="/login" className="underline">
            重新申請
          </a>
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "登入中…" : "完成登入"}
      </button>
    </form>
  );
}
