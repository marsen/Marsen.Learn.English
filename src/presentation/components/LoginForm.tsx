"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { LoginFormState, VerifyCodeFormState } from "./formStates";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { CodeInput } from "./CodeInput";
import { LOGIN_CODE_LENGTH, LOGIN_TOKEN_TTL_MINUTES } from "@/domain/auth/loginToken";
import { loginErrorText } from "@/presentation/lib/errorMessages";

type RequestAction = (
  prev: LoginFormState,
  formData: FormData,
) => Promise<LoginFormState>;
type VerifyAction = (
  prev: VerifyCodeFormState,
  formData: FormData,
) => Promise<VerifyCodeFormState>;

type Props = {
  requestCode: RequestAction;
  verifyCode: VerifyAction;
  submitLabel?: string;
};

const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base";

/**
 * 登入／註冊：兩步驟。
 * 1. 輸入 email → 寄一組 6 位數登入碼
 * 2. 在同一個畫面輸入登入碼 → 登入（第一次用的 email 會自動建立帳號）
 */
export function LoginForm({
  requestCode,
  verifyCode,
  submitLabel = "寄登入碼給我",
}: Props) {
  const [sent, requestAction, requesting] = useActionState(requestCode, {});
  // 寄出後想換 email：回到第一步；寄出新的一組就回到第二步
  const [changingEmail, setChangingEmail] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | undefined>();
  if (sent.sentAt !== lastSentAt) {
    setLastSentAt(sent.sentAt);
    setChangingEmail(false);
  }

  if (sent.sentTo && !changingEmail) {
    return (
      <div className="grid gap-4">
        <Alert>
          登入碼已寄到 <b>{sent.sentTo}</b>，請到信箱查看（{LOGIN_TOKEN_TTL_MINUTES}{" "}
          分鐘內有效）。
        </Alert>
        {sent.error && <Alert tone="error">{loginErrorText(sent.error)}</Alert>}
        {sent.devCode && (
          <Alert>開發模式（沒有設定寄信服務）：登入碼是 {sent.devCode}</Alert>
        )}
        {/* 每寄出一組新的碼就重新開始（清掉上一組的錯誤訊息） */}
        <CodeStep key={sent.sentAt} email={sent.sentTo} verifyCode={verifyCode} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <form action={requestAction}>
            <input type="hidden" name="email" value={sent.sentTo} />
            <button
              type="submit"
              disabled={requesting}
              className="text-primary underline disabled:opacity-60"
            >
              {requesting ? "寄送中…" : "重寄一組"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setChangingEmail(true)}
            className="text-primary underline"
          >
            換一個 email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={requestAction} className="grid gap-4">
      {sent.error && <Alert tone="error">{loginErrorText(sent.error)}</Alert>}
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
          // 送出後 React 會把表單重設回 defaultValue：失敗時要留著剛剛輸入的 email
          defaultValue={sent.email ?? sent.sentTo}
          className={field}
        />
      </div>
      <Button type="submit" disabled={requesting}>
        {requesting ? "寄送中…" : submitLabel}
      </Button>
    </form>
  );
}

/** 第二步：輸入登入碼（6 格，填滿自動送出；輸錯就清空重來） */
function CodeStep({ email, verifyCode }: { email: string; verifyCode: VerifyAction }) {
  const [verified, verifyAction, verifying] = useActionState(verifyCode, {});
  // 一次只送一個：填滿自動送出的同時又按了登入／Enter，第二次會多扣一次猜錯次數
  const submitted = useRef(false);
  useEffect(() => {
    submitted.current = false;
  }, [verified]);
  // 每次送出拿到新結果就換一個 key：方格清空、游標回第一格、重新播放晃動
  const [lastResult, setLastResult] = useState(verified);
  const [round, setRound] = useState(0);
  if (verified !== lastResult) {
    setLastResult(verified);
    setRound((r) => r + 1);
  }
  return (
    <form
      action={verifyAction}
      onSubmit={(e) => {
        if (submitted.current) e.preventDefault();
        submitted.current = true;
      }}
      className="grid gap-4"
    >
      {verified.error && (
        <Alert tone="error" size="md" className="font-medium ring-1 ring-destructive/40">
          {loginErrorText(verified.error)}
        </Alert>
      )}
      <input type="hidden" name="email" value={email} />
      <div>
        <label htmlFor="code-0" className="mb-2 block font-medium">
          登入碼
        </label>
        <CodeInput
          key={round}
          name="code"
          length={LOGIN_CODE_LENGTH}
          invalid={Boolean(verified.error)}
          disabled={verifying}
          label="登入碼"
        />
      </div>
      <Button type="submit" disabled={verifying}>
        {verifying ? "登入中…" : "登入"}
      </Button>
    </form>
  );
}
