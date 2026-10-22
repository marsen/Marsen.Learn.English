import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { audioRequester } from "@/infrastructure/auth/audioRequester";
import { getExamSetAudio } from "@/infrastructure/di/examSetContainer";
import { audioSourceResponse } from "@/app/lib/rangeResponse";

/** 審稿用的錄音：要登入且有審稿權限，否則一律 404（不透露題組是否存在）。 */
export async function GET(request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const { setId } = await ctx.params;
  const actor = await getCurrentAccount();
  const source = await getExamSetAudio().execute({
    actor,
    setId,
    requester: await audioRequester(actor),
  });
  if (!source) return new Response("Not found", { status: 404 });
  return audioSourceResponse(request, source);
}
