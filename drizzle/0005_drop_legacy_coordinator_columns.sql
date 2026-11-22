-- RUN ONLY AFTER the RBAC code is deployed (`npm run db:migrate`).
-- The pre-RBAC code still selects these columns; dropping them earlier would
-- break every page that loads the signed-in user.
--
-- First, catch anyone made a coordinator through the old COORDINATOR_CODE
-- flow between migration 0004 and the deploy (idempotent).
UPDATE "user" SET "role" = 'placement_coordinator' WHERE "is_coordinator" = true AND ("role" IS NULL OR "role" = 'student');--> statement-breakpoint
UPDATE "user" SET "role" = "role" || ',placement_coordinator' WHERE "is_coordinator" = true AND "role" NOT LIKE '%placement_coordinator%' AND "role" <> 'student';--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_coordinator";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_elective_poll_admin";
