/**
 * One-time role bootstrap. Reads emails ONLY from env (.env.local / Vercel),
 * so no personal data is ever committed:
 *
 *   SUPER_ADMIN_EMAILS=owner@example.edu                → admin
 *   BOOTSTRAP_ACTIVITY_COORDINATOR_EMAILS=a@…,b@…       → activity_coordinator
 *   BOOTSTRAP_FACULTY_EMAILS=x@…                        → faculty
 *
 * Usage:  npm run roles:bootstrap
 *
 * Accounts must already exist (the person has signed in once). Missing
 * accounts are reported by count only. After running, remove the
 * BOOTSTRAP_* variables — from then on roles are managed at /admin/users.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { inArray, sql } = await import("drizzle-orm");
  const { default: db } = await import("../db");
  const { auditLog, user } = await import("../db/schema");
  const { parseRoles, serializeRoles } =
    await import("../lib/permissions/roles");
  type RoleName = import("../lib/permissions/roles").RoleName;

  const readList = (name: string) =>
    (process.env[name] ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

  const grants: [RoleName, string[]][] = [
    ["admin", readList("SUPER_ADMIN_EMAILS")],
    ["activity_coordinator", readList("BOOTSTRAP_ACTIVITY_COORDINATOR_EMAILS")],
    ["faculty", readList("BOOTSTRAP_FACULTY_EMAILS")],
  ];

  for (const [role, emails] of grants) {
    if (emails.length === 0) continue;
    const rows = await db
      .select({ id: user.id, email: user.email, role: user.role })
      .from(user)
      .where(inArray(sql`lower(${user.email})`, emails));

    let updated = 0;
    for (const row of rows) {
      const before = parseRoles(row.role);
      if (before.includes(role)) continue;
      const next = serializeRoles([...before, role]);
      await db.batch([
        db
          .update(user)
          .set({ role: next })
          .where(sql`${user.id} = ${row.id}`),
        db.insert(auditLog).values({
          actorId: null,
          action: "role.update",
          targetType: "user",
          targetId: row.id,
          details: { from: before, to: parseRoles(next), source: "bootstrap" },
        }),
      ]);
      updated++;
    }
    console.log(
      `${role}: ${updated} updated, ${rows.length - updated} already had it, ${emails.length - rows.length} not signed up yet`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      "Bootstrap failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
