import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { getExamSetAudio } from "@/infrastructure/di/examSetContainer";
import { audioSourceResponse } from "@/app/lib/rangeResponse";

/** 考試用的錄音：只給能考這張考卷的人（路人只能聽公開考卷）。不能聽一律 404。 */
export async function GET(request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const { setId } = await ctx.params;
  const source = await getExamSetAudio().execute({
    actor: await getCurrentAccount(),
    setId,
  });
  if (!source) return new Response("Not found", { status: 404 });
  return audioSourceResponse(request, source);
}
