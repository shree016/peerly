// Server-only helpers shared by the poll server actions (not a "use server"
// module itself, so nothing here is callable from the client).
import { and, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AppError } from "@/lib/app-error";
import {
  getEffectiveRoles,
  requirePermission,
  userCan,
} from "@/lib/permissions/server";

import db from "@/db";
import {
  poll,
  pollAudienceExclusion,
  pollAudienceMember,
  pollReopenGrant,
  pollResponse,
  student,
} from "@/db/schema";
import type { User } from "@/types";

import { broadcastPollEvent } from "./realtime";
import { type StudentContext } from "./rules";
import type { PollRow } from "./types";

export {
  type StudentContext,
  type StudentPollState,
  csvCell,
  inAudience,
  studentPollState,
  toCsv,
} from "./rules";

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Enforces `closesAt`: any open poll past its closing time is closed. Called
 * at the start of every read/submit path, so no cron job is needed and a
 * late submission can never slip through (the seat-lock statement re-checks
 * closes_at atomically as well).
 */
export async function closeExpiredPolls(): Promise<void> {
  const closed = await db
    .update(poll)
    .set({ status: "closed", closedAt: new Date() })
    .where(
      and(
        eq(poll.status, "open"),
        isNotNull(poll.closesAt),
        lte(poll.closesAt, new Date()),
      ),
    )
    .returning({ id: poll.id });
  await Promise.all(
    closed.map((p) =>
      broadcastPollEvent(p.id, {
        event: "status",
        payload: { status: "closed" },
      }),
    ),
  );
}

// ── Manager access ──────────────────────────────────────────────────────────

export function isAdmin(
  user: Pick<User, "role" | "email" | "emailVerified">,
): boolean {
  return getEffectiveRoles(user).includes("admin");
}

export function managerAccess(
  user: User,
  row: Pick<PollRow, "creatorId" | "manageMode">,
  collaborators: { userId: string; status: string }[],
): { canManage: boolean; canAdminister: boolean; isCreator: boolean } {
  const isCreator = row.creatorId === user.id;
  if (!userCan(user, "poll:manage")) {
    return { canManage: false, canAdminister: false, isCreator };
  }
  const admin = isAdmin(user);
  const accepted = collaborators.some(
    (c) => c.userId === user.id && c.status === "accepted",
  );
  return {
    isCreator,
    canManage: admin || isCreator || row.manageMode === "shared" || accepted,
    // Ownership-level actions: delete, switch shared/private, collaborators.
    canAdminister:
      admin ||
      isCreator ||
      (row.creatorId === null && row.manageMode === "shared"),
  };
}

export async function loadPollFull(pollId: string) {
  return db.query.poll.findFirst({
    where: eq(poll.id, pollId),
    with: {
      options: true,
      audienceRules: true,
      collaborators: { columns: { userId: true, status: true } },
      creator: { columns: { name: true } },
    },
  });
}

export type PollFull = NonNullable<Awaited<ReturnType<typeof loadPollFull>>>;

/** Loads a poll the caller may manage, or throws 403/404. */
export async function requireManagedPoll(
  pollId: string,
  opts: { administer?: boolean } = {},
): Promise<{ user: User; poll: PollFull; canAdminister: boolean }> {
  const user = await requirePermission("poll:manage");
  const row = await loadPollFull(pollId);
  if (!row) throw new AppError("POLL_NOT_FOUND", "Poll not found.", 404);
  const access = managerAccess(user, row, row.collaborators);
  if (!access.canManage) {
    // Same response as "not found" so private polls don't leak their existence.
    throw new AppError("POLL_NOT_FOUND", "Poll not found.", 404);
  }
  if (opts.administer && !access.canAdminister) {
    throw new AppError(
      "FORBIDDEN",
      "Only the poll's creator (or an admin) can do that.",
      403,
    );
  }
  return { user, poll: row, canAdminister: access.canAdminister };
}

// ── Student eligibility ─────────────────────────────────────────────────────

export async function loadStudentContext(
  user: User,
  pollIds?: string[],
): Promise<StudentContext> {
  const studentRow =
    (await db.query.student.findFirst({
      where: eq(student.email, user.email.toLowerCase()),
    })) ?? null;

  const pollFilter = (col: AnyPgColumn) =>
    pollIds && pollIds.length ? inArray(col, pollIds) : undefined;

  const [members, exclusions, grants, responses] = await Promise.all([
    studentRow
      ? db
          .select({ pollId: pollAudienceMember.pollId })
          .from(pollAudienceMember)
          .where(
            and(
              eq(pollAudienceMember.studentId, studentRow.id),
              pollFilter(pollAudienceMember.pollId),
            ),
          )
      : Promise.resolve([]),
    studentRow
      ? db
          .select({ pollId: pollAudienceExclusion.pollId })
          .from(pollAudienceExclusion)
          .where(
            and(
              eq(pollAudienceExclusion.studentId, studentRow.id),
              pollFilter(pollAudienceExclusion.pollId),
            ),
          )
      : Promise.resolve([]),
    studentRow
      ? db
          .select({ pollId: pollReopenGrant.pollId, id: pollReopenGrant.id })
          .from(pollReopenGrant)
          .where(
            and(
              eq(pollReopenGrant.studentId, studentRow.id),
              isNull(pollReopenGrant.revokedAt),
              pollFilter(pollReopenGrant.pollId),
            ),
          )
      : Promise.resolve([]),
    db.query.pollResponse.findMany({
      where: and(
        eq(pollResponse.userId, user.id),
        pollFilter(pollResponse.pollId),
      ),
      columns: { id: true, pollId: true, textAnswer: true, submittedAt: true },
      with: { options: { columns: { optionId: true } } },
    }),
  ]);

  return {
    user,
    student: studentRow,
    memberPollIds: new Set(members.map((m) => m.pollId)),
    excludedPollIds: new Set(exclusions.map((e) => e.pollId)),
    grants: new Map(grants.map((g) => [g.pollId, g.id])),
    responses: new Map(
      responses.map((r) => [
        r.pollId,
        {
          id: r.id,
          textAnswer: r.textAnswer,
          submittedAt: r.submittedAt,
          optionIds: r.options.map((o) => o.optionId),
        },
      ]),
    ),
  };
}
