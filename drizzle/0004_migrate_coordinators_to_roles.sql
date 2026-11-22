-- Data-only step (production-safe): carry existing placement coordinators
-- (granted via the old shared COORDINATOR_CODE) over to the new RBAC role.
-- The legacy is_coordinator / is_elective_poll_admin columns are NOT dropped
-- here, so the currently deployed (pre-RBAC) code keeps working. They are
-- dropped by 0005, which runs after the new code is deployed.
-- Quiz admins were an email list in code, not a column — they are moved with
-- `npm run roles:bootstrap` (emails stay in env, never in git).
UPDATE "user" SET "role" = 'student' WHERE "role" IS NULL;--> statement-breakpoint
UPDATE "user" SET "role" = 'placement_coordinator' WHERE "is_coordinator" = true AND "role" = 'student';
