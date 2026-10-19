import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { getExamSetAudio } from "@/infrastructure/di/examSetContainer";
import { audioResponse } from "@/app/lib/rangeResponse";

/** 審稿用的錄音：要登入且有審稿權限，否則一律 404（不透露題組是否存在）。 */
export async function GET(request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const { setId } = await ctx.params;
  const actor = await getCurrentAccount();
  const bytes = actor ? await getExamSetAudio().execute({ actor, setId }) : null;
  if (!bytes) return new Response("Not found", { status: 404 });
  return audioResponse(request, bytes);
}
