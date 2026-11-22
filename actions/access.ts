"use server";

import { type Access, getAccessFor } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

/**
 * The current user's effective roles and permissions, for client-side UI
 * decisions (showing nav items, buttons). Purely cosmetic — the server
 * re-checks every protected action.
 */
export async function getMyAccess(): Promise<Access | null> {
  const user = await getUser();
  if (!user || user.banned) return null;
  return getAccessFor(user);
}
