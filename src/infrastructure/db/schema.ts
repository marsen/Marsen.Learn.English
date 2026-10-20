import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import type { JsonObject, PublicTiming } from "@/domain/examSet/examSet";
import type { QuestionNote } from "@/domain/examSet/review";
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
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  access: text("access").notNull().default("members"), // 'public' | 'members'
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
  audioNote: text("audio_note"),
  questionNotes: jsonb("question_notes").$type<QuestionNote[]>().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
});

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
