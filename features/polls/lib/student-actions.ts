"use server";

import { asc, count, eq, ne } from "drizzle-orm";

import { AppError, runAction } from "@/lib/app-error";
import { requirePermission } from "@/lib/permissions/server";

import db from "@/db";
import {
  poll,
  pollOption,
  pollResponse,
  pollResponseOption,
} from "@/db/schema";

import {
  type StudentContext,
  closeExpiredPolls,
  inAudience,
  loadStudentContext,
  studentPollState,
} from "./core";
import { broadcastPollEvent } from "./realtime";
import { computeResults } from "./results";
import { RESPONSE_UNIQUE_CONSTRAINT, isPgError, lockSeat } from "./seat-lock";
import {
  type PollOptionRow,
  type PollRow,
  type QuestionType,
  type StudentPollDTO,
  toSummaryDTO,
} from "./types";
import { type SubmitResponseInput, submitResponseSchema } from "./validation";

type PollWithRelations = PollRow & {
  options: PollOptionRow[];
  audienceRules: {
    id: string;
    pollId: string;
    batch: string;
    section: string | null;
    createdAt: Date;
  }[];
};

async function loadVisiblePolls(): Promise<PollWithRelations[]> {
  return db.query.poll.findMany({
    where: ne(poll.status, "draft"),
    orderBy: asc(poll.closesAt),
    with: {
      options: { orderBy: asc(pollOption.position) },
      audienceRules: true,
    },
  });
}

async function toStudentDTO(
  row: PollWithRelations,
  ctx: StudentContext,
  withResults: boolean,
): Promise<StudentPollDTO | null> {
  const state = studentPollState(row, row.audienceRules[0], ctx);
  if (!state.visible) return null;

  const mine = ctx.responses.get(row.id) ?? null;
  const isOpen = row.status === "open";
  const isSeatLock = row.kind === "seatlock";
  // Students only learn other people's choices if the manager allows it, and
  // only once they've answered or the poll is over. SeatLock seat
  // availability is always shown while open — it's needed to choose.
  const mayShowResults = row.showResults && (!!mine || !isOpen);
  const showSeats = isSeatLock && (isOpen || row.showResults);

  return {
    ...toSummaryDTO(row),
    options: row.options
      .filter((o) => o.status === "active" || mine?.optionIds.includes(o.id))
      .map((o) => ({
        id: o.id,
        label: o.label,
        description: o.description,
        capacity: showSeats ? o.capacity : null,
        seatsTaken: showSeats ? o.seatsTaken : 0,
      })),
    canRespond: state.canRespond,
    blockedReason: state.blockedReason,
    allowVoteChange: row.kind === "quick" && row.allowVoteChange,
    isAnonymous: row.isAnonymous,
    viaGrant: state.viaGrant,
    myResponse: mine
      ? {
          optionIds: mine.optionIds,
          textAnswer: mine.textAnswer,
          submittedAt: mine.submittedAt.toISOString(),
        }
      : null,
    results:
      withResults && mayShowResults
        ? await computeResults(row, row.options)
        : null,
  };
}

export async function listMyPolls() {
  return runAction(async () => {
    const user = await requirePermission("poll:respond");
    await closeExpiredPolls();
    const rows = await loadVisiblePolls();
    const ctx = await loadStudentContext(user);
    const dtos = (
      await Promise.all(rows.map((r) => toStudentDTO(r, ctx, false)))
    ).filter((d): d is StudentPollDTO => d !== null);
    const open = dtos.filter((d) => d.status === "open" || d.canRespond);
    const closed = dtos
      .filter((d) => !open.includes(d))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // Unanswered first, then soonest closing.
    open.sort(
      (a, b) =>
        Number(!!a.myResponse) - Number(!!b.myResponse) ||
        (a.closesAt ?? "9999").localeCompare(b.closesAt ?? "9999"),
    );
    return { open, closed };
  });
}

export async function getStudentPoll(pollId: string) {
  return runAction(async (): Promise<StudentPollDTO> => {
    const user = await requirePermission("poll:respond");
    await closeExpiredPolls();
    const row = await db.query.poll.findFirst({
      where: eq(poll.id, pollId),
      with: {
        options: { orderBy: asc(pollOption.position) },
        audienceRules: true,
      },
    });
    if (!row) throw new AppError("POLL_NOT_FOUND", "Poll not found.", 404);
    const ctx = await loadStudentContext(user, [row.id]);
    const dto = await toStudentDTO(row, ctx, true);
    // Polls outside the student's audience look exactly like missing ones.
    if (!dto) throw new AppError("POLL_NOT_FOUND", "Poll not found.", 404);
    return dto;
  });
}

export async function getMyPendingPollCount() {
  return runAction(async () => {
    const user = await requirePermission("poll:respond");
    await closeExpiredPolls();
    const rows = await loadVisiblePolls();
    if (rows.length === 0) return { count: 0 };
    const ctx = await loadStudentContext(user);
    const pending = rows.filter((r) => {
      const state = studentPollState(r, r.audienceRules[0], ctx);
      return state.visible && state.canRespond && !ctx.responses.has(r.id);
    });
    return { count: pending.length };
  });
}

