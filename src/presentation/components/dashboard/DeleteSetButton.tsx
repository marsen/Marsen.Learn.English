"use client";

import { useState } from "react";
import { Button } from "@/presentation/components/ui/Button";

type Props = {
  setId: string;
  action: (formData: FormData) => Promise<void>;
};

/** 刪除題組：按兩次才會刪（第二次要確認） */
export function DeleteSetButton({ setId, action }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <Button variant="dangerSecondary" size="sm" onClick={() => setConfirming(true)}>
        刪除
      </Button>
    );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="setId" value={setId} />
      <span className="text-sm text-destructive">確定整套刪掉？刪了就救不回來</span>
      <Button type="submit" variant="danger" size="sm">
        確定刪除
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
        取消
      </Button>
    </form>
  );
}
