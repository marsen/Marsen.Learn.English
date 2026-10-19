"use server";

import { revalidatePath } from "next/cache";
import type { UploadSetFormState } from "@/presentation/components/formStates";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { uploadExamSet } from "@/infrastructure/di/examSetContainer";

export async function uploadExamSetAction(
  _prev: UploadSetFormState,
  formData: FormData,
): Promise<UploadSetFormState> {
  const actor = await getCurrentAccount();
  if (!actor) return { problems: ["請先登入"] };

  const setJson = formData.get("setJson");
  const audio = formData.get("audio");
  if (
    !(setJson instanceof File) ||
    !(audio instanceof File) ||
    setJson.size === 0 ||
    audio.size === 0
  ) {
    return { problems: ["請選 set.json 和 audio.mp3 兩個檔案"] };
  }

  const result = await uploadExamSet().execute({
    actor,
    setJsonText: await setJson.text(),
    audio: new Uint8Array(await audio.arrayBuffer()),
  });
  if (!result.ok) return { problems: result.problems };

  revalidatePath("/admin/sets");
  return {
    uploaded: { setId: result.setId, title: result.title, aiVerdict: result.aiVerdict },
  };
}
