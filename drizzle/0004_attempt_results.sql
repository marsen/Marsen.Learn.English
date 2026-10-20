ALTER TABLE "exam_attempts" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD COLUMN "total" integer;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD COLUMN "results" jsonb;