ALTER TABLE "quiz_session_participant" ADD COLUMN "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quiz_session_participant" ADD COLUMN "removal_reason" text;