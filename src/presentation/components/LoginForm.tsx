"use client";

import { useActionState } from "react";
import type { LoginFormState } from "./formStates";

type Props = {
  action: (prev: LoginFormState, formData: FormData) => Promise<LoginFormState>;
  submitLabel?: string;
};

export function LoginForm({ action, submitLabel = "寄登入連結給我" }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  if (state.sent) {
    return (
      <div className="grid gap-3 text-sm">
        <p className="rounded-lg bg-card px-4 py-3">
          連結已經寄出，請到信箱點連結（15 分鐘內有效）。第一次使用的 email
          會自動建立帳號。
        </p>
        {state.devLink && (
          <p className="rounded-lg border border-dashed border-primary px-4 py-3">
            開發模式（沒有設定寄信服務）：
            <a className="break-all text-primary underline" href={state.devLink}>
              直接開登入連結
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-border bg-white px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "寄送中…" : submitLabel}
      </button>
    </form>
  );
}
