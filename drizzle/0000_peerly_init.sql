CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_experience" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"drive_id" text,
	"company_name" text NOT NULL,
	"company_logo_url" text,
	"role" text NOT NULL,
	"batch" text NOT NULL,
	"result" text NOT NULL,
	"ctc_lpa" real,
	"overview" text NOT NULL,
	"preparation_resources" text,
	"jd_url" text,
	"jd_file_name" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" text,
	"verified_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_experience_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"experience_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_experience_resource" (
	"id" text PRIMARY KEY NOT NULL,
	"experience_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"file_name" text,
	"file_size" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_experience_round" (
	"id" text PRIMARY KEY NOT NULL,
	"experience_id" text NOT NULL,
	"round_number" integer NOT NULL,
	"round_type" text NOT NULL,
	"description" text NOT NULL,
	"difficulty" text,
	"outcome" text
);
--> statement-breakpoint
CREATE TABLE "quiz_analytics_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"question_id" text NOT NULL,
	"total_responses" integer DEFAULT 0 NOT NULL,
	"option_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"avg_response_time_ms" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_analytics_snapshots_session_question" UNIQUE("session_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_answer_option" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text,
	"image_url" text,
	"is_correct" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answer_options_question_position" UNIQUE("question_id","position")
);
--> statement-breakpoint
CREATE TABLE "quiz_event" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"join_code" text,
	"logo_url" text,
	"theme_id" text DEFAULT 'ocean' NOT NULL,
	"custom_theme" jsonb,
	"anonymous_mode" boolean DEFAULT false NOT NULL,
	"auto_play_mode" boolean DEFAULT false NOT NULL,
	"enforce_focus_mode" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_event_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "quiz_join_code_history" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"join_code" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quiz_participant_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"question_id" text NOT NULL,
	"selected_option_ids" text[],
	"open_text_response" text,
	"rating_value" integer,
	"is_correct" boolean,
	"score_awarded" integer DEFAULT 0 NOT NULL,
	"response_time_ms" integer,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_participant_answers_participant_question" UNIQUE("participant_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_participant_report" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"ai_status" text DEFAULT 'idle' NOT NULL,
	"ai_feedback" jsonb,
	"ai_error" text,
	"pdf_status" text DEFAULT 'idle' NOT NULL,
	"pdf_s3_key" text,
	"pdf_content_hash" text,
	"pdf_error" text,
	"pdf_generated_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_participant_reports_participant" UNIQUE("participant_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_question" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"position" integer NOT NULL,
	"question_type" text NOT NULL,
	"text" text NOT NULL,
	"image_url" text,
	"time_limit" integer DEFAULT 20 NOT NULL,
	"rating_min" integer,
	"rating_max" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_questions_event_position" UNIQUE("event_id","position")
);
--> statement-breakpoint
CREATE TABLE "quiz_session" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"admin_id" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"current_question_id" text,
	"current_question_index" integer,
	"question_started_at" timestamp,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_session_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar" text NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"is_connected" boolean DEFAULT true NOT NULL,
	"disconnected_at" timestamp,
	"participant_token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_session_participant_participant_token_unique" UNIQUE("participant_token"),
	CONSTRAINT "quiz_session_participants_session_display_name" UNIQUE("session_id","display_name")
);
--> statement-breakpoint
CREATE TABLE "quiz_session_report_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"display_name" text NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"rating" integer NOT NULL,
	"feedback_text" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_session_report_feedback_participant" UNIQUE("session_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"github" text,
	"twitter" text,
	"peerlist" text,
	"linkedin" text,
	"portfolio" text,
	"bio" text,
	"is_coordinator" boolean DEFAULT false NOT NULL,
	"is_elective_poll_admin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"currentVideoNumber" integer,
	"currentVideoLink" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experience" ADD CONSTRAINT "interview_experience_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experience" ADD CONSTRAINT "interview_experience_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experience_comment" ADD CONSTRAINT "interview_experience_comment_experience_id_interview_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."interview_experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experience_comment" ADD CONSTRAINT "interview_experience_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experience_resource" ADD CONSTRAINT "interview_experience_resource_experience_id_interview_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."interview_experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experience_round" ADD CONSTRAINT "interview_experience_round_experience_id_interview_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."interview_experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_analytics_snapshot" ADD CONSTRAINT "quiz_analytics_snapshot_session_id_quiz_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_analytics_snapshot" ADD CONSTRAINT "quiz_analytics_snapshot_question_id_quiz_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answer_option" ADD CONSTRAINT "quiz_answer_option_question_id_quiz_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_event" ADD CONSTRAINT "quiz_event_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_join_code_history" ADD CONSTRAINT "quiz_join_code_history_event_id_quiz_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."quiz_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_participant_answer" ADD CONSTRAINT "quiz_participant_answer_session_id_quiz_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_participant_answer" ADD CONSTRAINT "quiz_participant_answer_participant_id_quiz_session_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."quiz_session_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_participant_answer" ADD CONSTRAINT "quiz_participant_answer_question_id_quiz_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_participant_report" ADD CONSTRAINT "quiz_participant_report_session_id_quiz_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_participant_report" ADD CONSTRAINT "quiz_participant_report_participant_id_quiz_session_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."quiz_session_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_event_id_quiz_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."quiz_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session" ADD CONSTRAINT "quiz_session_event_id_quiz_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."quiz_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session" ADD CONSTRAINT "quiz_session_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session" ADD CONSTRAINT "quiz_session_current_question_id_quiz_question_id_fk" FOREIGN KEY ("current_question_id") REFERENCES "public"."quiz_question"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_participant" ADD CONSTRAINT "quiz_session_participant_session_id_quiz_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_report_feedback" ADD CONSTRAINT "quiz_session_report_feedback_session_id_quiz_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_report_feedback" ADD CONSTRAINT "quiz_session_report_feedback_participant_id_quiz_session_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."quiz_session_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_experience_comment_experience_idx" ON "interview_experience_comment" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "interview_experience_resource_experience_idx" ON "interview_experience_resource" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "interview_experience_round_experience_idx" ON "interview_experience_round" USING btree ("experience_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_events_admin_title_unique" ON "quiz_event" USING btree ("admin_id",lower("title"));