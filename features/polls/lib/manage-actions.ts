"use server";

import { and, count, desc, eq, inArray } from "drizzle-orm";

import { auditInsert, recordAudit } from "@/features/admin/lib/audit";

import { AppError, runAction } from "@/lib/app-error";
import { requirePermission, userCan } from "@/lib/permissions/server";

import db from "@/db";
import {
  poll,
  pollAudienceExclusion,
  pollAudienceMember,
  pollAudienceRule,
  pollOption,
  pollResponse,
  pollResponseOption,
  student,
  user as userTable,
} from "@/db/schema";

import {
  closeExpiredPolls,
  managerAccess,
  requireManagedPoll,
  toCsv,
} from "./core";
import { broadcastPollEvent } from "./realtime";
import { computeResults } from "./results";
import {
  type ManagerPollDTO,
  type ManagerPollListItem,
  POLL_KINDS,
  type PollKind,
  type QuestionType,
  type StudentLite,
  hasOptions,
  toOptionDTO,
  toStudentLite,
  toSummaryDTO,
} from "./types";
import {
  type CreatePollInput,
  type SetAudienceInput,
  type UpdatePollInput,
  addOptionSchema,
  createPollSchema,
  moveOptionSchema,
  setAudienceSchema,
  setStatusSchema,
  updateOptionSchema,
  updatePollSchema,
} from "./validation";

async function responseCount(pollId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(pollResponse)
    .where(eq(pollResponse.pollId, pollId));
  return value;
}

async function broadcastSeats(pollId: string) {
  const options = await db
    .select({
      id: pollOption.id,
      seatsTaken: pollOption.seatsTaken,
      capacity: pollOption.capacity,
    })
    .from(pollOption)
    .where(eq(pollOption.pollId, pollId));
  await broadcastPollEvent(pollId, { event: "seats", payload: { options } });
}

// ── Lists ───────────────────────────────────────────────────────────────────

export async function listManagedPolls(kind: PollKind) {
  return runAction(async (): Promise<ManagerPollListItem[]> => {
    const user = await requirePermission("poll:manage");
    if (!POLL_KINDS.includes(kind))
      throw new AppError("BAD_KIND", "Unknown poll type.", 400);
    await closeExpiredPolls();

    const rows = await db.query.poll.findMany({
      where: eq(poll.kind, kind),
      orderBy: desc(poll.createdAt),
      with: {
        options: {
          columns: { status: true, capacity: true, seatsTaken: true },
        },
        collaborators: { columns: { userId: true, status: true } },
        creator: { columns: { name: true } },
      },
    });
    const visible = rows.filter(
      (r) => managerAccess(user, r, r.collaborators).canManage,
    );
    if (visible.length === 0) return [];

    const counts = await db
      .select({ pollId: pollResponse.pollId, value: count() })
      .from(pollResponse)
      .where(
        inArray(
          pollResponse.pollId,
          visible.map((r) => r.id),
        ),
      )
      .groupBy(pollResponse.pollId);
    const countMap = new Map(counts.map((c) => [c.pollId, c.value]));

    return visible.map((r) => {
      const active = r.options.filter((o) => o.status === "active");
      return {
        ...toSummaryDTO(r),
        manageMode: r.manageMode as ManagerPollListItem["manageMode"],
        audienceMode: r.audienceMode as ManagerPollListItem["audienceMode"],
        responseCount: countMap.get(r.id) ?? 0,
        optionCount: active.length,
        totalSeats:
          r.kind === "seatlock"
            ? active.reduce((s, o) => s + (o.capacity ?? 0), 0)
            : null,
        seatsTaken:
          r.kind === "seatlock"
            ? r.options.reduce((s, o) => s + o.seatsTaken, 0)
            : null,
        creatorName: r.creator?.name ?? null,
        isCreator: r.creatorId === user.id,
      };
    });
  });
}

