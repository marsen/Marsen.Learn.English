"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/presentation/components/ui/Button";

type Props = {
  setId: string;
  action: (formData: FormData) => Promise<void>;
};

/** 刪除題組：按兩次才會刪（第二次要確認） */
export function DeleteSetButton({ setId, action }: Props) {
  const [confirming, setConfirming] = useState(false);
  const t = useTranslations();

  if (!confirming)
    return (
      <Button variant="dangerSecondary" size="sm" onClick={() => setConfirming(true)}>
        {t("common.delete")}
      </Button>
    );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="setId" value={setId} />
      <span className="text-sm text-destructive">
        {t("adminDashboard.deleteConfirm")}
      </span>
      <Button type="submit" variant="danger" size="sm">
        {t("adminDashboard.deleteConfirmButton")}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
        {t("common.cancel")}
      </Button>
    </form>
  );
}
