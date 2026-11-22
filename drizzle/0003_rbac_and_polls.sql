CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text,
	"kind" text NOT NULL,
	"question_type" text DEFAULT 'single' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"audience_mode" text DEFAULT 'all' NOT NULL,
	"manage_mode" text DEFAULT 'shared' NOT NULL,
	"show_results" boolean DEFAULT false NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"allow_vote_change" boolean DEFAULT true NOT NULL,
	"closes_at" timestamp,
	"opened_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_audience_exclusion" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"student_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "poll_audience_exclusion_poll_student_unique" UNIQUE("poll_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "poll_audience_member" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"student_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "poll_audience_member_poll_student_unique" UNIQUE("poll_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "poll_audience_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"batch" text NOT NULL,
	"section" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_collaborator" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	CONSTRAINT "poll_collaborator_poll_user_unique" UNIQUE("poll_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "poll_option" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"capacity" integer,
	"seats_taken" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "poll_option_poll_position_unique" UNIQUE("poll_id","position")
);
--> statement-breakpoint
CREATE TABLE "poll_reopen_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"student_id" text NOT NULL,
	"remarks" text NOT NULL,
	"granted_by" text,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" text
);
--> statement-breakpoint
CREATE TABLE "poll_response" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text_answer" text,
	"student_usn" text,
	"student_name" text,
	"student_batch" text,
	"student_section" text,
	"reopen_grant_id" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "poll_response_poll_user_unique" UNIQUE("poll_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "poll_response_option" (
	"id" text PRIMARY KEY NOT NULL,
	"response_id" text NOT NULL,
	"poll_id" text NOT NULL,
	"option_id" text NOT NULL,
	CONSTRAINT "poll_response_option_response_option_unique" UNIQUE("response_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"usn" text NOT NULL,
	"email" text NOT NULL,
	"batch" text NOT NULL,
	"section" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_usn_unique" UNIQUE("usn"),
	CONSTRAINT "student_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "impersonatedBy" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'student';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banReason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banExpires" timestamp;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_audience_exclusion" ADD CONSTRAINT "poll_audience_exclusion_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_audience_exclusion" ADD CONSTRAINT "poll_audience_exclusion_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_audience_member" ADD CONSTRAINT "poll_audience_member_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_audience_member" ADD CONSTRAINT "poll_audience_member_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_audience_rule" ADD CONSTRAINT "poll_audience_rule_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_collaborator" ADD CONSTRAINT "poll_collaborator_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_collaborator" ADD CONSTRAINT "poll_collaborator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_collaborator" ADD CONSTRAINT "poll_collaborator_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_reopen_grant" ADD CONSTRAINT "poll_reopen_grant_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_reopen_grant" ADD CONSTRAINT "poll_reopen_grant_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_reopen_grant" ADD CONSTRAINT "poll_reopen_grant_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_reopen_grant" ADD CONSTRAINT "poll_reopen_grant_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response" ADD CONSTRAINT "poll_response_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response" ADD CONSTRAINT "poll_response_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response" ADD CONSTRAINT "poll_response_reopen_grant_id_poll_reopen_grant_id_fk" FOREIGN KEY ("reopen_grant_id") REFERENCES "public"."poll_reopen_grant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response_option" ADD CONSTRAINT "poll_response_option_response_id_poll_response_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."poll_response"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response_option" ADD CONSTRAINT "poll_response_option_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response_option" ADD CONSTRAINT "poll_response_option_option_id_poll_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "poll_status_idx" ON "poll" USING btree ("status");--> statement-breakpoint
CREATE INDEX "poll_creator_id_idx" ON "poll" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_audience_rule_poll_id_unique" ON "poll_audience_rule" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_collaborator_user_id_idx" ON "poll_collaborator" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_reopen_grant_poll_student_active_unique" ON "poll_reopen_grant" USING btree ("poll_id","student_id") WHERE "poll_reopen_grant"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "poll_reopen_grant_poll_id_idx" ON "poll_reopen_grant" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_response_poll_id_idx" ON "poll_response" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_response_option_option_id_idx" ON "poll_response_option" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "poll_response_option_poll_id_idx" ON "poll_response_option" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "student_batch_section_idx" ON "student" USING btree ("batch","section");