export async function getManagerPoll(pollId: string) {
  return runAction(async (): Promise<ManagerPollDTO> => {
    await closeExpiredPolls();
    const { user, poll: row, canAdminister } = await requireManagedPoll(pollId);

    const [members, exclusions, total] = await Promise.all([
      db.query.pollAudienceMember.findMany({
        where: eq(pollAudienceMember.pollId, row.id),
        with: { student: true },
      }),
      db.query.pollAudienceExclusion.findMany({
        where: eq(pollAudienceExclusion.pollId, row.id),
        with: { student: true },
      }),
      responseCount(row.id),
    ]);
    const rule = row.audienceRules[0] ?? null;

    return {
      ...toSummaryDTO(row),
      manageMode: row.manageMode as ManagerPollDTO["manageMode"],
      showResults: row.showResults,
      isAnonymous: row.isAnonymous,
      allowVoteChange: row.allowVoteChange,
      openedAt: row.openedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      creatorId: row.creatorId,
      creatorName: row.creator?.name ?? null,
      options: [...row.options]
        .sort((a, b) => a.position - b.position)
        .map(toOptionDTO),
      audience: {
        mode: row.audienceMode as ManagerPollDTO["audience"]["mode"],
        rule: rule ? { batch: rule.batch, section: rule.section } : null,
        members: members.map((m) => toStudentLite(m.student)),
        exclusions: exclusions.map((e) => toStudentLite(e.student)),
      },
      responseCount: total,
      canAdminister,
      canExport: userCan(user, "poll:export"),
    };
  });
}

// ── Create / update ─────────────────────────────────────────────────────────

export async function createPoll(input: CreatePollInput) {
  return runAction(async () => {
    const user = await requirePermission("poll:manage");
    const data = createPollSchema.parse(input);

    const isSeatLock = data.kind === "seatlock";
    const questionType: QuestionType = isSeatLock
      ? "single"
      : data.questionType;
    if (data.closesAt && data.closesAt <= new Date()) {
      throw new AppError(
        "CLOSES_IN_PAST",
        "Closing time must be in the future.",
        400,
        "closesAt",
      );
    }

    const options =
      questionType === "yes_no"
        ? [
            { label: "Yes", description: null, capacity: null },
            { label: "No", description: null, capacity: null },
          ]
        : questionType === "short_answer"
          ? []
          : data.options.map((o) => ({
              ...o,
              capacity: isSeatLock ? (o.capacity ?? null) : null,
            }));

    const pollId = crypto.randomUUID();
    const insertPoll = db.insert(poll).values({
      id: pollId,
      creatorId: user.id,
      kind: data.kind,
      questionType,
      title: data.title,
      description: data.description,
      closesAt: data.closesAt,
      manageMode: data.manageMode,
      showResults: data.showResults,
      // SeatLock is never anonymous and a locked seat can't be changed.
      isAnonymous: isSeatLock ? false : data.isAnonymous,
      allowVoteChange: isSeatLock ? false : data.allowVoteChange,
    });

    if (options.length > 0) {
      await db.batch([
        insertPoll,
        db.insert(pollOption).values(
          options.map((o, i) => ({
            pollId,
            label: o.label,
            description: o.description ?? null,
            capacity: o.capacity,
            position: i,
          })),
        ),
      ]);
    } else {
      await insertPoll;
    }
    return { id: pollId };
  });
}

export async function updatePoll(input: UpdatePollInput) {
  return runAction(async () => {
    const data = updatePollSchema.parse(input);
    const { poll: row, canAdminister } = await requireManagedPoll(data.pollId);
    const isSeatLock = row.kind === "seatlock";

    if (
      data.manageMode !== undefined &&
      data.manageMode !== row.manageMode &&
      !canAdminister
    ) {
      throw new AppError(
        "FORBIDDEN",
        "Only the creator (or an admin) can change who manages this poll.",
        403,
      );
    }
    if (
      data.isAnonymous !== undefined &&
      data.isAnonymous !== row.isAnonymous
    ) {
      if (isSeatLock) {
        throw new AppError(
          "NOT_SUPPORTED",
          "SeatLock polls can't be anonymous.",
          400,
        );
      }
      // Never flip anonymity after people voted under the old promise.
      if ((await responseCount(row.id)) > 0) {
        throw new AppError(
          "ANONYMITY_LOCKED",
          "Anonymity can't be changed once people have responded.",
          400,
          "isAnonymous",
        );
      }
    }
    if (
      data.closesAt &&
      data.closesAt <= new Date() &&
      row.status !== "closed"
    ) {
      throw new AppError(
        "CLOSES_IN_PAST",
        "Closing time must be in the future.",
        400,
        "closesAt",
      );
    }

    const updates: Partial<typeof poll.$inferInsert> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.closesAt !== undefined) updates.closesAt = data.closesAt;
    if (data.manageMode !== undefined) updates.manageMode = data.manageMode;
    if (data.showResults !== undefined) updates.showResults = data.showResults;
    if (!isSeatLock && data.isAnonymous !== undefined)
      updates.isAnonymous = data.isAnonymous;
    if (!isSeatLock && data.allowVoteChange !== undefined)
      updates.allowVoteChange = data.allowVoteChange;

    if (Object.keys(updates).length > 0) {
      await db.update(poll).set(updates).where(eq(poll.id, row.id));
    }
    return { id: row.id };
  });
}

