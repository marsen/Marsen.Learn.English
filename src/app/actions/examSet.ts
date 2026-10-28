"use server";

import { revalidatePath } from "next/cache";
import type {
  ReviewFormState,
  UploadSetFormState,
} from "@/presentation/components/formStates";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { parseReviewPayload } from "@/application/examSet/reviewExamSet";
import {
  reviewExamSet,
  setExamAccess,
  deleteExamSet,
  uploadExamSet,
} from "@/infrastructure/di/examSetContainer";

export async function uploadExamSetAction(
  _prev: UploadSetFormState,
  formData: FormData,
): Promise<UploadSetFormState> {
  const actor = await getCurrentAccount();
  if (!actor) return { problems: [{ code: "notLoggedIn" }] };

  const setJson = formData.get("setJson");
  const audio = formData.get("audio");
  if (
    !(setJson instanceof File) ||
    !(audio instanceof File) ||
    setJson.size === 0 ||
    audio.size === 0
  ) {
    return { problems: [{ code: "missingFiles" }] };
  }

  const result = await uploadExamSet().execute({
    actor,
    setJsonText: await setJson.text(),
    audio: new Uint8Array(await audio.arrayBuffer()),
    overwrite: formData.get("overwrite") === "1",
  });
  if (!result.ok) return { problems: result.problems, existing: result.existing };

  revalidatePath("/admin/sets");
  revalidatePath(`/admin/sets/${result.setId}`);
  return {
    uploaded: {
      setId: result.setId,
      title: result.title,
      aiVerdict: result.aiVerdict,
      outcome: result.outcome,
    },
  };
}

export async function reviewExamSetAction(
  setId: string,
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const actor = await getCurrentAccount();
  if (!actor) return { problems: [{ code: "notLoggedIn" }] };

  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : null;
  };
  // 每題、整套的判定與意見、對 AI 意見的處理，由審稿頁整理成 JSON 送來
  const payload = parseReviewPayload(text("payload"));
  if (!payload) return { problems: [{ code: "badPayload" }] };

  const result = await reviewExamSet().execute({
    actor,
    setId,
    comment: text("comment"),
    ...payload,
  });
  if (!result.ok) return { problems: result.problems };

  revalidatePath("/admin/sets");
  revalidatePath(`/admin/sets/${setId}`);
  return { saved: true };
}

export async function setExamAccessAction(formData: FormData): Promise<void> {
  const actor = await getCurrentAccount();
  if (!actor) return;
  await setExamAccess().execute({
    actor,
    setId: String(formData.get("setId") ?? ""),
    access: formData.get("access"),
  });
  revalidatePath("/admin/sets");
  revalidatePath("/admin");
}

export async function deleteExamSetAction(formData: FormData): Promise<void> {
  const actor = await getCurrentAccount();
  if (!actor) return;
  await deleteExamSet().execute({ actor, setId: String(formData.get("setId") ?? "") });
  revalidatePath("/admin");
  revalidatePath("/admin/sets");
}