export async function submitPollResponse(input: SubmitResponseInput) {
  return runAction(async () => {
    const user = await requirePermission("poll:respond");
    const data = submitResponseSchema.parse(input);
    await closeExpiredPolls();

    const row = await db.query.poll.findFirst({
      where: eq(poll.id, data.pollId),
      with: { options: true, audienceRules: true },
    });
    if (!row || row.status === "draft") {
      throw new AppError("POLL_NOT_FOUND", "Poll not found.", 404);
    }

    const ctx = await loadStudentContext(user, [row.id]);
    const rule = row.audienceRules[0];
    const state = studentPollState(row, rule, ctx);
    if (!state.visible)
      throw new AppError("POLL_NOT_FOUND", "Poll not found.", 404);
    if (!state.canRespond) {
      throw new AppError(
        "CANNOT_RESPOND",
        state.blockedReason ?? "You can't respond to this poll.",
        409,
      );
    }

    const activeIds = new Set(
      row.options.filter((o) => o.status === "active").map((o) => o.id),
    );
    const optionIds = [...new Set(data.optionIds)];
    const questionType = row.questionType as QuestionType;

    if (questionType === "short_answer") {
      if (!data.textAnswer) {
        throw new AppError(
          "ANSWER_REQUIRED",
          "Type your answer first.",
          400,
          "textAnswer",
        );
      }
    } else {
      if (optionIds.length === 0) {
        throw new AppError("CHOICE_REQUIRED", "Pick an option first.", 400);
      }
      if (questionType !== "multiple" && optionIds.length > 1) {
        throw new AppError("ONE_CHOICE", "Pick just one option.", 400);
      }
      if (!optionIds.every((id) => activeIds.has(id))) {
        throw new AppError(
          "OPTION_UNAVAILABLE",
          "That option is no longer available.",
          409,
        );
      }
    }

    const snapshot = {
      studentUsn: ctx.student?.usn ?? null,
      studentName: ctx.student?.name ?? user.name ?? null,
      studentBatch: ctx.student?.batch ?? null,
      studentSection: ctx.student?.section ?? null,
    };

    // ── SeatLock: one atomic statement ───────────────────────────────────
    if (row.kind === "seatlock") {
      try {
        const result = await lockSeat({
          pollId: row.id,
          optionId: optionIds[0],
          userId: user.id,
          inAudience: inAudience(row, rule, ctx),
          studentId: ctx.student?.id ?? null,
          reopenGrantId: state.grantId,
          ...snapshot,
        });
        if (!result.ok) {
          const messages = {
            OPTION_NOT_FOUND: "That option no longer exists.",
            POLL_NOT_OPEN: "This poll is not open for responses.",
            OPTION_UNAVAILABLE: "This option is no longer available.",
            OPTION_FULL:
              "Those seats just filled up. Please choose another option.",
          } as const;
          throw new AppError(result.reason, messages[result.reason], 409);
        }
        return { responseId: result.responseId };
      } catch (error) {
        if (isPgError(error, "23505", RESPONSE_UNIQUE_CONSTRAINT)) {
          throw new AppError(
            "ALREADY_RESPONDED",
            "You've already locked a seat in this poll.",
            409,
          );
        }
        throw error;
      } finally {
        const options = await db
          .select({
            id: pollOption.id,
            seatsTaken: pollOption.seatsTaken,
            capacity: pollOption.capacity,
          })
          .from(pollOption)
          .where(eq(pollOption.pollId, row.id));
        await broadcastPollEvent(row.id, {
          event: "seats",
          payload: { options },
        });
      }
    }

    // ── Quick poll ───────────────────────────────────────────────────────
    const existing = ctx.responses.get(row.id);
    const textAnswer =
      questionType === "short_answer" ? data.textAnswer! : null;
    const choiceRows = (responseId: string) =>
      optionIds.map((optionId) => ({ responseId, pollId: row.id, optionId }));

    let responseId: string;
    if (existing) {
      // canRespond already guaranteed: open, in audience, vote change allowed.
      responseId = existing.id;
      const statements = [
        db
          .delete(pollResponseOption)
          .where(eq(pollResponseOption.responseId, responseId)),
        db
          .update(pollResponse)
          .set({ textAnswer, updatedAt: new Date() })
          .where(eq(pollResponse.id, responseId)),
      ] as const;
      if (optionIds.length) {
        await db.batch([
          ...statements,
          db.insert(pollResponseOption).values(choiceRows(responseId)),
        ]);
      } else {
        await db.batch(statements);
      }
    } else {
      responseId = crypto.randomUUID();
      const insertResponse = db.insert(pollResponse).values({
        id: responseId,
        pollId: row.id,
        userId: user.id,
        textAnswer,
        reopenGrantId: state.grantId,
        ...snapshot,
      });
      try {
        if (optionIds.length) {
          await db.batch([
            insertResponse,
            db.insert(pollResponseOption).values(choiceRows(responseId)),
          ]);
        } else {
          await insertResponse;
        }
      } catch (error) {
        if (isPgError(error, "23505", RESPONSE_UNIQUE_CONSTRAINT)) {
          throw new AppError(
            "ALREADY_RESPONDED",
            "You've already responded to this poll.",
            409,
          );
        }
        throw error;
      }
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(pollResponse)
      .where(eq(pollResponse.pollId, row.id));
    await broadcastPollEvent(row.id, {
      event: "responses",
      payload: { total },
    });
    return { responseId };
  });
}
