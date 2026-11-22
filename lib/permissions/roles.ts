/**
 * Peeerly role-based access control — the single source of truth for WHAT
 * each role may do. WHO holds which role lives in the database
 * (`user.role`, a comma-separated list managed from /admin/users), so no
 * email address or personal data ever needs to be written in this file.
 *
 * Code must always check a PERMISSION (e.g. "poll:manage"), never a role
 * name, so a role can gain or lose an ability here without touching every
 * call site.
 *
 * This module is isomorphic (no server-only imports) so the same
 * `rolesHavePermission` check can hide UI on the client. The client check is
 * cosmetic only — every server action and API route re-checks with
 * `requirePermission` from `lib/permissions/server.ts`.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const statements = {
  // Better Auth admin-plugin resources, kept so the plugin's own permission
  // checks stay consistent with ours. Its HTTP endpoints are blocked in
  // lib/auth.ts — every role/ban/session change goes through our audited
  // server actions instead.
  ...defaultStatements,
  poll: ["respond", "manage", "export"],
  roster: ["read", "write", "export"],
  quiz: ["manage"],
  experience: ["verify", "moderate", "templates"],
  access: ["manage-roles", "ban", "revoke-sessions"],
  audit: ["read"],
} as const;

export const ac = createAccessControl(statements);

type Statements = typeof statements;
type ResourceName = Exclude<keyof Statements, "user" | "session">;

/** Every permission string the app checks, e.g. "poll:manage". */
export type Permission = {
  [R in ResourceName]: `${R}:${Statements[R][number]}`;
}[ResourceName];

export const ROLE_NAMES = [
  "student",
  "faculty",
  "placement_coordinator",
  "activity_coordinator",
  "admin",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const DEFAULT_ROLE: RoleName = "student";

const student = ac.newRole({
  poll: ["respond"],
});

const faculty = ac.newRole({
  poll: ["respond", "manage", "export"],
  roster: ["read", "write", "export"],
});

const placementCoordinator = ac.newRole({
  poll: ["respond", "manage"],
  roster: ["read", "write"],
  experience: ["verify", "moderate", "templates"],
});

const activityCoordinator = ac.newRole({
  poll: ["respond", "manage"],
  roster: ["read"],
  quiz: ["manage"],
});

const admin = ac.newRole({
  ...statements,
});

export const roles: Record<RoleName, ReturnType<typeof ac.newRole>> = {
  student,
  faculty,
  placement_coordinator: placementCoordinator,
  activity_coordinator: activityCoordinator,
  admin,
};

export const ROLE_LABELS: Record<RoleName, string> = {
  student: "Student",
  faculty: "Faculty",
  placement_coordinator: "Placement coordinator",
  activity_coordinator: "Activity coordinator",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  student: "Responds to polls, plays quizzes, shares experiences.",
  faculty: "Manages polls and the student roster, including exports.",
  placement_coordinator:
    "Moderates placement experiences, manages drive templates and polls, views and edits the roster.",
  activity_coordinator: "Runs quizzes, manages polls, views the roster.",
  admin: "Everything, plus deciding who holds which role.",
};

export function isRoleName(value: string): value is RoleName {
  return (ROLE_NAMES as readonly string[]).includes(value);
}

/** Parses the comma-separated `user.role` column into known role names. */
export function parseRoles(raw: string | null | undefined): RoleName[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(isRoleName);
  const unique = [...new Set(parsed)];
  return unique.length > 0 ? unique : [DEFAULT_ROLE];
}

/** Serialises roles back into the `user.role` column format. */
export function serializeRoles(list: readonly RoleName[]): string {
  const unique = [...new Set(list)].filter((r) => r !== DEFAULT_ROLE);
  return unique.length > 0 ? unique.join(",") : DEFAULT_ROLE;
}

export function rolesHavePermission(
  roleList: readonly RoleName[],
  permission: Permission,
): boolean {
  const [resource, action] = permission.split(":") as [ResourceName, string];
  return roleList.some(
    (role) => roles[role]?.authorize({ [resource]: [action] } as never).success,
  );
}

/** Highest-signal label to show for a user (e.g. on the dashboard chip). */
export function primaryRoleLabel(roleList: readonly RoleName[]): string {
  const order: RoleName[] = [
    "admin",
    "faculty",
    "placement_coordinator",
    "activity_coordinator",
    "student",
  ];
  const top = order.find((r) => roleList.includes(r)) ?? "student";
  return ROLE_LABELS[top];
}