export async function setPollStatus(input: {
  pollId: string;
  status: "open" | "closed";
}) {
  return runAction(async () => {
    const data = setStatusSchema.parse(input);
    await closeExpiredPolls();
    const { poll: row } = await requireManagedPoll(data.pollId);

    if (data.status === "open") {
      if (row.status === "open") return { status: "open" };
      if (row.closesAt && row.closesAt <= new Date()) {
        throw new AppError(
          "CLOSES_IN_PAST",
          "The closing time has passed — set a new closing time (or clear it) before opening.",
          400,
          "closesAt",
        );
      }
      const active = row.options.filter((o) => o.status === "active");
      if (hasOptions(row.questionType as QuestionType)) {
        const min = row.kind === "seatlock" ? 1 : 2;
        if (active.length < min) {
          throw new AppError(
            "NOT_ENOUGH_OPTIONS",
            row.kind === "seatlock"
              ? "Add at least one active option before opening."
              : "Add at least two active options before opening.",
            400,
          );
        }
      }
      if (row.kind === "seatlock" && active.some((o) => !o.capacity)) {
        throw new AppError(
          "MISSING_CAPACITY",
          "Every option needs a seat count.",
          400,
        );
      }
      if (row.audienceMode === "group" && row.audienceRules.length === 0) {
        throw new AppError(
          "NO_AUDIENCE",
          "Pick the target batch before opening.",
          400,
        );
      }
      await db
        .update(poll)
        .set({
          status: "open",
          openedAt: row.openedAt ?? new Date(),
          closedAt: null,
        })
        .where(eq(poll.id, row.id));
    } else {
      if (row.status !== "open") {
        throw new AppError(
          "INVALID_TRANSITION",
          "Only an open poll can be closed.",
          400,
        );
      }
      await db
        .update(poll)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(poll.id, row.id));
    }

    await broadcastPollEvent(row.id, {
      event: "status",
      payload: { status: data.status },
    });
    return { status: data.status };
  });
}

export async function deletePoll(pollId: string) {
  return runAction(async () => {
    const { user, poll: row } = await requireManagedPoll(pollId, {
      administer: true,
    });
    const total = await responseCount(row.id);
    // Responses first: poll_response_option.option_id RESTRICTs option
    // deletion, so removing responses up front avoids cascade-order hazards.
    await db.batch([
      db.delete(pollResponse).where(eq(pollResponse.pollId, row.id)),
      db.delete(poll).where(eq(poll.id, row.id)),
      auditInsert({
        actorId: user.id,
        action: "poll.delete",
        targetType: "poll",
        targetId: row.id,
        details: { kind: row.kind, responses: total },
      }),
    ]);
    return { deleted: true };
  });
}

// ── Options ─────────────────────────────────────────────────────────────────

async function assertOptionsEditable(row: {
  id: string;
  kind: string;
  status: string;
}) {
  if (row.status === "closed") {
    throw new AppError(
      "POLL_CLOSED",
      "Options can't be changed on a closed poll.",
      400,
    );
  }
  if (row.kind === "quick" && (await responseCount(row.id)) > 0) {
    throw new AppError(
      "OPTIONS_LOCKED",
      "Options are locked once people have started voting.",
      400,
    );
  }
}

