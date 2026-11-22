// Pure poll rules — no database or session access, so they can be unit
// tested directly (scripts/test-polls-rbac-logic.ts). core.ts loads the data
// and re-exports these.
import type { User } from "@/types";

import type { PollAudienceRuleRow, PollRow, StudentRow } from "./types";

export interface StudentContext {
  user: User;
  student: StudentRow | null;
  memberPollIds: Set<string>;
  excludedPollIds: Set<string>;
  /** pollId → active reopen grant id */
  grants: Map<string, string>;
  /** pollId → the user's response */
  responses: Map<
    string,
    {
      id: string;
      textAnswer: string | null;
      submittedAt: Date;
      optionIds: string[];
    }
  >;
}

/** Whether the user is in the poll's target audience (ignores grants). */
export function inAudience(
  row: Pick<PollRow, "id" | "audienceMode">,
  rule: Pick<PollAudienceRuleRow, "batch" | "section"> | null | undefined,
  ctx: Pick<StudentContext, "student" | "memberPollIds" | "excludedPollIds">,
): boolean {
  if (row.audienceMode === "all") return true;
  if (!ctx.student) return false;
  if (row.audienceMode === "group") {
    if (!rule) return false;
    const matches =
      rule.batch === ctx.student.batch &&
      (rule.section === null || rule.section === ctx.student.section);
    return matches && !ctx.excludedPollIds.has(row.id);
  }
  return ctx.memberPollIds.has(row.id);
}

export interface StudentPollState {
  visible: boolean;
  canRespond: boolean;
  blockedReason: string | null;
  viaGrant: boolean;
  grantId: string | null;
}

/** Decides what a student may see and do with a poll. */
export function studentPollState(
  row: Pick<
    PollRow,
    "id" | "status" | "audienceMode" | "kind" | "allowVoteChange"
  >,
  rule: Pick<PollAudienceRuleRow, "batch" | "section"> | null | undefined,
  ctx: Pick<
    StudentContext,
    "student" | "memberPollIds" | "excludedPollIds" | "grants" | "responses"
  >,
): StudentPollState {
  const hidden: StudentPollState = {
    visible: false,
    canRespond: false,
    blockedReason: null,
    viaGrant: false,
    grantId: null,
  };
  // Drafts are never visible to students.
  if (row.status === "draft") return hidden;

  const eligible = inAudience(row, rule, ctx);
  const grantId = ctx.grants.get(row.id) ?? null;
  const responded = ctx.responses.has(row.id);

  // Outside the audience, no grant, never answered → the poll doesn't exist
  // as far as this student is concerned.
  if (!eligible && !grantId && !responded) return hidden;

  const isOpen = row.status === "open";
  const canChange = row.kind === "quick" && row.allowVoteChange;

  // A grant admits a student who otherwise couldn't respond (closed poll or
  // outside the audience) — once, never to change an existing answer.
  const needsGrant = !isOpen || !eligible;

  let canRespond: boolean;
  let blockedReason: string | null = null;
  if (needsGrant) {
    canRespond = !!grantId && !responded;
    if (!canRespond) {
      blockedReason = responded
        ? "You've already responded."
        : "This poll is closed.";
    }
  } else if (responded) {
    canRespond = canChange;
    if (!canRespond) {
      blockedReason =
        row.kind === "seatlock"
          ? "Your seat is locked."
          : "You've already responded.";
    }
  } else {
    canRespond = true;
  }

  return {
    visible: true,
    canRespond,
    blockedReason,
    viaGrant: needsGrant && !!grantId && !responded,
    grantId: needsGrant ? grantId : null,
  };
}

// ── CSV helpers ─────────────────────────────────────────────────────────────

/** RFC 4180 quoting + spreadsheet formula-injection guard. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
