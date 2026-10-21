CREATE TABLE "exam_review_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" text NOT NULL,
	"set_title" text NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_review_log" ADD CONSTRAINT "exam_review_log_reviewer_id_accounts_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_review_log_reviewed_at_idx" ON "exam_review_log" USING btree ("reviewed_at");--> statement-breakpoint
-- 補上既有的審稿（每套只有最新一次）當作第一批紀錄
INSERT INTO "exam_review_log" ("set_id", "set_title", "reviewer_id", "decision", "reviewed_at")
SELECT r."set_id", s."title", r."reviewer_id", r."decision", r."reviewed_at"
FROM "exam_set_reviews" r JOIN "exam_sets" s ON s."set_id" = r."set_id";