export async function addOption(input: {
  pollId: string;
  label: string;
  description?: string | null;
  capacity?: number | null;
}) {
  return runAction(async () => {
    const data = addOptionSchema.parse(input);
    const { poll: row } = await requireManagedPoll(data.pollId);
    if (
      !hasOptions(row.questionType as QuestionType) ||
      row.questionType === "yes_no"
    ) {
      throw new AppError(
        "NOT_SUPPORTED",
        "This poll type has fixed options.",
        400,
      );
    }
    await assertOptionsEditable(row);
    if (row.kind === "seatlock" && !data.capacity) {
      throw new AppError(
        "MISSING_CAPACITY",
        "Set how many seats this option has.",
        400,
        "capacity",
      );
    }
    const nextPosition = row.options.length
      ? Math.max(...row.options.map((o) => o.position)) + 1
      : 0;
    const [created] = await db
      .insert(pollOption)
      .values({
        pollId: row.id,
        label: data.label,
        description: data.description,
        capacity: row.kind === "seatlock" ? (data.capacity ?? null) : null,
        position: nextPosition,
      })
      .returning();
    if (row.kind === "seatlock") await broadcastSeats(row.id);
    return toOptionDTO(created);
  });
}

export async function updateOption(input: {
  pollId: string;
  optionId: string;
  label?: string;
  description?: string | null;
  capacity?: number;
  status?: "active" | "archived";
}) {
  return runAction(async () => {
    const data = updateOptionSchema.parse(input);
    const { poll: row } = await requireManagedPoll(data.pollId);
    const option = row.options.find((o) => o.id === data.optionId);
    if (!option)
      throw new AppError("OPTION_NOT_FOUND", "Option not found.", 404);

    if (row.kind === "quick") {
      if (row.questionType === "yes_no") {
        throw new AppError("NOT_SUPPORTED", "Yes / No options are fixed.", 400);
      }
      await assertOptionsEditable(row);
    } else if (row.status === "closed") {
      throw new AppError(
        "POLL_CLOSED",
        "Options can't be changed on a closed poll.",
        400,
      );
    }

    if (data.capacity !== undefined) {
      if (row.kind !== "seatlock") {
        throw new AppError(
          "NOT_SUPPORTED",
          "Only SeatLock options have seats.",
          400,
        );
      }
      if (data.capacity < option.seatsTaken) {
        throw new AppError(
          "CAPACITY_BELOW_TAKEN",
          `Seats can't go below the ${option.seatsTaken} already locked.`,
          400,
          "capacity",
        );
      }
    }

    const updates: Partial<typeof pollOption.$inferInsert> = {};
    if (data.label !== undefined) updates.label = data.label;
    if (data.description !== undefined) updates.description = data.description;
    if (data.capacity !== undefined) updates.capacity = data.capacity;
    if (data.status !== undefined) updates.status = data.status;
    const [updated] = await db
      .update(pollOption)
      .set(updates)
      .where(eq(pollOption.id, option.id))
      .returning();
    if (row.kind === "seatlock") await broadcastSeats(row.id);
    return toOptionDTO(updated);
  });
}

export async function deleteOption(input: {
  pollId: string;
  optionId: string;
}) {
  return runAction(async () => {
    const { poll: row } = await requireManagedPoll(input.pollId);
    const option = row.options.find((o) => o.id === input.optionId);
    if (!option)
      throw new AppError("OPTION_NOT_FOUND", "Option not found.", 404);
    if (row.questionType === "yes_no") {
      throw new AppError("NOT_SUPPORTED", "Yes / No options are fixed.", 400);
    }
    await assertOptionsEditable(row);
    const [{ value }] = await db
      .select({ value: count() })
      .from(pollResponseOption)
      .where(eq(pollResponseOption.optionId, option.id));
    if (value > 0) {
      throw new AppError(
        "OPTION_HAS_RESPONSES",
        "This option already has responses — archive it instead.",
        400,
      );
    }
    await db.delete(pollOption).where(eq(pollOption.id, option.id));
    if (row.kind === "seatlock") await broadcastSeats(row.id);
    return { deleted: true };
  });
}

