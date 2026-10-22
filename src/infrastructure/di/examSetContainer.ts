import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { AudioStorage, RateLimiter } from "@/application/examSet/ports";
import { InMemoryRateLimiter } from "@/infrastructure/limits/inMemoryRateLimiter";
import { GetTeacherDashboard } from "@/application/dashboard/teacherDashboard";
import { GetAdminDashboard } from "@/application/dashboard/adminDashboard";
import { DeleteExamSet } from "@/application/examSet/deleteExamSet";
import { getAccountRepository } from "@/infrastructure/di/authContainer";
import { GetReviewLog } from "@/application/dashboard/reviewLog";
import { GetStudentDashboard } from "@/application/dashboard/studentDashboard";
import { ClaimGuestAttempts } from "@/application/exam/claimGuestAttempts";
import { GetAttemptResult } from "@/application/exam/getAttemptResult";
import { ListAvailableExams } from "@/application/exam/listAvailableExams";
import { ListMyAttempts } from "@/application/exam/listMyAttempts";
import { StartExam } from "@/application/exam/startExam";
import { SubmitExam } from "@/application/exam/submitExam";
import { SetExamAccess } from "@/application/examSet/setExamAccess";
import { GetExamSetAudio } from "@/application/examSet/getExamSetAudio";
import { GetExamSetForReview } from "@/application/examSet/getExamSetForReview";
import { ListExamSets } from "@/application/examSet/listExamSets";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { env } from "@/infrastructure/config/env";
import { NodeSha256 } from "@/infrastructure/crypto/nodeSha256";
import { DrizzleAttemptRepository } from "@/infrastructure/persistence/drizzleAttemptRepository";
import { InMemoryAttemptRepository } from "@/infrastructure/persistence/inMemoryAttemptRepository";
import { DrizzleExamSetRepository } from "@/infrastructure/persistence/drizzleExamSetRepository";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";
import { InMemoryAudioStorage } from "@/infrastructure/storage/inMemoryAudioStorage";
import { LocalAudioStorage } from "@/infrastructure/storage/localAudioStorage";
import { R2AudioStorage } from "@/infrastructure/storage/r2AudioStorage";
import { CdnAudioStorage } from "@/infrastructure/storage/cdnAudioStorage";

/**
 * Composition Root（題組、考試）。
 * - 有 DATABASE_URL → Drizzle；沒有 → 記憶體
 * - 錄音：有 R2 設定 → Cloudflare R2（再有 AUDIO_CDN_BASE → 經各地節點送出）；有 AUDIO_LOCAL_DIR → 本機資料夾；都沒有且非正式環境 → 記憶體
 */
type Container = {
  sets: ExamSetRepository;
  attempts: AttemptRepository;
  storage: AudioStorage;
  limiter: RateLimiter;
};

const globalStore = globalThis as unknown as { __examContainer?: Container };

function buildStorage(): AudioStorage {
  if (env.r2) {
    const r2 = new R2AudioStorage(env.r2);
    return env.audioCdn
      ? new CdnAudioStorage(r2, env.audioCdn.base, env.audioCdn.secret)
      : r2;
  }
  if (env.audioLocalDir) return new LocalAudioStorage(env.audioLocalDir);
  if (env.isProduction) throw new Error("[env] 正式環境還沒有設定音檔儲存空間");
  return new InMemoryAudioStorage();
}

function build(): Container {
  return {
    sets: env.databaseUrl
      ? new DrizzleExamSetRepository()
      : new InMemoryExamSetRepository(),
    attempts: env.databaseUrl
      ? new DrizzleAttemptRepository()
      : new InMemoryAttemptRepository(),
    storage: buildStorage(),
    limiter: new InMemoryRateLimiter(),
  };
}

/**
 * 有資料庫：物件放在模組裡，改程式熱更新時跟著換新（放 globalThis 會留著舊類別，新方法找不到）。
 * 沒有資料庫：記憶體資料放 globalThis，熱更新時才不會不見（改了 repository 要重開伺服器）。
 */
let dbContainer: Container | undefined;

function container(): Container {
  if (env.databaseUrl) return (dbContainer ??= build());
  return (globalStore.__examContainer ??= build());
}

export function uploadExamSet(): UploadExamSet {
  const c = container();
  return new UploadExamSet(c.sets, c.storage, new NodeSha256());
}

export function listExamSets(): ListExamSets {
  return new ListExamSets(container().sets);
}

export function getExamSetForReview(): GetExamSetForReview {
  return new GetExamSetForReview(container().sets);
}

export function reviewExamSet(): ReviewExamSet {
  return new ReviewExamSet(container().sets);
}

export function getExamSetAudio(): GetExamSetAudio {
  const c = container();
  return new GetExamSetAudio(c.sets, c.storage, c.limiter);
}

export function setExamAccess(): SetExamAccess {
  return new SetExamAccess(container().sets);
}

export function listAvailableExams(): ListAvailableExams {
  return new ListAvailableExams(container().sets);
}

export function startExam(): StartExam {
  const c = container();
  return new StartExam(c.sets, c.attempts);
}

export function submitExam(): SubmitExam {
  const c = container();
  return new SubmitExam(c.sets, c.attempts);
}

export function getAttemptResult(): GetAttemptResult {
  const c = container();
  return new GetAttemptResult(c.sets, c.attempts);
}

export function claimGuestAttempts(): ClaimGuestAttempts {
  return new ClaimGuestAttempts(container().attempts);
}

export function listMyAttempts(): ListMyAttempts {
  const c = container();
  return new ListMyAttempts(c.sets, c.attempts);
}

export function getTeacherDashboard(): GetTeacherDashboard {
  return new GetTeacherDashboard(container().sets);
}

export function getAdminDashboard(): GetAdminDashboard {
  return new GetAdminDashboard(container().sets, getAccountRepository());
}

export function deleteExamSet(): DeleteExamSet {
  const c = container();
  return new DeleteExamSet(c.sets, c.attempts, c.storage);
}

export function getReviewLog(): GetReviewLog {
  return new GetReviewLog(container().sets, getAccountRepository());
}

export function getStudentDashboard(): GetStudentDashboard {
  const c = container();
  return new GetStudentDashboard(c.sets, c.attempts);
}
