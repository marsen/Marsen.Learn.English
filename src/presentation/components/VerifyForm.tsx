"use client";

import { useActionState } from "react";
import type { VerifyFormState } from "./formStates";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";

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
        <Alert tone="error">
          {state.error}{" "}
          <a href="/login" className="underline">
            重新申請
          </a>
        </Alert>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "登入中…" : "完成登入"}
      </Button>
    </form>
  );
}