export async function moveOption(input: {
  pollId: string;
  optionId: string;
  direction: "up" | "down";
}) {
  return runAction(async () => {
    const data = moveOptionSchema.parse(input);
    const { poll: row } = await requireManagedPoll(data.pollId);
    if (row.kind === "quick") await assertOptionsEditable(row);
    const sorted = [...row.options].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((o) => o.id === data.optionId);
    const swapWith = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= sorted.length)
      return { moved: false };
    const a = sorted[index];
    const b = sorted[swapWith];
    // Park `a` on a free position first — unique(poll_id, position).
    await db.batch([
      db
        .update(pollOption)
        .set({ position: -1 - a.position })
        .where(eq(pollOption.id, a.id)),
      db
        .update(pollOption)
        .set({ position: a.position })
        .where(eq(pollOption.id, b.id)),
      db
        .update(pollOption)
        .set({ position: b.position })
        .where(eq(pollOption.id, a.id)),
    ]);
    return { moved: true };
  });
}

// ── Audience ────────────────────────────────────────────────────────────────

export async function setAudience(input: SetAudienceInput) {
  return runAction(async () => {
    const data = setAudienceSchema.parse(input);
    const { poll: row } = await requireManagedPoll(data.pollId);
    if (row.status === "closed") {
      throw new AppError(
        "POLL_CLOSED",
        "The audience of a closed poll can't change — use late-access grants instead.",
        400,
      );
    }

    const ids = [
      ...new Set(
        data.mode === "custom" ? data.studentIds : data.excludedStudentIds,
      ),
    ];
    if (data.mode !== "all" && ids.length > 0) {
      const found = await db
        .select({ id: student.id })
        .from(student)
        .where(inArray(student.id, ids));
      if (found.length !== ids.length) {
        throw new AppError(
          "STUDENT_NOT_FOUND",
          "Some selected students no longer exist.",
          400,
        );
      }
    }

    const statements = [
      db.delete(pollAudienceRule).where(eq(pollAudienceRule.pollId, row.id)),
      db
        .delete(pollAudienceMember)
        .where(eq(pollAudienceMember.pollId, row.id)),
      db
        .delete(pollAudienceExclusion)
        .where(eq(pollAudienceExclusion.pollId, row.id)),
      db
        .update(poll)
        .set({ audienceMode: data.mode })
        .where(eq(poll.id, row.id)),
    ] as const;

    const extra = [];
    if (data.mode === "group") {
      extra.push(
        db.insert(pollAudienceRule).values({
          pollId: row.id,
          batch: data.batch!,
          section: data.section ? data.section.toUpperCase() : null,
        }),
      );
      if (ids.length) {
        extra.push(
          db
            .insert(pollAudienceExclusion)
            .values(ids.map((studentId) => ({ pollId: row.id, studentId }))),
        );
      }
    } else if (data.mode === "custom") {
      extra.push(
        db
          .insert(pollAudienceMember)
          .values(ids.map((studentId) => ({ pollId: row.id, studentId }))),
      );
    }

    await db.batch([...statements, ...extra]);
    return { mode: data.mode };
  });
}

// ── Results & responses ─────────────────────────────────────────────────────

export async function getManagerResults(pollId: string) {
  return runAction(async () => {
    const { poll: row } = await requireManagedPoll(pollId);
    return computeResults(row, row.options);
  });
}

export interface ManagerResponseRow {
  id: string;
  /** null for anonymous polls — identity never leaves the server. */
  name: string | null;
  usn: string | null;
  batch: string | null;
  section: string | null;
  choices: string[];
  textAnswer: string | null;
  viaGrant: boolean;
  submittedAt: string;
}

