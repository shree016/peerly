"use server";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  or,
} from "drizzle-orm";
import { z } from "zod";

import { auditInsert } from "@/features/admin/lib/audit";

import { AppError, runAction } from "@/lib/app-error";

import db from "@/db";
import {
  pollReopenGrant,
  pollResponse,
  student,
  user as userTable,
} from "@/db/schema";

import { requireManagedPoll } from "./core";
import { broadcastPollEvent } from "./realtime";
import { type StudentLite, toStudentLite } from "./types";
import { grantSchema } from "./validation";

export interface GrantRow {
  id: string;
  student: StudentLite;
  remarks: string;
  grantedByName: string | null;
  grantedAt: string;
  revokedAt: string | null;
  used: boolean;
}

export async function listGrants(pollId: string) {
  return runAction(async (): Promise<GrantRow[]> => {
    const { poll: row } = await requireManagedPoll(pollId);
    const grants = await db.query.pollReopenGrant.findMany({
      where: eq(pollReopenGrant.pollId, row.id),
      orderBy: desc(pollReopenGrant.grantedAt),
      with: { student: true, grantor: { columns: { name: true } } },
    });
    const usedIds = new Set(
      (
        await db
          .select({ grantId: pollResponse.reopenGrantId })
          .from(pollResponse)
          .where(eq(pollResponse.pollId, row.id))
      )
        .map((r) => r.grantId)
        .filter(Boolean),
    );
    return grants.map((g) => ({
      id: g.id,
      student: toStudentLite(g.student),
      remarks: g.remarks,
      grantedByName: g.grantor?.name ?? null,
      grantedAt: g.grantedAt.toISOString(),
      revokedAt: g.revokedAt?.toISOString() ?? null,
      used: usedIds.has(g.id),
    }));
  });
}

/** Roster students without a response or an active grant, for the picker. */
export async function searchGrantCandidates(input: {
  pollId: string;
  query: string;
}) {
  return runAction(async (): Promise<StudentLite[]> => {
    const { poll: row } = await requireManagedPoll(input.pollId);
    const query = z.string().trim().min(2).max(60).parse(input.query);

    const [responders, active] = await Promise.all([
      db
        .select({ email: userTable.email })
        .from(pollResponse)
        .innerJoin(userTable, eq(userTable.id, pollResponse.userId))
        .where(eq(pollResponse.pollId, row.id)),
      db
        .select({ studentId: pollReopenGrant.studentId })
        .from(pollReopenGrant)
        .where(
          and(
            eq(pollReopenGrant.pollId, row.id),
            isNull(pollReopenGrant.revokedAt),
          ),
        ),
    ]);
    const respondedEmails = responders.map((r) => r.email.toLowerCase());
    const activeIds = active.map((a) => a.studentId);

    const rows = await db
      .select()
      .from(student)
      .where(
        and(
          or(
            ilike(student.name, `%${query}%`),
            ilike(student.usn, `%${query}%`),
          ),
          respondedEmails.length
            ? notInArray(student.email, respondedEmails)
            : undefined,
          activeIds.length ? notInArray(student.id, activeIds) : undefined,
        ),
      )
      .orderBy(student.usn)
      .limit(20);
    return rows.map(toStudentLite);
  });
}

export async function grantLateAccess(input: z.input<typeof grantSchema>) {
  return runAction(async () => {
    const data = grantSchema.parse(input);
    const { user, poll: row } = await requireManagedPoll(data.pollId);
    if (row.status === "draft") {
      throw new AppError(
        "POLL_DRAFT",
        "Open the poll before granting late access.",
        400,
      );
    }

    const ids = [...new Set(data.studentIds)];
    const [found, active] = await Promise.all([
      db
        .select({ id: student.id })
        .from(student)
        .where(inArray(student.id, ids)),
      db
        .select({ studentId: pollReopenGrant.studentId })
        .from(pollReopenGrant)
        .where(
          and(
            eq(pollReopenGrant.pollId, row.id),
            inArray(pollReopenGrant.studentId, ids),
            isNull(pollReopenGrant.revokedAt),
          ),
        ),
    ]);
    const already = new Set(active.map((a) => a.studentId));
    const toGrant = found.map((f) => f.id).filter((id) => !already.has(id));
    if (toGrant.length === 0) return { granted: 0 };

    await db.batch([
      db.insert(pollReopenGrant).values(
        toGrant.map((studentId) => ({
          pollId: row.id,
          studentId,
          remarks: data.remarks,
          grantedBy: user.id,
        })),
      ),
      auditInsert({
        actorId: user.id,
        action: "poll.grant.create",
        targetType: "poll",
        targetId: row.id,
        details: { students: toGrant.length },
      }),
    ]);
    await broadcastPollEvent(row.id, {
      event: "status",
      payload: { status: row.status },
    });
    return { granted: toGrant.length };
  });
}

export async function revokeLateAccess(input: {
  pollId: string;
  grantId: string;
}) {
  return runAction(async () => {
    const { user, poll: row } = await requireManagedPoll(input.pollId);
    const grant = await db.query.pollReopenGrant.findFirst({
      where: and(
        eq(pollReopenGrant.id, input.grantId),
        eq(pollReopenGrant.pollId, row.id),
        isNull(pollReopenGrant.revokedAt),
      ),
    });
    if (!grant) throw new AppError("NOT_FOUND", "Active grant not found.", 404);
    await db.batch([
      db
        .update(pollReopenGrant)
        .set({ revokedAt: new Date(), revokedBy: user.id })
        .where(eq(pollReopenGrant.id, grant.id)),
      auditInsert({
        actorId: user.id,
        action: "poll.grant.revoke",
        targetType: "poll",
        targetId: row.id,
        details: { grantId: grant.id },
      }),
    ]);
    return { revoked: true };
  });
}
