"use server";

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  like,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { AppError, runAction } from "@/lib/app-error";
import {
  ROLE_NAMES,
  type RoleName,
  parseRoles,
  serializeRoles,
} from "@/lib/permissions/roles";
import {
  getEffectiveRoles,
  isSuperAdminEmail,
  requirePermission,
} from "@/lib/permissions/server";

import db from "@/db";
import { auditLog, session, user } from "@/db/schema";

import { auditInsert } from "./audit";

const PAGE_SIZE = 25;

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  roles: RoleName[];
  storedRoles: RoleName[];
  isOwner: boolean;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
}

const listUsersSchema = z.object({
  query: z.string().trim().max(100).optional(),
  role: z.enum(ROLE_NAMES).optional(),
  page: z.number().int().min(1).max(10_000).default(1),
});

export async function listUsersForAdmin(
  input: z.input<typeof listUsersSchema>,
) {
  return runAction(async () => {
    await requirePermission("access:manage-roles");
    const { query, role, page } = listUsersSchema.parse(input);

    const filters = [];
    if (query) {
      filters.push(
        or(ilike(user.name, `%${query}%`), ilike(user.email, `%${query}%`)),
      );
    }
    if (role && role !== "student") {
      filters.push(like(user.role, `%${role}%`));
    }
    const where = filters.length ? and(...filters) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(user).where(where),
    ]);

    const users: AdminUserRow[] = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        image: r.image,
        roles: getEffectiveRoles(r),
        storedRoles: parseRoles(r.role),
        isOwner: isSuperAdminEmail(r.email),
        banned: r.banned ?? false,
        banReason: r.banReason,
        createdAt: r.createdAt.toISOString(),
      }))
      // "student" filter = people holding no elevated role at all.
      .filter((u) =>
        role === "student"
          ? u.roles.length === 1 && u.roles[0] === "student"
          : true,
      );

    return { users, total, page, pageSize: PAGE_SIZE };
  });
}

/** Number of accounts that are admin — stored role or env owner. */
async function countAdmins(excludeUserId?: string): Promise<number> {
  // Env owners are permanent admins even without a stored admin role.
  const ownerEmails = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const candidates = await db
    .select({
      id: user.id,
      email: user.email,
      role: user.role,
      banned: user.banned,
    })
    .from(user)
    .where(
      or(
        like(user.role, "%admin%"),
        ownerEmails.length
          ? inArray(sql`lower(${user.email})`, ownerEmails)
          : undefined,
      ),
    );
  return candidates.filter(
    (c) =>
      c.id !== excludeUserId &&
      !c.banned &&
      getEffectiveRoles(c).includes("admin"),
  ).length;
}

async function loadTarget(userId: string) {
  const target = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { id: true, email: true, role: true, banned: true },
  });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found.", 404);
  return target;
}

const setRolesSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(ROLE_NAMES)).max(ROLE_NAMES.length),
});

export async function setUserRoles(input: z.input<typeof setRolesSchema>) {
  return runAction(async () => {
    const actor = await requirePermission("access:manage-roles");
    const { userId, roles } = setRolesSchema.parse(input);
    const target = await loadTarget(userId);

    const before = parseRoles(target.role);
    const nextValue = serializeRoles(roles);
    const after = parseRoles(nextValue);

    const losingAdmin = before.includes("admin") && !after.includes("admin");
    if (losingAdmin && !isSuperAdminEmail(target.email)) {
      const remaining = await countAdmins(target.id);
      if (remaining === 0) {
        throw new AppError(
          "LAST_ADMIN",
          "Peeerly must always have at least one admin. Make someone else admin first.",
          400,
        );
      }
    }

    await db.batch([
      db.update(user).set({ role: nextValue }).where(eq(user.id, target.id)),
      auditInsert({
        actorId: actor.id,
        action: "role.update",
        targetType: "user",
        targetId: target.id,
        details: { from: before, to: after },
      }),
    ]);

    return {
      roles: getEffectiveRoles({ role: nextValue, email: target.email }),
    };
  });
}

const banSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3, "Add a short reason.").max(300),
});

export async function banUser(input: z.input<typeof banSchema>) {
  return runAction(async () => {
    const actor = await requirePermission("access:ban");
    const { userId, reason } = banSchema.parse(input);
    if (userId === actor.id) {
      throw new AppError(
        "SELF_BAN",
        "You can't suspend your own account.",
        400,
      );
    }
    const target = await loadTarget(userId);
    if (isSuperAdminEmail(target.email)) {
      throw new AppError("OWNER", "Owner accounts can't be suspended.", 400);
    }
    if (parseRoles(target.role).includes("admin")) {
      const remaining = await countAdmins(target.id);
      if (remaining === 0) {
        throw new AppError(
          "LAST_ADMIN",
          "You can't suspend the last admin.",
          400,
        );
      }
    }

    await db.batch([
      db
        .update(user)
        .set({ banned: true, banReason: reason, banExpires: null })
        .where(eq(user.id, target.id)),
      // Sign them out everywhere immediately.
      db.delete(session).where(eq(session.userId, target.id)),
      auditInsert({
        actorId: actor.id,
        action: "user.ban",
        targetType: "user",
        targetId: target.id,
      }),
    ]);
    return { banned: true };
  });
}

export async function unbanUser(userId: string) {
  return runAction(async () => {
    const actor = await requirePermission("access:ban");
    const target = await loadTarget(z.string().min(1).parse(userId));
    await db.batch([
      db
        .update(user)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(user.id, target.id)),
      auditInsert({
        actorId: actor.id,
        action: "user.unban",
        targetType: "user",
        targetId: target.id,
      }),
    ]);
    return { banned: false };
  });
}

export async function revokeUserSessions(userId: string) {
  return runAction(async () => {
    const actor = await requirePermission("access:revoke-sessions");
    const target = await loadTarget(z.string().min(1).parse(userId));
    await db.batch([
      db.delete(session).where(eq(session.userId, target.id)),
      auditInsert({
        actorId: actor.id,
        action: "user.sessions.revoke",
        targetType: "user",
        targetId: target.id,
      }),
    ]);
    return { revoked: true };
  });
}

export interface AuditRow {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export async function listAuditLog(page = 1) {
  return runAction(async () => {
    await requirePermission("audit:read");
    const safePage = z.number().int().min(1).max(10_000).parse(page);

    const rows = await db.query.auditLog.findMany({
      orderBy: desc(auditLog.createdAt),
      limit: PAGE_SIZE,
      offset: (safePage - 1) * PAGE_SIZE,
      with: { actor: { columns: { name: true, email: true } } },
    });

    // Only platform users are labelled; roster students stay as opaque ids.
    const userTargetIds = rows
      .filter((r) => r.targetType === "user" && r.targetId)
      .map((r) => r.targetId as string);
    const targets = userTargetIds.length
      ? await db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(inArray(user.id, userTargetIds))
      : [];
    const targetMap = new Map(targets.map((t) => [t.id, t.name ?? t.email]));

    const entries: AuditRow[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorName: r.actor?.name ?? null,
      actorEmail: r.actor?.email ?? null,
      targetType: r.targetType,
      targetId: r.targetId,
      targetLabel:
        r.targetType === "user" && r.targetId
          ? (targetMap.get(r.targetId) ?? null)
          : null,
      details: r.details ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    const [{ total }] = await db.select({ total: count() }).from(auditLog);
    return { entries, total, page: safePage, pageSize: PAGE_SIZE };
  });
}