async function loadResponses(
  row: { id: string; isAnonymous: boolean },
  optionLabels: Map<string, string>,
) {
  const rows = await db.query.pollResponse.findMany({
    where: eq(pollResponse.pollId, row.id),
    orderBy: desc(pollResponse.submittedAt),
    with: {
      options: { columns: { optionId: true } },
      user: { columns: { name: true } },
    },
  });
  return rows.map((r): ManagerResponseRow => ({
    id: r.id,
    name: row.isAnonymous ? null : (r.studentName ?? r.user?.name ?? "Unknown"),
    usn: row.isAnonymous ? null : r.studentUsn,
    batch: row.isAnonymous ? null : r.studentBatch,
    section: row.isAnonymous ? null : r.studentSection,
    choices: r.options.map((o) => optionLabels.get(o.optionId) ?? "—"),
    textAnswer: r.textAnswer,
    viaGrant: !!r.reopenGrantId,
    submittedAt: r.submittedAt.toISOString(),
  }));
}

export async function listResponses(pollId: string) {
  return runAction(async () => {
    const { poll: row } = await requireManagedPoll(pollId);
    const labels = new Map(row.options.map((o) => [o.id, o.label]));
    return {
      anonymous: row.isAnonymous,
      rows: await loadResponses(row, labels),
    };
  });
}

/** Roster students in the audience who haven't responded yet. */
async function nonResponderStudents(row: {
  id: string;
  audienceMode: string;
  audienceRules: { batch: string; section: string | null }[];
}) {
  let audience: (typeof student.$inferSelect)[] = [];
  if (row.audienceMode === "all") {
    audience = await db.select().from(student);
  } else if (row.audienceMode === "group") {
    const rule = row.audienceRules[0];
    if (!rule) return [];
    const excluded = await db
      .select({ id: pollAudienceExclusion.studentId })
      .from(pollAudienceExclusion)
      .where(eq(pollAudienceExclusion.pollId, row.id));
    const excludedIds = new Set(excluded.map((e) => e.id));
    audience = (
      await db
        .select()
        .from(student)
        .where(
          rule.section
            ? and(
                eq(student.batch, rule.batch),
                eq(student.section, rule.section),
              )
            : eq(student.batch, rule.batch),
        )
    ).filter((s) => !excludedIds.has(s.id));
  } else {
    audience = (
      await db.query.pollAudienceMember.findMany({
        where: eq(pollAudienceMember.pollId, row.id),
        with: { student: true },
      })
    ).map((m) => m.student);
  }

  const responders = await db
    .select({ email: userTable.email })
    .from(pollResponse)
    .innerJoin(userTable, eq(userTable.id, pollResponse.userId))
    .where(eq(pollResponse.pollId, row.id));
  const responded = new Set(responders.map((r) => r.email.toLowerCase()));
  return audience
    .filter((s) => !responded.has(s.email.toLowerCase()))
    .sort((a, b) => a.usn.localeCompare(b.usn));
}

export async function listNonResponders(pollId: string) {
  return runAction(async (): Promise<StudentLite[]> => {
    const { poll: row } = await requireManagedPoll(pollId);
    return (await nonResponderStudents(row)).map(toStudentLite);
  });
}

export async function exportResponsesCsv(pollId: string) {
  return runAction(async () => {
    const { user, poll: row } = await requireManagedPoll(pollId);
    if (!userCan(user, "poll:export")) {
      throw new AppError(
        "FORBIDDEN",
        "You don't have permission to export responses.",
        403,
      );
    }
    const labels = new Map(row.options.map((o) => [o.id, o.label]));
    const rows = await loadResponses(row, labels);

    const header = row.isAnonymous
      ? ["Choice(s)", "Answer", "Submitted at"]
      : [
          "Name",
          "USN",
          "Batch",
          "Section",
          "Choice(s)",
          "Answer",
          "Late access",
          "Submitted at",
        ];
    const body = rows.map((r) =>
      row.isAnonymous
        ? [r.choices.join("; "), r.textAnswer, r.submittedAt]
        : [
            r.name,
            r.usn,
            r.batch,
            r.section,
            r.choices.join("; "),
            r.textAnswer,
            r.viaGrant ? "yes" : "",
            r.submittedAt,
          ],
    );

    await recordAudit({
      actorId: user.id,
      action: "poll.export",
      targetType: "poll",
      targetId: row.id,
      details: { rows: rows.length, anonymous: row.isAnonymous },
    });

    const slug =
      row.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40) || "poll";
    return { filename: `${slug}-responses.csv`, csv: toCsv(header, body) };
  });
}
