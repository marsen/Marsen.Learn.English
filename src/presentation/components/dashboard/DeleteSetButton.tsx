"use client";

import { useState } from "react";

type Props = {
  setId: string;
  action: (formData: FormData) => Promise<void>;
};

/** 刪除題組：按兩次才會刪（第二次要確認） */
export function DeleteSetButton({ setId, action }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn-ghost text-destructive"
      >
        刪除
      </button>
    );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="setId" value={setId} />
      <span className="text-sm text-destructive">確定整套刪掉？刪了就救不回來</span>
      <button
        type="submit"
        className="rounded-full bg-destructive px-3 py-1.5 text-sm font-medium text-white"
      >
        確定刪除
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="btn-ghost">
        取消
      </button>
    </form>
  );
}
