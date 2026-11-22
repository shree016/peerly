"use server";

import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { AppError, runAction } from "@/lib/app-error";
import { sendEmail } from "@/lib/email";
import { requirePermission, userCan } from "@/lib/permissions/server";

import db from "@/db";
import { poll, pollCollaborator, user as userTable } from "@/db/schema";

import { requireManagedPoll } from "./core";
import { inviteSchema } from "./validation";

export interface CollaboratorRow {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  status: "pending" | "accepted" | "declined";
}

export async function listCollaborators(pollId: string) {
  return runAction(async () => {
    const { poll: row, canAdminister } = await requireManagedPoll(pollId);
    const rows = await db.query.pollCollaborator.findMany({
      where: eq(pollCollaborator.pollId, row.id),
      orderBy: desc(pollCollaborator.invitedAt),
      with: { user: { columns: { name: true, email: true } } },
    });
    return {
      canAdminister,
      collaborators: rows.map((c): CollaboratorRow => ({
        id: c.id,
        userId: c.userId,
        name: c.user?.name ?? null,
        email: c.user?.email ?? "",
        status: c.status as CollaboratorRow["status"],
      })),
    };
  });
}

/** Users who can manage polls (and so may be invited), minus existing ones. */
async function pollManagerUsers() {
  const ownerEmails = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      banned: userTable.banned,
    })
    .from(userTable)
    .where(
      or(
        like(userTable.role, "%faculty%"),
        like(userTable.role, "%coordinator%"),
        like(userTable.role, "%admin%"),
        ownerEmails.length
          ? inArray(sql`lower(${userTable.email})`, ownerEmails)
          : undefined,
      ),
    );
  return rows.filter((r) => !r.banned && userCan(r, "poll:manage"));
}

export async function listInviteCandidates(pollId: string) {
  return runAction(async () => {
    const { user, poll: row } = await requireManagedPoll(pollId, {
      administer: true,
    });
    const existing = await db
      .select({ userId: pollCollaborator.userId })
      .from(pollCollaborator)
      .where(
        and(
          eq(pollCollaborator.pollId, row.id),
          inArray(pollCollaborator.status, ["pending", "accepted"]),
        ),
      );
    const taken = new Set([
      user.id,
      row.creatorId,
      ...existing.map((e) => e.userId),
    ]);
    return (await pollManagerUsers())
      .filter((u) => !taken.has(u.id))
      .map((u) => ({ id: u.id, name: u.name, email: u.email }))
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  });
}

export async function inviteCollaborators(input: {
  pollId: string;
  userIds: string[];
}) {
  return runAction(async () => {
    const data = inviteSchema.parse(input);
    const { user, poll: row } = await requireManagedPoll(data.pollId, {
      administer: true,
    });

    const allowed = new Map((await pollManagerUsers()).map((u) => [u.id, u]));
    const invitees = [...new Set(data.userIds)]
      .filter((id) => id !== row.creatorId && id !== user.id)
      .map((id) => allowed.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u);
    if (invitees.length === 0) {
      throw new AppError(
        "NO_VALID_INVITEES",
        "Only people who can manage polls can be invited.",
        400,
      );
    }

    await db
      .insert(pollCollaborator)
      .values(
        invitees.map((u) => ({
          pollId: row.id,
          userId: u.id,
          status: "pending",
          invitedBy: user.id,
        })),
      )
      .onConflictDoUpdate({
        target: [pollCollaborator.pollId, pollCollaborator.userId],
        // Re-inviting someone who declined puts them back to pending.
        set: {
          status: "pending",
          invitedBy: user.id,
          invitedAt: new Date(),
          respondedAt: null,
        },
        where: sql`${pollCollaborator.status} = 'declined'`,
      });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    await Promise.allSettled(
      invitees.map((u) =>
        sendEmail({
          to: u.email,
          subject: `You've been invited to manage a poll on Peeerly`,
          text: `${user.name ?? "A coordinator"} invited you to help manage the poll "${row.title}".\n\nOpen ${appUrl}/polls to accept or decline.`,
        }),
      ),
    );
    return { invited: invitees.length };
  });
}

export async function removeCollaborator(input: {
  pollId: string;
  collaboratorId: string;
}) {
  return runAction(async () => {
    const {
      user,
      poll: row,
      canAdminister,
    } = await requireManagedPoll(input.pollId);
    const target = await db.query.pollCollaborator.findFirst({
      where: and(
        eq(pollCollaborator.id, input.collaboratorId),
        eq(pollCollaborator.pollId, row.id),
      ),
    });
    if (!target)
      throw new AppError("NOT_FOUND", "Collaborator not found.", 404);
    // Creators/admins remove anyone; a collaborator may remove themselves.
    if (!canAdminister && target.userId !== user.id) {
      throw new AppError(
        "FORBIDDEN",
        "Only the creator can remove collaborators.",
        403,
      );
    }
    await db.delete(pollCollaborator).where(eq(pollCollaborator.id, target.id));
    return { removed: true };
  });
}

export interface InviteRow {
  id: string;
  pollId: string;
  pollTitle: string;
  pollKind: string;
  invitedByName: string | null;
  invitedAt: string;
}

export async function listMyInvites() {
  return runAction(async (): Promise<InviteRow[]> => {
    const user = await requirePermission("poll:manage");
    const rows = await db
      .select({
        id: pollCollaborator.id,
        pollId: poll.id,
        pollTitle: poll.title,
        pollKind: poll.kind,
        invitedByName: userTable.name,
        invitedAt: pollCollaborator.invitedAt,
      })
      .from(pollCollaborator)
      .innerJoin(poll, eq(poll.id, pollCollaborator.pollId))
      .leftJoin(userTable, eq(userTable.id, pollCollaborator.invitedBy))
      .where(
        and(
          eq(pollCollaborator.userId, user.id),
          eq(pollCollaborator.status, "pending"),
        ),
      )
      .orderBy(desc(pollCollaborator.invitedAt));
    return rows.map((r) => ({ ...r, invitedAt: r.invitedAt.toISOString() }));
  });
}

export async function respondToInvite(input: {
  inviteId: string;
  accept: boolean;
}) {
  return runAction(async () => {
    const user = await requirePermission("poll:manage");
    const invite = await db.query.pollCollaborator.findFirst({
      where: and(
        eq(pollCollaborator.id, input.inviteId),
        eq(pollCollaborator.userId, user.id),
      ),
    });
    if (!invite || invite.status !== "pending") {
      throw new AppError("NOT_FOUND", "Invitation not found.", 404);
    }
    await db
      .update(pollCollaborator)
      .set({
        status: input.accept ? "accepted" : "declined",
        respondedAt: new Date(),
      })
      .where(eq(pollCollaborator.id, invite.id));
    return { pollId: invite.pollId, accepted: input.accept };
  });
}
