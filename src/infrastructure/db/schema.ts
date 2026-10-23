import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { JsonObject, PublicTiming, Transcript } from "@/domain/examSet/examSet";
import type { AiNoteAction, QuestionNote, ReviewNote } from "@/domain/examSet/review";
import type { QuestionResult } from "@/domain/exam/grading";

/** 帳號。以 email 識別（存正規化後的小寫）。 */
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 帳號角色：一個帳號可以有多筆（例如 管理員＋老師）。 */
export const accountRoles = pgTable(
  "account_roles",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'admin' | 'teacher' | 'student'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.role] })],
);

/** 一次性登入碼。只存雜湊；用過就標 used_at。 */
export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  // email＋6 位數登入碼的雜湊；舊版登入連結留下的資料為 null
  codeHash: text("code_hash"),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // 登入碼輸錯幾次（錯 3 次作廢）
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  // 申請登入碼的瀏覽器（路人識別的雜湊）：登入後把路人作答移過去
  guestId: text("guest_id"),
  // 申請者 IP 的雜湊（不存原 IP）：限制同一個 IP 的寄送次數
  ipHash: text("ip_hash"),
});

/** 題組（考生看得到的部分）。不含答案、不含逐字稿。 */
export const examSets = pgTable("exam_sets", {
  setId: text("set_id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  questionCount: integer("question_count").notNull(),
  paper: jsonb("paper").$type<JsonObject>().notNull(),
  timing: jsonb("timing").$type<PublicTiming>().notNull(),
  audioKey: text("audio_key").notNull(),
  aiVerdict: text("ai_verdict").notNull(), // 'pass' | 'needs_human'
  status: text("status").notNull(), // 'pending_review' | 'approved' | 'rejected'
  access: text("access").notNull().default("members"), // 'public' | 'members' | 'unlisted'
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => accounts.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
});

/** 題組私密部分：標準答案與製作紀錄。只由伺服器讀取。 */
export const examSetPrivates = pgTable("exam_set_privates", {
  setId: text("set_id")
    .primaryKey()
    .references(() => examSets.setId, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<JsonObject>().notNull(),
  provenance: jsonb("provenance").$type<JsonObject>().notNull(),
  // 逐字稿與每題答案的出處（set.json 2.1 起）；更早打包的題組是 null
  transcript: jsonb("transcript").$type<Transcript>(),
});

/** 老師審稿：一套題只留最新一次（以最後一次為準）。 */
export const examSetReviews = pgTable("exam_set_reviews", {
  setId: text("set_id")
    .primaryKey()
    .references(() => examSets.setId, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => accounts.id),
  decision: text("decision").notNull(), // 'approved' | 'rejected'
  comment: text("comment"),
  // 舊欄位：新版改用 notes，過渡期照樣寫（舊版程式還在讀），下一次上線再刪
  audioNote: text("audio_note"),
  questionNotes: jsonb("question_notes").$type<QuestionNote[]>().notNull(),
  // 老師的意見（每題的、整套的）；舊審稿是 null，讀的時候從舊欄位轉
  notes: jsonb("notes").$type<ReviewNote[]>(),
  // 老師對 AI 意見的處理（保留的不記）；舊審稿是 null
  aiActions: jsonb("ai_actions").$type<AiNoteAction[]>(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
});

/**
 * 審稿紀錄：每送出一次審稿就記一筆（算老師費用用）。
 * set_id 不設外鍵，題組刪掉後紀錄還在；題組名稱記當時的。
 */
export const examReviewLog = pgTable(
  "exam_review_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setId: text("set_id").notNull(),
    setTitle: text("set_title").notNull(),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => accounts.id),
    decision: text("decision").notNull(), // 'approved' | 'rejected'
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("exam_review_log_reviewed_at_idx").on(t.reviewedAt)],
);

/** 作答。路人的作答 account_id 為空。 */
export const examAttempts = pgTable("exam_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  setId: text("set_id")
    .notNull()
    .references(() => examSets.setId),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  // 路人作答的瀏覽器識別（雜湊）；登入後清掉、改填 account_id
  guestId: text("guest_id"),
  answers: jsonb("answers").$type<Record<string, string>>(),
  score: integer("score"),
  total: integer("total"),
  results: jsonb("results").$type<QuestionResult[]>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});
