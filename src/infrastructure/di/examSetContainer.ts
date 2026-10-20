import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { AudioStorage } from "@/application/examSet/ports";
import { ClaimGuestAttempts } from "@/application/exam/claimGuestAttempts";
import { GetAttemptResult } from "@/application/exam/getAttemptResult";
import { ListAvailableExams } from "@/application/exam/listAvailableExams";
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

/**
 * Composition Root（題組、考試）。
 * - 有 DATABASE_URL → Drizzle；沒有 → 記憶體
 * - 有 AUDIO_LOCAL_DIR → 存本機資料夾；沒有且非正式環境 → 記憶體
 *   （正式環境的雲端儲存等接上 Neon Object Storage 時再加）
 */
type Container = {
  sets: ExamSetRepository;
  attempts: AttemptRepository;
  storage: AudioStorage;
};

const globalStore = globalThis as unknown as { __examContainer?: Container };

function buildStorage(): AudioStorage {
  if (env.audioLocalDir) return new LocalAudioStorage(env.audioLocalDir);
  if (env.isProduction) throw new Error("[env] 正式環境還沒有設定音檔儲存空間");
  return new InMemoryAudioStorage();
}

function container(): Container {
  globalStore.__examContainer ??= {
    sets: env.databaseUrl
      ? new DrizzleExamSetRepository()
      : new InMemoryExamSetRepository(),
    attempts: env.databaseUrl
      ? new DrizzleAttemptRepository()
      : new InMemoryAttemptRepository(),
    storage: buildStorage(),
  };
  return globalStore.__examContainer;
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
  return new GetExamSetAudio(c.sets, c.storage);
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
