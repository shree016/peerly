// Server-only module: reads private env vars and the session. Never import it
// from a "use client" file — use `rolesHavePermission` from ./roles there.
import { AppError } from "@/lib/app-error";

import { getUser } from "@/actions/user";

import type { User } from "@/types";

import { isSuperAdminEmail, isVerifiedOwner } from "./owners";
import {
  type Permission,
  ROLE_NAMES,
  type RoleName,
  parseRoles,
  rolesHavePermission,
} from "./roles";

type RoleSource = Pick<User, "role" | "email" | "emailVerified">;

/**
 * Roles stored on the user, plus "admin" for verified env owners. This is how
 * the very first admin gets access, and it guarantees peerly can never be
 * left without anyone able to manage roles.
 *
 * An unverified account on an owner email may be an impostor, so it gets no
 * elevated role at all, not even one stored in the database.
 */
export function getEffectiveRoles(user: RoleSource): RoleName[] {
  if (isSuperAdminEmail(user.email) && !user.emailVerified) return ["student"];

  const stored = parseRoles(user.role);
  if (isVerifiedOwner(user) && !stored.includes("admin")) {
    return [...stored.filter((r) => r !== "student"), "admin"];
  }
  return stored;
}

export function userCan(
  user: RoleSource | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  return rolesHavePermission(getEffectiveRoles(user), permission);
}

export interface Access {
  roles: RoleName[];
  permissions: Permission[];
}

const ALL_PERMISSIONS: Permission[] = [
  "poll:respond",
  "poll:manage",
  "poll:export",
  "roster:read",
  "roster:write",
  "roster:export",
  "quiz:manage",
  "experience:verify",
  "experience:moderate",
  "experience:templates",
  "access:manage-roles",
  "access:ban",
  "access:revoke-sessions",
  "audit:read",
];

export function getAccessFor(user: RoleSource): Access {
  const roles = getEffectiveRoles(user);
  return {
    roles,
    permissions: ALL_PERMISSIONS.filter((p) => rolesHavePermission(roles, p)),
  };
}

/** Signed-in, non-banned user or a 401. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user || user.banned) {
    throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
  }
  return user;
}

/**
 * The real gate. Every server action and API route that touches protected
 * data calls this — hiding a button in the UI is never enough.
 */
export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!userCan(user, permission)) {
    throw new AppError("FORBIDDEN", "You don't have access to do that.", 403);
  }
  return user;
}

export { ROLE_NAMES };
